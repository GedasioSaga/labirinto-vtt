import type { RegionPoint } from '../types/map'
import type { Point } from '../pixi/world'

/**
 * Índice de canto num polígono de Sala retangular (4 vértices, mesma ordem
 * de `buildRoomFromDraft`, `lib/drawingFactory.ts`): 0 topo-esquerda,
 * 1 topo-direita, 2 baixo-direita, 3 baixo-esquerda — sentido horário em
 * coordenada de tela (y cresce pra baixo). Resize por canto e por
 * largura/altura numérica (`resizeRoomDimensions` abaixo) preservam essa
 * convenção: `points[0]` fica sempre no canto de menor x/menor y.
 */
export type RoomCorner = 0 | 1 | 2 | 3

/**
 * Menor largura/altura aceita ao redimensionar uma Sala retangular, em px de
 * mundo — evita retângulo degenerado (largura ou altura zero/negativa) tanto
 * no arrasto de canto quanto no campo numérico. Mesma ordem de grandeza de
 * `MIN_POLYGON_RADIUS` (`lib/drawingFactory.ts:102`).
 */
export const MIN_ROOM_DIMENSION = 1

/** Tolerância de clique/arrasto sobre a alça de canto de Sala, em px de
 *  mundo — mesma ordem de grandeza de `LIGHT_RADIUS_HANDLE_TOLERANCE`
 *  (`pixi/drawEditHandles.ts`). */
export const ROOM_CORNER_HIT_TOLERANCE = 10

/**
 * Afasta `value` de `anchor` por pelo menos `min`, preservando de que lado de
 * `anchor` ele já estava (ou caindo pro lado positivo se `value === anchor`).
 * Usada por `resizeRoomCorner` pra impedir retângulo degenerado sem inverter
 * o lado do arrasto de propósito — o retângulo só "vira" se o usuário
 * arrastar de fato pro outro lado da âncora, nunca por causa do clamp.
 */
function clampAwayFrom(anchor: number, value: number, min: number): number {
  if (value >= anchor) return Math.max(value, anchor + min)
  return Math.min(value, anchor - min)
}

/**
 * Recalcula os 4 vértices de uma Sala retangular a partir do canto OPOSTO ao
 * arrastado (âncora, que fica fixo) e do canto arrastado, agora em `(x, y)`.
 * Reconstrói o retângulo inteiro em vez de só mover `points[corner]` — o
 * resultado nunca fica torto mesmo se o arrasto cruzar a âncora (o retângulo
 * espelha, mesmo comportamento de alça de resize de qualquer editor).
 *
 * MESMA função de geometria usada por `resizeRoomDimensions` por baixo — as
 * duas convergem pra "reconstruir os 4 cantos a partir de 2 pontos opostos",
 * só a origem do segundo ponto muda (canto arrastado vs. largura/altura
 * somadas à âncora).
 *
 * `points` precisa ter exatamente 4 vértices (contrato de
 * `RoomMeta.shape === 'rect'`); chamado com outro tamanho devolve `points`
 * sem mudança — mesma convenção defensiva de `syncWallsToRegionPoint`
 * (`lib/roomLink.ts`), que também assume o formato e não lança.
 */
export function resizeRoomCorner(points: RegionPoint[], corner: RoomCorner, x: number, y: number): RegionPoint[] {
  if (points.length !== 4) return points

  const anchor = points[(corner + 2) % 4]
  const clampedX = clampAwayFrom(anchor.x, x, MIN_ROOM_DIMENSION)
  const clampedY = clampAwayFrom(anchor.y, y, MIN_ROOM_DIMENSION)

  return rectFromCorners(anchor, { x: clampedX, y: clampedY })
}

/**
 * Recalcula os 4 vértices de uma Sala retangular a partir de largura/altura
 * numéricas — âncora sempre em `points[0]` (canto de menor x/menor y, ver
 * `RoomCorner` acima), que fica fixo; a sala cresce pra baixo e pra direita.
 * `width`/`height` são clampados em `MIN_ROOM_DIMENSION`, mesma trava de
 * `resizeRoomCorner` — um campo zerado ou negativo não produz sala inválida.
 *
 * `points` fora do formato de 4 vértices devolve sem mudança, mesma
 * convenção de `resizeRoomCorner`.
 */
export function resizeRoomDimensions(points: RegionPoint[], width: number, height: number): RegionPoint[] {
  if (points.length !== 4) return points

  const anchor = points[0]
  const w = Math.max(width, MIN_ROOM_DIMENSION)
  const h = Math.max(height, MIN_ROOM_DIMENSION)

  return rectFromCorners(anchor, { x: anchor.x + w, y: anchor.y + h })
}

/** Reconstrói os 4 vértices (topo-esq, topo-dir, baixo-dir, baixo-esq) a
 *  partir de dois cantos quaisquer da diagonal — mesma convenção de
 *  `buildRoomFromDraft` (`lib/drawingFactory.ts`). */
function rectFromCorners(a: RegionPoint, b: RegionPoint): RegionPoint[] {
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)

  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
}

/** Largura/altura atuais de uma Sala retangular, derivadas dos 4 vértices —
 *  para exibir nos campos numéricos de `RoomControls`. `points` fora do
 *  formato de 4 vértices devolve `{ width: 0, height: 0 }`. */
export function roomDimensions(points: RegionPoint[]): { width: number; height: number } {
  if (points.length !== 4) return { width: 0, height: 0 }
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
}

/**
 * Hit-test da alça de canto de Sala retangular — usado no pointerdown da
 * ferramenta Selecionar (com a Sala já selecionada) pra decidir se o clique
 * começou um arrasto de resize em vez de mover a seleção. Mesmo padrão de
 * `findLightRadiusHandleAt` (`pixi/drawEditHandles.ts`): função pura, sem
 * import de `pixi.js`, usada tanto pelo hit-test do PixiCanvas quanto (via
 * `drawRoomHandles`) pelo desenho.
 */
export function findRoomCornerAt(points: RegionPoint[], point: Point, tolerance = ROOM_CORNER_HIT_TOLERANCE): RoomCorner | null {
  if (points.length !== 4) return null
  for (let i = 0; i < 4; i += 1) {
    const corner = points[i]
    if (Math.hypot(point.x - corner.x, point.y - corner.y) <= tolerance) return i as RoomCorner
  }
  return null
}
