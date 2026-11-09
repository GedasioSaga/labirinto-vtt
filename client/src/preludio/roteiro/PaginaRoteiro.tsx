import { memo, useEffect, useId, useMemo, useState } from 'react'
import { TituloDaPagina } from '../../components/livro/FolhaDoLivro'
import { formaDe } from '../../lib/preparo/enciclopedia'
import { paginasDaSessao, sessoesEmOrdem, type AlvoNaMesa } from '../../lib/preparo/sessoes'
import type { Campanha, LigaCena, Verbete } from '../../lib/preparo/tipos'
import { useAdventureStore } from '../../stores/adventureStore'
import { useToastStore } from '../../stores/toastStore'
import { usePreludio } from '../estado/preludio'
import { abrirFichaNaCena } from '../mesa/irParaAMesa'
import { useCatalogoDaMesa } from '../mesa/catalogo'
import { useRaizDaMidia } from '../midia'
import { useCampanhaDaRevelacao } from '../revelar/Revelar'
import { RevelarDaMencao, RevelarHoje } from '../sessoes/RevelarHoje'
import { temTexto, TextoDoRoteiro, type ContextoDoRoteiro } from './TextoDoRoteiro'
import '../preludio.css'
import '../sessoes/sessoes.css'
import './roteiro.css'

/**
 * A PÁGINA ROTEIRO (F4), no Livro do mestre do editor de mapas: a sessão mais
 * recente da campanha do mapa aberto (a pasta do mapa é a campanha), só para
 * leitura. Em cima, o "Revelar hoje" (Revelar e Ocultar valem na hora, como no
 * Prelúdio); embaixo, o roteiro com os links: cena e pino levam ao lugar,
 * ficha seleciona o boneco na cena, verbete citado abre o Revelar dele. Mudar
 * o roteiro é no Prelúdio.
 */

const SUB = 'Só leitura. O roteiro muda no Prelúdio, em Sessões.'

interface PaginaRoteiroProps {
  aoAbrirNaMesa: (alvo: LigaCena) => void
}

function avisar(texto: string): void {
  useToastStore.getState().push('error', texto)
}

/** O texto de uma sessão ou página: as seções da forma ativa, com o título de cada uma. */
function SecoesDe({ dono, contexto }: { dono: Verbete; contexto: ContextoDoRoteiro }) {
  const forma = formaDe(dono, null)
  const secoes = (forma?.secoes ?? []).filter((secao) => secao.titulo.trim() !== '' || temTexto(secao.texto))
  return (
    <>
      {secoes.map((secao) => (
        <section key={secao.id} className={secao.segredo ? 'pr-roteiro__secao pr-segredo' : 'pr-roteiro__secao'}>
          {secao.titulo.trim() !== '' && <h4 className="pr-roteiro__secao-nome">{secao.titulo}</h4>}
          <TextoDoRoteiro texto={secao.texto} contexto={contexto} />
        </section>
      ))}
    </>
  )
}

function temRoteiro(dono: Verbete): boolean {
  return (formaDe(dono, null)?.secoes ?? []).some((secao) => temTexto(secao.texto))
}

interface SessaoNoLivroProps {
  sessoes: readonly Verbete[]
  campanhas: readonly Campanha[]
  /** A lista mistura campanhas (o mapa não é da pasta de nenhuma): o nome leva a campanha. */
  comCampanha: boolean
  /** A campanha da pasta do mapa aberto: é nela que o Revelar vale, quando a sessão está nela. */
  campanhaDoMapa: string | null
  aoAbrirNaMesa: (alvo: LigaCena) => void
}

