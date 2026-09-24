/**
 * Ferramenta "Selecionar área" (pedido N3 do usuário: "eu seleciono uma área
 * e eu posso mover os objetos para um outro local"). Duas responsabilidades
 * puras, sem PixiJS nem store:
 *
 *  1. `selectEntitiesInArea` — dado um retângulo em coordenadas de mundo,
 *     decide quais entidades do MapData caem dentro (contenção ou
 *     interseção, ver `areaSelectionMode`).
 *  2. `moveAreaSelection` — dado o resultado de (1) e um delta (dx, dy),
 *     devolve um MapData novo com todas essas entidades deslocadas.
 *
 * Reusa (nunca reimplementa) o que já existe: `lib/layers.ts` para o filtro
 * de camada oculta, `lib/itemTransform.ts` para o filtro de item travado, e
 * `lib/selectionHitTest.ts` (`isPointInPolygon`/`estimateTextWidth`) para os
 * dois pedaços de geometria que já tinham uma fonte única de verdade.
 * `lib/selectionHitTest.ts` NÃO é editado por este arquivo — é do agente B3
 * nesta fase.
 */
import type { MapData, Wall, Region, Light, Token, Prop, Stair, Drawing } from '../types/map'
import type { Point } from './selectionHitTest'
import { isPointInPolygon, estimateTextWidth } from './selectionHitTest'
import { visibleWalls, visibleRegions, visibleLights, visibleTokens, visibleProps, visibleStairs, visibleDrawings } from './layers'
import { canInteract } from './itemTransform'
import { isDegenerateRegion } from '../pixi/shapes'
import { moveWall, moveRegion, moveStair } from './mapFactory'
import { ancestorsOf, subtreeIds } from './roomNesting'
import { carryAttachedLights } from './lightAttachment'
import { stairSpiralCircle } from './stairs'

// ─────────────────────────────────────────────────────────────
// Geometria genérica: todo tipo de entidade do mapa se reduz a um destes 5
// formatos. Escrever o teste de contenção/interseção UMA vez por formato (em
// vez de uma vez por tipo de entidade) é o que mantém esta seção pequena e
// testável — 7 tipos de entidade, só 5 formas geométricas.
// ─────────────────────────────────────────────────────────────

export interface AreaBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type AreaGeometryEntity =
  | { kind: 'point'; x: number; y: number }
  | { kind: 'circle'; cx: number; cy: number; radius: number }
  | { kind: 'rect'; minX: number; minY: number; maxX: number; maxY: number }
  | { kind: 'segments'; segments: Array<{ a: Point; b: Point }> }
  | { kind: 'polygon'; points: Point[] } // fechado (última aresta volta ao primeiro ponto)
  | { kind: 'polyline'; points: Point[] } // aberto

function pointInRect(point: Point, rect: AreaBounds): boolean {
  return point.x >= rect.minX && point.x <= rect.maxX && point.y >= rect.minY && point.y <= rect.maxY
}

function rectContainsRect(outer: AreaBounds, inner: AreaBounds): boolean {
  return inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY
}

function rectsOverlap(a: AreaBounds, b: AreaBounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

function rectCorners(rect: AreaBounds): Point[] {
  return [
    { x: rect.minX, y: rect.minY },
    { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY },
    { x: rect.minX, y: rect.maxY },
  ]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function circleIntersectsRect(cx: number, cy: number, radius: number, rect: AreaBounds): boolean {
  const closestX = clamp(cx, rect.minX, rect.maxX)
  const closestY = clamp(cy, rect.minY, rect.maxY)
  return Math.hypot(cx - closestX, cy - closestY) <= radius
}

/** Orientação do triplo (a,b,c) pelo sinal do produto vetorial — base do
 *  teste clássico de interseção segmento-segmento usado por `segmentsIntersect`. */
function orientation(a: Point, b: Point, c: Point): -1 | 0 | 1 {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)
  if (value === 0) return 0
  return value > 0 ? 1 : -1
}

/** Só chamada quando `a`, `b`, `c` já são colineares (orientation 0) — checa
 *  se `b` cai dentro da caixa delimitada por `a`/`c`. */
function onSegment(a: Point, b: Point, c: Point): boolean {
  return (
    Math.min(a.x, c.x) <= b.x && b.x <= Math.max(a.x, c.x) && Math.min(a.y, c.y) <= b.y && b.y <= Math.max(a.y, c.y)
  )
}

/** Interseção segmento-segmento por orientação, incluindo o caso colinear
 *  (necessário porque as arestas do retângulo de seleção são sempre
 *  horizontais/verticais — colinear com paredes/linhas na mesma direção não
 *  é raro). */
function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const o1 = orientation(p1, p2, p3)
  const o2 = orientation(p1, p2, p4)
  const o3 = orientation(p3, p4, p1)
  const o4 = orientation(p3, p4, p2)

  if (o1 !== o2 && o3 !== o4) return true

  if (o1 === 0 && onSegment(p1, p3, p2)) return true
  if (o2 === 0 && onSegment(p1, p4, p2)) return true
  if (o3 === 0 && onSegment(p3, p1, p4)) return true
  if (o4 === 0 && onSegment(p3, p2, p4)) return true

  return false
}

