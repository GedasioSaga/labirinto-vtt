import type { Graphics } from 'pixi.js'
import { CONDITION_INK } from '../lib/tokenConditions'
import { parseHexColor } from '../lib/tokenColor'

/**
 * FICHA SEGURADA PELO MESTRE: o cadeado pequeno na ficha do próprio jogador
 * enquanto o mestre a trava (`Token.locked`). Mesmo idioma das outras marcas
 * da ficha (condição, balão do guarda): pastilha chapada, contorno fino
 * escuro, nada de brilho nem degradê.
 */

/**
 * Nome (`Container.label`) da camada do cadeado dentro da ficha do jogador
 * (`player/PlayerView.tsx`). É por ele que o teste acha a camada.
 */
export const TOKEN_LOCK_LABEL = 'cadeado'

const INK = parseHexColor(CONDITION_INK) ?? 0x1a1a1a
/** Pastilha clara: o cadeado escuro precisa ler sobre qualquer cor de ficha e sobre o chão escuro. */
const LOCK_BADGE_FILL = 0xe6e6e6
/** Raio da pastilha, em fração do raio da ficha, com piso para ficha pequena (o mesmo do balão do guarda). */
const LOCK_RADIUS_FRACTION = 0.42
const LOCK_RADIUS_MIN = 6
/** Contorno da pastilha e traço da alça, em fração do raio da pastilha. */
const LOCK_OUTLINE_FRACTION = 0.16
const LOCK_SHACKLE_STROKE_FRACTION = 0.18
/** Corpo do cadeado e alça, em fração do raio da pastilha. */
const LOCK_BODY_HALF_WIDTH = 0.42
const LOCK_BODY_TOP = -0.05
const LOCK_BODY_BOTTOM = 0.5
const LOCK_SHACKLE_RADIUS = 0.26
/** Quanto a pastilha sai para fora da borda da ficha, em fração do raio dela. */
const LOCK_LEAN_OUT = 0.35

/**
 * O cadeado, sentado na diagonal de cima à ESQUERDA da ficha: o topo é das
 * pastilhas de condição (`drawTokenConditions.ts`) e a diagonal da direita é
 * do balão do guarda (`drawNpcWatch.ts`). Limpa antes de desenhar; `false`
 * deixa a camada vazia.
 */
export function drawTokenLock(graphics: Graphics, locked: boolean, tokenRadius: number): void {
  graphics.clear()
  if (!locked || !Number.isFinite(tokenRadius) || tokenRadius <= 0) return
  const r = Math.max(LOCK_RADIUS_MIN, tokenRadius * LOCK_RADIUS_FRACTION)
  const lean = (tokenRadius + r * LOCK_LEAN_OUT) * Math.SQRT1_2
  const cx = -lean
  const cy = -lean
  graphics.circle(cx, cy, r).fill({ color: LOCK_BADGE_FILL }).stroke({ width: r * LOCK_OUTLINE_FRACTION, color: INK })
  // Alça: meia-volta por cima do corpo. O `moveTo` antes do arco: sem ele o
  // traço sai da origem da ficha até o começo do arco (medido no teste).
  const shackle = r * LOCK_SHACKLE_RADIUS
  const shackleY = cy + r * LOCK_BODY_TOP
  graphics
    .moveTo(cx - shackle, shackleY)
    .arc(cx, shackleY, shackle, Math.PI, Math.PI * 2)
    .stroke({ width: r * LOCK_SHACKLE_STROKE_FRACTION, color: INK, cap: 'round' })
  // Corpo: retângulo cheio sob a alça.
  const half = r * LOCK_BODY_HALF_WIDTH
  graphics.rect(cx - half, cy + r * LOCK_BODY_TOP, half * 2, r * (LOCK_BODY_BOTTOM - LOCK_BODY_TOP)).fill({ color: INK })
}