function SessaoNoLivro({ sessoes, campanhas, comCampanha, campanhaDoMapa, aoAbrirNaMesa }: SessaoNoLivroProps) {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const raiz = useRaizDaMidia()
  const tituloDoRevelar = useId()
  const tituloDoRoteiro = useId()
  // A mais recente, até o mestre escolher outra (vale enquanto o mapa está aberto).
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const sessao = sessoes.find((uma) => uma.id === escolhida) ?? sessoes[sessoes.length - 1]
  // Uma campanha só para o "Revelar hoje" e as menções: o Revelar da menção vale onde a lista vale.
  const campanha = useCampanhaDaRevelacao(sessao, campanhaDoMapa)
  const campanhaId = campanha.campanhaId
  const paginas = useMemo(() => (sessao === undefined ? [] : paginasDaSessao(sessao, verbetes)), [sessao, verbetes])
  const contexto = useMemo<ContextoDoRoteiro>(
    () => ({
      raiz,
      tituloDe: (id) => verbetes.get(id)?.titulo,
      aoAbrirLink: (alvo: AlvoNaMesa, nome: string) => {
        if (alvo.tipo === 'ficha') {
          const aviso = abrirFichaNaCena(alvo, nome)
          if (aviso !== null) avisar(aviso)
          return
        }
        aoAbrirNaMesa(alvo.pinoId === undefined ? { chave: alvo.chave, sceneId: alvo.sceneId } : { chave: alvo.chave, sceneId: alvo.sceneId, pinoId: alvo.pinoId })
      },
      revelarMencao: (verbeteId) => {
        const citado = verbetes.get(verbeteId)
        // Sessão nunca vai ao jogador: a menção a ela fica só o nome.
        return sessao === undefined || citado === undefined || citado.tipo === 'sessao' ? null : <RevelarDaMencao sessao={sessao} verbeteId={verbeteId} campanhaId={campanhaId} />
      },
    }),
    [raiz, verbetes, aoAbrirNaMesa, sessao, campanhaId],
  )
  if (sessao === undefined) return null
  const ultima = sessoes[sessoes.length - 1]
  // Com sessões de várias campanhas na lista, o nome leva a campanha junto ("Sessão 3 (Ilha Velha)").
  const rotuloDe = (uma: Verbete): string => {
    const nome = uma.titulo || 'Sessão sem nome'
    const deQuais = comCampanha ? campanhas.filter((campanha) => uma.campanhas.includes(campanha.id)).map((campanha) => campanha.nome) : []
    const comNome = deQuais.length === 0 ? nome : `${nome} (${deQuais.join(', ')})`
    return comNome
  }
  const vazio = !temRoteiro(sessao) && !paginas.some(temRoteiro)

  return (
    <div className="pr-roteiro">
      {sessoes.length > 1 ? (
        <label className="pr-roteiro__escolha">
          <span className="pr-roteiro__rotulo">{sessao === ultima ? 'Sessão, a mais recente' : 'Sessão'}</span>
          <select className="pr-revelar__escolha" value={sessao.id} onChange={(evento) => setEscolhida(evento.target.value)}>
            {sessoes.map((uma) => (
              <option key={uma.id} value={uma.id}>
                {rotuloDe(uma)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <h3 className="pr-roteiro__nome">{sessao.titulo || 'Sessão sem nome'}</h3>
      )}

      <div className="pr-roteiro__bloco">
        <RevelarHoje key={sessao.id} sessao={sessao} editavel={false} tituloId={tituloDoRevelar} campanha={campanha} />
      </div>

      <section className="pr-roteiro__bloco" aria-labelledby={tituloDoRoteiro}>
        <h3 id={tituloDoRoteiro} className="pr-trilho__titulo">
          Roteiro
        </h3>
        {vazio ? (
          <p className="pr-quieto">Esta sessão ainda não tem roteiro. Escreva no Prelúdio, em Sessões.</p>
        ) : (
          <div className="pr-roteiro__corpo">
            <SecoesDe dono={sessao} contexto={contexto} />
            {paginas.filter(temRoteiro).map((pagina) => (
              <article key={pagina.id} className="pr-roteiro__pagina" aria-label={pagina.titulo || 'Página sem nome'}>
                <h4 className="pr-roteiro__pagina-nome">{pagina.titulo || 'Página sem nome'}</h4>
                <SecoesDe dono={pagina} contexto={contexto} />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export const PaginaRoteiro = memo(function PaginaRoteiro({ aoAbrirNaMesa }: PaginaRoteiroProps) {
  const carga = usePreludio((estado) => estado.carga)
  const verbetes = usePreludio((estado) => estado.verbetes)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const pastaId = useAdventureStore((estado) => estado.pasta?.pastaId ?? null)

  // A lista de mapas, cenas e pinos é relida: pode ter mudado no editor desde a última vez.
  useEffect(() => {
    useCatalogoDaMesa.getState().esquecer()
  }, [])
  // O Prelúdio abre aqui na primeira vez (e de novo se a tela dele o fechou).
  useEffect(() => {
    if (carga.t === 'fechada') void usePreludio.getState().carregar()
  }, [carga.t])

  const campanha = pastaId === null ? undefined : campanhas.find((uma) => uma.pastaId === pastaId)
  const sessoes = useMemo(() => sessoesEmOrdem(verbetes.values(), campanha?.id ?? null), [verbetes, campanha])

  if (carga.t !== 'pronta') {
    return (
      <>
        <TituloDaPagina titulo="Roteiro" sub={SUB} />
        <p className="pr-quieto pr-roteiro__aviso" role={carga.t === 'falhou' ? 'alert' : 'status'}>
          {carga.t === 'falhou' ? carga.aviso : 'Abrindo o Prelúdio…'}
        </p>
      </>
    )
  }

  return (
    <>
      <TituloDaPagina titulo="Roteiro" sub={SUB} />
      {sessoes.length === 0 ? (
        <p className="pr-quieto pr-roteiro__aviso">{campanha === undefined ? 'Nenhuma sessão no Prelúdio. Crie a primeira em Sessões.' : `Nenhuma sessão de ${campanha.nome} no Prelúdio. Crie a primeira em Sessões.`}</p>
      ) : (
        <>
          {campanha === undefined && campanhas.length > 1 && <p className="pr-quieto pr-roteiro__aviso">Este mapa não é da pasta de nenhuma campanha do Prelúdio: aparecem as sessões de todas.</p>}
          <SessaoNoLivro
            key={campanha?.id ?? 'todas'}
            sessoes={sessoes}
            campanhas={campanhas}
            comCampanha={campanha === undefined && campanhas.length > 1}
            campanhaDoMapa={campanha?.id ?? null}
            aoAbrirNaMesa={aoAbrirNaMesa}
          />
        </>
      )}
    </>
  )
})
