import { useCallback, useEffect, useState } from 'react'
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

type Carga = { t: 'carregando' } | { t: 'pronta'; videos: VideoDaGaleria[] } | { t: 'erro'; mensagem: string }

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

  useEffect(() => {
    // A demo não tem servidor: a Galeria fica vazia.
    if (naDemo) {
      setCarga({ t: 'pronta', videos: [] })
      return
    }
    const controle = new AbortController()
    setCarga({ t: 'carregando' })
    fetch(enderecoDaApi(campanhaId, 'galeria'), { credentials: 'same-origin', signal: controle.signal })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error(resposta.status === 404 ? 'A Galeria desta mesa não abriu.' : `O Lobby recusou (${resposta.status}).`)
        setCarga({ t: 'pronta', videos: lerLista(await resposta.json()) })
      })
      .catch((erro: unknown) => {
        if (controle.signal.aborted) return
        setCarga({ t: 'erro', mensagem: erro instanceof Error ? erro.message : 'Sem rede: tente de novo.' })
      })
    return () => controle.abort()
  }, [campanhaId, naDemo])

  const tirar = useCallback(
    async (videoId: string): Promise<string | null> => {
      try {
        const resposta = await fetch(enderecoDaApi(campanhaId, `galeria/${videoId}/tirar`), {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
        if (!resposta.ok) return resposta.status === 403 ? 'Só o mestre tira um vídeo da Galeria.' : `Não deu para tirar (${resposta.status}).`
        setCarga((atual) => (atual.t === 'pronta' ? { t: 'pronta', videos: atual.videos.filter((video) => video.id !== videoId) } : atual))
        return null
      } catch {
        return 'Sem rede: tente de novo.'
      }
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
        <p className="lo-galeria__erro" role="alert">
          {carga.mensagem}
        </p>
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
