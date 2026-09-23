import type { DoorState, Drawing, FloorPiece, LayerId, MapData, MapLine, MapMarker, Pin, Region, RegionPoint, Stair, Token, Wall } from '../types/map'
import { isTokenPhotoData } from './tokenPhoto'
import { isPointExplored, isShapeExplored, type Exploration } from './exploration'
import { pointInRing } from './floorContour'
import { pieceBounds, pieceDistance, shapeCenter } from './floorSdf'
import { drawingLayer, regionLayer, stairLayer, visibleLights, visibleProps, visibleRegions, visibleTokens, wallLayer } from './layers'
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
   * Só a geometria sai: nome e id da zona ficam no mestre.
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
  /**
   * A memória da planta DEPOIS deste recorte: o que está na visão agora entra
   * (versão atual), o que o jogador viu mudar ou sumir sai, o que o mestre
   * esconde item a item (oculto, secreto) sai; camada escondida fica guardada,
   * sem sair. O chamador guarda para o próximo recorte. Sem `remembered` na
   * entrada, volta só com o que está à vista agora.
   */
  plan: PlanMemory
}

/** Polígonos das zonas ocultas ativas (`?? []`: mapa montado fora do deserializeMap pode vir sem o campo). */
function activeConcealRings(map: MapData): RegionPoint[][] {
  return (map.concealZones ?? [])
    .filter((z) => !z.revealed && z.points.length >= 3)
    .map((z) => z.points.map((p) => ({ x: p.x, y: p.y })))
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

/** Porta explorada que o jogador nunca viu: aparece fechada e destrancada. */
function unseenDoor(door: DoorState): DoorState {
  return { open: false, locked: false, kind: door.kind }
}

/**
 * MEMÓRIA DA PLANTA — a última versão de cada item estático que o jogador VIU,
 * por id. É o que o explorado mostra fora da visão atual: o lugar como ele o
 * deixou, e não como o mestre o deixou depois. Parede nova, desabamento,
 * bilhete reescrito ou pino novo longe dele só chegam quando ele volta a ver o
 * lugar. Vive no mestre (`net/hostSession.ts`), uma por jogador e por cena;
 * nunca sai pela rede inteira — só o que o recorte escolhe dela.
 */
export interface PlanMemory {
  walls: ReadonlyMap<string, Wall>
  floor: ReadonlyMap<string, FloorPiece>
  regions: ReadonlyMap<string, Region>
  drawings: ReadonlyMap<string, Drawing>
  markers: ReadonlyMap<string, MapMarker>
  lines: ReadonlyMap<string, MapLine>
  stairs: ReadonlyMap<string, Stair>
  pins: ReadonlyMap<string, Pin>
}

export function emptyPlanMemory(): PlanMemory {
  return { walls: new Map(), floor: new Map(), regions: new Map(), drawings: new Map(), markers: new Map(), lines: new Map(), stairs: new Map(), pins: new Map() }
}

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}

/**
 * "Revelar planta" do mestre: o jogador passa a lembrar a planta como ela está
 * AGORA. Entra tudo; o que o mestre esconde (item oculto, secreto, camada, sala
 * secreta, teto, zona) o recorte tira na hora de mandar e apaga da memória.
 */
export function planOfWholeMap(map: MapData): PlanMemory {
  return {
    walls: byId(map.walls),
    floor: byId(map.floor),
    regions: byId(map.regions),
    drawings: byId(map.drawings),
    markers: byId(map.markers),
    lines: byId(map.lines),
    stairs: byId(map.stairs),
    pins: byId(map.pins ?? []),
  }
}

/** De onde veio a versão que sai: a vista agora, a lembrada, ou a nunca vista (planta fora da memória). */
type RecallSource = 'agora' | 'lembrado' | 'nunca-visto'

interface RecallRules<T> {
  /**
   * O mestre deixa o jogador receber o item (não está oculto nem secreto).
   * Vale para a versão atual E para a lembrada: a memória nunca devolve o que o
   * mestre esconde. A lembrança de item escondido fica guardada SEM sair
   * (desfeito o oculto, volta a versão que ele viu), a menos que o jogador veja o
   * lugar enquanto está escondido: aí ele viu o lugar sem o item e esquece.
   */
  allowed: (item: T) => boolean
  /**
   * A camada do item está à mostra (`hiddenLayers`). Camada escondida não sai,
   * mas NÃO apaga a memória: é um interruptor do mapa inteiro, e religá-lo não
   * pode deixar o explorado de todo jogador vazio.
   */
  shown: (item: T) => boolean
  /**
   * O lugar do item permite mandá-lo (sala secreta, teto fechado, zona oculta).
   * Lugar escondido não apaga a memória: ligar e desligar uma zona longe do
   * jogador não pode deixar buraco sem chão nem sala no explorado dele.
   */
  placeOk: (item: T) => boolean
  /** O item está na visão ATUAL do jogador. */
  seenNow: (item: T) => boolean
  /** Item que o jogador nunca viu (ou esqueceu) ainda sai. */
  unseenOk: (item: T) => boolean
}

