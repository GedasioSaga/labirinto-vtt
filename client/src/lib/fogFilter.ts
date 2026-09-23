import type { ConcealZone, DoorState, Drawing, FloorPiece, MapData, Pin, Region, RegionPoint, Token, Wall } from '../types/map'
import { cellCenter, cellKeyAt, cellRunRects, concealedPieces, REVEAL_BRUSH_CELL, unveiledCellsOf } from './concealBrush'
import { isTokenPhotoData } from './tokenPhoto'
import { tokenAsSeenByPlayer } from './tokenPublicName'
import { isPointExplored, isShapeExplored, type Exploration } from './exploration'
import { pointInRing } from './floorContour'
import { pieceBounds, pieceDistance, shapeCenter } from './floorSdf'
import { visibleDrawings, visibleLights, visibleProps, visibleRegions, visibleStairs, visibleTokens, visibleWalls } from './layers'
import { isPlayerSafePinImage } from './pins'
import { exitLabelsOf, isArrivalOnly } from './pinTravel'
import { computeVisibility, visionSegments } from './visibility'
import { ancestorsOf, NESTING_TOLERANCE, pointInPolygonInclusive, pointOnPolygonBorder, subtreeIds } from './roomNesting'
import { roomHasRoof } from './roomOps'

/**
 * Recorte do mapa que um jogador pode receber. Tudo que sai daqui vai pela
 * rede: item fora da visão precisa estar AUSENTE, não só escondido no render.
 * A planta (chão, estilo, moldura, fundo, paredes sem porta) vai inteira por
 * decisão do usuário; entidades dinâmicas só aparecem dentro da visão de pelo
 * menos um token do jogador. Camada oculta pelo mestre (`hiddenLayers`) não
 * sai, e caminho de arquivo local (fundo, imagem de token e de prop) também
 * não: o jogador não abre caminho do disco do mestre.
 */

/** Folga da caixa envolvente do anel de visão, em px de mundo; muito acima do erro de arredondamento. */
const BBOX_SLACK = 1e-3

export interface PlayerMapView {
  map: MapData
  vision: RegionPoint[][]
  /** Portas dentro da visão atual: saíram com o estado real e o chamador deve lembrá-lo. */
  visibleDoorIds: string[]
  /**
   * Polígonos das zonas ocultas ativas (`revealed === false`). O jogador pinta
   * preto por cima e o chamador não marca explorado em célula que toque neles.
   * Só a geometria sai: nome e id da zona ficam no mestre. Zona com pedaço
   * revelado pelo pincel sai em várias peças, sem o pedaço que o jogador vê
   * (`lib/concealBrush.ts`).
   */
  concealed: RegionPoint[][]
  /**
   * Zonas ocultas ativas + salas secretas: o chamador não marca explorado em
   * célula que toque nelas, e NÃO guarda o contorno do anel de visão que
   * encosta nelas. NÃO sai pela rede (o anel da sala secreta é o formato dela).
   */
  blocked: RegionPoint[][]
  /**
   * TETO DE CONSTRUÇÃO — polígonos das salas de teto FECHADO para este jogador.
   *
   * Separado de `blocked` DE PROPÓSITO, e a separação é a feature: o contorno
   * de um prédio não é segredo (ele já sai desenhado em `map.regions`), então
   * ele não pode entrar no balde que faz `rememberRing` jogar fora o anel de
   * visão inteiro. O que o teto veta é só a GRADE de células: o chamador apaga
   * as células cobertas por estes polígonos depois de marcar
   * (`forgetInside`, `lib/exploration.ts`), e é isso que apaga da memória do
   * jogador o interior que ele percorreu enquanto o teto estava aberto.
   */
  roofs: RegionPoint[][]
}

/** Zonas ocultas ativas (`?? []`: mapa montado fora do deserializeMap pode vir sem o campo). */
function activeConcealZones(map: MapData): ConcealZone[] {
  return (map.concealZones ?? []).filter((z) => !z.revealed && z.points.length >= 3)
}

/**
 * Polígonos INTEIROS das zonas ocultas ativas — inclusive o pedaço que o
 * pincel revelou. É o que a memória respeita (`blocked`, "Revelar planta"): o
 * pincel mostra o corredor enquanto o jogador o vê, mas não vira explorado.
 */
function activeConcealRings(map: MapData): RegionPoint[][] {
  return activeConcealZones(map).map((z) => z.points.map((p) => ({ x: p.x, y: p.y })))
}

/** Zona ativa pronta para o teste de ponto: anel com caixa e as células que o pincel revelou. */
interface ActiveZone extends BoxedRing {
  unveiled: ReadonlySet<string>
}

/** Sala "Oculta para jogadores": região secret que é Sala. */
function secretRoomsOf(map: MapData): MapData['regions'] {
  return map.regions.filter((r) => r.secret && r.room !== undefined)
}

/** Todo vértice com coordenada finita e polígono com área: sem isso não dá para decidir nada. */
function isUsablePolygon(points: readonly RegionPoint[]): boolean {
  return points.length >= 3 && points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
}

/**
 * Sala com TETO DE CONSTRUÇÃO ligado (`RoomMeta.roof`). Ligado é do mapa; se o
 * teto está aberto ou fechado é por JOGADOR, e isso se decide em
 * `filterMapForPlayer` (token dele dentro do polígono).
 *
 * `regions` vem de fora (e não de `map.regions`) porque o recorte do jogador
 * respeita `hiddenLayers`: com a camada Salas escondida NENHUMA região sai, e
 * um teto ali viraria buraco — interior apagado e silhueta nenhuma no lugar.
 */
function roofRoomsOf(regions: readonly Region[]): Region[] {
  return regions.filter((r) => roomHasRoof(r.room))
}

/**
 * Áreas que nunca viram exploradas para o jogador: zonas ocultas ativas, salas
 * secretas e salas com teto.
 *
 * O teto entra aqui inteiro (sem olhar token) porque esta função não é do
 * recorte por jogador — é o que "Revelar planta" respeita e o que decide se um
 * sinal pode ser repassado. Revelar a planta não pode ABRIR teto nenhum: o teto
 * abre andando para dentro, e só para quem andou.
 */
export function playerBlockedRings(map: MapData): RegionPoint[][] {
  return [
    ...activeConcealRings(map),
    ...secretRoomsOf(map).map((r) => r.points),
    ...roofRoomsOf(map.regions).filter((r) => isUsablePolygon(r.points)).map((r) => r.points),
  ]
}

/**
 * Sala de teto FECHADO para este jogador, com a caixa envolvente pronta.
 *
 * A folga da caixa é `NESTING_TOLERANCE` (e não `BBOX_SLACK`) porque o teste de
 * dentro é `pointInPolygonInclusive`, que aceita ponto na borda com essa mesma
 * folga: caixa mais apertada que o predicado recusaria antes de perguntar.
 */
interface ClosedRoof extends Box {
  id: string
  points: RegionPoint[]
  /** Geometria que não dá para julgar: bloqueia pela caixa e NUNCA abre. */
  broken: boolean
}

interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function boxOf(points: readonly RegionPoint[]): Box | null {
  if (points.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

interface BoxedRing extends Box {
  ring: RegionPoint[]
}

/**
 * Invariante de performance: anel de visão tem ~mil vértices e é testado para
 * cada entidade. Ponto fora da caixa envolvente (com folga para o
 * arredondamento da intersecção do pointInRing) nunca está dentro do anel,
 * então a caixa descarta a maioria sem mudar o resultado.
 */
function boxRings(rings: readonly RegionPoint[][]): BoxedRing[] {
  return rings.flatMap((ring) => {
    const box = ring.length >= 3 ? boxOf(ring) : null
    if (box === null) return []
    return [{ ring, minX: box.minX - BBOX_SLACK, minY: box.minY - BBOX_SLACK, maxX: box.maxX + BBOX_SLACK, maxY: box.maxY + BBOX_SLACK }]
  })
}

function inAnyRing(boxed: readonly BoxedRing[], point: RegionPoint): boolean {
  return boxed.some((b) => point.x >= b.minX && point.x <= b.maxX && point.y >= b.minY && point.y <= b.maxY && pointInRing(point, b.ring))
}

function wallMidpoint(wall: Wall): RegionPoint {
  return { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 }
}

/** Fração da distância vértice-centróide que a amostra de área anda para dentro. */
const INTERIOR_PULL = 0.15
/** Piso do recuo, em px de mundo: vértice sobre a parede sai do traço dela. */
const INTERIOR_PULL_MIN = 4
/** Distância, em px de mundo, das amostras de visão da porta para cada lado da parede (a porta fica na borda do anel). */
const DOOR_VISION_PROBE = 2
/**
 * Distância das amostras de explorado da porta, em células: maior que a
 * diagonal da célula (√2), para cair numa célula que não cruza a parede da
 * porta (célula que cruza a parede nunca é marcada).
 */
const DOOR_EXPLORED_PROBE_CELLS = 1.5

/**
 * Amostras INTERNAS de uma forma com área: o centróide dos vértices e cada
 * vértice puxado em direção a ele. Vértice cru sobre uma parede fica na borda
 * da visão de quem está do outro lado e cai, pelo arredondamento, na célula
 * vizinha: a sala do lado vazaria. Com `ring`, descarta amostra fora do
 * polígono (centróide de polígono côncavo); se nenhuma sobra, usa todas.
 */
function interiorSamples(points: readonly RegionPoint[], ring?: RegionPoint[]): RegionPoint[] {
  if (points.length === 0) return []
  let sx = 0
  let sy = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
  }
  const c = { x: sx / points.length, y: sy / points.length }
  const samples = [c]
  for (const p of points) {
    const dx = c.x - p.x
    const dy = c.y - p.y
    const d = Math.hypot(dx, dy)
    if (d === 0) continue
    const step = Math.min(d, Math.max(d * INTERIOR_PULL, INTERIOR_PULL_MIN))
    samples.push({ x: p.x + (dx * step) / d, y: p.y + (dy * step) / d })
  }
  if (ring === undefined || ring.length < 3) return samples
  const inside = samples.filter((p) => pointInRing(p, ring))
  return inside.length > 0 ? inside : samples
}

/**
 * Quanto a amostra do CONTORNO anda para FORA do polígono, em px de mundo.
 * Maior que `NESTING_TOLERANCE` (0,5, `lib/roomNesting.ts`), senão a amostra
 * continuaria contando como DENTRO da área bloqueada e nunca viraria explorada.
 */
const CONTOUR_PUSH = 4

/**
 * Amostras do CONTORNO de uma sala — vértices e meio de cada aresta, afastados
 * do centróide por `CONTOUR_PUSH`.
 *
 * POR QUE existir, em vez de reusar `interiorSamples`. Sala comum entra no
 * recorte quando o INTERIOR dela é conhecido. Sala de teto FECHADO nunca tem
 * interior conhecido — o teto é exatamente o que impede isso —, então medir por
 * dentro apagaria o prédio da tela do jogador, que é o contrário do que o teto
 * promete. Por fora o critério é o certo: o jogador vê a construção quando
 * enxerga a construção. A folga também tira a amostra de cima da parede, onde
 * ela cairia na borda da visão de quem está do lado de fora.
 */
function contourSamples(points: readonly RegionPoint[]): RegionPoint[] {
  const n = points.length
  if (n === 0) return []
  let sx = 0
  let sy = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
  }
  const c = { x: sx / n, y: sy / n }
  const out: RegionPoint[] = []
  const pushOut = (p: RegionPoint): void => {
    const dx = p.x - c.x
    const dy = p.y - c.y
    const d = Math.hypot(dx, dy)
    // Vértice em cima do centróide (polígono degenerado) não tem direção "para fora".
    out.push(d === 0 ? p : { x: p.x + (dx * CONTOUR_PUSH) / d, y: p.y + (dy * CONTOUR_PUSH) / d })
  }
  for (let i = 0; i < n; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % n]
    pushOut(a)
    pushOut({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  }
  return out
}

/**
 * Pontos que representam o desenho. Com área (polígono, retângulo, círculo,
 * elipse): amostras internas. Traço (linha, mão livre, curva) e texto: pontos
 * crus. Traço sem pontos devolve lista vazia e nunca é enviado.
 */
function drawingSamplePoints(drawing: Drawing): RegionPoint[] {
  switch (drawing.kind) {
    case 'freehand':
    case 'curve':
    case 'path':
      return drawing.points
    case 'polygon':
      return interiorSamples(drawing.points, drawing.points)
    case 'line':
      return [
        { x: drawing.x1, y: drawing.y1 },
        { x: (drawing.x1 + drawing.x2) / 2, y: (drawing.y1 + drawing.y2) / 2 },
        { x: drawing.x2, y: drawing.y2 },
      ]
    case 'circle':
      return interiorSamples(ellipseExtremes(drawing.cx, drawing.cy, drawing.radius, drawing.radius))
    case 'ellipse':
      return interiorSamples(ellipseExtremes(drawing.cx, drawing.cy, drawing.rx, drawing.ry))
    case 'text':
      return [{ x: drawing.x, y: drawing.y }]
    case 'rect':
      return interiorSamples([
        { x: drawing.x, y: drawing.y },
        { x: drawing.x + drawing.w, y: drawing.y },
        { x: drawing.x + drawing.w, y: drawing.y + drawing.h },
        { x: drawing.x, y: drawing.y + drawing.h },
      ])
  }
}

function ellipseExtremes(cx: number, cy: number, rx: number, ry: number): RegionPoint[] {
  return [
    { x: cx - rx, y: cy },
    { x: cx + rx, y: cy },
    { x: cx, y: cy - ry },
    { x: cx, y: cy + ry },
  ]
}

/** Meio da porta e dois pontos a `distance` px dele, um de cada lado da parede. */
function doorSamples(wall: Wall, distance: number): RegionPoint[] {
  const mx = (wall.x1 + wall.x2) / 2
  const my = (wall.y1 + wall.y2) / 2
  const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
  if (len === 0) return [{ x: mx, y: my }]
  const nx = (-(wall.y2 - wall.y1) / len) * distance
  const ny = ((wall.x2 - wall.x1) / len) * distance
  return [
    { x: mx, y: my },
    { x: mx + nx, y: my + ny },
    { x: mx - nx, y: my - ny },
  ]
}

/** Pontas e meio da parede. */
function wallSamples(wall: Wall): RegionPoint[] {
  return [{ x: wall.x1, y: wall.y1 }, wallMidpoint(wall), { x: wall.x2, y: wall.y2 }]
}

/** Pontas e meio de cada lance da escada. */
function stairSamples(stair: MapData['stairs'][number]): RegionPoint[] {
  return stair.segments.flatMap((s) => [{ x: s.x1, y: s.y1 }, { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 }, { x: s.x2, y: s.y2 }])
}

/** Desenho de traço (sem área): basta uma ponta escondida para não sair. */
function isStrokeDrawing(drawing: Drawing): boolean {
  return drawing.kind === 'line' || drawing.kind === 'freehand' || drawing.kind === 'curve'
}

/** Fração do caminho centro→borda da caixa onde ficam as amostras da peça de chão. */
const FLOOR_SAMPLE_PULL = 0.5

/**
 * Amostras internas da peça de chão: o centro e 8 pontos a meio caminho da
 * borda da caixa envolvente, só os que caem dentro da própria peça (distância
 * assinada ≤ 0). Sem nenhum, só o centro.
 */
function floorPieceSamples(piece: FloorPiece): RegionPoint[] {
  const c = shapeCenter(piece.shape)
  const b = pieceBounds(piece)
  const candidates: RegionPoint[] = [c]
  for (const x of [b.minX, c.x, b.maxX]) {
    for (const y of [b.minY, c.y, b.maxY]) {
      if (x === c.x && y === c.y) continue
      candidates.push({ x: c.x + (x - c.x) * FLOOR_SAMPLE_PULL, y: c.y + (y - c.y) * FLOOR_SAMPLE_PULL })
    }
  }
  const inside = candidates.filter((p) => pieceDistance(piece, p.x, p.y) <= 0)
  return inside.length > 0 ? inside : [c]
}

/** Mais da metade das amostras satisfaz `test`. */
function mostly(samples: readonly RegionPoint[], test: (p: RegionPoint) => boolean): boolean {
  return samples.length > 0 && samples.filter(test).length * 2 > samples.length
}

/** Chão sem as peças escondidas, cacheado pelo array imutável `map.floor`: o contorno do chão (visão) é cacheado pela referência. */
const playerFloorCache = new WeakMap<FloorPiece[], { key: string; floor: FloorPiece[] }>()

function floorWithout(floor: FloorPiece[], hiddenIds: ReadonlySet<string>): FloorPiece[] {
  if (hiddenIds.size === 0) return floor
  const key = [...hiddenIds].join('|')
  const cached = playerFloorCache.get(floor)
  if (cached !== undefined && cached.key === key) return cached.floor
  const out = floor.filter((f) => !hiddenIds.has(f.id))
  playerFloorCache.set(floor, { key, floor: out })
  return out
}

/**
 * O pedaço de uma peça de chão ESCONDIDA que cai nas células que o pincel
 * revelou, como peça de blocos na grade do pincel (`REVEAL_BRUSH_CELL`, a
 * mesma origem de `cellKeyAt`). Célula entra quando o CENTRO dela está no
 * chão da peça. Nada da forma original atravessa — nem medida, nem ruído, nem
 * giro —, só as células pintadas: o resto da peça é o que a zona esconde.
 * Sem célula nenhuma no chão, `null`.
 */
function floorInCells(piece: FloorPiece, cells: readonly string[]): FloorPiece | null {
  const b = pieceBounds(piece)
  const blocos: { col: number; row: number }[] = []
  for (const key of cells) {
    const c = cellCenter(key)
    if (c === null || c.x < b.minX || c.x > b.maxX || c.y < b.minY || c.y > b.maxY) continue
    if (pieceDistance(piece, c.x, c.y) > 0) continue
    blocos.push({ col: Math.floor(c.x / REVEAL_BRUSH_CELL), row: Math.floor(c.y / REVEAL_BRUSH_CELL) })
  }
  if (blocos.length === 0) return null
  const out: FloorPiece = { id: `${piece.id}~pincel`, shape: { kind: 'blocos', cell: REVEAL_BRUSH_CELL, cells: blocos }, op: piece.op, modifiers: {} }
  return piece.fillColor === undefined ? out : { ...out, fillColor: piece.fillColor }
}

/** Passo, em px de mundo, da amostragem da parede que entra no pedaço pintado: um quarto da célula do pincel. */
const BRUSH_WALL_STEP = REVEAL_BRUSH_CELL / 4
/** Acima disto (parede de ~50 mil px) a parede não é recortada e não sai: erra para o lado de esconder. */
const BRUSH_WALL_MAX_STEPS = 20_000

/**
 * Trechos da parede em que as amostras passam em `shown`, como paredes
 * novas (`<id>~pincel<n>`). As pontas de cada trecho são amostras que
 * passaram, então o trecho nunca avança sobre o escondido: erra até um passo
 * para DENTRO. Coordenada não-finita ou parede enorme não sai.
 */
function wallRunsWhere(wall: Wall, shown: (p: RegionPoint) => boolean): Wall[] {
  const steps = Math.ceil(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) / BRUSH_WALL_STEP)
  if (!Number.isFinite(steps) || steps > BRUSH_WALL_MAX_STEPS) return []
  const n = Math.max(1, steps)
  const runs: Wall[] = []
  let start: RegionPoint | null = null
  let end: RegionPoint | null = null
  for (let i = 0; i <= n + 1; i += 1) {
    const t = i / n
    const p = i <= n ? { x: wall.x1 + (wall.x2 - wall.x1) * t, y: wall.y1 + (wall.y2 - wall.y1) * t } : null
    if (p !== null && shown(p)) {
      if (start === null) start = p
      end = p
      continue
    }
    // Amostra escondida (ou o fim da parede) fecha o trecho aberto.
    if (start !== null && end !== null && (start.x !== end.x || start.y !== end.y)) {
      runs.push({ ...wall, id: `${wall.id}~pincel${runs.length}`, x1: start.x, y1: start.y, x2: end.x, y2: end.y })
    }
    start = null
    end = null
  }
  return runs
}