function segmentIntersectsRect(a: Point, b: Point, rect: AreaBounds): boolean {
  if (pointInRect(a, rect) || pointInRect(b, rect)) return true
  const corners = rectCorners(rect)
  for (let i = 0; i < 4; i += 1) {
    if (segmentsIntersect(a, b, corners[i], corners[(i + 1) % 4])) return true
  }
  return false
}

/** `closed=true` fecha o último ponto de volta ao primeiro (Região, Drawing
 *  'polygon'); `closed=false` trata como traço aberto (freehand, curve). */
function polylineIntersectsRect(points: Point[], rect: AreaBounds, closed: boolean): boolean {
  if (points.some((p) => pointInRect(p, rect))) return true
  // Um retângulo de seleção pode cair inteiro DENTRO de um polígono grande
  // (ex.: marquee pequeno no meio de uma Sala enorme) sem que nenhum vértice
  // do polígono nem nenhuma aresta cruze o retângulo — só um canto do
  // retângulo "dentro" do polígono acusa esse caso. Não se aplica a formato
  // aberto (freehand/curve não têm "dentro").
  if (closed && rectCorners(rect).some((corner) => isPointInPolygon(corner, points))) return true
  const n = points.length
  const segmentCount = closed ? n : n - 1
  for (let i = 0; i < segmentCount; i += 1) {
    if (segmentIntersectsRect(points[i], points[(i + 1) % n], rect)) return true
  }
  return false
}

function entityBounds(entity: AreaGeometryEntity): AreaBounds {
  switch (entity.kind) {
    case 'point':
      return { minX: entity.x, maxX: entity.x, minY: entity.y, maxY: entity.y }
    case 'circle':
      return {
        minX: entity.cx - entity.radius,
        maxX: entity.cx + entity.radius,
        minY: entity.cy - entity.radius,
        maxY: entity.cy + entity.radius,
      }
    case 'rect':
      return { minX: entity.minX, maxX: entity.maxX, minY: entity.minY, maxY: entity.maxY }
    case 'segments': {
      const xs = entity.segments.flatMap((s) => [s.a.x, s.b.x])
      const ys = entity.segments.flatMap((s) => [s.a.y, s.b.y])
      return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
    }
    case 'polygon':
    case 'polyline': {
      const xs = entity.points.map((p) => p.x)
      const ys = entity.points.map((p) => p.y)
      return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
    }
  }
}

/**
 * Teste único de contenção/interseção, genérico sobre a forma geométrica —
 * `mode='contain'` exige que a entidade caiba INTEIRA dentro do retângulo;
 * `mode='intersect'` basta tocar. Círculo usa bounding-box pra contenção
 * (exato: um círculo sempre cabe dentro do próprio bounding box, então "bbox
 * cabe no retângulo" ⟺ "círculo cabe no retângulo") e teste de distância
 * ponto-mais-perto pra interseção (também exato).
 */
