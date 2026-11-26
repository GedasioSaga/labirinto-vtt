import { useCallback, useEffect, useState } from 'react'
import { lerJsonSeguro } from '../../../lib/nuvem/json'
import { enderecoDaRota, type Rota } from '../../dados/rotas'
import { aoClicarNoLink, fonteDaDemo, useDoSite, useSite } from '../contexto'
import { AvisoDaPagina } from '../Estados'
import { Icone } from '../Icone'
import './galeria.css'

/**
 * A GALERIA DA MESA (14/11/2026, pedido do mestre): as cutscenes que tocaram
 * na mesa, para rever depois. Todo membro vê e assiste; o vídeo vem do DO da
 * campanha (`GET /api/c/:id/video/:videoId`, com Range: o player pede aos
 * pedaços). Só o mestre tira um vídeo da Galeria, em dois toques (o vídeo some
 * do site; no app ele continua na lista das Cutscenes).
 */

interface VideoDaGaleria {
  id: string
  titulo: string
  tamanho: number
  quando: number
}

/** `entrar` = a entrada no Lobby venceu: o que resolve é recarregar (o Access pede o login de novo). `tentando` = o "Tentar de novo" está a caminho. */
type Carga = { t: 'carregando' } | { t: 'pronta'; videos: VideoDaGaleria[] } | { t: 'erro'; mensagem: string; entrar: boolean; tentando: boolean }

type LeituraDaGaleria = { ok: true; videos: VideoDaGaleria[] } | { ok: false; mensagem: string; entrar: boolean }

const SEM_REDE = 'Sem conexão com o Lobby. Confira a internet e tente de novo.'
const ENTRADA_VENCIDA = 'Sua entrada no Lobby venceu. Recarregue a página para entrar de novo.'
const RESPOSTA_ESTRANHA = 'O servidor do Lobby mandou uma resposta que esta página não entende. Recarregue a página; se continuar, avise o mestre.'
/** A partir de quantas falhas seguidas a tela diz o que fazer além de tentar. */
const FALHAS_ATE_O_CONSELHO = 2

/** Sem login (ou login vencido): o `redirect: 'manual'` devolve o redirect do Access como `opaqueredirect`. */
function precisaEntrar(resposta: Response): boolean {
  return resposta.type === 'opaqueredirect' || resposta.status === 401
}

/** A frase de uma resposta que não deu certo: o que aconteceu e o que fazer; o código fica no fim, para quem for ajudar. */
function fraseDoStatus(status: number, acao: 'abrir' | 'tirar'): string {
  if (status === 404) return acao === 'abrir' ? 'A Galeria desta mesa não foi achada no servidor. Avise o mestre.' : 'Este vídeo já tinha saído da Galeria. Recarregue a página para ver a lista de agora.'
  if (status >= 500) return `O servidor do Lobby está com problema agora (código ${status}). Tente de novo daqui a pouco; se continuar, avise o mestre.`
  const oQue = acao === 'abrir' ? 'abrir a Galeria' : 'tirar este vídeo'
  return `O servidor do Lobby não deixou ${oQue} (código ${status}). Tente de novo; se continuar, avise o mestre.`
}

async function lerGaleria(campanhaId: string, sinal: AbortSignal): Promise<LeituraDaGaleria> {
  let resposta: Response
  try {
    // `manual`: com a entrada vencida, o Access redireciona para outra origem; seguir dava erro de CORS ("Failed to fetch") em vez de "entre de novo" (o mesmo do `/api/eu`).
    resposta = await fetch(enderecoDaApi(campanhaId, 'galeria'), { credentials: 'same-origin', redirect: 'manual', headers: { Accept: 'application/json' }, signal: sinal })
  } catch {
    return { ok: false, mensagem: SEM_REDE, entrar: false }
  }
  if (precisaEntrar(resposta)) return { ok: false, mensagem: ENTRADA_VENCIDA, entrar: true }
  if (!resposta.ok) return { ok: false, mensagem: fraseDoStatus(resposta.status, 'abrir'), entrar: false }
  try {
    return { ok: true, videos: lerLista(lerJsonSeguro(await resposta.text())) }
  } catch {
    return { ok: false, mensagem: RESPOSTA_ESTRANHA, entrar: false }
  }
}

