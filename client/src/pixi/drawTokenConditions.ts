import { CanvasSource, Texture, type Graphics } from 'pixi.js'
import type { CondicaoPropria, TokenCondition } from '../types/map'
import { parseHexColor } from '../lib/tokenColor'
import { simboloDaCondicaoPropria } from '../lib/condicoesProprias'
import { telaDoGlifo } from '../lib/glifoDeCondicao'
import {
  CONDITION_GLYPH_FRACTION,
  CONDITION_GLYPH_STROKE_FRACTION,
  CONDITION_INK,
  CONDITION_OUTLINE_FRACTION,
  CONDITION_TEXT_FRACTION,
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
/** A textura entra com as cores da própria tela: a tinta já foi escolhida na pintura. */
const SEM_TINGIR = 0xffffff

/**
 * A textura de cada símbolo digitado, pela tela dele (`telaDoGlifo` devolve a
 * mesma tela a cada pedido igual). Fraca: a tela que sai da guarda de lá leva a
 * textura junto. Com mipmaps, como os objetos do mapa (`pixi/drawCarimbos.ts`):
 * a tela tem 128 px e a pastilha, de longe, uns 20.
 */
const texturasDosGlifos = new WeakMap<HTMLCanvasElement, Texture>()

function texturaDoGlifo(texto: string, tinta: string): Texture | null {
  const tela = telaDoGlifo(texto, tinta)
  if (tela === null) return null
  const guardada = texturasDosGlifos.get(tela)
  if (guardada !== undefined) return guardada
  const textura = new Texture({ source: new CanvasSource({ resource: tela, autoGenerateMipmaps: true, scaleMode: 'linear' }) })
  texturasDosGlifos.set(tela, textura)
  return textura
}

/** Uma pastilha: disco chapado, contorno escuro e o desenho (ou o símbolo digitado) da condição por cima. */
function drawBadge(graphics: Graphics, symbol: ConditionSymbol, cx: number, cy: number, radius: number): void {
  const fill = parseHexColor(symbol.fill) ?? INK
  // Tinta do desenho: a de sempre, ou a clara que a condição criada pede em cor escura.
  const ink = parseHexColor(symbol.ink) ?? INK
  graphics.circle(cx, cy, radius).fill({ color: fill }).stroke({ width: radius * CONDITION_OUTLINE_FRACTION, color: INK })

  if (symbol.texto !== undefined) {
    // SÍMBOLO DIGITADO: a pintura pronta, no quadrado dele. Sem pintura (teste sem tela), fica só o disco na cor.
    const textura = texturaDoGlifo(symbol.texto, symbol.ink ?? CONDITION_INK)
    const meia = radius * CONDITION_TEXT_FRACTION
    if (textura !== null) graphics.texture(textura, SEM_TINGIR, cx - meia, cy - meia, meia * 2, meia * 2)
    return
  }

  const scale = radius * CONDITION_GLYPH_FRACTION
  const width = radius * CONDITION_GLYPH_STROKE_FRACTION
  const px = (n: number) => cx + n * scale
  const py = (n: number) => cy + n * scale

  for (const solid of symbol.solids ?? []) {
    graphics.poly(solid.flatMap((p) => [px(p.x), py(p.y)])).fill({ color: ink })
  }
  for (const stroke of symbol.strokes) {
    const [first, ...rest] = stroke.points
    if (first === undefined) continue
    graphics.moveTo(px(first.x), py(first.y))
    for (const point of rest) graphics.lineTo(px(point.x), py(point.y))
    if (stroke.closed === true) graphics.closePath()
    graphics.stroke({ width, color: ink, cap: 'round', join: 'round' })
  }
  // Furo = a cor da pastilha por cima da forma cheia (os olhos do fantasma).
  for (const dot of symbol.dots ?? []) {
    graphics.circle(px(dot.x), py(dot.y), dot.r * scale).fill({ color: dot.hole === true ? fill : ink })
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
 *
 * `proprias`: as condições CRIADAS pelo mestre (`lib/condicoesProprias.ts`),
 * já limpas. Entram no mesmo leque, depois das de fábrica.
 */
export function drawTokenConditions(
  graphics: Graphics,
  conditions: readonly TokenCondition[],
  tokenRadius: number,
  gridSize: number,
  proprias: readonly CondicaoPropria[] = [],
): void {
  graphics.clear()
  const symbols = [...conditions.map((condition) => TOKEN_CONDITION_SYMBOLS[condition]), ...proprias.map(simboloDaCondicaoPropria)]
  const layout = conditionBadgeLayout(symbols, tokenRadius, gridSize)
  for (const badge of layout.badges) {
    drawBadge(graphics, badge.condition, badge.x, badge.y, layout.radius)
  }
}