function matchesArea(entity: AreaGeometryEntity, rect: AreaBounds, mode: AreaSelectionMode): boolean {
  switch (entity.kind) {
    case 'point':
      return pointInRect(entity, rect)
    case 'circle':
      if (mode === 'contain') return rectContainsRect(rect, entityBounds(entity))
      return circleIntersectsRect(entity.cx, entity.cy, entity.radius, rect)
    case 'rect':
      return mode === 'contain' ? rectContainsRect(rect, entity) : rectsOverlap(rect, entity)
    case 'segments':
      if (mode === 'contain') return entity.segments.every((s) => pointInRect(s.a, rect) && pointInRect(s.b, rect))
      return entity.segments.some((s) => segmentIntersectsRect(s.a, s.b, rect))
    case 'polygon':
      if (mode === 'contain') return entity.points.every((p) => pointInRect(p, rect))
      return polylineIntersectsRect(entity.points, rect, true)
    case 'polyline':
      if (mode === 'contain') return entity.points.every((p) => pointInRect(p, rect))
      return polylineIntersectsRect(entity.points, rect, false)
  }
}

// ─────────────────────────────────────────────────────────────
// Um construtor de AreaGeometryEntity por tipo de entidade do mapa.
// ─────────────────────────────────────────────────────────────

function wallEntity(wall: Wall): AreaGeometryEntity {
  return { kind: 'segments', segments: [{ a: { x: wall.x1, y: wall.y1 }, b: { x: wall.x2, y: wall.y2 } }] }
}

function stairEntity(stair: Stair): AreaGeometryEntity {
  // Espiral: a área cerca ou toca o círculo desenhado, não o diâmetro arrastado.
  const circle = stairSpiralCircle(stair)
  if (circle !== null) return { kind: 'circle', cx: circle.center.x, cy: circle.center.y, radius: circle.radius }
  return {
    kind: 'segments',
    segments: stair.segments.map((seg) => ({ a: { x: seg.x1, y: seg.y1 }, b: { x: seg.x2, y: seg.y2 } })),
  }
}

function lightEntity(light: Light): AreaGeometryEntity {
  return { kind: 'point', x: light.x, y: light.y }
}

function regionEntity(region: Region): AreaGeometryEntity {
  return { kind: 'polygon', points: region.points }
}

/** Raio de seleção do Token = mesma fórmula de `findTokenAt`
 *  (`pixi/tokenInteraction.ts:82-86`: metade da célula de grade × `token.size`).
 *  A fórmula é duplicada aqui (não importada) de propósito: `findTokenAt`
 *  embute a varredura da lista inteira + prioridade de topo-pra-baixo junto
 *  com a conta do raio; só a conta interessa pra geometria de área, e
 *  importar a função inteira pra extrair 1 linha seria mais confuso que
 *  repetir a linha com a referência de onde ela vem. */
function tokenEntity(token: Token, gridSize: number): AreaGeometryEntity {
  return { kind: 'circle', cx: token.x, cy: token.y, radius: (gridSize / 2) * token.size }
}

/** `prop.x`/`prop.y` é o CENTRO do objeto, não o canto — mesma convenção de
 *  `pixi/propInteraction.ts:6-9` (`findPropAt`), reusada aqui em vez de
 *  redefinida. */
function propEntity(prop: Prop): AreaGeometryEntity {
  const halfW = prop.width / 2
  const halfH = prop.height / 2
  return { kind: 'rect', minX: prop.x - halfW, maxX: prop.x + halfW, minY: prop.y - halfH, maxY: prop.y + halfH }
}

