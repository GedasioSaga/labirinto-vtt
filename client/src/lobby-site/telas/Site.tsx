import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { ImagemDaMesa } from '../../components/ImagemDaMesa'
import { resolverSoEmbutida } from '../../lib/midia'
import { pendentesACaminho } from '../dados/chatDaCampanha'
import { enderecoDaRota, type Rota } from '../dados/rotas'
import { Cabeca } from './Cabeca'
import { aoClicarNoLink, useDoSite, useSite } from './contexto'
import { mudancasACaminho } from './enviar'
import { TelaChat } from './chat/TelaChat'
import { AvisoDaPagina, Carregando } from './Estados'
import { FaixaDeAvisos } from './mural/FaixaDeAvisos'
import { TelaMural } from './mural/TelaMural'
import { TelaAcesso } from './TelaAcesso'
import { TelaCampanha } from './TelaCampanha'
import { TelaCampanhas } from './TelaCampanhas'
import { TelaFicha } from './TelaFicha'
import { TelaLobby } from './lobby/TelaLobby'
import type { TelaTreino as TelaDoTreino } from './treino/TelaTreino'

/**
 * O SITE DO LOBBY, tela por tela: a cabeça fixa com a faixa de estado em
 * cima e a página da rota embaixo. Imagem só a embutida na ficha: a mídia
 * da mesa (`midia:`) mora no app e o site ainda não a serve.
 */

const NOME_DO_SITE = 'Lobby do Labirinto'

type PropsDoTreino = Parameters<typeof TelaDoTreino>[0]

/** O pedaço do treino não chegou (a conexão caiu no meio, ou o site foi publicado de novo e o arquivo antigo saiu). */
function TreinoNaoAbriu() {
  return (
    <AvisoDaPagina
      titulo="O treino não abriu"
      acoes={
        <button type="button" className="lo-btn lo-btn--primario" onClick={() => window.location.reload()}>
          Recarregar a página
        </button>
      }
    >
      <p>A parte do site com a Arena não chegou. Confira a conexão e recarregue.</p>
    </AvisoDaPagina>
  )
}

/**
 * O treino e o duelo (a Arena, o HUD da batalha, o motor da luta) só baixam
 * quando alguém abre o treino: a entrada do lobby não paga por eles.
 */
const TelaTreino = lazy<ComponentType<PropsDoTreino>>(() =>
  import('./treino/TelaTreino').then(
    (modulo) => ({ default: modulo.TelaTreino }),
    () => ({ default: TreinoNaoAbriu }),
  ),
)

export function Site() {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const eu = useDoSite((estado) => estado.eu)
  const rota = useDoSite((estado) => estado.rota)
  const esperando = useDoSite(
    (estado) =>
      (estado.campanha === null ? 0 : mudancasACaminho(estado.campanha)) +
      (estado.chat === null ? 0 : pendentesACaminho(estado.chat.conversas.values())) +
      estado.chatGuardado,
  )
  const tituloDaPagina = useDoSite((estado) =>
    tituloDe(
      estado.rota,
      estado.campanha?.fichas.find((ficha) => estado.rota.tela === 'ficha' && ficha.doc.id === estado.rota.fichaId)?.doc.nome,
      estado.eu.t === 'pronto' ? estado.eu.eu.campanhas.find((linha) => linha.campanhaId === estado.campanha?.campanhaId)?.nomeDaCampanha : undefined,
    ),
  )

  // Fechar a aba com mudança a caminho: o navegador pergunta. A fila fica guardada, mas a pessoa fica sabendo;
  // um desfazer a caminho vive só nesta aba (sai pelo canal, fora da fila) e se perde. A mensagem do chat que ainda
  // não saiu (enviando, ou segurada por ritmo ou cota), desta mesa ou de outra deixada nesta aba, também só vive aqui.
  useEffect(() => {
    if (esperando === 0) return
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault()
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [esperando])

  // As não lidas do chat (C2) na frente do título, em toda tela da mesa: a aba avisa mesmo atrás de outras.
  const naoLidasDoChat = useDoSite((estado) => estado.chat?.naoLidas ?? 0)

  useEffect(() => {
    const titulo = tituloDaPagina === null ? NOME_DO_SITE : `${tituloDaPagina} | ${NOME_DO_SITE}`
    document.title = naoLidasDoChat > 0 ? `(${naoLidasDoChat}) ${titulo}` : titulo
  }, [tituloDaPagina, naoLidasDoChat])

  let pagina
  if (eu.t !== 'pronto' || eu.eu.campanhas.length === 0) pagina = <TelaAcesso carga={eu} />
  else if (rota.tela === 'campanhas') pagina = <TelaCampanhas eu={eu.eu} />
  else if (rota.tela === 'campanha') pagina = <TelaLobby campanhaId={rota.campanhaId} />
  else if (rota.tela === 'fichas') pagina = <TelaCampanha campanhaId={rota.campanhaId} />
  else if (rota.tela === 'treino')
    pagina = (
      <Suspense fallback={<Carregando texto="Abrindo o treino…" />}>
        <TelaTreino rota={rota} />
      </Suspense>
    )
  else if (rota.tela === 'ficha') pagina = <TelaFicha rota={rota} />
  else if (rota.tela === 'chat') pagina = <TelaChat rota={rota} />
  else if (rota.tela === 'mural') pagina = <TelaMural rota={rota} />
  else {
    const mesas: Rota = { tela: 'campanhas' }
    pagina = (
      <AvisoDaPagina
        titulo="Esta página não existe"
        acoes={
          <a className="lo-btn lo-btn--primario" href={enderecoDaRota(mesas, demo)} onClick={aoClicarNoLink(site, mesas)}>
            Ver suas mesas
          </a>
        }
      >
        <p>O endereço pode estar torto, ou a mesa não é sua.</p>
      </AvisoDaPagina>
    )
  }

  return (
    <ImagemDaMesa.Provider value={resolverSoEmbutida}>
      <a className="lo-pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <Cabeca />
      <main id="conteudo" className="lo-principal" tabIndex={-1}>
        {/* O aviso fixado do mestre, ao entrar em qualquer tela da mesa, até a pessoa marcar como lido (M2). No lobby
            os avisos têm lugar próprio, no alto da página (H1): a faixa ali repetiria o mesmo aviso duas vezes. */}
        {eu.t === 'pronto' && rota.tela !== 'campanha' && <FaixaDeAvisos />}
        {pagina}
      </main>
    </ImagemDaMesa.Provider>
  )
}

function tituloDe(rota: Rota, nomeDaFicha: string | undefined, nomeDaMesa: string | undefined): string | null {
  switch (rota.tela) {
    case 'campanhas':
      return 'Suas mesas'
    case 'campanha':
      return nomeDaMesa ?? null
    case 'fichas':
      return nomeDaMesa === undefined ? 'Fichas' : `Fichas de ${nomeDaMesa}`
    case 'treino':
      return rota.parte === 'duelo' ? 'Duelo' : 'Treino'
    case 'ficha':
      return nomeDaFicha ?? nomeDaMesa ?? null
    case 'chat':
      return nomeDaMesa === undefined ? 'Chat' : `Chat de ${nomeDaMesa}`
    case 'mural':
      return nomeDaMesa === undefined ? 'Mural' : `Mural de ${nomeDaMesa}`
    case 'nao-achada':
      return 'Página não encontrada'
  }
}
