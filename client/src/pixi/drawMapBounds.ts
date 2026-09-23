/**
 * ONDA 3 (PLANO-REFINAMENTO.md), item 21 — moldura do mapa. `MapData.width`/
 * `height` (types/map.ts) já existem e aparecem no painel "Cenário", mas o
 * render nunca os usava pra nada — o número é decorativo, e num canvas que
 * parece infinito (roda pana/zoom sem limite, ver world.ts) o usuário não
 * tem nenhuma âncora espacial: não sabe onde o mapa começa nem termina.
 *
 * Duas peças, desenhadas juntas em `drawMapBounds` (mesmo `Graphics`, mesmo
 * `clear()`):
 *  1. um contorno FINO ao redor do retângulo `width*grid` × `height*grid`
 *     (px de mundo) — "discreta de verdade: ela não pode competir com o
 *     conteúdo" (CONTRATO da tarefa), por isso hairline + alpha baixo, e uma
 *     cor neutra que não é usada em nenhum outro lugar do canvas
 *     (`SELECTION_COLOR` é amarelo quente, `WALL_COLOR` é acinzentado mais
 *     escuro — ver drawWalls.ts);
 *  2. uma leve sombra na área FORA do mapa, dentro do viewport visível —
 *     convenção de editor (Figma/Photoshop escurecem fora do artboard/tela).
 *     Só a área fora é sombreada; dentro do mapa nada muda.
 *
 * Decomposição da área "fora" em 4 retângulos sem sobreposição (moldura
 * clássica: faixa de cima, faixa de baixo — largura cheia do viewport — e
 * faixas de esquerda/direita só na banda vertical que sobra, já recortada
 * pelas duas primeiras) — funciona pra QUALQUER posição relativa entre
 * `bounds` e `viewport`, inclusive quando não há sobreposição nenhuma (câmera
 * afastada pra fora do mapa: a moldura cai toda numa única faixa) ou quando o
 * viewport está inteiro dentro do mapa (nenhum retângulo tem área > 0, nada é
 * desenhado — só o contorno aparece).
 */
import type { Graphics } from 'pixi.js'
import type { Viewport } from './grid'
import { STROKE_WEIGHT } from './constants'
import { alignToPixel, strokeWidthInWorld, type PixelGrid } from './pixelAlign'

/** Cor neutra, sem uso em nenhuma outra camada do canvas — não é
 *  `SELECTION_COLOR` (amarelo, "isto está selecionado") nem se aproxima do
 *  cinza de `WALL_COLOR`/grade, pra não ser lida como parede ou linha de
 *  grade extra. */
const MAP_BOUNDS_STROKE_COLOR = 0xd8d8d8
/** Baixo de propósito — "discreta de verdade" (CONTRATO). */
const MAP_BOUNDS_STROKE_ALPHA = 0.4
/** `STROKE_WEIGHT.hairline` (1, pixi/constants.ts): "traço de referência,
 *  quase invisível" — a mesma descrição que este item pede pro contorno. */
const MAP_BOUNDS_STROKE_WIDTH = STROKE_WEIGHT.hairline

/** Preto translúcido — mesma convenção de Figma/Photoshop pra escurecer a
 *  área fora do artboard/tela, sem introduzir uma cor nova no vocabulário do
 *  canvas. */
const OUTSIDE_SHADE_COLOR = 0x000000
const OUTSIDE_SHADE_ALPHA = 0.25

export interface MapBoundsSize {
  width: number
  height: number
  grid: number
}

export interface MapBoundsRect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Retângulo do mapa em px de mundo (`width`/`height` são contagem de
 * células — `grid` é o px por célula, mesma convenção de `contentBounds`,
 * `pixi/world.ts`). `null` quando as dimensões não formam uma área
 * desenhável (zero, negativo, ou não-finito — mapa corrompido ou em
 * construção) — nunca fabrica um retângulo `{0,0,0,0}` que aparentaria "mapa
 * de tamanho zero" na tela; mesmo padrão defensivo de `isDegenerateRegion`
 * (`pixi/shapes.ts`).
 */
export function mapBoundsRect(map: MapBoundsSize): MapBoundsRect | null {
  const { width, height, grid } = map
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(grid)) return null
  if (width <= 0 || height <= 0 || grid <= 0) return null
  return { minX: 0, minY: 0, maxX: width * grid, maxY: height * grid }
}