function drawingEntity(drawing: Drawing): AreaGeometryEntity {
  switch (drawing.kind) {
    case 'freehand':
      return { kind: 'polyline', points: drawing.points }
    case 'line':
      return {
        kind: 'segments',
        segments: [{ a: { x: drawing.x1, y: drawing.y1 }, b: { x: drawing.x2, y: drawing.y2 } }],
      }
    case 'circle':
      return { kind: 'circle', cx: drawing.cx, cy: drawing.cy, radius: drawing.radius }
    case 'curve':
      // Mesma aproximação de `findDrawingAt` (selectionHitTest.ts:119-120):
      // usa os pontos de CONTROLE brutos, não a curva bezier suavizada que
      // `catmullRomToBezierSegments` gera só na hora de desenhar — geometria
      // de seleção sempre trabalhou sobre o polígono de controle.
      return { kind: 'polyline', points: drawing.points }
    case 'text': {
      // Mesma caixa aproximada de `estimateTextWidth` (selectionHitTest.ts),
      // sem a folga de tolerância de clique (+4px) que a função de hit-test
      // usa — aqui é geometria de área, não alvo de clique.
      const width = estimateTextWidth(drawing.text, drawing.fontSize)
      return { kind: 'rect', minX: drawing.x, maxX: drawing.x + width, minY: drawing.y, maxY: drawing.y + drawing.fontSize }
    }
    case 'rect':
      return { kind: 'rect', minX: drawing.x, maxX: drawing.x + drawing.w, minY: drawing.y, maxY: drawing.y + drawing.h }
    case 'ellipse':
      // Bounding box, não a elipse exata — mesma classe de heurística de
      // `estimateTextWidth`: suficiente pra selecionar por área, só
      // super-inclui um pouco perto dos 4 cantos da caixa.
      return {
        kind: 'rect',
        minX: drawing.cx - drawing.rx,
        maxX: drawing.cx + drawing.rx,
        minY: drawing.cy - drawing.ry,
        maxY: drawing.cy + drawing.ry,
      }
    case 'polygon':
      return { kind: 'polygon', points: drawing.points }
    case 'path':
      // Traço ABERTO, como freehand/curve: a trilha nunca fecha sozinha, e
      // tratá-la como polígono selecionaria por engano tudo o que estivesse
      // dentro da área que ela contorna.
      return { kind: 'polyline', points: drawing.points }
  }
}

// ─────────────────────────────────────────────────────────────
// API pública — 1. seleção por área
// ─────────────────────────────────────────────────────────────

export interface AreaRect {
  x1: number
  y1: number
  x2: number
  y2: number
}

export type AreaSelectionMode = 'contain' | 'intersect'

/**
 * Convenção padrão de editor 2D/CAD: arrasto da ESQUERDA pra DIREITA
 * (`x2 >= x1`) seleciona por CONTENÇÃO TOTAL — só entra o que cabe inteiro
 * dentro do retângulo. Arrasto da DIREITA pra ESQUERDA (`x2 < x1`) seleciona
 * por INTERSECÇÃO — entra tudo que toca o retângulo, mesmo que sobre pra
 * fora. A decisão olha só o eixo X (mesma convenção usada por AutoCAD e a
 * maioria dos editores vetoriais); o eixo Y do arrasto não muda o modo.
 */
export function areaSelectionMode(rect: AreaRect): AreaSelectionMode {
  return rect.x2 >= rect.x1 ? 'contain' : 'intersect'
}

function normalizeRect(rect: AreaRect): AreaBounds {
  return {
    minX: Math.min(rect.x1, rect.x2),
    maxX: Math.max(rect.x1, rect.x2),
    minY: Math.min(rect.y1, rect.y2),
    maxY: Math.max(rect.y1, rect.y2),
  }
}

/** Abaixo disso (em px de mundo, nos dois eixos) o arrasto é tratado como um
 *  clique acidental, não uma intenção de marquee — evita que um pointerdown/
 *  pointerup quase parado sem mover o mouse dispare uma seleção vazia ou,
 *  pior, selecione tudo que passa a colar na borda por erro de arredondamento
 *  de ponto flutuante. Mesma ordem de grandeza de `MIN_ROOM_DIMENSION`
 *  (`lib/roomOps.ts`), só que aplicada aos dois eixos, não a um só. */
const AREA_SELECTION_MIN_DRAG = 4

export interface AreaSelection {
  walls: string[]
  regions: string[]
  lights: string[]
  tokens: string[]
  props: string[]
  stairs: string[]
  drawings: string[]
}

export const EMPTY_AREA_SELECTION: AreaSelection = {
  walls: [],
  regions: [],
  lights: [],
  tokens: [],
  props: [],
  stairs: [],
  drawings: [],
}

export function isAreaSelectionEmpty(selection: AreaSelection): boolean {
  return (
    selection.walls.length === 0 &&
    selection.regions.length === 0 &&
    selection.lights.length === 0 &&
    selection.tokens.length === 0 &&
    selection.props.length === 0 &&
    selection.stairs.length === 0 &&
    selection.drawings.length === 0
  )
}