/** Contorno de uma forma: vértices em ordem; `closed` fecha o último no primeiro e a forma tem interior. */
interface ShapeOutline {
  points: RegionPoint[]
  closed: boolean
}

/**
 * Passo, em px de mundo, da amostragem densa que pergunta se a forma tem
 * trecho escondido: meia célula do pincel, então toda célula que a forma
 * cobre por dentro recebe ao menos uma amostra.
 */
const BRUSH_SHAPE_STEP = REVEAL_BRUSH_CELL / 2
/** Acima disto a forma não é amostrada e conta como tendo trecho escondido: erra para o lado de esconder. */
const BRUSH_SHAPE_MAX_SAMPLES = 40_000
/** Lados do polígono que envolve círculo e elipse no contorno de desenho. */
const ELLIPSE_OUTLINE_SIDES = 16

/**
 * Algum ponto da forma cai em `hidden`? Amostra cada aresta a cada
 * `BRUSH_SHAPE_STEP` e, com a forma fechada, uma grade no interior. Forma
 * grande demais ou coordenada não-finita responde "sim".
 */
function hasHiddenStretch(outline: ShapeOutline, hidden: (p: RegionPoint) => boolean): boolean {
  const pts = outline.points
  const box = boxOf(pts)
  if (box === null) return false
  if (pts.length === 1) return hidden(pts[0])
  let budget = BRUSH_SHAPE_MAX_SAMPLES
  const edges = outline.closed && pts.length >= 3 ? pts.length : pts.length - 1
  for (let i = 0; i < edges; i += 1) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / BRUSH_SHAPE_STEP))
    budget -= steps + 1
    if (!Number.isFinite(steps) || budget < 0) return true
    for (let k = 0; k <= steps; k += 1) {
      const t = k / steps
      if (hidden({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return true
    }
  }
  if (!outline.closed || pts.length < 3) return false
  const cols = Math.ceil((box.maxX - box.minX) / BRUSH_SHAPE_STEP) + 1
  const rows = Math.ceil((box.maxY - box.minY) / BRUSH_SHAPE_STEP) + 1
  if (!Number.isFinite(cols * rows) || cols * rows > budget) return true
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < rows; j += 1) {
      const p = { x: box.minX + i * BRUSH_SHAPE_STEP, y: box.minY + j * BRUSH_SHAPE_STEP }
      if (pointInRing(p, pts) && hidden(p)) return true
    }
  }
  return false
}

