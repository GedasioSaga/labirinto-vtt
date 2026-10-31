import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { AcoesDaVez } from '../../lib/batalha/acoes'
import type { AcaoDaForma, PedidoDeAcao } from '../../lib/batalha/combate'
import { armazemDoAparelho, gravarEscolhaDaImagem, lerEscolhaDaImagem } from '../../lib/batalha/escolhaDaImagem'
import { motivoDaForma, type FormaNoMenu } from '../../lib/batalha/transformacao'
import { formatarNumero, textoDaAcao, type PipDaVez } from './dadosDoMenu'
import { CabecaDaVez, Tira, andarComSetas, semRolarDeLado } from './ListaDeTecnicas'
import './batalha.css'
import './combate.css'

/**
 * A TIRA TRANSFORMAÇÃO aberta (F3, fatia T; seção 5.2 do plano): uma tira por
 * forma da ficha (as abas que ligam), no padrão das tiras da Habilidades.
 * Escolher a tira abre o PAINEL DA FORMA, em papel como a mira: a descrição, a
 * prévia dos números ("FOR 160 → 220"), as técnicas que a forma traz, e:
 *  - forma desligada: a ação em 3 botões (a da ficha marcada), a caixa
 *    "Trocar a imagem do token e do retrato" (só com imagem; lembrada no
 *    aparelho por personagem) e Ativar, apagado com o motivo;
 *  - forma ligada: "Desfazer a forma · ação livre".
 *
 * O painel serve também ao mestre, na vez do NPC (`PainelDaVezDoNpc`).
 *
 * Teclado: setas andam, Enter ou seta para a direita abrem o painel, Esc ou
 * seta para a esquerda voltam; no painel, Enter ativa e Esc volta à lista.
 */

const ACOES_DA_FORMA: readonly AcaoDaForma[] = ['simples', 'completa', 'bonus']

export function nomeDaForma(forma: FormaNoMenu): string {
  return forma.cartao.nome.trim() || 'Forma sem nome'
}

function descricaoDaForma(forma: FormaNoMenu): string {
  return (forma.cartao.campos.descricao ?? forma.cartao.campos.efeito ?? '').trim()
}

export interface PainelDaFormaProps {
  forma: FormaNoMenu
  /** `null` = sem a economia à vista (o motivo vem só da forma). */
  acoes: AcoesDaVez | null
  /** Lembra "trocar a imagem" por personagem no aparelho. */
  personagemId: string | null
  /** `false` = não saiu (o painel fica, com o aviso). */
  onAtivar: (acao: AcaoDaForma, trocarImagem: boolean) => boolean
  onDesfazer: () => boolean
  /** Ausente = sem Voltar (o painel do NPC não tem para onde voltar). */
  onVoltar?: () => void
  /** Esperando o host: os botões ficam parados. */
  esperando?: boolean
  /** O painel do mestre mora sobre o escuro da aba Batalha. */
  className?: string
}