const FORMA_DO_ID = /^[0-9a-f]{64}\.(?:mp4|webm)$/
const MB = 1024 * 1024

function ehVideoDaGaleria(valor: unknown): valor is VideoDaGaleria {
  if (typeof valor !== 'object' || valor === null) return false
  const { id, titulo, tamanho, quando } = valor as Record<string, unknown>
  return typeof id === 'string' && FORMA_DO_ID.test(id) && typeof titulo === 'string' && typeof tamanho === 'number' && typeof quando === 'number'
}

function lerLista(corpo: unknown): VideoDaGaleria[] {
  const videos = typeof corpo === 'object' && corpo !== null && 'videos' in corpo ? corpo.videos : undefined
  return Array.isArray(videos) ? videos.filter(ehVideoDaGaleria) : []
}

function enderecoDaApi(campanhaId: string, resto: string): string {
  return `/api/c/${encodeURIComponent(campanhaId)}/${resto}`
}

const quandoLegivel = (quando: number): string => new Date(quando).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const tamanhoLegivel = (bytes: number): string => `${(bytes / MB).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`

function CartaoDoVideo({ campanhaId, video, souMestre, aoTirar }: { campanhaId: string; video: VideoDaGaleria; souMestre: boolean; aoTirar: (id: string) => Promise<string | null> }) {
  const [confirmando, setConfirmando] = useState(false)
  const [tirando, setTirando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const tirar = async () => {
    if (!confirmando) {
      setConfirmando(true)
      return
    }
    setTirando(true)
    const falha = await aoTirar(video.id)
    setTirando(false)
    setConfirmando(false)
    setErro(falha)
  }

  return (
    <li className="lo-galeria__item">
      <video className="lo-galeria__video" src={enderecoDaApi(campanhaId, `video/${video.id}`)} controls preload="metadata" playsInline />
      <div className="lo-galeria__texto">
        <h2 className="lo-galeria__titulo">{video.titulo}</h2>
        <p className="lo-galeria__meta">
          {quandoLegivel(video.quando)} · {tamanhoLegivel(video.tamanho)}
        </p>
        {souMestre && (
          <div className="lo-galeria__acoes">
            <button type="button" className="lo-btn lo-btn--fantasma" disabled={tirando} onClick={() => void tirar()}>
              <Icone nome="tirar" /> {confirmando ? 'Confirmar: tirar do site' : 'Tirar da Galeria'}
            </button>
            {confirmando && !tirando && (
              <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => setConfirmando(false)}>
                Manter
              </button>
            )}
          </div>
        )}
        {erro !== null && (
          <p className="lo-galeria__erro" role="alert">
            {erro}
          </p>
        )}
      </div>
    </li>
  )
}