/** Polígono que ENVOLVE a elipse (circunscrito): a amostragem nunca fica aquém da borda desenhada. */
function ellipseOutline(cx: number, cy: number, rx: number, ry: number): RegionPoint[] {
  const grow = 1 / Math.cos(Math.PI / ELLIPSE_OUTLINE_SIDES)
  return Array.from({ length: ELLIPSE_OUTLINE_SIDES }, (_, i) => {
    const a = (2 * Math.PI * i) / ELLIPSE_OUTLINE_SIDES
    return { x: cx + Math.cos(a) * rx * grow, y: cy + Math.sin(a) * ry * grow }
  })
}

/** O contorno de um desenho para `hasHiddenStretch`: traço aberto, forma com área fechada, texto no ponto de âncora. */
function drawingOutline(drawing: Drawing): ShapeOutline {
  switch (drawing.kind) {
    case 'freehand':
    case 'curve':
    case 'path':
      return { points: drawing.points, closed: false }
    case 'line':
      return {
        points: [
          { x: drawing.x1, y: drawing.y1 },
          { x: drawing.x2, y: drawing.y2 },
        ],
        closed: false,
      }
    case 'text':
      return { points: [{ x: drawing.x, y: drawing.y }], closed: false }
    case 'polygon':
      return { points: drawing.points, closed: true }
    case 'circle':
      return { points: ellipseOutline(drawing.cx, drawing.cy, drawing.radius, drawing.radius), closed: true }
    case 'ellipse':
      return { points: ellipseOutline(drawing.cx, drawing.cy, drawing.rx, drawing.ry), closed: true }
    case 'rect':
      return {
        points: [
          { x: drawing.x, y: drawing.y },
          { x: drawing.x + drawing.w, y: drawing.y },
          { x: drawing.x + drawing.w, y: drawing.y + drawing.h },
          { x: drawing.x, y: drawing.y + drawing.h },
        ],
        closed: true,
      }
  }
}

/**
 * Foto do token como o jogador pode recebê-la: só referência AUTO-CONTIDA
 * (`data:image/...;base64,...`) atravessa; qualquer outra coisa vira `null`.
 *
 * O filtro é por FORMA e não por nome de campo: `Token.image` costuma ser
 * caminho no disco do mestre e some, mas some porque não é auto-contido — se
 * um dia guardar uma foto embutida, ela passa pelo mesmo critério. É o que
 * leva a foto até a tela do jogador sem abrir a pasta do mestre.
 */
function sanitizeTokenPhoto(token: Token): Token {
  const image = isTokenPhotoData(token.image) ? token.image : null
  const imageData = isTokenPhotoData(token.imageData) ? token.imageData : null
  if (token.image === image && (token.imageData ?? null) === imageData) return token
  return { ...token, image, imageData }
}

/**
 * "QUEM VÊ" de cada pino, por id: os jogadores escolhidos pelo mestre. Pino
 * AUSENTE do mapa = "Todos" (o pino de sempre); presente com o conjunto vazio =
 * "Só estes" sem ninguém marcado, e ninguém recebe. A lista vive na sessão do
 * host (`net/hostSession.ts`), não no arquivo do mapa: id de jogador só existe
 * enquanto a sala está aberta.
 */
export type PinAudiences = ReadonlyMap<string, ReadonlySet<string>>

/** O pino chega a este jogador pela lista de quem vê? Sem lista, sim. */
function pinReachesPlayer(audiences: PinAudiences | undefined, pinId: string, playerId: string): boolean {
  const chosen = audiences?.get(pinId)
  return chosen === undefined || chosen.has(playerId)
}

/** Porta explorada que o jogador nunca viu: aparece fechada e destrancada. */
function unseenDoor(door: DoorState): DoorState {
  return { open: false, locked: false, kind: door.kind }
}

/**
 * `explored`: memória do jogador ANTES desta visão (quem marca é o chamador).
 * Só a planta estática (regiões, desenhos e textos, escadas, portas, linhas,
 * marcadores) entra por estar explorada; token, prop e luz mudam de lugar e
 * continuam exigindo visão atual, senão a memória viraria espionagem.
 * `seenDoors`: último estado visto de cada porta (somente leitura). Porta
 * explorada fora da visão sai com esse estado, nunca com o atual: senão o
 * jogador longe veria o mestre abrir ou destrancar a porta.
 * `pinAudiences`: quem vê cada pino (`PinAudiences`); ausente = todo pino é de todos.
 */
