import type { Drawing, MapData, MapLine, MapMarker, Prop, RegionPoint, Stair, Wall } from '../types/map'
import type { Bounds } from '../pixi/world'
import { createExploration, isPointExplored, markRings, type Exploration } from '../lib/exploration'
import { pointInRing } from '../lib/floorContour'
import { stairMidpoint } from '../lib/stairCurve'

/**
 * MAPA LEMBRADO — "Mudou desde a sua última visita".
 *
 * O jogador viu um trecho, saiu, e o mestre mexeu lá (jogou entulho, derrubou
 * uma parede, tirou o baú). Quando ele VOLTA a ver o trecho, o que mudou pisca
 * uma vez (`revisitPulse.ts`). A conta mora aqui, pura, sobre o que a própria
 * tela do jogador já recebeu — o mapa recortado pelo mestre e a visão. Nada
 * que a névoa, a zona oculta ou o teto escondem entra: o que não chegou no
 * pacote não pode piscar, e o que está debaixo de zona oculta ou de teto
 * fechado é pulado de propósito, senão o piscar viraria pista.
 *
 * Três portas para piscar, todas obrigatórias:
 *  1. o lugar está na visão AGORA e não estava no snapshot anterior (é a volta;
 *     o que muda enquanto o jogador olha ele viu acontecer);
 *  2. o jogador já tinha VISTO aquele lugar nesta sessão (a memória desta tela,
 *     não o explorado do mestre: "Revelar planta" e recarregar a página não
 *     inventam lembrança de móvel que ele nunca viu);
 *  3. o explorado que o mestre mandou antes ainda lembra o lugar ("Esconder de
 *     novo" apaga a lembrança, e o piscar vai junto).
 *
 * Cada cena tem a própria memória (por `map.id`): a viagem de volta revê o que
 * mudou lá enquanto o jogador estava em outra cena.
 */

/**
 * O que o jogador viu de uma coisa do mapa: a cara dela e onde ela fica.
 * Nunca muda depois de criada: a mesma é dividida pelo catálogo da tela e
 * pela lembrança de cada cena.
 */
interface SeenThing {
  readonly signature: string
  /** Pontos que dizem "está na visão": basta um. */
  readonly samples: readonly RegionPoint[]
  readonly bounds: Bounds
}

interface SceneMemory {
  things: Map<string, SeenThing>
  /** Onde a visão desta tela já passou nesta sessão (a grade do explorado, mas local). */
  seen: Exploration
  /** Tamanho do mundo em que `seen` foi montada: cena redimensionada recomeça. */
  sizeKey: string
  prevVision: RegionPoint[][]
  prevExplored: Exploration | undefined
  lastMap: MapData
  lastVision: RegionPoint[][]
}

/** A coisa vista e a chave dela entre as coisas do mapa (tipo e id). */
interface KeyedThing {
  readonly key: string
  readonly thing: SeenThing
}

/** As coisas vistas de uma lista do mapa, na ordem dela; `null` = fora da conta (parede sem comprimento, escada sem lance, traço sem ponto). */
interface ListThings<T> {
  readonly items: readonly T[]
  readonly things: readonly (KeyedThing | null)[]
}

/** As coisas do último mapa observado, lista por lista, e todas juntas por chave. */
interface ThingCatalog {
  readonly props: ListThings<Prop>
  readonly walls: ListThings<Wall>
  readonly stairs: ListThings<Stair>
  readonly drawings: ListThings<Drawing>
  readonly lines: ListThings<MapLine>
  readonly markers: ListThings<MapMarker>
  readonly all: ReadonlyMap<string, SeenThing>
}

export interface RevisitMemory {
  scenes: Map<string, SceneMemory>
  /** Cena do último snapshot: chegar de outra cena é voltar, mesmo que a visão de lá fosse a mesma. */
  currentMapId: string | null
  /** As coisas do último mapa: o passo da ficha reaproveita o que não mudou de referência (`collectThings`). */
  catalog: ThingCatalog | null
}

export interface RevisitSnapshot {
  map: MapData
  vision: RegionPoint[][]
  /** Explorado que o mestre mandou neste snapshot; ausente = sem memória de névoa. */
  explored?: Exploration
  /** Zonas ocultas ativas: nada pisca debaixo delas. */
  concealed?: RegionPoint[][]
}

export function createRevisitMemory(): RevisitMemory {
  return { scenes: new Map(), currentMapId: null, catalog: null }
}

/** Visão vazia: quem chega de outra cena não estava olhando para nada desta. */
const NO_VISION: RegionPoint[][] = []