/**
 * Decide quais entidades do `map` caem dentro de `rect` (contenção ou
 * interseção — `areaSelectionMode`), agrupadas por tipo. Duas camadas de
 * filtro ANTES do teste geométrico, nesta ordem, pedidas explicitamente pela
 * tarefa:
 *
 *  1. Camada oculta (`map.hiddenLayers`) — via `visibleWalls`/`visibleRegions`/
 *     etc. de `lib/layers.ts`, a MESMA fonte de verdade que o render e o
 *     hit-test de clique (`findSelectableAt`) já usam. Item numa camada
 *     escondida nunca entra, mesmo que geometricamente esteja dentro do
 *     retângulo.
 *  2. Item travado (`locked === true`) — via `canInteract` de
 *     `lib/itemTransform.ts`. `Drawing` não tem campo `locked` no schema
 *     (types/map.ts), por isso não passa por este filtro.
 *
 * Região degenerada (`points.length < 3`, `pixi/shapes.ts` →
 * `isDegenerateRegion`) nunca entra — mesma guarda que `drawRegions.ts` usa
 * pra não desenhar uma região sem geometria válida.
 */
export function selectEntitiesInArea(map: MapData, rect: AreaRect): AreaSelection {
  if (Math.abs(rect.x2 - rect.x1) < AREA_SELECTION_MIN_DRAG && Math.abs(rect.y2 - rect.y1) < AREA_SELECTION_MIN_DRAG) {
    return EMPTY_AREA_SELECTION
  }

  const normalized = normalizeRect(rect)
  const mode = areaSelectionMode(rect)
  const inArea = (entity: AreaGeometryEntity) => matchesArea(entity, normalized, mode)

  const walls = visibleWalls(map.walls, map.hiddenLayers)
    .filter((wall) => canInteract(wall))
    .filter((wall) => inArea(wallEntity(wall)))
    .map((wall) => wall.id)

  const regions = visibleRegions(map.regions, map.hiddenLayers)
    .filter((region) => canInteract(region))
    .filter((region) => !isDegenerateRegion(region.points))
    .filter((region) => inArea(regionEntity(region)))
    .map((region) => region.id)

  const lights = visibleLights(map.lights, map.hiddenLayers)
    .filter((light) => canInteract(light))
    .filter((light) => inArea(lightEntity(light)))
    .map((light) => light.id)

  const tokens = visibleTokens(map.tokens, map.hiddenLayers)
    .filter((token) => canInteract(token))
    .filter((token) => inArea(tokenEntity(token, map.grid)))
    .map((token) => token.id)

  const props = visibleProps(map.props, map.hiddenLayers)
    .filter((prop) => canInteract(prop))
    .filter((prop) => inArea(propEntity(prop)))
    .map((prop) => prop.id)

  const stairs = visibleStairs(map.stairs, map.hiddenLayers)
    .filter((stair) => canInteract(stair))
    .filter((stair) => inArea(stairEntity(stair)))
    .map((stair) => stair.id)

  const drawings = visibleDrawings(map.drawings, map.hiddenLayers)
    .filter((drawing) => inArea(drawingEntity(drawing)))
    .map((drawing) => drawing.id)

  return { walls, regions, lights, tokens, props, stairs, drawings }
}

/**
 * Bounding box de todas as entidades HOJE presentes em `selection`, usada
 * pra desenhar o contorno do grupo já selecionado (`pixi/drawSelectionMarquee.ts`
 * → `drawAreaSelectionOutline`). `null` se a seleção estiver vazia ou se
 * nenhum dos ids ainda existir no mapa (ex.: tudo apagado entre o fim do
 * arrasto e o próximo redraw) — o chamador simplesmente não desenha nada
 * nesse caso.
 */
