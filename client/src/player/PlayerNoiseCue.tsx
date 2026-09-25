import type { CSSProperties } from 'react'
import { NOISE_CUE_TTL_MS, noiseArrowAngle, noiseCueText, type NoiseDirection } from '../lib/noise'

/** Duração da saída (a mesma do `pp-noise-out` em `player.css`). */
const NOISE_CUE_FADE_OUT_MS = 500

export interface PlayerNoiseCueProps {
  /** De que lado veio o ruído, visto da ficha do jogador. É tudo o que a tela sabe dele. */
  dir: NoiseDirection
}

/**
 * RUÍDO NO MAPA na tela do jogador: uma seta na BORDA da tela, do lado de onde
 * veio o ruído, e o texto curto ao lado dela ("Um ruído a nordeste"). A seta
 * fica na borda, e não num ponto do mapa: o jogador só sabe a direção, e um
 * ponto no mapa inventaria uma posição que ele não tem.
 *
 * Não rouba o foco nem o toque (`pointer-events: none` no CSS): chega sem o
 * jogador pedir, no meio de um arrasto de ficha. O texto é anunciado pelo
 * `role="status"`. Some sozinho: quem tira da tela é a conexão, no prazo.
 */
export function PlayerNoiseCue({ dir }: PlayerNoiseCueProps) {
  const angle = noiseArrowAngle(dir)
  // Duas animações no CSS (entrada, saída): a saída começa a tempo de acabar
  // junto com o prazo em que a conexão tira o aviso da tela.
  const style: CSSProperties = { animationDelay: `0ms, ${Math.max(0, NOISE_CUE_TTL_MS - NOISE_CUE_FADE_OUT_MS)}ms` }
  return (
    <div className="pp-noise" style={style}>
      <div className="pp-noise__cue" data-dir={dir} role="status" aria-live="polite">
        {angle !== null && (
          <span className="pp-noise__arrow" data-dir={dir} aria-hidden="true" style={{ transform: `rotate(${angle}deg)` }}>
            <svg viewBox="0 0 24 24" width="28" height="28" focusable="false">
              <path d="M12 3 L20 15 H14.5 V21 H9.5 V15 H4 Z" />
            </svg>
          </span>
        )}
        <span className="pp-noise__text">{noiseCueText(dir)}</span>
      </div>
    </div>
  )
}
