import type { Graphics } from 'pixi.js'
import type { TokenCondition } from '../types/map'
import { parseHexColor } from '../lib/tokenColor'
import {
  CONDITION_GLYPH_FRACTION,
  CONDITION_GLYPH_STROKE_FRACTION,
  CONDITION_INK,
  CONDITION_OUTLINE_FRACTION,
  TOKEN_CONDITION_SYMBOLS,
  conditionBadgeLayout,
  type ConditionSymbol,
} from '../lib/tokenConditions'

/**
 * Nome (`Container.label`) da camada de marcas dentro da ficha — no editor
 * (`pixi/tokensRenderer.ts`) e na tela do jogador (`player/PlayerView.tsx`).
 * É por ele que o teste acha a camada sem depender da posição na pilha.
 */
export const CONDITION_MARKS_LABEL = 'condicoes'

const INK = parseHexColor(CONDITION_INK) ?? 0x1a1a1a

/** Uma pastilha: disco chapado, contorno escuro e o desenho da condição por cima. */
function drawBadge(graphics: Graphics, symbol: ConditionSymbol, cx: number, cy: number, radius: number): void {
  const fill = parseHexColor(symbol.fill) ?? INK
  graphics.circle(cx, cy, radius).fill({ color: fill }).stroke({ width: radius * CONDITION_OUTLINE_FRACTION, color: INK })

  const scale = radius * CONDITION_GLYPH_FRACTION
  const width = radius * CONDITION_GLYPH_STROKE_FRACTION
  const px = (n: number) => cx + n * scale
  const py = (n: number) => cy + n * scale

  for (const solid of symbol.solids ?? []) {
    graphics.poly(solid.flatMap((p) => [px(p.x), py(p.y)])).fill({ color: INK })
  }
  for (const stroke of symbol.strokes) {
    const [first, ...rest] = stroke.points
    if (first === undefined) continue
    graphics.moveTo(px(first.x), py(first.y))
    for (const point of rest) graphics.lineTo(px(point.x), py(point.y))
    if (stroke.closed === true) graphics.closePath()
    graphics.stroke({ width, color: INK, cap: 'round', join: 'round' })
  }
  // Furo = a cor da pastilha por cima da forma cheia (os olhos do fantasma).
  for (const dot of symbol.dots ?? []) {
    graphics.circle(px(dot.x), py(dot.y), dot.r * scale).fill({ color: dot.hole === true ? fill : INK })
  }
}

/**
 * As marcas de condição de UMA ficha, em volta da origem do `graphics` — que o
 * chamador põe no centro da ficha, sem girar junto com o disco: a marca fica
 * sempre em pé e em cima. Limpa antes de desenhar; lista vazia deixa a camada
 * vazia.
 *
 * `tokenRadius` é o raio do disco como cada tela o desenha — o editor tira 2 px
 * de respiro, o jogador não —, para a pastilha sentar na borda que a pessoa vê.
 */
export function drawTokenConditions(graphics: Graphics, conditions: readonly TokenCondition[], tokenRadius: number, gridSize: number): void {
  graphics.clear()
  const layout = conditionBadgeLayout(conditions, tokenRadius, gridSize)
  for (const badge of layout.badges) {
    drawBadge(graphics, TOKEN_CONDITION_SYMBOLS[badge.condition], badge.x, badge.y, layout.radius)
  }
}