export function areaSelectionBounds(map: MapData, selection: AreaSelection): AreaBounds | null {
  const bounds: AreaBounds[] = []

  for (const id of selection.walls) {
    const wall = map.walls.find((w) => w.id === id)
    if (wall) bounds.push(entityBounds(wallEntity(wall)))
  }
  for (const id of selection.regions) {
    const region = map.regions.find((r) => r.id === id)
    if (region) bounds.push(entityBounds(regionEntity(region)))
  }
  for (const id of selection.lights) {
    const light = map.lights.find((l) => l.id === id)
    if (light) bounds.push(entityBounds(lightEntity(light)))
  }
  for (const id of selection.tokens) {
    const token = map.tokens.find((t) => t.id === id)
    if (token) bounds.push(entityBounds(tokenEntity(token, map.grid)))
  }
  for (const id of selection.props) {
    const prop = map.props.find((p) => p.id === id)
    if (prop) bounds.push(entityBounds(propEntity(prop)))
  }
  for (const id of selection.stairs) {
    const stair = map.stairs.find((s) => s.id === id)
    if (stair) bounds.push(entityBounds(stairEntity(stair)))
  }
  for (const id of selection.drawings) {
    const drawing = map.drawings.find((d) => d.id === id)
    if (drawing) bounds.push(entityBounds(drawingEntity(drawing)))
  }

  if (bounds.length === 0) return null

  return {
    minX: Math.min(...bounds.map((b) => b.minX)),
    maxX: Math.max(...bounds.map((b) => b.maxX)),
    minY: Math.min(...bounds.map((b) => b.minY)),
    maxY: Math.max(...bounds.map((b) => b.maxY)),
  }
}

// ─────────────────────────────────────────────────────────────
// API pública — 2. mover o conjunto selecionado
// ─────────────────────────────────────────────────────────────

/**
 * Move UM Drawing por delta — cobre os 8 kinds do schema (types/map.ts).
 * DIFERENTE de propósito de `moveDrawing` (`lib/mapFactory.ts:589-612`): essa
 * função só translada freehand/curve/line/circle/text — os 3 kinds mais
 * novos do schema (rect, ellipse, polygon, da Fase 1) caem no
 * `default: return d` de lá, um no-op documentado como "rede de segurança".
 * Como a seleção por área é a PRIMEIRA forma de selecionar esses 3 kinds
 * (o clique direto ainda não tem hit-test pra eles — `selectionHitTest.ts:128`,
 * comentário do próprio time confirma que é proposital/pendente), reusar
 * `moveDrawing` faria o usuário arrastar um retângulo/elipse/polígono
 * selecionado por área e nada se mover, silenciosamente — pior que um erro,
 * porque não avisa. Por isso esta função própria e completa, em vez de
 * importar a de `mapFactory.ts`. Não é um `any`/`as`/`!`/`@ts-ignore` — é
 * só a decisão de não depender de uma função com um caso conhecido faltando.
 */