export function TelaGaleria({ campanhaId }: { campanhaId: string }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const campanha = useDoSite((estado) => estado.campanha)
  const erroDaCampanha = useDoSite((estado) => estado.erroDaCampanha)
  const nomeDaMesa = useDoSite((estado) =>
    estado.eu.t === 'pronto' ? (estado.eu.eu.campanhas.find((linha) => linha.campanhaId === campanhaId)?.nomeDaCampanha ?? 'Mesa') : 'Mesa',
  )
  const naDemo = fonteDaDemo(site) !== null
  const [carga, setCarga] = useState<Carga>({ t: 'carregando' })
  /** Cada "Tentar de novo" soma um: o efeito pede a lista outra vez, sem recarregar a página. */
  const [tentativa, setTentativa] = useState(0)
  const [falhas, setFalhas] = useState(0)

  useEffect(() => {
    // A demo não tem servidor: a Galeria fica vazia.
    if (naDemo) {
      setCarga({ t: 'pronta', videos: [] })
      return
    }
    const controle = new AbortController()
    // Tentando de novo, o aviso fica na tela e o botão mostra que tentou; na primeira vez, o "Abrindo a Galeria…".
    setCarga((atual) => (atual.t === 'erro' ? { ...atual, tentando: true } : { t: 'carregando' }))
    void lerGaleria(campanhaId, controle.signal).then((lida) => {
      if (controle.signal.aborted) return
      if (lida.ok) {
        setCarga({ t: 'pronta', videos: lida.videos })
        setFalhas(0)
        return
      }
      setCarga({ t: 'erro', mensagem: lida.mensagem, entrar: lida.entrar, tentando: false })
      setFalhas((antes) => antes + 1)
    })
    return () => controle.abort()
  }, [campanhaId, naDemo, tentativa])

  const tirar = useCallback(
    async (videoId: string): Promise<string | null> => {
      let resposta: Response
      try {
        resposta = await fetch(enderecoDaApi(campanhaId, `galeria/${videoId}/tirar`), {
          method: 'POST',
          credentials: 'same-origin',
          redirect: 'manual',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
      } catch {
        return SEM_REDE
      }
      if (precisaEntrar(resposta)) return ENTRADA_VENCIDA
      if (!resposta.ok) return resposta.status === 403 ? 'Só o mestre tira um vídeo da Galeria.' : fraseDoStatus(resposta.status, 'tirar')
      setCarga((atual) => (atual.t === 'pronta' ? { t: 'pronta', videos: atual.videos.filter((video) => video.id !== videoId) } : atual))
      return null
    },
    [campanhaId],
  )

  const daMesa: Rota = { tela: 'campanha', campanhaId }

  if (erroDaCampanha !== null) {
    return (
      <AvisoDaPagina titulo="Não deu para abrir esta mesa neste navegador">
        <p>{erroDaCampanha}</p>
      </AvisoDaPagina>
    )
  }

  const souMestre = campanha?.eu?.papel === 'mestre'

  return (
    <div className="lo-pagina lo-pagina--galeria">
      <header className="lo-cab-pag">
        <div className="lo-cab-pag__texto">
          <a className="lo-voltar" href={enderecoDaRota(daMesa, demo)} onClick={aoClicarNoLink(site, daMesa)}>
            <Icone nome="voltar" /> {nomeDaMesa}
          </a>
          <h1 className="lo-titulo">Galeria</h1>
          <p className="lo-sub">As cutscenes que já tocaram na mesa, para rever quando quiser.</p>
        </div>
      </header>

      {carga.t === 'carregando' && (
        <p className="lo-carregando" role="status">
          <span className="lo-giro" aria-hidden="true" />
          Abrindo a Galeria…
        </p>
      )}
      {carga.t === 'erro' && (
        <div className="lo-galeria__falha">
          <p className="lo-galeria__erro" role="alert">
            {carga.mensagem}
          </p>
          <div className="lo-galeria__acoes">
            {carga.entrar ? (
              <button type="button" className="lo-btn lo-btn--primario" onClick={() => window.location.reload()}>
                Recarregar a página
              </button>
            ) : (
              <button type="button" className="lo-btn lo-btn--primario" disabled={carga.tentando} aria-busy={carga.tentando} onClick={() => setTentativa((antes) => antes + 1)}>
                {carga.tentando ? 'Tentando…' : 'Tentar de novo'}
              </button>
            )}
          </div>
          {!carga.entrar && !carga.tentando && falhas >= FALHAS_ATE_O_CONSELHO && (
            <p className="lo-motivo" role="status">
              Continua sem abrir. Avise o mestre: o servidor do Lobby pode estar fora do ar.
            </p>
          )}
        </div>
      )}
      {carga.t === 'pronta' && carga.videos.length === 0 && <p className="lo-galeria__vazia">Nenhuma cutscene ainda. Quando o mestre tocar uma na mesa, ela aparece aqui.</p>}
      {carga.t === 'pronta' && carga.videos.length > 0 && (
        <ul className="lo-galeria__lista">
          {carga.videos.map((video) => (
            <CartaoDoVideo key={video.id} campanhaId={campanhaId} video={video} souMestre={souMestre} aoTirar={tirar} />
          ))}
        </ul>
      )}
    </div>
  )
}