interface Recalled<T> {
  items: { item: T; source: RecallSource }[]
  plan: Map<string, T>
}

/**
 * Escolhe, item a item, a versão que o jogador recebe.
 *
 * `all`: a lista do mapa do mestre. Item que o mestre esconde agora
 * (`rules.allowed` ou `rules.placeOk` falso) não sai: o jogador não recebe nem
 * a versão que viu antes, mas ela fica na memória. Saem na ordem do mapa; os
 * apagados que ele lembra, no fim.
 *
 * Sem `memory` (quem não guarda memória por jogador), o explorado mostra o
 * presente: é a regra antiga, e `unseenOk` é que decide.
 */
function recallItems<T extends { id: string }>(
  all: readonly T[],
  memory: ReadonlyMap<string, T> | undefined,
  rules: RecallRules<T>,
): Recalled<T> {
  const items: { item: T; source: RecallSource }[] = []
  const plan = new Map<string, T>()
  for (const current of all) {
    const remembered = memory?.get(current.id)
    const allowedNow = rules.allowed(current)
    if (allowedNow && !rules.shown(current)) {
      if (remembered !== undefined) plan.set(current.id, remembered)
      continue
    }
    if (allowedNow && rules.placeOk(current) && rules.seenNow(current)) {
      items.push({ item: current, source: 'agora' })
      plan.set(current.id, current)
      continue
    }
    // O lugar lembrado está à vista e o item não está lá como era: ele vê que mudou e esquece.
    if (remembered !== undefined && rules.allowed(remembered) && rules.shown(remembered) && !rules.seenNow(remembered)) {
      if (allowedNow && rules.placeOk(remembered)) {
        items.push({ item: remembered, source: 'lembrado' })
        plan.set(current.id, remembered)
        continue
      }
      // O mestre esconde agora o item ou o lugar lembrado (oculto, secreto, zona,
      // sala secreta, teto): não sai, mas a lembrança fica para quando ele desfizer.
      plan.set(current.id, remembered)
    }
    if (allowedNow && rules.placeOk(current) && rules.unseenOk(current)) items.push({ item: current, source: 'nunca-visto' })
  }
  if (memory === undefined) return { items, plan }
  const present = new Set(all.map((item) => item.id))
  // Apagado pelo mestre depois que o jogador viu: continua na memória até ele ver o lugar vazio.
  for (const [id, remembered] of memory) {
    if (present.has(id) || !rules.allowed(remembered)) continue
    if (!rules.shown(remembered)) {
      plan.set(id, remembered)
      continue
    }
    if (rules.seenNow(remembered)) continue
    // Lugar escondido agora (zona, sala secreta, teto): guarda sem mandar.
    if (rules.placeOk(remembered)) items.push({ item: remembered, source: 'lembrado' })
    plan.set(id, remembered)
  }
  return { items, plan }
}

/** Passo das amostras de visão ao longo de uma parede, em células da grade. */
const WALL_SAMPLE_STEP_CELLS = 1

/**
 * Amostras dos DOIS lados de uma parede, ao longo dela, a `distance` px do
 * traço. A visão para NA parede, então amostra em cima do traço cai na borda
 * do anel; uma por célula da grade (mais as pontas) acha trecho visto de
 * parede comprida que as 3 amostras de `wallSamples` perderiam.
 */
function wallSideSamples(wall: Wall, grid: number, distance: number): RegionPoint[] {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const len = Math.hypot(dx, dy)
  if (len === 0 || !Number.isFinite(len)) return [wallMidpoint(wall)]
  const steps = Math.max(1, Math.ceil(len / Math.max(1, grid * WALL_SAMPLE_STEP_CELLS)))
  const nx = (-dy / len) * distance
  const ny = (dx / len) * distance
  const out: RegionPoint[] = []
  // Meio de cada trecho, não as pontas: a ponta é o canto, que a parede vizinha já mostra.
  for (let i = 0; i < steps; i += 1) {
    const x = wall.x1 + (dx * (i + 0.5)) / steps
    const y = wall.y1 + (dy * (i + 0.5)) / steps
    out.push({ x: x + nx, y: y + ny }, { x: x - nx, y: y - ny })
  }
  return out
}