/** O painel de uma forma: a leitura, a prévia e Ativar ou Desfazer. */
export function PainelDaForma({ forma, acoes, personagemId, onAtivar, onDesfazer, onVoltar, esperando, className }: PainelDaFormaProps) {
  const idBase = useId()
  const [acao, setAcao] = useState<AcaoDaForma>(forma.acaoDaFicha)
  const [trocar, setTrocar] = useState(() => lerEscolhaDaImagem(armazemDoAparelho(), personagemId))
  const [erro, setErro] = useState<string | null>(null)
  const nome = nomeDaForma(forma)
  const descricao = descricaoDaForma(forma)
  const motivo = forma.ligada ? null : motivoDaForma(forma, acao, acoes)
  const comImagem = forma.imagem !== null

  const ativar = (evento?: FormEvent) => {
    evento?.preventDefault()
    if (esperando) return
    if (forma.ligada) {
      setErro(onDesfazer() ? null : 'Não desfez: sem conexão com o mestre, ou a forma já foi desligada.')
      return
    }
    if (motivo !== null) {
      setErro(motivo)
      return
    }
    const saiu = onAtivar(acao, comImagem && trocar)
    if (saiu && comImagem) gravarEscolhaDaImagem(armazemDoAparelho(), personagemId, trocar)
    setErro(saiu ? null : 'Não ativou: sem conexão com o mestre, ou a vez já passou. Tente de novo.')
  }

  const teclar = (evento: KeyboardEvent<HTMLFormElement>) => {
    if (evento.key !== 'Escape' || onVoltar === undefined) return
    evento.preventDefault()
    evento.stopPropagation()
    onVoltar()
  }

  const classe = ['bt-mira', 'bt-papel', 'bt-forma', className].filter(Boolean).join(' ')
  return (
    <form className={classe} onSubmit={ativar} onKeyDown={teclar} aria-labelledby={`${idBase}-nome`} noValidate>
      <p className="bt-mira__rot bt-forma__rot">{forma.ligada ? 'Transformação · ativa' : 'Transformação'}</p>
      <h3 className="bt-mira__nome" id={`${idBase}-nome`}>
        {nome}
      </h3>
      {descricao !== '' && <p className="bt-forma__texto">{descricao}</p>}
      {forma.numeros.length > 0 && (
        <dl className="bt-forma__numeros" aria-label={forma.ligada ? 'O que a forma mudou' : 'O que muda ao ativar'}>
          {forma.numeros.map((numero, i) => (
            <div key={`${i}:${numero.rotulo}`}>
              <dt>{numero.rotulo}</dt>
              <dd>
                {formatarNumero(numero.de)} <span aria-hidden="true">→</span>
                <span className="bt-sr"> vai para </span> <b>{formatarNumero(numero.para)}</b>
                {numero.nota !== undefined && numero.nota !== '' && <small> {numero.nota}</small>}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {forma.tecnicas.length > 0 && (
        <p className="bt-forma__tecnicas">
          <span>Técnicas da forma</span> {forma.tecnicas.join(', ')}
          <small>{forma.ligada ? ' · já estão em Habilidades' : ' · entram em Habilidades quando ativa'}</small>
        </p>
      )}
      {!forma.ligada && (
        <fieldset className="bt-forma__acoes">
          <legend>Ação para ativar</legend>
          {ACOES_DA_FORMA.map((opcao) => (
            <label key={opcao} className="bt-forma__acao">
              <input
                type="radio"
                name={`${idBase}-acao`}
                value={opcao}
                checked={acao === opcao}
                onChange={() => {
                  setErro(null)
                  setAcao(opcao)
                }}
              />
              <span>
                {textoDaAcao(opcao)}
                {opcao === forma.acaoDaFicha && <small>da ficha</small>}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {!forma.ligada && comImagem && (
        <label className="bt-chave">
          <input type="checkbox" role="switch" checked={trocar} onChange={(evento) => setTrocar(evento.target.checked)} />
          <span className="bt-chave__trilho" aria-hidden="true" />
          Trocar a imagem do token e do retrato <small>só nesta batalha</small>
        </label>
      )}
      {motivo !== null && (
        <p className="bt-mira__nota bt-forma__motivo" id={`${idBase}-motivo`}>
          {motivo}
        </p>
      )}
      {erro !== null && erro !== motivo && (
        <p className="bt-mira__erro" role="alert">
          {erro}
        </p>
      )}
      <div className="bt-pendente__acoes">
        <button
          type="submit"
          className={forma.ligada ? 'bt-botao' : 'bt-botao bt-botao--forma'}
          disabled={esperando || motivo !== null}
          aria-describedby={motivo === null ? undefined : `${idBase}-motivo`}
        >
          {forma.ligada ? 'Desfazer a forma · ação livre' : `Ativar · ${textoDaAcao(acao)}`} <kbd>Enter</kbd>
        </button>
        {onVoltar !== undefined && (
          <button type="button" className="bt-botao" onClick={onVoltar}>
            Voltar <kbd>Esc</kbd>
          </button>
        )}
      </div>
    </form>
  )
}

export interface ListaDeFormasProps {
  pips: readonly PipDaVez[] | null
  carga: number
  formas: readonly FormaNoMenu[]
  acoes: AcoesDaVez | null
  personagemId: string | null
  /** Aberta pelo teclado: as tiras entram na hora. */
  instantaneo?: boolean
  esperando?: boolean
  /** O pedido saiu? */
  onAgir: (pedido: PedidoDeAcao) => boolean
  /** Ativou ou desfez: o menu volta ao começo. */
  onFeito: () => void
  onVoltar: () => void
}

export function ListaDeFormas({ pips, carga, formas, acoes, personagemId, instantaneo, esperando, onAgir, onFeito, onVoltar }: ListaDeFormasProps) {
  const tiras = useRef<(HTMLButtonElement | null)[]>([])
  const [atual, setAtual] = useState(0)
  const [aberta, setAberta] = useState<string | null>(null)
  const [porTeclado, setPorTeclado] = useState(Boolean(instantaneo))
  tiras.current.length = formas.length
  const forma = aberta === null ? undefined : formas.find((candidata) => candidata.cartao.id === aberta)

  // Voltando do painel, o foco volta à tira da forma que estava aberta.
  const voltarDoPainel = useRef(false)
  useEffect(() => {
    if (aberta !== null || !voltarDoPainel.current) return
    voltarDoPainel.current = false
    tiras.current[atual]?.focus()
    // Só a troca de tela devolve o foco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta])

  if (forma !== undefined) {
    const cartaoId = forma.cartao.id
    return (
      <div className="bt-vez bt-vez--lista" data-instantaneo="sim">
        <CabecaDaVez quem="Transformação" pips={pips} carga={carga} />
        <PainelDaForma
          key={cartaoId}
          forma={forma}
          acoes={acoes}
          personagemId={personagemId}
          esperando={esperando}
          onAtivar={(acao, trocarImagem) => {
            const saiu = onAgir({ tipo: 'transformar', cartaoId, acao, trocarImagem })
            if (saiu) onFeito()
            return saiu
          }}
          onDesfazer={() => {
            const saiu = onAgir({ tipo: 'destransformar', cartaoId })
            if (saiu) onFeito()
            return saiu
          }}
          onVoltar={() => {
            voltarDoPainel.current = true
            setPorTeclado(true)
            setAberta(null)
          }}
        />
      </div>
    )
  }

  const abrir = (indice: number) => {
    const escolhida = formas[indice]
    if (escolhida === undefined || esperando) return
    setAtual(indice)
    setAberta(escolhida.cartao.id)
  }

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (andarComSetas(evento, tiras.current, atual)) return
    if (evento.key === 'ArrowRight') {
      evento.preventDefault()
      abrir(atual)
      return
    }
    if (evento.key === 'Escape' || evento.key === 'ArrowLeft') {
      evento.preventDefault()
      evento.stopPropagation()
      onVoltar()
    }
  }

  return (
    <div className="bt-vez bt-vez--lista" data-instantaneo={porTeclado ? 'sim' : 'nao'} onKeyDown={teclar}>
      <CabecaDaVez quem="Transformação" pips={pips} carga={carga} />
      {formas.length === 0 ? (
        <p className="bt-vez__aviso">Nenhuma transformação na ficha.</p>
      ) : (
        <ul className="bt-vez__tiras" aria-label="Transformações" onScroll={semRolarDeLado}>
          {formas.map((item, indice) => (
            <li key={item.cartao.id}>
              <Tira
                indice={indice}
                chave={`forma:${item.cartao.id}`}
                nome={nomeDaForma(item)}
                lado={item.ligada ? 'ATIVA' : textoDaAcao(item.acaoDaFicha)}
                detalhe={item.ligada ? 'Ativa: escolha para desfazer (ação livre)' : descricaoDaForma(item) || null}
                chips={
                  <>
                    {item.ligada && <span className="bt-etq bt-etq--forma">Ativa</span>}
                    {item.numeros.length > 0 && <span className="bt-etq">{item.numeros.length === 1 ? 'Muda 1 número' : `Muda ${item.numeros.length} números`}</span>}
                    {item.tecnicas.length > 0 && <span className="bt-etq bt-etq--forma">{item.tecnicas.length === 1 ? '1 técnica' : `${item.tecnicas.length} técnicas`}</span>}
                    {item.imagem !== null && <span className="bt-etq">Imagem própria</span>}
                  </>
                }
                forma
                esta={atual === indice}
                onFoco={() => setAtual(indice)}
                onApontar={() => setAtual(indice)}
                onEscolher={() => abrir(indice)}
                refDaTira={(elemento) => {
                  tiras.current[indice] = elemento
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <p className="bt-vez__dica">
        <kbd>↑</kbd> <kbd>↓</kbd> escolhe · <kbd>Enter</kbd> abre · <kbd>Esc</kbd> volta
      </p>
      <div className="bt-vez__rodape">
        <button type="button" className="bt-botao bt-botao--p" onClick={onVoltar}>
          Voltar
        </button>
      </div>
    </div>
  )
}
