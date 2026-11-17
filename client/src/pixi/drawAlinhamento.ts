/**
 * ALINHAMENTO NO CANVAS (pedido de 17/11/2026, `lib/alinhamento.ts`): as duas
 * cores que respondem "essa parede está alinhada?".
 *
 *  - VERDE por cima do traço que está sendo desenhado ou puxado, na hora em que
 *    ele fica reto (0°, 45°, 90°). É a confirmação do "gruda sozinho".
 *  - LARANJA nas paredes tortas, com o "Mostrar paredes tortas" ligado: a faixa
 *    por cima da parede e um anel no meio dela, para achar de longe até a
 *    parede curtinha.
 *
 * Sem animação nas duas: o verde acende e apaga a cada pointermove, e o laranja
 * é um mapa do que consertar — movimento numa resposta de alta frequência só
 * atrasa a leitura (a mesma regra da guia magenta, `drawSmartGuides.ts`). Tudo
 * em px de TELA: a mesma leitura em qualquer zoom.
 */
import type { Graphics } from 'pixi.js'
import { screenPxToWorld } from '../lib/smartGuides'
import { ALINHAMENTO_RETO_COLOR, PAREDE_TORTA_COLOR } from './constants'

interface Ponto {
  x: number
  y: number
}

/** Um traço: de onde até onde. */
export type Traco = readonly [Ponto, Ponto]

/** Largura do verde, em px de tela: mais que a guia (1 px), menos que a parede grossa. */
export const ALINHAMENTO_RETO_SCREEN_PX = 3

/** Largura da faixa laranja, em px de tela: sobra dos dois lados da parede média. */
export const PAREDE_TORTA_FAIXA_SCREEN_PX = 7

/** Raio e traço do anel no meio da parede torta, em px de tela. */
export const PAREDE_TORTA_ANEL_SCREEN_PX = 9
const PAREDE_TORTA_ANEL_TRACO_SCREEN_PX = 2

/** A faixa deixa ver a parede por baixo; o anel é cheio para aparecer de longe. */
const PAREDE_TORTA_FAIXA_ALPHA = 0.55

/** Limpa SEMPRE no topo, também sem traço: é assim que o verde do passo anterior some. */
export function drawTracosRetos(graphics: Graphics, tracos: readonly Traco[], cameraScale: number): void {
  graphics.clear()
  if (tracos.length === 0) return
  for (const [de, ate] of tracos) graphics.moveTo(de.x, de.y).lineTo(ate.x, ate.y)
  graphics.stroke({ width: screenPxToWorld(ALINHAMENTO_RETO_SCREEN_PX, cameraScale), color: ALINHAMENTO_RETO_COLOR, cap: 'round' })
}

/** As paredes tortas: todas as faixas num `stroke` só e todos os anéis em outro (dois lotes, não dois por parede). */
export function drawParedesTortas(graphics: Graphics, paredes: readonly { x1: number; y1: number; x2: number; y2: number }[], cameraScale: number): void {
  graphics.clear()
  if (paredes.length === 0) return
  for (const p of paredes) graphics.moveTo(p.x1, p.y1).lineTo(p.x2, p.y2)
  graphics.stroke({ width: screenPxToWorld(PAREDE_TORTA_FAIXA_SCREEN_PX, cameraScale), color: PAREDE_TORTA_COLOR, alpha: PAREDE_TORTA_FAIXA_ALPHA, cap: 'round' })
  const raio = screenPxToWorld(PAREDE_TORTA_ANEL_SCREEN_PX, cameraScale)
  for (const p of paredes) {
    const cx = (p.x1 + p.x2) / 2
    const cy = (p.y1 + p.y2) / 2
    // `moveTo` na borda do círculo: sem ele o traço ligaria um anel ao seguinte.
    graphics.moveTo(cx + raio, cy).circle(cx, cy, raio)
  }
  graphics.stroke({ width: screenPxToWorld(PAREDE_TORTA_ANEL_TRACO_SCREEN_PX, cameraScale), color: PAREDE_TORTA_COLOR })
}