/** Profundidade mínima, em px de mundo, para um vértice da visão contar como DENTRO de uma peça de chão. */
const FLOOR_SEEN_DEPTH = 1

/**
 * `explored`: memória do jogador ANTES desta visão (quem marca é o chamador).
 * Só a planta estática (regiões, desenhos e textos, escadas, portas, linhas,
 * marcadores) entra por estar explorada; token, prop e luz mudam de lugar e
 * continuam exigindo visão atual, senão a memória viraria espionagem.
 * `seenDoors`: último estado visto de cada porta (somente leitura). Porta
 * explorada fora da visão sai com esse estado, nunca com o atual: senão o
 * jogador longe veria o mestre abrir ou destrancar a porta.
 * `remembered`: memória da planta do jogador (`PlanMemory`). Com ela, o
 * explorado fora da visão mostra a versão LEMBRADA de cada item e nada do que o
 * jogador nunca viu (a parede que o mestre ergueu longe dele não aparece). Sem
 * ela, o explorado mostra o presente — só para quem não guarda memória por
 * jogador; o host sempre passa.
 */
export function filterMapForPlayer(
  map: MapData,
  playerId: string,
  ownership: Record<string, string[]>,
  visionRadius: number,
  explored?: Exploration,
  seenDoors?: ReadonlyMap<string, DoorState>,
  remembered?: PlanMemory,
): PlayerMapView {
  const hiddenLayers = map.hiddenLayers
  const owned = new Set(ownership[playerId] ?? []) // jogador sem entrada de posse não tem token nem visão
  const layerTokens = visibleTokens(map.tokens, hiddenLayers)
  const ownTokens = layerTokens.filter((t) => owned.has(t.id) && !t.hidden)

  // Zona oculta ativa: ponto dentro dela não conta como visível nem explorado.
  // A visão continua passando (a zona esconde conteúdo, não é parede).
  const concealed = activeConcealRings(map)
  const zones = boxRings(concealed)
  const inConcealZone = (point: RegionPoint): boolean => zones.length > 0 && inAnyRing(zones, point)
  const outsideZones = (points: readonly RegionPoint[]): readonly RegionPoint[] =>
    zones.length === 0 ? points : points.filter((p) => !inConcealZone(p))

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
  const blocked = [...concealed, ...secretRooms.map((r) => r.points)]

  // Peça de chão com a maioria das amostras em área escondida não sai. Limitação
  // aceita: peça grande que cruza a borda sai inteira, e tirar peça 'subtract'
  // fecha o buraco dela (só dentro da área escondida).
  // O chão de dentro do prédio de teto fechado some pelo mesmo caminho, embora
  // o teto não esteja mais em `blocked` (ver o comentário de `roofs` acima).
  const hiddenAreas = boxRings(blocked)
  const isFloorInHiddenArea = (f: FloorPiece): boolean =>
    (hiddenAreas.length > 0 || closedRoofs.length > 0) && mostly(floorPieceSamples(f), (p) => inAnyRing(hiddenAreas, p) || inClosedRoof(p))
  const hiddenFloorIds = new Set(map.floor.filter(isFloorInHiddenArea).map((f) => f.id))

  /**
   * Duas visões. A da autoridade (todas as paredes, chão inteiro) decide o que
   * sai do mapa. A enviada (`vision`) é montada sem o que o jogador não pode
   * saber: paredes da sala secreta, paredes/portas inteiras dentro de zona
   * ativa e peças de chão escondidas; senão a sombra delas desenharia a sala na
   * névoa. Parede que só cruza a borda da zona continua na enviada: tirá-la
   * deixaria o jogador ver através dela fora da zona. Colisão não usa isto.
   */
  const authoritySegments = ownTokens.length > 0 ? visionSegments(map) : []
  const authorityVision = ownTokens.map((t) => computeVisibility({ x: t.x, y: t.y }, authoritySegments, visionRadius))
  const rings = boxRings(authorityVision)
  const playerWalls = map.walls.filter(
    (w) =>
      !(w.regionId !== undefined && secretRoomIds.has(w.regionId)) &&
      !isUnderClosedRoof(w) &&
      !(zones.length > 0 && wallSamples(w).every(inConcealZone)),
  )
  let vision = authorityVision
  if (ownTokens.length > 0 && (playerWalls.length !== map.walls.length || hiddenFloorIds.size > 0)) {
    const playerSegments = visionSegments({ ...map, walls: playerWalls, floor: floorWithout(map.floor, hiddenFloorIds) })
    vision = ownTokens.map((t) => computeVisibility({ x: t.x, y: t.y }, playerSegments, visionRadius))
  }

  const isVisible = (point: RegionPoint): boolean => !inConcealZone(point) && inAnyRing(rings, point)

  /**
   * Forma com extensão: a caixa da forma precisa cruzar a caixa de algum anel
   * e algum ponto amostrado (fora de zona oculta) precisa estar dentro dele.
   * Forma que só atravessa a visão sem nenhum ponto amostrado dentro fica de
   * fora (aceito).
   */
  const isShapeVisible = (points: readonly RegionPoint[]): boolean => {
    const open = outsideZones(points)
    const box = boxOf(open)
    if (box === null) return false
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
    explored !== undefined && !inConcealZone(point) && isPointExplored(explored, point)

  /**
   * Planta estática: visível agora, ou lembrada (`recallItems`). Nunca usar
   * para entidade dinâmica. Sem memória da planta (`remembered` ausente), vale
   * a regra antiga: o explorado sozinho mostra o presente.
   */
  const memoryMode = remembered !== undefined
  const exploredPoint = (point: RegionPoint): boolean => !memoryMode && isPointExploredOpen(point)
  const exploredShape = (points: readonly RegionPoint[]): boolean =>
    !memoryMode && explored !== undefined && isShapeExplored(explored, outsideZones(points))
  const layerShown = (layer: LayerId): boolean => !hiddenLayers.includes(layer)

  const markerCenter = (m: MapMarker): RegionPoint => ({ x: m.cx, y: m.cy })
  const markers = recallItems(map.markers, remembered?.markers, {
    allowed: () => true,
    shown: () => true,
    placeOk: (m) => !inRoomHiddenFromPlayer(markerCenter(m)) && !inConcealZone(markerCenter(m)),
    seenNow: (m) => isVisible(markerCenter(m)),
    unseenOk: (m) => exploredPoint(markerCenter(m)),
  })

  const lines = recallItems(map.lines, remembered?.lines, {
    allowed: () => true,
    shown: () => true,
    placeOk: (l) => !l.points.some(inRoomHiddenFromPlayer) && !l.points.some(inConcealZone),
    seenNow: (l) => isShapeVisible(l.points),
    unseenOk: (l) => exploredShape(l.points),
  })

  const stairMid = (s: Stair): RegionPoint | null => {
    const first = s.segments[0]
    return first === undefined ? null : { x: (first.x1 + first.x2) / 2, y: (first.y1 + first.y2) / 2 }
  }
  const stairs = recallItems(map.stairs, remembered?.stairs, {
    allowed: (s) => !s.hidden && !s.secret,
    shown: (s) => layerShown(stairLayer(s)),
    placeOk: (s) => {
      const mid = stairMid(s)
      return mid !== null && !inConcealZone(mid) && !stairSamples(s).some(inRoomHiddenFromPlayer)
    },
    seenNow: (s) => {
      const mid = stairMid(s)
      return mid !== null && isVisible(mid)
    },
    unseenOk: (s) => {
      const mid = stairMid(s)
      return mid !== null && exploredPoint(mid)
    },
  })

  const drawings = recallItems(map.drawings, remembered?.drawings, {
    allowed: (d) => !d.secret,
    shown: (d) => layerShown(drawingLayer(d)),
    placeOk: (d) => {
      const samples = drawingSamplePoints(d)
      if (samples.some(inRoomHiddenFromPlayer)) return false
      // Traço com uma ponta na zona desenharia o que ela esconde.
      if (isStrokeDrawing(d) && samples.some(inConcealZone)) return false
      return outsideZones(samples).length > 0
    },
    seenNow: (d) => isShapeVisible(drawingSamplePoints(d)),
    unseenOk: (d) => exploredShape(drawingSamplePoints(d)),
  })

  // Teto fechado: o "conhecido" é medido NO CONTORNO, nunca no interior —
  // que está bloqueado justamente por causa do teto. Ver `contourSamples`.
  const regionSamples = (r: Region): RegionPoint[] =>
    closedRoofIds.has(r.id) ? contourSamples(r.points) : interiorSamples(r.points, r.points)
  const regions = recallItems(map.regions, remembered?.regions, {
    allowed: (r) => !r.hidden && !r.secret && !hiddenByAncestorIds.has(r.id),
    shown: (r) => layerShown(regionLayer(r)),
    // Sala de teto que a geometria não sabe julgar não vira silhueta: some.
    // Cômodo órfão dentro do prédio, Área sem `parentId`, prédio de teto
    // dentro de outro prédio de teto: tudo isso é interior. Ver `swallowedByClosedRoof`.
    placeOk: (r) =>
      !underRoofIds.has(r.id) && !brokenRoofIds.has(r.id) && !swallowedByClosedRoof(r) && outsideZones(regionSamples(r)).length > 0,
    seenNow: (r) => isShapeVisible(regionSamples(r)),
    unseenOk: (r) => exploredShape(regionSamples(r)),
  })
  /** Versão ATUAL de cada região: o nome que o mestre esconde agora não volta pela memória. */
  const currentRegions = new Map(map.regions.map((r) => [r.id, r]))

  const visibleDoorIds: string[] = []
  const walls = recallItems(map.walls, remembered?.walls, {
    allowed: (w) => !w.hidden,
    shown: (w) => layerShown(wallLayer(w)),
    placeOk: (w) => {
      if (w.regionId !== undefined && secretRoomIds.has(w.regionId)) return false
      if (isUnderClosedRoof(w)) return false
      // Porta com o meio escondido não sai nem pelas amostras dos lados.
      if (w.door !== null) return !inConcealZone(wallMidpoint(w))
      return !wallSamples(w).some(inConcealZone)
    },
    seenNow: (w) =>
      w.door !== null ? doorSamples(w, DOOR_VISION_PROBE).some(isVisible) : wallSideSamples(w, map.grid, DOOR_VISION_PROBE).some(isVisible),
    unseenOk: (w) => {
      if (explored === undefined) return w.door === null
      const probe = explored.cell * DOOR_EXPLORED_PROBE_CELLS
      // Porta explorada que nunca foi vista: só na regra antiga (com memória, ela é nova para o jogador).
      if (w.door !== null) return !memoryMode && doorSamples(w, probe).some(isPointExploredOpen)
      // Parede nunca vista: a planta vai inteira FORA do explorado (a névoa a cobre);
      // dentro dele, seria a parede que o mestre ergueu longe do jogador.
      if (!memoryMode) return true
      return ![...wallSideSamples(w, map.grid, DOOR_VISION_PROBE), ...wallSideSamples(w, map.grid, probe)].some(isPointExploredOpen)
    },
  })

  /**
   * Peça de chão na visão atual. As amostras de `floorPieceSamples` sozinhas
   * perdem peça grande vista só pela beirada; o token dentro dela ou um
   * vértice do anel de visão FUNDO dentro dela (não em cima da borda, que é a
   * parede que a separa da vizinha) também contam.
   */
  const floorSeenNow = (f: FloorPiece): boolean => {
    const b = pieceBounds(f)
    const near = rings.filter((r) => b.maxX >= r.minX && b.minX <= r.maxX && b.maxY >= r.minY && b.minY <= r.maxY)
    if (near.length === 0) return false
    if (floorPieceSamples(f).some(isVisible)) return true
    if (ownTokens.some((t) => !inConcealZone({ x: t.x, y: t.y }) && pieceDistance(f, t.x, t.y) <= 0)) return true
    return near.some((r) =>
      r.ring.some(
        (v) => v.x >= b.minX && v.x <= b.maxX && v.y >= b.minY && v.y <= b.maxY && !inConcealZone(v) && pieceDistance(f, v.x, v.y) < -FLOOR_SEEN_DEPTH,
      ),
    )
  }
  const floor = recallItems(map.floor, remembered?.floor, {
    allowed: (f) => !f.hidden,
    shown: () => true,
    placeOk: (f) => !isFloorInHiddenArea(f),
    seenNow: floorSeenNow,
    unseenOk: (f) => !memoryMode || !floorPieceSamples(f).some(isPointExploredOpen),
  })

  // CHEGADA OCULTA (mão única) sai ANTES de qualquer outra regra: não é
  // questão de névoa nem de explorado — o jogador nunca recebe o pino, nem o
  // id dele, estando ou não em cima dele. Ver `isArrivalOnly`.
  const pinPoint = (p: Pin): RegionPoint => ({ x: p.x, y: p.y })
  const pins = recallItems(map.pins ?? [], remembered?.pins, {
    allowed: (p) => !isArrivalOnly(p) && !p.hidden && !p.secret,
    shown: () => layerShown('anotacoes'),
    placeOk: (p) => !inRoomHiddenFromPlayer(pinPoint(p)) && !inConcealZone(pinPoint(p)),
    seenNow: (p) => isVisible(pinPoint(p)),
    unseenOk: (p) => exploredPoint(pinPoint(p)),
  })

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
    tokens: layerTokens
      .filter((t) => !t.hidden && (owned.has(t.id) || (!t.secret && !inClosedRoof({ x: t.x, y: t.y }) && isVisible({ x: t.x, y: t.y }))))
      .map(sanitizeTokenPhoto),
    markers: markers.items.map(({ item }) => item),
    lines: lines.items.map(({ item }) => item),
    // Tocha acesa dentro do prédio de teto fechado não sai: o halo dela
    // desenharia o interior na tela do jogador que está lá fora.
    lights: visibleLights(map.lights, hiddenLayers).filter(
      (l) => !l.hidden && !inClosedRoof({ x: l.x, y: l.y }) && isVisible({ x: l.x, y: l.y }),
    ),
    stairs: stairs.items.map(({ item }) => item),
    props: visibleProps(map.props, hiddenLayers)
      .filter((p) => !p.hidden && !p.secret && !inClosedRoof({ x: p.x, y: p.y }) && isVisible({ x: p.x, y: p.y }))
      .map((p) => ({ ...p, src: '', linkedMapPath: null })),
    drawings: drawings.items.map(({ item }) => item),
    regions: regions.items
      .map(({ item: r }) => {
        if (r.room === undefined) return r
        const roofClosed = closedRoofIds.has(r.id)
        // Sala com a maioria do interior dentro de zona ativa: o nome é do que a zona esconde.
        // Teto fechado esconde o nome junto: o rótulo é desenhado DENTRO do
        // polígono e é anotação do mestre sobre o que tem lá dentro.
        // Nome que o mestre escondeu DEPOIS que o jogador viu também some da memória.
        const nameHidden =
          r.room.nameHiddenFromPlayers ||
          currentRegions.get(r.id)?.room?.nameHiddenFromPlayers === true ||
          roofClosed ||
          (zones.length > 0 && mostly(interiorSamples(r.points, r.points), inConcealZone))
        if (!nameHidden && !roofClosed && r.room.roof === undefined) return r
        // `roof` atravessa SÓ quando o teto está fechado PARA ESTE JOGADOR: é o
        // sinal de "pinte a silhueta" (`player/PlayerView.tsx`). Com o teto
        // aberto o campo some e a Sala volta a desenhar como sempre desenhou.
        return { ...r, room: { ...r.room, name: nameHidden ? '' : r.room.name, roof: roofClosed ? true : undefined } }
      }),
    // Porta dentro da visão sai com o estado real; lembrada ou explorada fora
    // dela, com o último estado visto (senão o jogador longe veria o mestre
    // abrir ou destrancar a porta).
    walls: walls.items.map(({ item: w, source }) => {
      if (w.door === null) return w
      if (source === 'agora') {
        visibleDoorIds.push(w.id)
        return w
      }
      return { ...w, door: seenDoors?.get(w.id) ?? unseenDoor(w.door) }
    }),
    floor: floor.items.map(({ item }) => item),
    // Pino de ponto de interesse: anotação estática, então vale a memória
    // (mesma regra de linha/marcador). `image` só atravessa em data URL — se
    // um dia alguém guardar caminho de disco no campo, o jogador recebe
    // `null` em vez do computador do mestre (`isPlayerSafePinImage`).
    pins: pins.items.map(({ item }) => pinForPlayer(item)),
    // Metadado do mestre: nome e estado das zonas não saem; só `concealed` (geometria).
    concealZones: [],
  }
  const plan: PlanMemory = {
    walls: walls.plan,
    floor: floor.plan,
    regions: regions.plan,
    drawings: drawings.plan,
    markers: markers.plan,
    lines: lines.plan,
    stairs: stairs.plan,
    pins: pins.plan,
  }
  return { map: filtered, vision, visibleDoorIds, concealed, blocked, roofs, plan }
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
