import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { estaCalado, useSomStore } from '../stores/somStore'
import type { CutsceneVideoNoJogador } from '../player/playerConnection'
import './cutsceneDeVideo.css'

/**
 * CUTSCENE EM VÍDEO (14/11/2026) na tela do jogador e da TV. Enquanto o vídeo
 * baixa, só um selo discreto no canto ("Cutscene: 45%", depois "Esperando a
 * mesa"); o mapa segue jogável. Com a ordem do mestre (`largouEm`), o vídeo
 * ocupa a tela inteira, no volume do controle de som deste aparelho, e some
 * sozinho no fim. Sem botão de pular: só o mestre para ("Parar para todos").
 */

interface CutsceneDeVideoOverlayProps {
  cutscene: CutsceneVideoNoJogador | undefined
  /** 0 a 1. Ausente = o "Som da mesa" deste aparelho (volume e mudo). A TV passa o volume fixo dela. */
  volume?: number
  /** O vídeo chegou ao fim aqui: a conexão avisa o mestre e solta o vídeo. */
  aoTerminar: (exibicao: number) => void
  /**
   * O vídeo chegou mas não toca neste navegador (H.265 de iPhone, arquivo
   * corrompido): a conexão avisa o mestre ("não chegou" no painel) e solta a
   * tela, que não fica preta esperando um fim que nunca vem.
   */
  aoFalhar: (exibicao: number) => void
}

/** Saída: o mesmo fade curto das transições. */
const SAIDA_MS = 260

function querMovimentoReduzido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function SeloDaBaixa({ cutscene }: { cutscene: CutsceneVideoNoJogador }) {
  const texto = cutscene.falhou === true ? 'Cutscene: o vídeo não chegou' : cutscene.url === undefined ? `Cutscene: ${cutscene.pct}%` : 'Cutscene pronta: esperando a mesa'
  return (
    <div className="lb-cutscene-selo" role="status" aria-live="polite" data-falhou={cutscene.falhou === true}>
      <span className="lb-cutscene-selo__titulo">{cutscene.titulo}</span>
      <span className="lb-cutscene-selo__texto">{texto}</span>
      {cutscene.url === undefined && cutscene.falhou !== true && (
        <span className="lb-cutscene-selo__barra" aria-hidden="true">
          <span className="lb-cutscene-selo__cheio" style={{ transform: `scaleX(${cutscene.pct / 100})` }} />
        </span>
      )}
    </div>
  )
}

interface TelaDoVideoProps {
  cutscene: CutsceneVideoNoJogador
  url: string
  volume: number
  aoTerminar: (exibicao: number) => void
  aoFalhar: (exibicao: number) => void
}

function TelaDoVideo({ cutscene, url, volume, aoTerminar, aoFalhar }: TelaDoVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [saindo, setSaindo] = useState(false)
  const [semSom, setSemSom] = useState(false)
  const volumeRef = useRef(volume)
  volumeRef.current = volume

  useEffect(() => {
    const video = videoRef.current
    if (video === null) return
    video.volume = Math.min(1, Math.max(0, volume))
    video.muted = semSom || volume <= 0
  }, [volume, semSom])

  useEffect(() => {
    const video = videoRef.current
    if (video === null) return
    video.volume = Math.min(1, Math.max(0, volumeRef.current))
    // Navegador que não deixa tocar com som sem um toque (a TV recém-aberta): toca mudo e oferece o som.
    video.play().catch(() => {
      setSemSom(true)
      video.muted = true
      video.play().catch(() => undefined)
    })
  }, [url])

  /** Sai com o fade e, no fim dele, conta à conexão como acabou: chegou ao fim ou não tocou. */
  const sair = (aoSair: (exibicao: number) => void) => {
    if (saindo) return
    setSaindo(true)
    setTimeout(() => aoSair(cutscene.exibicao), querMovimentoReduzido() ? 0 : SAIDA_MS)
  }

  const ligarSom = () => {
    const video = videoRef.current
    setSemSom(false)
    if (video === null) return
    video.muted = volumeRef.current <= 0
    video.play().catch(() => undefined)
  }

  return createPortal(
    <div className="lb-cutscene-video" data-saindo={saindo} role="dialog" aria-modal="true" aria-label={`Cutscene: ${cutscene.titulo}`}>
      <video
        ref={videoRef}
        className="lb-cutscene-video__filme"
        src={url}
        playsInline
        preload="auto"
        onEnded={() => sair(aoTerminar)}
        onError={() => sair(aoFalhar)}
        disablePictureInPicture
        controls={false}
      />
      {semSom && (
        <button type="button" className="lb-cutscene-video__som" onClick={ligarSom}>
          Ligar o som
        </button>
      )}
    </div>,
    document.body,
  )
}

export function CutsceneDeVideoOverlay({ cutscene, volume, aoTerminar, aoFalhar }: CutsceneDeVideoOverlayProps) {
  const volumeDoAparelho = useSomStore((estado) => (estaCalado(estado) ? 0 : estado.volume))
  if (cutscene === undefined) return null
  const url = cutscene.url
  if (url === undefined || cutscene.largouEm === undefined) return <SeloDaBaixa cutscene={cutscene} />
  return <TelaDoVideo key={`${cutscene.exibicao}:${url}`} cutscene={cutscene} url={url} volume={volume ?? volumeDoAparelho} aoTerminar={aoTerminar} aoFalhar={aoFalhar} />
}