export function filterMapForPlayer(
  map: MapData,
  playerId: string,
  ownership: Record<string, string[]>,
  visionRadius: number,
  explored?: Exploration,
  seenDoors?: ReadonlyMap<string, DoorState>,
  pinAudiences?: PinAudiences,
): PlayerMapView {
  const hiddenLayers = map.hiddenLayers
  const owned = new Set(ownership[playerId] ?? []) // jogador sem entrada de posse não tem token nem visão
  const layerTokens = visibleTokens(map.tokens, hiddenLayers)
  const ownTokens = layerTokens.filter((t) => owned.has(t.id) && !t.hidden)

  // Zona oculta ativa: ponto dentro dela não conta como visível nem explorado.
  // A visão continua passando (a zona esconde conteúdo, não é parede).
  // PINCEL DE REVELAR: ponto numa célula que o mestre pintou deixa de ser
  // escondido POR ESTA zona — outra zona ativa por cima continua valendo.
  const concealRings = activeConcealRings(map)
  const zones: ActiveZone[] = activeConcealZones(map).flatMap((zone, i) =>
    boxRings([concealRings[i]]).map((boxed) => ({ ...boxed, unveiled: unveiledCellsOf(zone) })),
  )
  const hidesPoint = (zone: ActiveZone, point: RegionPoint): boolean =>
    point.x >= zone.minX &&
    point.x <= zone.maxX &&
    point.y >= zone.minY &&
    point.y <= zone.maxY &&
    pointInRing(point, zone.ring) &&
    !(zone.unveiled.size > 0 && zone.unveiled.has(cellKeyAt(point)))
  const inConcealZone = (point: RegionPoint): boolean => zones.length > 0 && zones.some((zone) => hidesPoint(zone, point))

  // Sala "Oculta para jogadores" leva junto as paredes dela e o que está dentro dela.
  const secretRooms = secretRoomsOf(map)
  // Sub-sala de sala secreta ou oculta some junto, com as paredes dela. O nome
  // oculto da sala de fora NÃO passa para a de dentro.
  const hiddenByAncestorIds = new Set(
    map.regions.filter((r) => r.parentId !== undefined && ancestorsOf(map.regions, r.id).some((a) => a.secret || a.hidden)).map((r) => r.id),
  )
  const secretRoomIds = new Set([...secretRooms.flatMap((r) => [...subtreeIds(map.regions, r.id)]), ...hiddenByAncestorIds])
  const secretRoomRings = boxRings(secretRooms.map((r) => r.points))
  const inSecretRoom = (point: RegionPoint): boolean => secretRoomRings.length > 0 && inAnyRing(secretRoomRings, point)

  /**
   * TETO DE CONSTRUÇÃO. Sala com `room.roof` esconde o INTERIOR com o mesmo
   * rigor da sala secreta acima — nada de dentro entra no pacote —, com UMA
   * diferença: a própria `Region` continua saindo, marcada, porque é a silhueta
   * do prédio que o jogador tem de ver.
   *
   * UM PREDICADO SÓ, dos dois lados. Abrir o teto e esconder o interior são a
   * mesma pergunta geométrica, e a primeira versão respondia com predicados
   * diferentes: `pointInRing` escondia (raycast de borda EXCLUSIVA, assimétrica
   * entre norte/oeste e sul/leste) e `pointInPolygonInclusive` abria. Medido:
   * token parado EM CIMA da parede leste abria o teto DE FORA e levava o
   * interior inteiro; divisória interna encostada no muro vazava na rede por
   * ter uma ponta "fora"; e a parede solta sobre o muro NORTE sumia junto com a
   * porta da frente, então o jogador nunca entrava e o teto nunca abria.
   *
   * Agora tudo passa por `inRoof` (inclusivo, com a tolerância de
   * `pointInPolygonInclusive` também na caixa envolvente) e ABRIR exige o token
   * ESTRITAMENTE dentro: em cima do muro, o teto fica fechado. Na dúvida, fecha.
   *
   * Sala secreta vence: quem já sumiu inteiro não precisa de teto. Polígono com
   * menos de 3 vértices ou com coordenada não-finita é INDECIDÍVEL: a sala some
   * do pacote (`brokenRoofIds`) em vez de virar um teto que nunca fecha.
   */
  const roofCandidates = roofRoomsOf(visibleRegions(map.regions, hiddenLayers)).filter(
    (r) => !r.hidden && !r.secret && !secretRoomIds.has(r.id),
  )
  /** Sala de teto que a geometria não sabe julgar: não sai para o jogador, e não abre. */
  const brokenRoofIds = new Set(roofCandidates.filter((r) => !isUsablePolygon(r.points)).map((r) => r.id))

  const roofBoxes: ClosedRoof[] = roofCandidates.flatMap((r) => {
    const broken = !isUsablePolygon(r.points)
    // Sala quebrada bloqueia pela CAIXA dos vértices que sobraram: a caixa
    // CONTÉM o polígono real, então o erro é sempre para o lado de fechar
    // demais. Largar o bloqueio (o que a primeira versão fazia) era o lado
    // errado — um vértice NaN abria o prédio inteiro para o jogador.
    const box = boxOf(r.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
    if (box === null) return []
    const points = broken
      ? [
          { x: box.minX, y: box.minY },
          { x: box.maxX, y: box.minY },
          { x: box.maxX, y: box.maxY },
          { x: box.minX, y: box.maxY },
        ]
      : r.points
    if (points.length < 3 || box.minX === box.maxX || box.minY === box.maxY) return []
    return [
      {
        id: r.id,
        points,
        broken,
        minX: box.minX - NESTING_TOLERANCE,
        minY: box.minY - NESTING_TOLERANCE,
        maxX: box.maxX + NESTING_TOLERANCE,
        maxY: box.maxY + NESTING_TOLERANCE,
      },
    ]
  })
  const inRoof = (roof: ClosedRoof, p: RegionPoint): boolean =>
    p.x >= roof.minX && p.x <= roof.maxX && p.y >= roof.minY && p.y <= roof.maxY && pointInPolygonInclusive(p, roof.points)
  /** Token EM CIMA do muro não abre o teto: para quem quer entrar, a borda conta como fora. */
  const opensRoof = (roof: ClosedRoof): boolean =>
    ownTokens.some((t) => inRoof(roof, { x: t.x, y: t.y }) && !pointOnPolygonBorder({ x: t.x, y: t.y }, roof.points))

  // Sala quebrada nunca abre: quem não sabe onde estão as paredes não sabe dizer que o jogador entrou.
  const closedRoofs = roofBoxes.filter((roof) => roof.broken || !opensRoof(roof))
  const closedRoofIds = new Set(closedRoofs.map((roof) => roof.id))
  const inClosedRoof = (point: RegionPoint): boolean => closedRoofs.some((roof) => inRoof(roof, point))
  /** Ponto que o jogador não recebe por causa da SALA: secreta ou de teto fechado. */
  const inRoomHiddenFromPlayer = (point: RegionPoint): boolean => inSecretRoom(point) || inClosedRoof(point)

  /**
   * Ponto no pedaço que o pincel revelou: dentro de uma zona ativa e não
   * escondido por nenhuma (então toda zona que o contém o pintou). É o MESTRE
   * mostrando aos jogadores, como o "revelar névoa" das mesas virtuais: conta
   * como à vista mesmo sem linha de visão de token — e só ele. Com o chão da
   * zona dividido em peças, a própria borda do chão corta a visão na entrada
   * da zona, e sem esta regra o corredor pintado nunca apareceria.
   *
   * O pincel NÃO atravessa sala secreta nem teto fechado (`brushedRoom`).
   */
  const brushed = zones.some((zone) => zone.unveiled.size > 0)
  const inZoneRing = (point: RegionPoint): boolean =>
    zones.some((zone) => point.x >= zone.minX && point.x <= zone.maxX && point.y >= zone.minY && point.y <= zone.maxY && pointInRing(point, zone.ring))
  /**
   * Ponto que o pincel DESTAPOU mas que está numa sala secreta ou de teto
   * fechado: continua escondido, como antes do pincel. Sem esta regra a sala
   * dentro da zona ficava protegida só pelas paredes dela (e sala sem parede
   * desenhada, por nada): token, prop e luz testam a sala só pelo teto, e o
   * pincel Largo passado ao lado do cofre levava a ficha de dentro para o fio.
   */
  const brushedRoom = (point: RegionPoint): boolean => brushed && inRoomHiddenFromPlayer(point) && inZoneRing(point)
  /** Escondido pela zona: fora do pedaço pintado, ou pintado mas dentro da sala que esconde (`brushedRoom`). */
  const hiddenByZone = (point: RegionPoint): boolean => inConcealZone(point) || brushedRoom(point)
  const inBrushReveal = (point: RegionPoint): boolean => brushed && inZoneRing(point) && !hiddenByZone(point)
  const outsideZones = (points: readonly RegionPoint[]): readonly RegionPoint[] =>
    zones.length === 0 ? points : points.filter((p) => !hiddenByZone(p))

  /**
   * Região ENGOLIDA por um prédio de teto fechado, medida na GEOMETRIA e não em
   * `parentId`.
   *
   * `parentId` não basta e nunca vai bastar: `lib/roomNesting.ts` só dá mãe à
   * região NOVA e `mapFactory.reparentRoom` só reprocessa a MOVIDA, então o
   * cômodo desenhado ANTES do prédio fica órfão para sempre — e "Área"
   * (`room === undefined`) nunca ganha `parentId` em hipótese alguma. Sem este
   * teste, o polígono e o nome desses cômodos saíam no pacote.
   *
   * `mostly` e não `some`: uma Área GRANDE que CONTÉM o prédio (um pátio, um
   * bairro) tem o centróide dentro dele e continua sendo do jogador.
   */
  const swallowedByClosedRoof = (r: Region): boolean =>
    closedRoofs.some((roof) => roof.id !== r.id && mostly(interiorSamples(r.points, r.points), (p) => inRoof(roof, p)))

  /** Sub-sala declarada por `parentId`: continua valendo, é mais barata que a geometria. */
  const underRoofIds = new Set(closedRoofs.flatMap((roof) => [...subtreeIds(map.regions, roof.id)].filter((id) => id !== roof.id)))
  /** Prédio que o jogador vê MESMO: teto fechado que não está dentro de outro prédio de teto fechado. */
  const visibleRoofIds = new Set(
    closedRoofs
      .filter((roof) => !closedRoofs.some((outer) => outer.id !== roof.id && mostly(roof.points, (p) => inRoof(outer, p))))
      .map((roof) => roof.id),
  )

  /**
   * Parede que é MOBÍLIA de dentro de um teto fechado.
   *
   * Duas perguntas, não uma: a parede está inteira dentro do polígono E não é o
   * CONTORNO dele. Sem a segunda, a parede do próprio muro (e a porta da frente
   * nela) sumia; sem a primeira, a divisória encostada no muro vazava. O
   * `regionId` é só um atalho: parede desenhada à mão sobre o muro não tem
   * nenhum, e era exatamente o caso que quebrava.
   */
  const isUnderClosedRoof = (w: Wall): boolean => {
    if (w.regionId !== undefined && underRoofIds.has(w.regionId)) return true
    if (closedRoofs.length === 0) return false
    if (w.regionId !== undefined && visibleRoofIds.has(w.regionId)) return false
    const samples = wallSamples(w)
    return closedRoofs.some((roof) => samples.every((p) => inRoof(roof, p)) && samples.some((p) => !pointOnPolygonBorder(p, roof.points)))
  }

  /**
   * Polígonos dos prédios de teto fechado. Vão SEPARADOS de `blocked`, e essa
   * separação é a correção de um defeito grande: `blocked` alimenta
   * `rememberRing` (`lib/exploration.ts`), cuja regra é "anel de visão que
   * ENCOSTA em área proibida não é guardado". Com o teto ali dentro, bastava um
   * prédio no campo de visão para o jogador PERDER a borda da memória em todo o
   * resto do mapa — e, pior, para a própria silhueta sumir quando ele se
   * afastava. O contorno de um prédio não é segredo: ele já sai desenhado. O
   * veto do teto é só sobre a grade de células, e quem o aplica é
   * `forgetInside` (`net/hostSession.ts`).
   */
  const roofs = closedRoofs.map((roof) => roof.points)
  const blocked = [...concealRings, ...secretRooms.map((r) => r.points)]

  // Peça de chão com a maioria das amostras em área escondida não sai. Limitação
  // aceita: peça grande que cruza a borda sai inteira, e tirar peça 'subtract'
  // fecha o buraco dela (só dentro da área escondida).
  // O chão de dentro do prédio de teto fechado some pelo mesmo caminho, embora
  // o teto não esteja mais em `blocked` (ver o comentário de `roofs` acima).
  const hiddenAreas = boxRings(blocked)
  const hiddenFloorIds = new Set(
    hiddenAreas.length === 0 && closedRoofs.length === 0
      ? []
      : map.floor.filter((f) => mostly(floorPieceSamples(f), (p) => inAnyRing(hiddenAreas, p) || inClosedRoof(p))).map((f) => f.id),
  )

  /**
   * Duas visões. A da autoridade (todas as paredes, chão inteiro) decide o que
   * sai do mapa. A enviada (`vision`) é montada sem o que o jogador não pode
   * saber: paredes da sala secreta, paredes/portas inteiras dentro de zona
   * ativa e peças de chão escondidas; senão a sombra delas desenharia a sala na
   * névoa. Parede que só cruza a borda da zona continua na enviada: tirá-la
   * deixaria o jogador ver através dela fora da zona. Colisão não usa isto.
   *
   * PINCEL: parede ou porta inteira dentro da zona entra na enviada SÓ no
   * trecho pintado (`wallRunsWhere`, o mesmo recorte que o jogador recebe). O
   * teste é `inZoneRing` e não `inConcealZone`: com o pincel a amostra pintada
   * deixava de contar como escondida, a parede entrava inteira e as pontas
   * escondidas saíam no fio — com a sombra delas desenhada fora da zona.
   */
  const authoritySegments = ownTokens.length > 0 ? visionSegments(map) : []
  const authorityVision = ownTokens.map((t) => computeVisibility({ x: t.x, y: t.y }, authoritySegments, visionRadius))
  const rings = boxRings(authorityVision)
  const playerWalls = map.walls.flatMap((w): Wall[] => {
    if (w.regionId !== undefined && secretRoomIds.has(w.regionId)) return []
    if (isUnderClosedRoof(w)) return []
    if (zones.length === 0 || !wallSamples(w).every(inZoneRing)) return [w]
    return brushed ? wallRunsWhere(w, inBrushReveal) : []
  })
  const wallsChanged = playerWalls.length !== map.walls.length || playerWalls.some((w, i) => w !== map.walls[i])
  let vision = authorityVision
  if (ownTokens.length > 0 && (wallsChanged || hiddenFloorIds.size > 0)) {
    const playerSegments = visionSegments({ ...map, walls: playerWalls, floor: floorWithout(map.floor, hiddenFloorIds) })
    vision = ownTokens.map((t) => computeVisibility({ x: t.x, y: t.y }, playerSegments, visionRadius))
  }

  const isVisible = (point: RegionPoint): boolean => !hiddenByZone(point) && (inAnyRing(rings, point) || inBrushReveal(point))

  /**
   * Forma com extensão: a caixa da forma precisa cruzar a caixa de algum anel
   * e algum ponto amostrado (fora de zona oculta) precisa estar dentro dele.
   * Forma que só atravessa a visão sem nenhum ponto amostrado dentro fica de
   * fora (aceito).
   */
  const isShapeVisible = (open: readonly RegionPoint[]): boolean => {
    const box = boxOf(open)
    if (box === null) return false
    if (brushed && open.some(inBrushReveal)) return true
    return rings.some(
      (b) =>
        box.maxX >= b.minX &&
        box.minX <= b.maxX &&
        box.maxY >= b.minY &&
        box.minY <= b.maxY &&
        open.some((p) => p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY && pointInRing(p, b.ring)),
    )
  }

  const isPointExploredOpen = (point: RegionPoint): boolean =>
    explored !== undefined && !hiddenByZone(point) && isPointExplored(explored, point)

  // Planta estática: visível agora ou já explorada. Nunca usar para entidade dinâmica.
  const isPointKnown = (point: RegionPoint): boolean => isVisible(point) || isPointExploredOpen(point)
  /**
   * Forma com algum trecho que a zona ainda esconde (fora do pedaço pintado,
   * ou na sala que o pincel não abre), medido no CONTORNO e no interior, não
   * só nas amostras. Só pergunta com pincel ativo e a forma perto de uma zona.
   */
  const brushLeavesPartHidden = (outline: ShapeOutline): boolean => {
    if (!brushed) return false
    const box = boxOf(outline.points)
    if (box === null || !zones.some((z) => box.maxX >= z.minX && box.minX <= z.maxX && box.maxY >= z.minY && box.minY <= z.maxY)) return false
    return hasHiddenStretch(outline, hiddenByZone)
  }
  /**
   * As amostras que decidem se a forma é conhecida. Forma que o pincel deixa
   * em parte escondida é julgada como ANTES do pincel (amostra dentro da zona
   * não conta, pintada ou não): o pincel mostra o pedaço pintado, e uma
   * amostra no corredor entregava o polígono e a cor da sala inteira. Forma
   * que cabe inteira no pedaço pintado (ou fora da zona) segue a regra de
   * sempre, com o pintado contando como à vista (`inBrushReveal`).
   */
  const openSamples = (points: readonly RegionPoint[], outline: ShapeOutline): readonly RegionPoint[] =>
    brushLeavesPartHidden(outline) ? points.filter((p) => !inZoneRing(p)) : outsideZones(points)
  const isShapeKnown = (points: readonly RegionPoint[], outline: ShapeOutline): boolean => {
    const open = openSamples(points, outline)
    return isShapeVisible(open) || (explored !== undefined && isShapeExplored(explored, open))
  }

  const visibleDoorIds: string[] = []
  /** Porta dentro da visão sai com o estado real; explorada fora dela, com o lembrado; senão não sai. */
  const doorWallForPlayer = (w: Wall, door: DoorState): Wall[] => {
    // Porta com o meio escondido não sai nem pelas amostras dos lados.
    if (inConcealZone(wallMidpoint(w))) return []
    if (doorSamples(w, DOOR_VISION_PROBE).some(isVisible)) {
      visibleDoorIds.push(w.id)
      return [w]
    }
    if (explored === undefined) return []
    const probe = explored.cell * DOOR_EXPLORED_PROBE_CELLS
    if (!doorSamples(w, probe).some(isPointExploredOpen)) return []
    return [{ ...w, door: seenDoors?.get(w.id) ?? unseenDoor(door) }]
  }

  /**
   * PINCEL DE REVELAR — o preto de cada zona ativa sai sem os buracos que o
   * mestre pintou (`inBrushReveal`: o pedaço pintado é mostrado a todos da
   * cena). Célula que outra zona ativa ainda esconde fica preta, e célula
   * sobre sala secreta ou teto fechado também (ver `inBrushReveal`). Sem
   * célula pintada, o preto é a zona inteira, como sempre.
   */
  const unveiledShown = zones.map((zone) =>
    [...zone.unveiled].filter((key) => {
      const center = cellCenter(key)
      return center !== null && pointInRing(center, zone.ring) && !inConcealZone(center) && !inRoomHiddenFromPlayer(center)
    }),
  )
  const shownCells = [...new Set(unveiledShown.flat())]

  /**
   * Chão que o jogador recebe. Peça escondida (`hiddenFloorIds`) continua sem
   * sair, mas o pedaço dela sob o corredor pintado sai recortado nas células
   * pintadas (`floorInCells`): sem isso o corredor revelado aparecia como uma
   * faixa do fundo, sem o chão que o mestre vê ali. A ordem das peças se
   * mantém, então 'subtract' continua abrindo buraco no que vem antes.
   */
  const playerFloor = map.floor.flatMap((f): FloorPiece[] => {
    if (f.hidden) return []
    if (!hiddenFloorIds.has(f.id)) return [f]
    const clipped = shownCells.length > 0 ? floorInCells(f, shownCells) : null
    return clipped === null ? [] : [clipped]
  })

  /**
   * Parede sem porta com amostra DENTRO da zona: sai só o trecho no pedaço
   * pintado (`wallRunsWhere`). O teste é `inZoneRing`, não `inConcealZone`: as
   * 3 amostras não dizem o que há entre elas, então amostra pintada não vale
   * como "sem trecho escondido" — senão uma parede com o meio pintado e as
   * pontas fora da zona saía inteira, com o trecho escondido junto.
   */
  const wallForPlayer = (w: Wall): Wall[] => {
    if (!wallSamples(w).some(inZoneRing)) return [w]
    return shownCells.length > 0 ? wallRunsWhere(w, inBrushReveal) : []
  }

  const filtered: MapData = {
    ...map,
    // O nome do mapa é o nome da CENA (a aventura cria a cena com
    // `createEmptyMap(id, nomeDaCena, …)`): o jogador descobre onde está pelo
    // que vê, nunca pelo nome que o mestre deu. Nada na tela dele lê este campo.
    name: '',
    // Metadado do mestre: vínculo de cenário, dono e áreas reveladas não são do jogador.
    scenarioLink: null,
    ownerId: null,
    fog: { mode: map.fog.mode, revealed: [] },
    background: map.background.type === 'image' ? { type: 'image', src: '' } : map.background,
    // Token do próprio jogador sai sempre, mesmo secreto ou em zona oculta: é ele quem o move.
    // Nome: o dono lê o real; os outros, o "Nome para os jogadores" (o de trabalho do mestre não sai).
    tokens: layerTokens
      .filter((t) => !t.hidden && (owned.has(t.id) || (!t.secret && !inClosedRoof({ x: t.x, y: t.y }) && isVisible({ x: t.x, y: t.y }))))
      .map((t) => sanitizeTokenPhoto(tokenAsSeenByPlayer(t, owned.has(t.id)))),
    markers: map.markers.filter((m) => !inRoomHiddenFromPlayer({ x: m.cx, y: m.cy }) && isPointKnown({ x: m.cx, y: m.cy })),
    lines: map.lines.filter((l) => !l.points.some(inRoomHiddenFromPlayer) && !l.points.some(inConcealZone) && isShapeKnown(l.points, { points: l.points, closed: l.closed })),
    // Tocha acesa dentro do prédio de teto fechado não sai: o halo dela
    // desenharia o interior na tela do jogador que está lá fora.
    lights: visibleLights(map.lights, hiddenLayers).filter(
      (l) => !l.hidden && !inClosedRoof({ x: l.x, y: l.y }) && isVisible({ x: l.x, y: l.y }),
    ),
    stairs: visibleStairs(map.stairs, hiddenLayers).filter((s) => {
      const first = s.segments[0]
      if (s.hidden || s.secret || first === undefined || stairSamples(s).some(inRoomHiddenFromPlayer)) return false
      return isPointKnown({ x: (first.x1 + first.x2) / 2, y: (first.y1 + first.y2) / 2 })
    }),
    props: visibleProps(map.props, hiddenLayers)
      .filter((p) => !p.hidden && !p.secret && !inClosedRoof({ x: p.x, y: p.y }) && isVisible({ x: p.x, y: p.y }))
      .map((p) => ({ ...p, src: '', linkedMapPath: null })),
    drawings: visibleDrawings(map.drawings, hiddenLayers).filter((d) => {
      if (d.secret) return false
      const samples = drawingSamplePoints(d)
      if (samples.some(inRoomHiddenFromPlayer)) return false
      // Traço com uma ponta na zona desenharia o que ela esconde.
      if (isStrokeDrawing(d) && samples.some(inConcealZone)) return false
      return isShapeKnown(samples, drawingOutline(d))
    }),
    regions: visibleRegions(map.regions, hiddenLayers)
      .filter((r) => {
        if (r.hidden || r.secret || hiddenByAncestorIds.has(r.id) || underRoofIds.has(r.id)) return false
        // Sala de teto que a geometria não sabe julgar não vira silhueta: some.
        if (brokenRoofIds.has(r.id)) return false
        // Cômodo órfão dentro do prédio, Área sem `parentId`, prédio de teto
        // dentro de outro prédio de teto: tudo isso é interior. Ver `swallowedByClosedRoof`.
        if (swallowedByClosedRoof(r)) return false
        // Teto fechado: o "conhecido" é medido NO CONTORNO, nunca no interior
        // — que está bloqueado justamente por causa do teto. Ver `contourSamples`.
        // O contorno afastado é o que se mede também contra o pincel: o
        // interior do teto fechado continua escondido mesmo pintado (`brushedRoom`).
        if (closedRoofIds.has(r.id)) {
          const contour = contourSamples(r.points)
          return isShapeKnown(contour, { points: contour.length > 0 ? [...contour, contour[0]] : contour, closed: false })
        }
        return isShapeKnown(interiorSamples(r.points, r.points), { points: r.points, closed: true })
      })
      .map((r) => {
        if (r.room === undefined) return r
        const roofClosed = closedRoofIds.has(r.id)
        // Sala com a maioria do interior dentro de zona ativa: o nome é do que a zona esconde.
        // Teto fechado esconde o nome junto: o rótulo é desenhado DENTRO do
        // polígono e é anotação do mestre sobre o que tem lá dentro.
        const nameHidden =
          r.room.nameHiddenFromPlayers || roofClosed || (zones.length > 0 && mostly(interiorSamples(r.points, r.points), inConcealZone))
        if (!nameHidden && !roofClosed && r.room.roof === undefined) return r
        // `roof` atravessa SÓ quando o teto está fechado PARA ESTE JOGADOR: é o
        // sinal de "pinte a silhueta" (`player/PlayerView.tsx`). Com o teto
        // aberto o campo some e a Sala volta a desenhar como sempre desenhou.
        return { ...r, room: { ...r.room, name: nameHidden ? '' : r.room.name, roof: roofClosed ? true : undefined } }
      }),
    walls: visibleWalls(map.walls, hiddenLayers).flatMap((w) => {
      if (w.hidden) return []
      if (w.regionId !== undefined && secretRoomIds.has(w.regionId)) return []
      if (isUnderClosedRoof(w)) return []
      if (w.door !== null) return doorWallForPlayer(w, w.door)
      return wallForPlayer(w)
    }),
    floor: playerFloor,
    // Pino de ponto de interesse: anotação estática, então vale o explorado
    // (mesma regra de linha/marcador). `image` só atravessa em data URL — se
    // um dia alguém guardar caminho de disco no campo, o jogador recebe
    // `null` em vez do computador do mestre (`isPlayerSafePinImage`).
    // CHEGADA OCULTA (mão única) sai ANTES de qualquer outra regra: não é
    // questão de névoa nem de explorado — o jogador nunca recebe o pino, nem o
    // id dele, estando ou não em cima dele. Ver `isArrivalOnly`.
    // "QUEM VÊ" também sai antes da névoa: quem não foi escolhido não recebe o
    // pino nem o id dele, mesmo em cima dele — e o host recusa passagem por um
    // pino que o jogador não recebeu (`validTravel` usa este mesmo recorte).
    pins: (map.pins ?? [])
      .filter((p) => {
        if (isArrivalOnly(p)) return false
        if (!pinReachesPlayer(pinAudiences, p.id, playerId)) return false
        if (p.hidden || p.secret || hiddenLayers.includes('anotacoes')) return false
        const point = { x: p.x, y: p.y }
        return !inRoomHiddenFromPlayer(point) && isPointKnown(point)
      })
      .map(pinForPlayer),
    // Metadado do mestre: nome, estado e células do pincel das zonas não saem; só `concealed` (geometria).
    concealZones: [],
  }

  const concealed = zones.flatMap((zone, i) => concealedPieces(zone.ring, unveiledShown[i]))
  /**
   * O mesmo pedaço entra na VISÃO enviada. Sem isto o buraco no preto
   * mostraria névoa: a visão enviada é calculada sem o chão escondido da zona
   * (para a sombra dele não desenhar a zona), e a borda do chão que sobra corta
   * a visão bem na entrada da zona. Só as células pintadas somam, nada mais da
   * zona. Não vira memória: o anel encosta na zona (`blocked`) e
   * `rememberRing`/`markRings` o descartam — o pedaço fica à vista enquanto
   * estiver pintado, e some quando o mestre esconde de volta.
   */
  const sightRects = cellRunRects(new Set(shownCells))
  const sentVision = sightRects.length > 0 ? [...vision, ...sightRects] : vision
  return { map: filtered, vision: sentVision, visibleDoorIds, concealed, blocked, roofs }
}

/** O host vê o mapa inteiro, inclusive itens ocultos. */
export function filterMapForHost(map: MapData): MapData {
  return map
}

/**
 * O pino como o jogador pode recebê-lo. Sai SEMPRE numa cópia:
 * - `image` só em data URL (`isPlayerSafePinImage`) — nunca um caminho do
 *   disco do mestre;
 * - `destino` (pino de viagem) NUNCA: o id da cena de destino e o do pino par
 *   diriam ao jogador que a outra cena existe, antes de o mestre deixar passar.
 * - `passagem` VAI, de propósito: o cartão do jogador precisa saber se oferece
 *   "Passar", "Pedir para passar" ou "Está trancada". O modo diz como a porta
 *   se comporta, não para onde ela leva.
 */
function pinForPlayer(pin: Pin): Pin {
  // LISTA DO QUE VAI, e não "copia tudo e apaga o que não pode": campo que o
  // arquivo trouxer e o app não conhece (versão futura, edição à mão) não
  // chega ao jogador por descuido (revisão de segurança, 22/09). `destino`,
  // `rotulo` e `saidas` ficam de fora — o destino de cada saída diria que a
  // outra cena existe.
  const forPlayer: Pin = {
    id: pin.id,
    x: pin.x,
    y: pin.y,
    kind: pin.kind,
    description: pin.description,
    image: isPlayerSafePinImage(pin.image) ? pin.image : null,
  }
  if (pin.icon !== undefined) forPlayer.icon = pin.icon
  if (pin.locked !== undefined) forPlayer.locked = pin.locked
  if (pin.hidden !== undefined) forPlayer.hidden = pin.hidden
  if (pin.secret !== undefined) forPlayer.secret = pin.secret
  if (pin.passagem !== undefined) forPlayer.passagem = pin.passagem
  // ENCRUZILHADA: o jogador recebe `escolhas`, montado AQUI (nunca copiado do
  // mestre): por saída, só o id e o rótulo. Pino de uma saída não ganha o
  // campo: o cartão dele é o de sempre, e o recorte também.
  const escolhas = exitLabelsOf(pin)
  if (escolhas.length > 1) forPlayer.escolhas = escolhas
  return forPlayer
}
