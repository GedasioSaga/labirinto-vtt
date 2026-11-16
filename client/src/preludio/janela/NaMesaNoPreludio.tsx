import { useEffect, useId, useState } from 'react'
import type { Forma, Secao, Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import { cancelarPorNoMapa, lerAgoraNaMesa, mostrarNoMapa, porNoMapa, useMesaNaJanela } from './mesaNaJanela'
import type { ItemNaMesa, TipoParaOMapa } from './protocolo'
import './janela.css'

/**
 * "PÔR NO MAPA" E "NA MESA" (P3 do estudo de 15/11), dentro do Prelúdio em
 * janela própria: cada seção comum de um verbete pode virar um pino ligado no
 * mapa ("!" para ler, "?" para dizer), e a lista "Na mesa" diz onde cada
 * verbete já está. Fora da janela (a tela do Prelúdio dentro da principal),
 * nada disto aparece: o mapa está por baixo, sem lugar para o clique.
 *
 * Seção de segredo não tem "Pôr no mapa" (o motivo fica escrito). Se a seção
 * já está no mapa e vira segredo, o aviso diz que o jogador passa a ler
 * "Texto indisponível.".
 */

const ROTULO_DO_TIPO: Record<ItemNaMesa['kind'], string> = { exclamacao: 'Cenário !', interrogacao: 'Fala ou pista ?', outro: 'Pino' }
const SIMBOLO: Record<ItemNaMesa['kind'], string> = { exclamacao: '!', interrogacao: '?', outro: '•' }

const OPCOES: readonly { readonly kind: TipoParaOMapa; readonly rotulo: string; readonly sub: string }[] = [
  { kind: 'exclamacao', rotulo: '! Como cenário', sub: 'O jogador lê este texto ao tocar no pino.' },
  { kind: 'interrogacao', rotulo: '? Como fala ou pista', sub: 'O jogador lê ao tocar, como o "?" de hoje.' },
]

/** Os itens do mapa aberto ligados a esta seção (ou a qualquer seção do verbete, sem `secaoId`). */
function useItensDe(verbeteId: string, secaoId?: string): readonly ItemNaMesa[] {
  const naMesa = useMesaNaJanela((estado) => estado.naMesa)
  return naMesa.filter((item) => item.verbeteId === verbeteId && (secaoId === undefined || item.secaoId === secaoId))
}

function ondeEsta(item: ItemNaMesa): string {
  return item.cena === '' ? 'No mapa aberto' : `Em ${item.cena}`
}

/** Esc em qualquer lugar da janela desiste do "Pôr no mapa" em curso. */
function useEscCancela(ativo: boolean): void {
  useEffect(() => {
    if (!ativo) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') cancelarPorNoMapa()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [ativo])
}

interface PorNoMapaProps {
  verbete: Verbete
  forma: Forma
  secao: Secao
  /** No cartão do quadro: só o botão e as escolhas, sem o texto de ajuda. */
  compacto?: boolean
}

/** O "Pôr no mapa" de uma seção, as fichas "No mapa" dela e o aviso de segredo. */
export function PorNoMapaDaSecao({ verbete, forma, secao, compacto = false }: PorNoMapaProps) {
  const ligada = useMesaNaJanela((estado) => estado.ligada)
  const viva = useMesaNaJanela((estado) => estado.viva)
  const pondo = useMesaNaJanela((estado) => estado.pondo)
  const aviso = useMesaNaJanela((estado) => estado.avisoDoPor)
  const itens = useItensDe(verbete.id, secao.id)
  const [escolhendo, setEscolhendo] = useState(false)
  const idDasEscolhas = useId()
  const minha = pondo !== null && pondo.fonte.verbeteId === verbete.id && pondo.fonte.formaId === forma.id && pondo.fonte.secaoId === secao.id
  useEscCancela(minha)
  // Fora da janela, ou num verbete que nunca vai ao jogador (a sessão), não há o que pôr no mapa.
  if (!ligada || verbete.tipo === 'sessao') return null
  const fonte = { verbeteId: verbete.id, formaId: forma.id, secaoId: secao.id }
  return (
    <div className={`pr-por${compacto ? ' pr-por--compacto' : ''}`} onPointerDown={(evento) => evento.stopPropagation()}>
      {secao.segredo ? (
        <button type="button" className="gr-bt gr-bt--latao gr-bt--p" disabled title="Seção de segredo não vai ao mapa.">
          Pôr no mapa
        </button>
      ) : (
        <button
          type="button"
          className="gr-bt gr-bt--latao gr-bt--p"
          aria-expanded={escolhendo}
          aria-controls={idDasEscolhas}
          disabled={!viva}
          title={viva ? 'Põe esta seção no mapa: o pino aponta para cá, e o texto continua morando aqui.' : 'A janela do mapa não está respondendo.'}
          onClick={() => setEscolhendo((antes) => !antes)}
        >
          Pôr no mapa
        </button>
      )}
      {secao.segredo && !compacto && <span className="pr-por__motivo">Segredo não vai ao mapa.</span>}
      {escolhendo && !secao.segredo && (
        <div id={idDasEscolhas} className="pr-por__escolhas" role="group" aria-label="Como pôr no mapa">
          {OPCOES.map((opcao) => (
            <button
              key={opcao.kind}
              type="button"
              className="gr-bt gr-bt--fantasma gr-bt--p"
              title={opcao.sub}
              onClick={() => {
                setEscolhendo(false)
                void porNoMapa(fonte, opcao.kind)
              }}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      )}
      {itens.map((item) => (
        <button key={item.pinoId} type="button" className="pr-chip pr-por__chip" title="Mostrar no mapa" onClick={() => mostrarNoMapa(item)}>
          <span aria-hidden="true">{SIMBOLO[item.kind]}</span> No mapa: {item.cena === '' ? item.nome : item.cena}
        </button>
      ))}
      {minha && (
        <div className="pr-por__espera" role="status">
          <span>{pondo.andamento === 'pedindo' ? 'Pedindo à janela do mapa…' : 'Clique no mapa, na janela principal, onde fica esta seção. Esc cancela.'}</span>
          <button type="button" className="gr-bt gr-bt--fantasma gr-bt--p" onClick={cancelarPorNoMapa}>
            Cancelar
          </button>
        </div>
      )}
      {secao.segredo && itens.length > 0 && (
        <p className="pr-aviso pr-por__aviso" role="note">
          Esta seção está no mapa e virou segredo: o jogador passa a ler "Texto indisponível.". Tire o segredo ou desligue o pino no mapa.
        </p>
      )}
      {aviso !== null && pondo === null && !compacto && itens.length === 0 && (
        <p className="pr-aviso pr-por__aviso" role="alert">
          {aviso}
        </p>
      )}
    </div>
  )
}

function LinhaNaMesa({ item, comVerbete }: { item: ItemNaMesa; comVerbete: boolean }) {
  const verbete = usePreludio((estado) => estado.verbetes.get(item.verbeteId))
  const secao = verbete?.formas.find((forma) => forma.id === item.formaId)?.secoes.find((uma) => uma.id === item.secaoId)
  const nomeDaSecao = secao === undefined ? 'seção apagada' : secao.titulo || 'seção sem título'
  const onde = `${comVerbete ? `${verbete?.titulo || 'Verbete apagado'} › ` : ''}${nomeDaSecao}. ${ondeEsta(item)}.`
  return (
    <li className="pr-na-mesa__item">
      <span className="pr-na-mesa__sim" aria-hidden="true">
        {SIMBOLO[item.kind]}
      </span>
      <span className="pr-na-mesa__onde">
        <b>
          {ROTULO_DO_TIPO[item.kind]} {item.nome}
        </b>
        <small>{onde}</small>
        {secao?.segredo === true && <small className="pr-na-mesa__alerta">Virou segredo: o jogador lê "Texto indisponível."</small>}
      </span>
      <span className="pr-na-mesa__acoes">
        {item.kind === 'exclamacao' && (
          <button type="button" className="gr-bt gr-bt--primario gr-bt--p" title="A revelação abre na tela de todos da cena do pino" onClick={() => lerAgoraNaMesa(item)}>
            Ler agora
          </button>
        )}
        <button type="button" className="gr-bt gr-bt--latao gr-bt--p" onClick={() => mostrarNoMapa(item)}>
          Mostrar no mapa
        </button>
      </span>
    </li>
  )
}

/**
 * A lista "Na mesa": de um verbete (`verbeteId`) ou de tudo o que está no mapa
 * aberto (na sessão). Só na janela do Prelúdio.
 */
export function NaMesa({ verbeteId }: { verbeteId?: string }) {
  const ligada = useMesaNaJanela((estado) => estado.ligada)
  const naMesa = useMesaNaJanela((estado) => estado.naMesa)
  const titulo = useId()
  if (!ligada) return null
  const itens = verbeteId === undefined ? naMesa : naMesa.filter((item) => item.verbeteId === verbeteId)
  const n = itens.length
  return (
    <section className="pr-trilho__bloco pr-na-mesa" aria-labelledby={titulo}>
      <h3 id={titulo} className="pr-trilho__titulo">
        Na mesa <small>{n === 0 ? 'nada no mapa aberto' : n === 1 ? '1 coisa no mapa aberto' : `${n} coisas no mapa aberto`}</small>
      </h3>
      {n === 0 ? (
        <p className="pr-quieto">
          {verbeteId === undefined ? 'Nada do Prelúdio está no mapa aberto. Abra um verbete e use Pôr no mapa numa seção.' : 'Use Pôr no mapa numa seção abaixo. O pino aponta para cá, e o texto continua morando aqui.'}
        </p>
      ) : (
        <ul className="pr-na-mesa__lista">
          {itens.map((item) => (
            <LinhaNaMesa key={`${item.sceneId}\n${item.pinoId}`} item={item} comVerbete={verbeteId === undefined} />
          ))}
        </ul>
      )}
    </section>
  )
}

