import type { Graphics } from 'pixi.js'
import { CONDITION_INK } from '../lib/tokenConditions'
import { parseHexColor } from '../lib/tokenColor'
import { cornerBadgeOf } from './drawTokenLock'

/**
 * CONGELAR FICHA: o floco pequeno na ficha que o mestre congelou
 * (`Token.congelado`). Na tela de quem joga, só na PRÓPRIA ficha; no mapa do
 * mestre, em toda ficha congelada (`tokensRenderer.ts`). Mesmo idioma das
 * outras marcas da ficha (condição, cadeado): pastilha chapada, contorno fino
 * escuro, nada de brilho nem degradê — e o mesmo canto do cadeado
 * (`cornerBadgeOf`), que vence quando os dois valem: ele segura mais.
 */

/**
 * Nome (`Container.label`) da camada do floco dentro da ficha do jogador
 * (`player/PlayerView.tsx`). É por ele que o teste acha a camada.
 */
export const TOKEN_FROST_LABEL = 'floco'

const INK = parseHexColor(CONDITION_INK) ?? 0x1a1a1a
/** Pastilha azul-gelo: lê como "gelo" sobre qualquer cor de ficha e sobre o chão escuro, e não se confunde com a cinza do cadeado. */
const FROST_BADGE_FILL = 0xcfe8ff
/** Contorno da pastilha e traço do floco, em fração do raio da pastilha. */
const FROST_OUTLINE_FRACTION = 0.16
const FROST_STROKE_FRACTION = 0.14
/** Seis braços: do centro até esta fração do raio da pastilha. */
const FROST_ARM_FRACTION = 0.62
const FROST_ARMS = 6
/** Os galhinhos de cada braço: onde saem (fração do braço), o comprimento (fração do raio) e a abertura. */
const FROST_TWIG_AT = 0.55
const FROST_TWIG_LENGTH = 0.22
const FROST_TWIG_ANGLE = Math.PI / 4

/**
 * O floco, somado ao que `graphics` já tem — o anel da ficha no mapa do
 * mestre leva seleção, vez e selo do Volto já, e o floco entra sem slot novo.
 */
export function drawFrostBadge(graphics: Graphics, tokenRadius: number): void {
  const badge = cornerBadgeOf(tokenRadius)
  if (badge === null) return
  const { cx, cy, r } = badge
  graphics.circle(cx, cy, r).fill({ color: FROST_BADGE_FILL }).stroke({ width: r * FROST_OUTLINE_FRACTION, color: INK })
  const arm = r * FROST_ARM_FRACTION
  const twig = r * FROST_TWIG_LENGTH
  for (let i = 0; i < FROST_ARMS; i += 1) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / FROST_ARMS
    const tipX = cx + Math.cos(angle) * arm
    const tipY = cy + Math.sin(angle) * arm
    graphics.moveTo(cx, cy).lineTo(tipX, tipY)
    const baseX = cx + Math.cos(angle) * arm * FROST_TWIG_AT
    const baseY = cy + Math.sin(angle) * arm * FROST_TWIG_AT
    for (const side of [-1, 1]) {
      const twigAngle = angle + side * FROST_TWIG_ANGLE
      graphics.moveTo(baseX, baseY).lineTo(baseX + Math.cos(twigAngle) * twig, baseY + Math.sin(twigAngle) * twig)
    }
  }
  graphics.stroke({ width: r * FROST_STROKE_FRACTION, color: INK, cap: 'round' })
}

/** A camada própria do floco (tela do jogador): limpa antes; `false` deixa vazia. */
export function drawTokenFrozen(graphics: Graphics, frozen: boolean, tokenRadius: number): void {
  graphics.clear()
  if (frozen) drawFrostBadge(graphics, tokenRadius)
}