function moveDrawingItem(drawing: Drawing, dx: number, dy: number): Drawing {
  switch (drawing.kind) {
    case 'freehand':
    case 'curve':
      return { ...drawing, points: drawing.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
    case 'line':
      return { ...drawing, x1: drawing.x1 + dx, y1: drawing.y1 + dy, x2: drawing.x2 + dx, y2: drawing.y2 + dy }
    case 'circle':
      return { ...drawing, cx: drawing.cx + dx, cy: drawing.cy + dy }
    case 'text':
      return { ...drawing, x: drawing.x + dx, y: drawing.y + dy }
    case 'rect':
      return { ...drawing, x: drawing.x + dx, y: drawing.y + dy }
    case 'ellipse':
      return { ...drawing, cx: drawing.cx + dx, cy: drawing.cy + dy }
    case 'polygon':
    case 'path':
      return { ...drawing, points: drawing.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
  }
}

/**
 * Move todas as entidades de `selection` por (dx, dy) — a função central do
 * pedido N3. Mesmo estilo imutável de `lib/mapFactory.ts`: devolve um
 * `MapData` novo, nunca muta `map`; `dx === 0 && dy === 0` devolve `map` pela
 * mesma referência (mesma convenção defensiva de `moveWall`/`moveRegion`
 * quando o id não existe).
 *
 * ORDEM IMPORTA pra Região/Parede: `moveRegion` (`lib/mapFactory.ts`) já
 * translada toda parede vinculada a ela (`wall.regionId`, via
 * `translateLinkedWalls`, `lib/roomLink.ts`). Se a região E uma de suas
 * paredes estiverem as duas em `selection` (comum — selecionar uma Sala por
 * área pega o preenchimento E as 4 paredes da borda), mover a região
 * primeiro e DEPOIS pular essa parede evita somar o delta duas vezes.
 * `movedRegionIds` registra toda região já deslocada, seja porque estava em
 * `selection.regions`, seja por delegação de uma parede irmã já processada
 * (2+ paredes de uma Sala selecionadas SEM a região em si: a primeira aciona
 * `moveWall` → `moveRegion` da região inteira, a segunda tem que ser pulada
 * pelo mesmo motivo — `moveWall` delega pra `moveRegion` sempre que
 * `wall.regionId !== undefined`, mesmo se a região não estiver na seleção).
 *
 * Segunda camada de defesa: mesmo com `selectEntitiesInArea` já filtrando
 * item travado, este laço confere `canInteract` de novo em cima do estado
 * ATUAL do mapa (`next`, não do `map` original) — cobre o caso de a seleção
 * ter sido calculada antes de alguém travar o item no meio do arrasto.
 */
export function moveAreaSelection(map: MapData, selection: AreaSelection, dx: number, dy: number): MapData {
  if (dx === 0 && dy === 0) return map

  let next = map
  const movedRegionIds = new Set<string>()

  for (const regionId of selection.regions) {
    const region = next.regions.find((r) => r.id === regionId)
    if (!region || !canInteract(region) || movedRegionIds.has(regionId)) continue
    // Sub-sala cuja sala de fora também está na seleção já anda com ela.
    if (ancestorsOf(next.regions, regionId).some((a) => selection.regions.includes(a.id) && canInteract(a))) continue
    next = moveRegion(next, regionId, dx, dy)
    // moveRegion leva a subárvore: paredes das sub-salas não podem andar de novo.
    for (const id of subtreeIds(next.regions, regionId)) movedRegionIds.add(id)
  }

  for (const wallId of selection.walls) {
    const wall = next.walls.find((w) => w.id === wallId)
    if (!wall || !canInteract(wall)) continue
    if (wall.regionId !== undefined) {
      if (movedRegionIds.has(wall.regionId)) continue
      movedRegionIds.add(wall.regionId)
    }
    next = moveWall(next, wallId, dx, dy)
  }

  for (const stairId of selection.stairs) {
    const stair = next.stairs.find((s) => s.id === stairId)
    if (!stair || !canInteract(stair)) continue
    next = moveStair(next, stairId, dx, dy)
  }

  if (selection.lights.length > 0) {
    const lightIds = new Set(selection.lights)
    next = {
      ...next,
      lights: next.lights.map((l) => (lightIds.has(l.id) && canInteract(l) ? { ...l, x: l.x + dx, y: l.y + dy } : l)),
    }
  }

  if (selection.tokens.length > 0) {
    const tokenIds = new Set(selection.tokens)
    const movedTokenIds = new Set(next.tokens.filter((t) => tokenIds.has(t.id) && canInteract(t)).map((t) => t.id))
    // Tocha presa na ficha vai junto; a luz que também estava na seleção já andou acima.
    const movedLightIds = new Set(next.lights.filter((l) => selection.lights.includes(l.id) && canInteract(l)).map((l) => l.id))
    next = {
      ...next,
      tokens: next.tokens.map((t) => (movedTokenIds.has(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t)),
      lights: carryAttachedLights(next.lights, movedTokenIds, dx, dy, movedLightIds),
    }
  }

  if (selection.props.length > 0) {
    const propIds = new Set(selection.props)
    next = {
      ...next,
      props: next.props.map((p) => (propIds.has(p.id) && canInteract(p) ? { ...p, x: p.x + dx, y: p.y + dy } : p)),
    }
  }

  if (selection.drawings.length > 0) {
    const drawingIds = new Set(selection.drawings)
    next = {
      ...next,
      drawings: next.drawings.map((d) => (drawingIds.has(d.id) ? moveDrawingItem(d, dx, dy) : d)),
    }
  }

  return next
}

// ─────────────────────────────────────────────────────────────
// API pública — 3. leitura do GESTO de marquee
//
// A partir de 17/09/2026 o arrasto em área vazia com a ferramenta Selecionar
// É o marquee (antes ele panava a câmera e ainda limpava a seleção; o Shift
// que ligava o retângulo era invisível e ninguém o descobria — jornada
// `e2e/task-jornada-selecao-arrasto.spec.ts`). Com isso, o MESMO gesto
// precisa significar três coisas diferentes conforme o que a pessoa fez, e
// essa decisão é pura o bastante pra viver aqui, longe do PixiJS:
//
//   - quase parado         → clique no vazio (larga a seleção, como sempre);
//   - arrasto sem Shift    → a área SUBSTITUI a seleção (convenção de todo
//                            editor 2D: Figma, Inkscape, Dungeon Scrawl);
//   - arrasto com Shift    → a área SOMA à seleção já existente (era o único
//                            comportamento antes desta mudança).
//
// Mover a vista não morreu: continua no botão do meio e em Espaço+arrastar,
// os dois caminhos que `PixiCanvas.tsx` já tinha ANTES de qualquer if de
// ferramenta (e que `e2e/task-middle-button-pan.spec.ts` cobre).
// ─────────────────────────────────────────────────────────────

/** Abaixo disto, em px de TELA, o gesto foi um clique, não um arrasto. O
 *  limiar é de tela (e não de mundo como `AREA_SELECTION_MIN_DRAG`) porque o
 *  tremor de mão de quem clica tem tamanho fixo no dedo, não no mapa: com
 *  zoom em 25% um tremor de 3 px de tela viraria 12 px de mundo e o clique de
 *  "largar a seleção" viraria um marquee minúsculo. */
export const MARQUEE_DRAG_THRESHOLD_SCREEN_PX = 4

export type MarqueeGesture = 'click' | 'replace' | 'add'

/** `cameraScale` inválido (0, negativo, NaN) vira 1 em vez de propagar — o
 *  mesmo tratamento defensivo que `screenLabelSizing` (pixi/screenLabel.ts)
 *  dá a esse parâmetro, pra um zoom corrompido não travar o gesto. */
function safeScale(cameraScale: number): number {
  return Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1
}

export function classifyMarqueeGesture(rect: AreaRect, cameraScale: number, shiftKey: boolean): MarqueeGesture {
  const travelledOnScreen = Math.hypot(rect.x2 - rect.x1, rect.y2 - rect.y1) * safeScale(cameraScale)
  if (travelledOnScreen < MARQUEE_DRAG_THRESHOLD_SCREEN_PX) return 'click'
  return shiftKey ? 'add' : 'replace'
}

/** Onde cabe a dica "Espaço ou botão do meio move a vista" DENTRO do
 *  retângulo em curso, em coordenadas de MUNDO (é lá que o marquee é
 *  desenhado). `visible: false` quando o retângulo é pequeno demais pra
 *  comportar o texto com folga — dica que vaza pra fora da própria caixa é
 *  pior que dica nenhuma. */
export interface MarqueeHintPlacement {
  visible: boolean
  x: number
  y: number
}

/** Folga entre o texto e a borda do retângulo, em px de tela. */
const MARQUEE_HINT_PADDING_SCREEN_PX = 10

/**
 * `labelScreenSize` é o tamanho do texto em px de TELA (medido pelo próprio
 * PixiJS com escala 1, ver `createMarqueeHintRenderer`) — este módulo não
 * mede fonte, não conhece PixiJS e continua testável sem canvas.
 *
 * A dica fica encostada no canto ONDE O GESTO COMEÇOU, nunca no canto que o
 * cursor está arrastando: ali ela ficaria debaixo do ponteiro, tremendo junto
 * com ele.
 */
export function marqueeHintPlacement(
  rect: AreaRect,
  cameraScale: number,
  labelScreenSize: { width: number; height: number },
): MarqueeHintPlacement {
  const scale = safeScale(cameraScale)
  const padding = MARQUEE_HINT_PADDING_SCREEN_PX / scale
  const labelWidth = labelScreenSize.width / scale
  const labelHeight = labelScreenSize.height / scale
  const bounds = normalizeRect(rect)

  const fits =
    bounds.maxX - bounds.minX >= labelWidth + padding * 2 && bounds.maxY - bounds.minY >= labelHeight + padding * 2
  if (!fits) return { visible: false, x: bounds.minX, y: bounds.minY }

  return {
    visible: true,
    x: rect.x2 >= rect.x1 ? bounds.minX + padding : bounds.maxX - padding - labelWidth,
    y: rect.y2 >= rect.y1 ? bounds.minY + padding : bounds.maxY - padding - labelHeight,
  }
}