export interface ShadeRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Geometria PURA (sem Pixi) das faixas "fora do mapa, dentro do viewport
 * visível" — ver docstring do módulo para a decomposição em 4 faixas sem
 * sobreposição. Cada faixa com largura OU altura ≤ 0 é omitida (viewport
 * inteiramente dentro do mapa devolve `[]`), então quem chama nunca recebe
 * um retângulo degenerado pra desenhar.
 */
export function outsideShadeRects(bounds: MapBoundsRect, viewport: Viewport): ShadeRect[] {
  const { left, top, right, bottom } = viewport
  const rects: ShadeRect[] = []

  const addRect = (x: number, y: number, w: number, h: number) => {
    if (w <= 0 || h <= 0) return
    rects.push({ x, y, w, h })
  }

  // Faixa de cima (y < bounds.minY), largura cheia do viewport.
  const topBottom = Math.min(bounds.minY, bottom)
  addRect(left, top, right - left, topBottom - top)

  // Faixa de baixo (y > bounds.maxY), largura cheia do viewport.
  const bottomTop = Math.max(bounds.maxY, top)
  addRect(left, bottomTop, right - left, bottom - bottomTop)

  // Banda vertical que sobra depois das duas faixas acima — só aqui que
  // esquerda/direita precisam desenhar, e só nessa faixa de y.
  const bandTop = Math.max(bounds.minY, top)
  const bandBottom = Math.min(bounds.maxY, bottom)

  // Faixa da esquerda (x < bounds.minX).
  const leftRight = Math.min(bounds.minX, right)
  addRect(left, bandTop, leftRight - left, bandBottom - bandTop)

  // Faixa da direita (x > bounds.maxX).
  const rightLeft = Math.max(bounds.maxX, left)
  addRect(rightLeft, bandTop, right - rightLeft, bandBottom - bandTop)

  return rects
}

/**
 * Desenha em `graphics` as faixas devolvidas por `outsideShadeRects` — um
 * único `fill()` cobrindo todas (mesmo padrão de `computeHatchSegments` +
 * `createRegionsRenderer` em `drawRegions.ts`: geometria pura calculada
 * separado, Pixi só consome). `fill()` só é chamado se houver pelo menos uma
 * faixa — path vazio não é caso que este módulo precisa exercitar.
 */
function drawOutsideShade(graphics: Graphics, bounds: MapBoundsRect, viewport: Viewport): void {
  const rects = outsideShadeRects(bounds, viewport)
  if (rects.length === 0) return
  for (const r of rects) graphics.rect(r.x, r.y, r.w, r.h)
  graphics.fill({ color: OUTSIDE_SHADE_COLOR, alpha: OUTSIDE_SHADE_ALPHA })
}

/**
 * Desenha a moldura do mapa (item 21) em `graphics`: sombra da área fora
 * (recortada ao `viewport` visível) + contorno fino do retângulo
 * `width*grid` × `height*grid`. `map` sem dimensão desenhável (ver
 * `mapBoundsRect`) limpa `graphics` e não desenha nada — sem moldura em vez
 * de moldura errada.
 *
 * Chamar depois de qualquer mudança de câmera (pan/zoom) ou de
 * `width`/`height`/`grid` — mesmo gatilho de `drawGrid` (o `viewport` em px
 * de mundo já é recomputado ali a cada redraw; reusar o mesmo valor evita
 * uma segunda fonte de verdade pro "o que está visível agora").
 */
export function drawMapBounds(graphics: Graphics, map: MapBoundsSize, viewport: Viewport, pixel?: PixelGrid): void {
  graphics.clear()
  const bounds = mapBoundsRect(map)
  if (!bounds) return

  drawOutsideShade(graphics, bounds, viewport)

  // Com `pixel`: 1 px de tela no pixel físico inteiro (sem ele o contorno de
  // 1 px de mundo caía entre dois pixels e saía como 2 px cinza).
  const align = (value: number) => (pixel ? alignToPixel(value, pixel) : value)
  const minX = align(bounds.minX)
  const minY = align(bounds.minY)
  graphics.rect(minX, minY, align(bounds.maxX) - minX, align(bounds.maxY) - minY)
  graphics.stroke({
    width: pixel ? strokeWidthInWorld(pixel) : MAP_BOUNDS_STROKE_WIDTH,
    color: MAP_BOUNDS_STROKE_COLOR,
    alpha: MAP_BOUNDS_STROKE_ALPHA,
  })
}