/** Desvio da amostra da parede para cada lado, em px de mundo: a visão para rente à parede, e o meio exato cai na borda do anel. */
const WALL_SAMPLE_OFFSET = 2
/** Teto de amostras por traço longo (desenho, linha da planta): o teste de visão é por amostra. */
const MAX_STROKE_SAMPLES = 16

/** Anel com a caixa envolvente pronta: o teste de ponto descarta a maioria sem varrer os vértices. */
interface Ring extends Bounds {
  points: RegionPoint[]
}

function ringsOf(polygons: readonly RegionPoint[][]): Ring[] {
  return polygons.filter((points) => points.length >= 3).map((points) => ({ points, ...boundsOf(points) }))
}

function insideAny(rings: readonly Ring[], p: RegionPoint): boolean {
  return rings.some((r) => p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY && pointInRing(p, r.points))
}

function boundsOf(points: readonly RegionPoint[]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

/** No máximo `MAX_STROKE_SAMPLES` pontos do traço, espalhados, sempre com as duas pontas. */
function strokeSamples(points: readonly RegionPoint[]): RegionPoint[] {
  if (points.length <= MAX_STROKE_SAMPLES) return points.map((p) => ({ x: p.x, y: p.y }))
  const step = (points.length - 1) / (MAX_STROKE_SAMPLES - 1)
  const out: RegionPoint[] = []
  for (let k = 0; k < MAX_STROKE_SAMPLES; k += 1) {
    const p = points[Math.round(k * step)]
    out.push({ x: p.x, y: p.y })
  }
  return out
}

/** Contorno de amostra de cada tipo de desenho, em px de mundo. */
function drawingPoints(d: Drawing): RegionPoint[] {
  switch (d.kind) {
    case 'freehand':
    case 'curve':
    case 'polygon':
    case 'path':
      return strokeSamples(d.points)
    case 'line':
      return [
        { x: d.x1, y: d.y1 },
        { x: (d.x1 + d.x2) / 2, y: (d.y1 + d.y2) / 2 },
        { x: d.x2, y: d.y2 },
      ]
    case 'circle':
      return [
        { x: d.cx, y: d.cy },
        { x: d.cx - d.radius, y: d.cy - d.radius },
        { x: d.cx + d.radius, y: d.cy + d.radius },
      ]
    case 'ellipse':
      return [
        { x: d.cx, y: d.cy },
        { x: d.cx - d.rx, y: d.cy - d.ry },
        { x: d.cx + d.rx, y: d.cy + d.ry },
      ]
    case 'rect':
      return [
        { x: d.x, y: d.y },
        { x: d.x + d.w / 2, y: d.y + d.h / 2 },
        { x: d.x + d.w, y: d.y + d.h },
      ]
    case 'text':
      return [{ x: d.x, y: d.y }]
  }
}

function keyed(key: string, signature: unknown, samples: readonly RegionPoint[], outline: readonly RegionPoint[]): KeyedThing {
  return { key, thing: { signature: JSON.stringify(signature), samples, bounds: boundsOf(outline) } }
}

function propThing(p: Prop): KeyedThing {
  // Caixa que cabe o objeto em qualquer rotação: meia diagonal para cada lado.
  const half = Math.hypot(p.width, p.height) / 2
  const corners = [
    { x: p.x - half, y: p.y - half },
    { x: p.x + half, y: p.y + half },
  ]
  return keyed(`prop:${p.id}`, [p.x, p.y, p.width, p.height, p.rotation ?? 0], [{ x: p.x, y: p.y }], corners)
}

function wallThing(w: Wall): KeyedThing | null {
  const length = Math.hypot(w.x2 - w.x1, w.y2 - w.y1)
  if (!(length > 0)) return null
  const nx = (-(w.y2 - w.y1) / length) * WALL_SAMPLE_OFFSET
  const ny = ((w.x2 - w.x1) / length) * WALL_SAMPLE_OFFSET
  const mx = (w.x1 + w.x2) / 2
  const my = (w.y1 + w.y2) / 2
  const samples = [
    { x: mx + nx, y: my + ny },
    { x: mx - nx, y: my - ny },
  ]
  const ends = [
    { x: w.x1, y: w.y1 },
    { x: w.x2, y: w.y2 },
  ]
  return keyed(`wall:${w.id}`, [w.x1, w.y1, w.x2, w.y2, w.door?.kind ?? null], samples, ends)
}

function stairThing(s: Stair): KeyedThing | null {
  const first = s.segments[0]
  if (first === undefined) return null
  const ends = s.segments.flatMap((seg) => [
    { x: seg.x1, y: seg.y1 },
    { x: seg.x2, y: seg.y2 },
  ])
  // Na escada curva, o meio do arco; a curva entra na chave: curvar a escada é mudar a escada.
  const samples = [stairMidpoint(s) ?? { x: (first.x1 + first.x2) / 2, y: (first.y1 + first.y2) / 2 }]
  return keyed(`stair:${s.id}`, [s.shape, s.direction, s.segments, s.stepWidth, s.rotation ?? 0, s.curva ?? 0], samples, ends)
}

function drawingThing(d: Drawing): KeyedThing | null {
  const points = drawingPoints(d)
  if (points.length === 0) return null
  return keyed(`drawing:${d.id}`, d, points, points)
}

function lineThing(l: MapLine): KeyedThing | null {
  if (l.points.length === 0) return null
  return keyed(`line:${l.id}`, [l.points, l.closed, l.dotted], strokeSamples(l.points), l.points)
}

function markerThing(m: MapMarker): KeyedThing {
  const half = Math.hypot(m.w, m.h) / 2
  const corners = [
    { x: m.cx - half, y: m.cy - half },
    { x: m.cx + half, y: m.cy + half },
  ]
  return keyed(`marker:${m.id}`, [m.cx, m.cy, m.w, m.h, m.rotation], [{ x: m.cx, y: m.cy }], corners)
}

/**
 * ASSINATURA SÓ DO QUE MUDOU, por referência, antes de serializar. O patch do
 * mestre mantém a MESMA lista em todo campo do mapa que não mudou
 * (`applyMapPatch`, em `net/viewPatch.ts`), e nada na tela do jogador muta o
 * mapa no lugar: lista igual = coisas iguais, sem olhar uma por uma. Lista
 * nova compara item a item com a de antes, na mesma posição; só o objeto novo
 * é serializado (o que só andou de posição na lista é refeito: custa o de
 * antes, nunca erra). A comparação com a lembrança continua sendo pelo
 * conteúdo: o snapshot inteiro, de objetos novos com o mesmo conteúdo, não pisca.
 */
function listThings<T>(items: readonly T[], previous: ListThings<T> | undefined, build: (item: T) => KeyedThing | null): ListThings<T> {
  if (previous === undefined) return { items, things: items.map((item) => build(item)) }
  if (previous.items === items) return previous
  const old = previous.items
  return { items, things: items.map((item, i) => (old[i] === item ? previous.things[i] : build(item))) }
}

/**
 * Tudo que pode "mudar desde a última visita", com chave por tipo e id. Ficha
 * fica de fora (anda o tempo todo), e luz, pino e sala também: são anotação
 * ou efeito, não o trecho. Da porta conta a planta (onde está, que tipo), não
 * o estado: aberta por outro jogador é o jogo andando, não o lugar mudando.
 *
 * O passo da ficha chega com mapa novo e as MESMAS listas: devolve o conjunto
 * de antes inteiro. Serializar as milhares de paredes a cada passo só para
 * descobrir isso era o tranco do passo numa cena grande.
 */
function collectThings(memory: RevisitMemory, map: MapData): ReadonlyMap<string, SeenThing> {
  const previous = memory.catalog
  const props = listThings(map.props, previous?.props, propThing)
  const walls = listThings(map.walls, previous?.walls, wallThing)
  const stairs = listThings(map.stairs, previous?.stairs, stairThing)
  const drawings = listThings(map.drawings, previous?.drawings, drawingThing)
  const lines = listThings(map.lines, previous?.lines, lineThing)
  const markers = listThings(map.markers, previous?.markers, markerThing)
  if (
    previous !== null &&
    props === previous.props &&
    walls === previous.walls &&
    stairs === previous.stairs &&
    drawings === previous.drawings &&
    lines === previous.lines &&
    markers === previous.markers
  ) {
    return previous.all
  }
  // Mesma ordem de sempre (objetos, paredes, escadas, desenhos, linhas, marcadores): é a ordem das áreas que piscam.
  const all = new Map<string, SeenThing>()
  for (const list of [props, walls, stairs, drawings, lines, markers]) {
    for (const entry of list.things) if (entry !== null) all.set(entry.key, entry.thing)
  }
  memory.catalog = { props, walls, stairs, drawings, lines, markers, all }
  return all
}

/** Polígonos das salas de teto FECHADO para este jogador (o recorte só manda `roof` nesse caso). */
function closedRoofs(map: MapData): RegionPoint[][] {
  return map.regions.filter((r) => r.room?.roof === true && r.points.length >= 3).map((r) => r.points)
}

/** Mundo em px (a grade do explorado é a mesma do host: `net/hostSession.ts`). */
function worldSize(map: MapData): { width: number; height: number; grid: number } {
  return { width: map.width * map.grid, height: map.height * map.grid, grid: map.grid }
}

function sameGrid(a: Exploration, b: Exploration): boolean {
  return a.cell === b.cell && a.cols === b.cols && a.rows === b.rows
}

/** Explorado do mestre só serve de régua na mesma grade da memória local; noutra, fica só a memória local. */
function comparableExplored(explored: Exploration | undefined, seen: Exploration): Exploration | undefined {
  return explored !== undefined && sameGrid(explored, seen) ? explored : undefined
}

/** Primeira vez nesta cena (ou ela mudou de tamanho): só aprende o que está na visão; nada pisca. */
function learnScene(memory: RevisitMemory, snapshot: RevisitSnapshot, sizeKey: string, things: ReadonlyMap<string, SeenThing>): void {
  const { map, vision, explored } = snapshot
  const visionRings = ringsOf(vision)
  const kept = new Map<string, SeenThing>()
  for (const [key, t] of things) if (t.samples.some((p) => insideAny(visionRings, p))) kept.set(key, t)
  const seen = createExploration(worldSize(map))
  markRings(seen, vision)
  memory.scenes.set(map.id, {
    things: kept,
    seen,
    sizeKey,
    prevVision: vision,
    prevExplored: comparableExplored(explored, seen),
    lastMap: map,
    lastVision: vision,
  })
}

/**
 * Registra o snapshot na memória e devolve as áreas (px de mundo) que mudaram
 * desde a última visita e estão sendo revistas agora. Muta `memory`.
 */
export function observeRevisit(memory: RevisitMemory, snapshot: RevisitSnapshot): Bounds[] {
  const { map, vision, explored, concealed = [] } = snapshot
  const arrived = memory.currentMapId !== map.id
  memory.currentMapId = map.id
  const scene = memory.scenes.get(map.id)
  const sizeKey = JSON.stringify([map.width, map.height, map.grid])
  if (scene === undefined || scene.sizeKey !== sizeKey) {
    learnScene(memory, snapshot, sizeKey, collectThings(memory, map))
    return []
  }
  // O mesmo snapshot redesenhado (brilho, nomes, zoom) não é uma volta.
  if (!arrived && scene.lastMap === map && scene.lastVision === vision) return []

  const things = collectThings(memory, map)
  const visionRings = ringsOf(vision)
  // Chegou de outra cena: aqui ele não estava olhando para nada.
  const prevRings = ringsOf(arrived ? NO_VISION : scene.prevVision)
  const hiddenRings = ringsOf([...concealed, ...closedRoofs(map)])
  const prevExplored = scene.prevExplored
  const remembered = (p: RegionPoint): boolean =>
    isPointExplored(scene.seen, p) && (prevExplored === undefined || isPointExplored(prevExplored, p))
  const inVision = (samples: readonly RegionPoint[]): boolean => samples.some((p) => insideAny(visionRings, p))
  /** É a volta a um lugar lembrado: na visão agora, fora dela no snapshot anterior, e já visto antes. */
  const revisited = (samples: readonly RegionPoint[]): boolean =>
    inVision(samples) && !samples.some((p) => insideAny(prevRings, p)) && samples.some(remembered)
  const hidden = (samples: readonly RegionPoint[]): boolean => samples.some((p) => insideAny(hiddenRings, p))

  const changed: Bounds[] = []
  // O que ele lembrava e não está mais lá como era (sumiu, ou mudou para longe dali).
  for (const [key, prior] of scene.things) {
    const current = things.get(key)
    if (current !== undefined && current.signature === prior.signature) continue
    if (!inVision(prior.samples)) continue
    // Continua na visão, só que diferente: o laço de baixo pisca no lugar novo.
    if (current !== undefined && inVision(current.samples)) continue
    // Debaixo de zona oculta ou de teto: o jogador não enxerga ali, a lembrança fica como estava.
    if (hidden(prior.samples)) continue
    if (revisited(prior.samples)) changed.push(prior.bounds)
    scene.things.delete(key)
  }
  // O que está na visão agora e não é o que ele lembrava (novo ou mudado).
  for (const [key, current] of things) {
    if (!inVision(current.samples)) continue
    const prior = scene.things.get(key)
    if (prior === undefined || prior.signature !== current.signature) {
      if (!hidden(current.samples) && revisited(current.samples)) changed.push(current.bounds)
    }
    scene.things.set(key, current)
  }

  markRings(scene.seen, vision)
  scene.prevVision = vision
  scene.prevExplored = comparableExplored(explored, scene.seen)
  scene.lastMap = map
  scene.lastVision = vision
  return changed
}
