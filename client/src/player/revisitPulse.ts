import type { Graphics } from 'pixi.js'
import type { Bounds } from '../pixi/world'

/**
 * MAPA LEMBRADO — o piscar do trecho que mudou desde a última visita
 * (`revisitChanges.ts` decide O QUÊ; aqui é só COMO aparece).
 *
 * Âmbar, a mesma cor do halo da porta alcançável: na tela do jogador ela já é
 * "olhe aqui". Três piscadas e acabou: é resposta à volta do jogador, não um
 * enfeite que fica acendendo a sessão inteira. Começa e termina apagada, então
 * a área não "estala" quando o pulso entra ou sai.
 */
export const REVISIT_NOTE = 'Mudou desde a sua última visita'
export const REVISIT_COLOR = 0xe8c170
export const REVISIT_BLINKS = 3
export const REVISIT_PULSE_DURATION_MS = 2400
/** Folga em volta da área, em px de TELA: o contorno não encosta no que mudou. */
export const REVISIT_PAD_PX = 6
const REVISIT_STROKE_PX = 2
const REVISIT_STROKE_ALPHA = 0.95
const REVISIT_FILL_ALPHA = 0.22
const REVISIT_CORNER_PX = 4

/**
 * Brilho do quadro `elapsedMs`, de 0 a 1. Cada piscada é meia volta de
 * cosseno (sobe e desce suave). Com movimento reduzido o trecho acende fixo e
 * apaga no fim: o aviso continua, só não pisca. Fora do intervalo, 0.
 */
export function revisitIntensity(elapsedMs: number, reducedMotion: boolean): number {
  if (!(elapsedMs >= 0) || elapsedMs >= REVISIT_PULSE_DURATION_MS) return 0
  if (reducedMotion) return 1
  const phase = (elapsedMs / REVISIT_PULSE_DURATION_MS) * REVISIT_BLINKS
  return (1 - Math.cos(2 * Math.PI * phase)) / 2
}

/**
 * Quadro do pulso sobre cada área (px de TELA). Devolve `false`, com `g`
 * vazio, quando o pulso acabou ou o tempo não vale.
 */
export function drawRevisitPulse(g: Graphics, areas: readonly Bounds[], elapsedMs: number, reducedMotion: boolean): boolean {
  g.clear()
  if (!(elapsedMs >= 0) || elapsedMs >= REVISIT_PULSE_DURATION_MS) return false
  const intensity = revisitIntensity(elapsedMs, reducedMotion)
  for (const area of areas) {
    const x = area.minX - REVISIT_PAD_PX
    const y = area.minY - REVISIT_PAD_PX
    const w = area.maxX - area.minX + REVISIT_PAD_PX * 2
    const h = area.maxY - area.minY + REVISIT_PAD_PX * 2
    g.roundRect(x, y, w, h, REVISIT_CORNER_PX).fill({ color: REVISIT_COLOR, alpha: REVISIT_FILL_ALPHA * intensity })
    g.roundRect(x, y, w, h, REVISIT_CORNER_PX).stroke({ width: REVISIT_STROKE_PX, color: REVISIT_COLOR, alpha: REVISIT_STROKE_ALPHA * intensity })
  }
  return true
}
