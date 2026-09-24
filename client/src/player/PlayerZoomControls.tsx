import type { MouseEvent } from 'react'
import type { ZoomDirection } from './playerZoom'

interface PlayerZoomControlsProps {
  /** Falso no zoom máximo: o + fica indisponível. */
  canZoomIn: boolean
  /** Falso no zoom mínimo: o − fica indisponível. */
  canZoomOut: boolean
  /** Um degrau de zoom. `animate` falso = veio do teclado, e ação de teclado não espera animação. */
  onZoom: (direction: ZoomDirection, animate: boolean) => void
}

/*
 * O + e o − desenhados, e não os caracteres: o glifo da fonte do sistema cai
 * fora do centro óptico do botão (a caixa do texto não é a do sinal). Mesma
 * família dos ícones do editor (`components/icons.tsx`: `viewBox` 24, traço em
 * `currentColor`, ponta redonda), com traço 2 em vez de 1,6 porque flutua
 * sobre o mapa, e não num painel.
 */
function Glyph({ plus }: { plus: boolean }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={plus ? 'M12 5v14M5 12h14' : 'M5 12h14'} />
    </svg>
  )
}

/**
 * Botões + e − do mapa do jogador, no canto de baixo à direita (`player.css`).
 *
 * No limite o botão fica `aria-disabled`, e não `disabled`: continua focável,
 * então quem aperta Enter até o máximo não perde o foco para o nada no meio
 * da tela, e o `title` diz o motivo. O clique no botão indisponível não faz
 * nada — e não finge que faz.
 */
export function PlayerZoomControls({ canZoomIn, canZoomOut, onZoom }: PlayerZoomControlsProps) {
  function press(direction: ZoomDirection, enabled: boolean) {
    return (event: MouseEvent<HTMLButtonElement>) => {
      if (!enabled) return
      // `detail` conta os cliques do dedo ou do mouse; Enter e Espaço sintetizam o clique com 0.
      onZoom(direction, event.detail !== 0)
    }
  }

  return (
    <div className="pp-zoom" role="group" aria-label="Zoom do mapa">
      <button
        type="button"
        className="pp-zoom__button"
        aria-label="Aproximar"
        aria-disabled={!canZoomIn}
        title={canZoomIn ? 'Aproximar' : 'Zoom máximo'}
        onClick={press(1, canZoomIn)}
      >
        <Glyph plus />
      </button>
      <button
        type="button"
        className="pp-zoom__button"
        aria-label="Afastar"
        aria-disabled={!canZoomOut}
        title={canZoomOut ? 'Afastar' : 'Zoom mínimo'}
        onClick={press(-1, canZoomOut)}
      >
        <Glyph plus={false} />
      </button>
    </div>
  )
}
