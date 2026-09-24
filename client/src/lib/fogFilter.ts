import type { ConcealZone, DoorState, Drawing, FloorPiece, MapData, Pin, Region, RegionPoint, Token, TokenCompanion, Wall } from '../types/map'
import { cellCenter, cellKeyAt, cellRunRects, concealedPieces, REVEAL_BRUSH_CELL, unveiledCellsOf } from './concealBrush'
import { isTokenPhotoData } from './tokenPhoto'
import { tokenAsSeenByPlayer, tokenPublicNameMode } from './tokenPublicName'
import { isPointExplored, isShapeExplored, type Exploration } from './exploration'
import { pointInRing } from './floorContour'
import { pieceBounds, pieceDistance, shapeCenter } from './floorSdf'
import { visibleDrawings, visibleLights, visibleProps, visibleRegions, visibleStairs, visibleTokens, visibleWalls } from './layers'
import { blockReasonOf, isPlayerSafePinImage } from './pins'
import { CLUE_TITLE_ONLY_IMAGE, clampClueText, clueTitleFrom } from './clues'
import { exitLabelsOf, isArrivalOnly, type OneWayExits } from './pinTravel'
import { withoutAttachment } from './lightAttachment'
import { computeVisibility, visionSegments } from './visibility'
import { ancestorsOf, NESTING_TOLERANCE, pointInPolygonInclusive, pointOnPolygonBorder, subtreeIds } from './roomNesting'
import { roomHasRoof } from './roomOps'
import { rotatePointAround, rotationTrig } from './roomRotation'
import { clampRoomText, hasEnterText } from './roomText'

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
  /**
   * TEXTO DA SALA — ids das Salas COM texto de entrada em que uma ficha do
   * jogador está agora, estritamente dentro, e que ele pode ler (a Sala saiu
   * no recorte, fora de teto fechado e de zona oculta, e a ficha não está em
   * zona oculta nem em sala secreta). O chamador compara com as que ele já
   * visitou para mandar o cartão só na primeira entrada. Não sai pela rede.
   */
  occupiedRooms: string[]
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

/** Só a reta de uma parede: o que as contas de continuidade e cobertura olham. */
type WallLine = Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>

/** Frações do comprimento amostradas por `wallLineSamples`. */
const WALL_LINE_FRACTIONS = [0, 0.25, 0.5, 0.75, 1]

/** Pontas, quartos e meio da parede: bastam para dizer que ela corre SOBRE um contorno, e não só o cruza. */
function wallLineSamples(wall: Wall): RegionPoint[] {
  return WALL_LINE_FRACTIONS.map((t) => ({ x: wall.x1 + (wall.x2 - wall.x1) * t, y: wall.y1 + (wall.y2 - wall.y1) * t }))
}

/** `other` continua `wall` na mesma reta: encosta numa ponta dela e as duas pontas dele estão na reta dela. */
function continuesInLine(wall: WallLine, other: WallLine): boolean {
  const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
  if (len === 0) return false
  const ends = [
    { x: other.x1, y: other.y1 },
    { x: other.x2, y: other.y2 },
  ]
  const own = [
    { x: wall.x1, y: wall.y1 },
    { x: wall.x2, y: wall.y2 },
  ]
  const touches = ends.some((q) => own.some((p) => Math.hypot(p.x - q.x, p.y - q.y) <= NESTING_TOLERANCE))
  const offLine = (q: RegionPoint): number => Math.abs((wall.x2 - wall.x1) * (q.y - wall.y1) - (wall.y2 - wall.y1) * (q.x - wall.x1)) / len
  return touches && ends.every((q) => offLine(q) <= NESTING_TOLERANCE)
}

/**
 * A parede que o jogador recebe no lugar de um trecho de parede (ou porta) de
 * sala secreta: LISTA DO QUE VAI, montada aqui. Sem porta e com a CARA e o
 * VÍNCULO da parede vizinha na mesma reta — nunca os da parede secreta, cuja
 * espessura ou `regionId` já seriam a pista. O vínculo só vem de parede de
 * sala do jogador (`playerRegionIds`): é a Biblioteca, que ele já recebe, e
 * sem ele o trecho sairia como um pedaço sem sala, do tamanho da porta, no
 * meio da borda dela. Sem vizinha, a aparência padrão e sem vínculo.
 */
function plainWallFor(id: string, from: RegionPoint, to: RegionPoint, look: Wall | undefined, playerRegionIds: ReadonlySet<string>): Wall {
  const plain: Wall = { id, x1: from.x, y1: from.y, x2: to.x, y2: to.y, blocksLight: true, blocksMove: true, door: null }
  if (look?.wallKind !== undefined) plain.wallKind = look.wallKind
  if (look?.thickness !== undefined) plain.thickness = look.thickness
  if (look?.lineStyle !== undefined) plain.lineStyle = look.lineStyle
  if (look?.regionId !== undefined && playerRegionIds.has(look.regionId)) {
    plain.regionId = look.regionId
    if (look.regionEdgeIndex !== undefined) plain.regionEdgeIndex = look.regionEdgeIndex
  }
  return plain
}

/**
 * Porta secreta (`DoorState.secret`) como o jogador a conhece: parede comum
 * que bloqueia luz e passo, sem porta — então sem estado, sem o campo e sem
 * halo nem toque na tela dele. A cara e o vínculo são os do próprio pedaço,
 * que `addDoorOnWall` copiou da parede de onde a porta foi cortada. Outra
 * parede passa pela mesma referência.
 */
function secretDoorAsWall(wall: Wall): Wall {
  if (wall.door?.secret !== true) return wall
  return { ...wall, blocksLight: true, blocksMove: true, door: null }
}

/** Campos de posição e nome da parede; o resto é a cara e o vínculo dela. */
const WALL_GEOMETRY_KEYS: ReadonlySet<string> = new Set(['id', 'x1', 'y1', 'x2', 'y2'])

/** Mesma cara e mesmo vínculo: todo campo fora de id e pontas é igual (inclusive ausente dos dois lados). */
function sameWallLook(a: Wall, b: Wall): boolean {
  const lookA = new Map<string, unknown>(Object.entries(a))
  const lookB = new Map<string, unknown>(Object.entries(b))
  for (const key of new Set([...lookA.keys(), ...lookB.keys()])) {
    if (!WALL_GEOMETRY_KEYS.has(key) && !Object.is(lookA.get(key), lookB.get(key))) return false
  }
  return true
}

/** Alguma ponta de `a` é ponta de `b` (tolerância `NESTING_TOLERANCE`). */
function sharesEnd(a: WallLine, b: WallLine): boolean {
  const aEnds = [
    { x: a.x1, y: a.y1 },
    { x: a.x2, y: a.y2 },
  ]
  const bEnds = [
    { x: b.x1, y: b.y1 },
    { x: b.x2, y: b.y2 },
  ]
  return aEnds.some((p) => bEnds.some((q) => Math.hypot(p.x - q.x, p.y - q.y) <= NESTING_TOLERANCE))
}

/**
 * A porta secreta e as paredes encostadas nela, na mesma reta e com a mesma
 * cara, de ponta em ponta — outra porta secreta no caminho entra junto e a
 * corrente segue por ela.
 */
function seamChain(seam: Wall, walls: readonly Wall[]): Wall[] {
  const chain = [seam]
  // O for...of do Array enxerga o que é empurrado durante a volta: é a busca em largura.
  for (const current of chain) {
    for (const other of walls) {
      if (other.door !== null || chain.includes(other)) continue
      if (sharesEnd(current, other) && onSameLine(seam, other) && sameWallLook(seam, other)) chain.push(other)
    }
  }
  return chain
}

/** Sufixo que o recorte do pincel (`wallRunsWhere`) põe no id de cada trecho. */
const BRUSH_RUN_SUFFIX = /~pincel\d+$/

/**
 * A parede é porta secreta, inteira ou trecho dela recortado pelo pincel de
 * revelar (`<id>~pincel<n>`): o recorte troca o id, mas o trecho continua
 * sendo a porta e tem que sumir na junção como ela.
 */
function isSecretDoorPiece(wall: Wall, seamIds: ReadonlySet<string>): boolean {
  return seamIds.has(wall.id) || seamIds.has(wall.id.replace(BRUSH_RUN_SUFFIX, ''))
}

/**
 * Uma parede só no lugar da corrente, no sentido da porta (que é o da parede de
 * onde `addDoorOnWall` a cortou: a junção devolve a parede original). O id é o
 * da parede comum de onde a reta começa; só porta secreta na corrente, o da
 * primeira.
 */
function joinChain(seam: Wall, chain: readonly Wall[], seamIds: ReadonlySet<string>): Wall {
  const dx = seam.x2 - seam.x1
  const dy = seam.y2 - seam.y1
  const along = (p: RegionPoint): number => (p.x - seam.x1) * dx + (p.y - seam.y1) * dy
  const ends = chain.flatMap((w) => [
    { p: { x: w.x1, y: w.y1 }, w },
    { p: { x: w.x2, y: w.y2 }, w },
  ])
  let start = ends[0] ?? { p: { x: seam.x1, y: seam.y1 }, w: seam }
  let end = start
  for (const e of ends) {
    if (along(e.p) < along(start.p)) start = e
    if (along(e.p) > along(end.p)) end = e
  }
  const plain = ends.filter((e) => !isSecretDoorPiece(e.w, seamIds)).sort((a, b) => along(a.p) - along(b.p))
  const owner = plain[0]?.w ?? seam
  return { ...owner, x1: start.p.x, y1: start.p.y, x2: end.p.x, y2: end.p.y }
}

/**
 * PORTA SECRETA SEM COSTURA NA REDE. `addDoorOnWall` parte a parede em
 * antes/porta/depois; com a porta virada parede (`secretDoorAsWall`) o jogador
 * receberia 3 pedaços na mesma reta, o do meio com o id da porta e o
 * comprimento exato de uma porta — a mesma pista que
 * `disguisedSecretBorderWalls` evita na sala secreta ("as quebras na rede
 * marcam as pontas da porta"). Na tela não aparece (`drawWalls` encadeia os
 * pedaços), mas quem inspeciona o WebSocket acharia a passagem.
 *
 * Roda no pacote FINAL, depois de névoa, zona, pincel, teto e sala secreta: só junta o
 * que de fato sai, então nenhuma regra de esconder é contornada por uma parede
 * mais comprida. Vizinha de outra cara (espessura, tipo, sala) não entra: a
 * quebra ali já existia no mapa do mestre antes de qualquer porta.
 */
function mergeSecretDoorSeams(walls: Wall[], seamIds: ReadonlySet<string>): Wall[] {
  if (seamIds.size === 0 || !walls.some((w) => isSecretDoorPiece(w, seamIds))) return walls
  // Parede da corrente → a junção (na posição da primeira da lista) ou `null` (absorvida).
  const replaced = new Map<Wall, Wall | null>()
  for (const seam of walls) {
    if (!isSecretDoorPiece(seam, seamIds) || replaced.has(seam)) continue
    const chain = seamChain(seam, walls)
    if (chain.length < 2) continue
    const joined = joinChain(seam, chain, seamIds)
    const first = walls.find((w) => chain.includes(w)) ?? seam
    for (const w of chain) replaced.set(w, w === first ? joined : null)
  }
  if (replaced.size === 0) return walls
  return walls.flatMap((w) => {
    const r = replaced.get(w)
    if (r === undefined) return [w]
    return r === null ? [] : [r]
  })
}

/** As duas pontas de `other` estão na reta de `wall` (tolerância `NESTING_TOLERANCE`). */
function onSameLine(wall: WallLine, other: WallLine): boolean {
  const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
  if (len === 0) return false
  const offLine = (x: number, y: number): number => Math.abs((wall.x2 - wall.x1) * (y - wall.y1) - (wall.y2 - wall.y1) * (x - wall.x1)) / len
  return offLine(other.x1, other.y1) <= NESTING_TOLERANCE && offLine(other.x2, other.y2) <= NESTING_TOLERANCE
}

/** Ponta de um trecho: posição ao longo de `wall` (0 = início, 1 = fim) e o ponto exato. */
interface SpanEnd {
  t: number
  p: RegionPoint
}

/**
 * Trechos de `wall` que nenhuma parede de `covers` na mesma reta percorre. As
 * pontas de cada trecho são as pontas EXATAS de `wall` ou das paredes que a
 * cobrem — nada de ponto interpolado, que deixaria um fio de vão por
 * arredondamento.
 */
function uncoveredSpans(wall: Wall, covers: readonly Wall[]): [SpanEnd, SpanEnd][] {
  const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
  if (len === 0) return []
  const tol = NESTING_TOLERANCE / len
  const along = (p: RegionPoint): SpanEnd => ({ t: ((p.x - wall.x1) * (wall.x2 - wall.x1) + (p.y - wall.y1) * (wall.y2 - wall.y1)) / (len * len), p })
  const intervals = covers
    .filter((o) => onSameLine(wall, o))
    .map((o) => {
      const a = along({ x: o.x1, y: o.y1 })
      const b = along({ x: o.x2, y: o.y2 })
      return a.t <= b.t ? [a, b] : [b, a]
    })
    .sort((i, j) => i[0].t - j[0].t)
  const spans: [SpanEnd, SpanEnd][] = []
  let cursor: SpanEnd = { t: 0, p: { x: wall.x1, y: wall.y1 } }
  for (const [start, end] of intervals) {
    if (cursor.t >= 1 - tol) break
    if (start.t > cursor.t + tol) spans.push([cursor, start.t < 1 ? start : { t: 1, p: { x: wall.x2, y: wall.y2 } }])
    if (end.t > cursor.t) cursor = end
  }
  if (cursor.t < 1 - tol) spans.push([cursor, { t: 1, p: { x: wall.x2, y: wall.y2 } }])
  return spans
}

/**
 * SALA SECRETA NA BORDA — parede ou porta de sala secreta que corre SOBRE o
 * contorno de uma sala que o jogador tem (a estante da Biblioteca, porta do
 * Quarto Secreto) é, para o jogador, a parede daquela sala. Tirá-la do recorte
 * (o que se fazia antes) deixava um VÃO: a visão atravessava e desenhava o
 * interior da sala secreta, e a parede chegava com um buraco — exatamente a
 * pista que o oculto promete não dar. Chave: a parede original; valor: as
 * paredes comuns que a substituem (`plainWallFor`) — lista vazia = some.
 *
 * Só sai o trecho que NENHUMA parede fixa não secreta já percorre. No caso
 * comum (cada Sala com a própria parede na aresta comum, `mapFactory`), a
 * Biblioteca já tem a parede leste inteira: a porta e os pedaços do Quarto
 * Secreto somem, porque mandá-los por cima dela seria a pista — o traço
 * sobreposto desenha mais claro (`drawWalls`) e as quebras na rede marcam as
 * pontas da porta. Um trecho descoberto herda a cara e o vínculo da parede que
 * o continua, para ninguém distinguir onde um termina e o outro começa.
 *
 * A borda não depende de Sala: corredor feito com a ferramenta de parede, sem
 * região, tem a mesma estante tapando o mesmo buraco. Fora do contorno de sala
 * do jogador, sai o trecho descoberto que TAPA UM BURACO numa parede reta que
 * o jogador recebe — as DUAS pontas continuam, na mesma reta, uma parede fixa
 * não secreta (`plugsGapInLine`).
 *
 * Trecho que continua a parede do jogador de um lado só (o norte do Quarto
 * Secreto seguindo o norte do corredor) não sai: seria um toco desenhando o
 * contorno da sala. Sala secreta solta no meio de um salão, sem encostar em
 * nada, continua sumindo inteira: não pode virar um bloco de paredes sem porta.
 */
function disguisedSecretBorderWalls(walls: readonly Wall[], secretIds: ReadonlySet<string>, playerRegions: readonly Region[]): Map<Wall, Wall[]> {
  const out = new Map<Wall, Wall[]>()
  if (secretIds.size === 0) return out
  const isSecret = (w: Wall): boolean => w.regionId !== undefined && secretIds.has(w.regionId)
  const playerRegionIds = new Set(playerRegions.map((r) => r.id))
  // Parede que o jogador recebe e que segura a visão sempre: porta não conta
  // (aberta, deixaria a sala secreta à vista pelo vão).
  const fixed = walls.filter((o) => !isSecret(o) && !o.hidden && o.door === null && o.blocksLight)
  // Vizinha da mesma sala do jogador primeiro: é a cara e o vínculo que o trecho tem de ter.
  const looksFirst = [...fixed.filter((o) => o.regionId !== undefined && playerRegionIds.has(o.regionId)), ...fixed.filter((o) => o.regionId === undefined || !playerRegionIds.has(o.regionId))]
  for (const w of walls) {
    if (!isSecret(w)) continue
    const samples = wallLineSamples(w)
    const onPlayerRoomBorder = playerRegions.some((r) => samples.every((p) => pointOnPolygonBorder(p, r.points)))
    const spans = uncoveredSpans(w, fixed).map(([from, to]): WallLine => ({ x1: from.p.x, y1: from.p.y, x2: to.p.x, y2: to.p.y }))
    const kept = onPlayerRoomBorder ? spans : spans.filter((line) => plugsGapInLine(line, fixed))
    if (!onPlayerRoomBorder && kept.length === 0) continue
    out.set(
      w,
      kept.map((line, i) => {
        const look = looksFirst.find((o) => continuesInLine(line, o))
        return plainWallFor(i === 0 ? w.id : `${w.id}-${i}`, { x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 }, look, playerRegionIds)
      }),
    )
  }
  return out
}

/** Cada uma das duas pontas de `line` é ponta de alguma parede de `fixed` na mesma reta: o trecho tapa um buraco nela. */
function plugsGapInLine(line: WallLine, fixed: readonly Wall[]): boolean {
  const inLine = fixed.filter((o) => onSameLine(line, o))
  const isEndOf = (p: RegionPoint, o: WallLine): boolean =>
    Math.hypot(o.x1 - p.x, o.y1 - p.y) <= NESTING_TOLERANCE || Math.hypot(o.x2 - p.x, o.y2 - p.y) <= NESTING_TOLERANCE
  const ends = [
    { x: line.x1, y: line.y1 },
    { x: line.x2, y: line.y2 },
  ]
  return ends.every((p) => inLine.some((o) => isEndOf(p, o)))
}

/** Pontas e meio de cada lance da escada. */
function stairSamples(stair: MapData['stairs'][number]): RegionPoint[] {
  return stair.segments.flatMap((s) => [{ x: s.x1, y: s.y1 }, { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 }, { x: s.x2, y: s.y2 }])
}

/**
 * Amostras da SILHUETA do objeto, o retângulo que a tela do jogador pinta
 * (`pixi/drawPropSilhouettes.ts`): o centro e os quatro cantos girados em
 * volta dele, puxados para dentro como os de um desenho retângulo
 * (`interiorSamples`).
 *
 * Desde que o jogador vê a silhueta, o objeto deixou de ser um ponto: o
 * armário com o centro no corredor e a ponta dentro da sala secreta pintava a
 * ponta no vazio onde a sala não existe para ele. O recuo dos cantos é o que
 * deixa a estante ENCOSTADA por fora na parede dessa sala (a que esconde a
 * passagem) continuar na tela de quem está no cômodo dela: sem ele, o canto em
 * cima da parede oeste cairia DENTRO pelo `pointInRing`.
 *
 * O centro exato entra além do centróide dos cantos: com largura não-finita
 * (arquivo estragado) os cantos viram NaN, e é ele que sobra para decidir.
 */
function propSamplePoints(prop: MapData['props'][number]): RegionPoint[] {
  const center = { x: prop.x, y: prop.y }
  const trig = rotationTrig(prop.rotation ?? 0)
  const hw = prop.width / 2
  const hh = prop.height / 2
  const corners = [
    { x: prop.x - hw, y: prop.y - hh },
    { x: prop.x + hw, y: prop.y - hh },
    { x: prop.x + hw, y: prop.y + hh },
    { x: prop.x - hw, y: prop.y + hh },
  ].map((corner) => rotatePointAround(corner, center, trig))
  return [center, ...interiorSamples(corners)]
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

/** A marca de NPC é organização do mestre: a ficha sai para o jogador sem ela. */
function withoutNpcMark(token: Token): Token {
  if (token.npc === undefined) return token
  const copy = { ...token }
  delete copy.npc
  return copy
}

/**
 * MARCA DE COMPANHEIRO, por id de JOGADOR: nome e cor de sinal de quem está na
 * mesa. Montada pelo host (`net/hostSession.ts`), que é quem conhece os nomes.
 */
export type CompanionMarks = ReadonlyMap<string, TokenCompanion>

/**
 * Por id de ficha, a marca do jogador dono dela — só fichas de OUTROS
 * jogadores. Ficha que o próprio jogador também tem não entra: ela é dele.
 */
function companionsByToken(ownership: Record<string, string[]>, playerId: string, owned: ReadonlySet<string>, marks: CompanionMarks | undefined): Map<string, TokenCompanion> {
  const byToken = new Map<string, TokenCompanion>()
  if (marks === undefined) return byToken
  for (const [ownerId, tokenIds] of Object.entries(ownership)) {
    if (ownerId === playerId) continue
    const mark = marks.get(ownerId)
    if (mark === undefined) continue
    for (const id of tokenIds) {
      if (!owned.has(id) && !byToken.has(id)) byToken.set(id, { name: mark.name, color: mark.color })
    }
  }
  return byToken
}

/** A ficha com a marca que o recorte decidiu, e só ela: `companion` vindo do mapa do mestre nunca passa. */
function withCompanionMark(token: Token, mark: TokenCompanion | undefined): Token {
  if (mark !== undefined) return { ...token, companion: mark }
  if (token.companion === undefined) return token
  const copy = { ...token }
  delete copy.companion
  return copy
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
 * `enteredRooms`: Salas deste mapa em que o jogador JÁ entrou (texto da sala).
 * O texto de entrada dela continua no recorte depois que ele sai, para tocar
 * no rótulo e reler; de Sala onde ele nunca entrou o texto não sai.
 * `oneWayExits`: por pino, as saídas cujo par é a chegada oculta
 * (`oneWayExitsOf`, montado pelo host, que enxerga a outra cena). Ausente =
 * nenhuma passagem sai marcada "Só ida".
 * `companions`: nome e cor de cada jogador da mesa (`CompanionMarks`). A ficha
 * de outro jogador que SAI no recorte leva a marca dele; ausente = nenhuma
 * ficha sai marcada.
 */
export function filterMapForPlayer(
  map: MapData,
  playerId: string,
  ownership: Record<string, string[]>,
  visionRadius: number,
  explored?: Exploration,
  seenDoors?: ReadonlyMap<string, DoorState>,
  pinAudiences?: PinAudiences,
  enteredRooms?: ReadonlySet<string>,
  oneWayExits?: OneWayExits,
  companions?: CompanionMarks,
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
  // Sala do jogador = toda região que não some por ser secreta ou oculta. Não
  // passa por `hiddenLayers`: com a camada Salas escondida a Biblioteca não sai,
  // mas a parede dela continua saindo — e o vão também saía.
  const playerRegions = map.regions.filter((r) => !r.hidden && !r.secret && !secretRoomIds.has(r.id) && isUsablePolygon(r.points))
  /**
   * PORTA SECRETA vira parede comum ANTES de qualquer outra regra: segura a
   * visão da autoridade (nada do outro lado entra no pacote, nem com ela
   * aberta), nunca entra em `visibleDoorIds` (o host recusa o toque) e segue
   * as regras de parede daqui para baixo — inclusive sumir junto com a sala
   * secreta a que pertence, porque o `regionId` fica.
   */
  const secretDoorIds = new Set(map.walls.filter((w) => w.door?.secret === true).map((w) => w.id))
  const withSecretDoorsAsWalls = secretDoorIds.size > 0 ? map.walls.map(secretDoorAsWall) : map.walls
  const disguised = disguisedSecretBorderWalls(withSecretDoorsAsWalls, secretRoomIds, playerRegions)
  /**
   * As paredes como o jogador as conhece: a da sala secreta na borda já
   * trocada pela parede comum. Vale para as DUAS visões (abaixo) e para o
   * pacote: com a estante aberta e a sala ainda secreta, nem a autoridade olha
   * para dentro — senão o que está lá sairia no pacote.
   */
  const knownWalls = disguised.size === 0 ? withSecretDoorsAsWalls : withSecretDoorsAsWalls.flatMap((w) => disguised.get(w) ?? [w])

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
  const authoritySegments = ownTokens.length > 0 ? visionSegments(knownWalls === map.walls ? map : { ...map, walls: knownWalls }) : []
  const authorityVision = ownTokens.map((t) => computeVisibility({ x: t.x, y: t.y }, authoritySegments, visionRadius))
  const rings = boxRings(authorityVision)
  // `knownWalls` (e não `map.walls`): a porta/estante da sala secreta chega ao
  // jogador disfarçada de parede, e a sombra dela precisa sair igual.
  const playerWalls = knownWalls.flatMap((w): Wall[] => {
    if (w.regionId !== undefined && secretRoomIds.has(w.regionId)) return []
    if (isUnderClosedRoof(w)) return []
    if (zones.length === 0 || !wallSamples(w).every(inZoneRing)) return [w]
    return brushed ? wallRunsWhere(w, inBrushReveal) : []
  })
  const wallsChanged = playerWalls.length !== knownWalls.length || playerWalls.some((w, i) => w !== knownWalls[i])
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

  /** Preenchida no recorte das regiões abaixo: só entra Sala que saiu no pacote. */
  const occupiedRooms: string[] = []
  /**
   * A ficha está DENTRO da Sala para o texto de entrada: estritamente dentro
   * (em cima do muro ainda é fora, mesma regra do teto) e num ponto que o
   * jogador pode saber — nem zona oculta, nem sala secreta.
   */
  const isStrictlyInsideReadableRoom = (points: readonly RegionPoint[], p: RegionPoint): boolean =>
    pointInPolygonInclusive(p, points) && !pointOnPolygonBorder(p, points) && !inConcealZone(p) && !inSecretRoom(p)

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

  // Token do próprio jogador sai sempre, mesmo secreto ou em zona oculta: é ele quem o move.
  // Nome: o dono lê o real; os outros, o "Nome para os jogadores" (o de trabalho do mestre não sai).
  // Marca de companheiro DEPOIS do filtro: ficha que não sai não leva o nome do dono a lugar nenhum.
  // Ficha disfarçada pelo mestre (outro nome ou nenhum) também não: a marca diria quem está por trás.
  const companionOf = companionsByToken(ownership, playerId, owned, companions)
  const tokens = layerTokens
    .filter((t) => !t.hidden && (owned.has(t.id) || (!t.secret && !inClosedRoof({ x: t.x, y: t.y }) && isVisible({ x: t.x, y: t.y }))))
    .map((t) => {
      const mark = tokenPublicNameMode(t.publicName) === 'same' ? companionOf.get(t.id) : undefined
      return withCompanionMark(withoutNpcMark(sanitizeTokenPhoto(tokenAsSeenByPlayer(t, owned.has(t.id)))), mark)
    })
  const sentTokenIds = new Set(tokens.map((t) => t.id))
  // Ficha que o MESTRE esconde deste jogador (oculta, secreta ou na camada
  // Fichas escondida). A tocha presa nela fica no centro dela e anda com ela:
  // enviar a luz, mesmo sem o vínculo, entregaria a posição e o trajeto do NPC.
  const layerTokenIds = new Set(layerTokens.map((t) => t.id))
  const masterHiddenTokenIds = new Set(
    map.tokens.filter((t) => !sentTokenIds.has(t.id) && (t.hidden || t.secret || !layerTokenIds.has(t.id))).map((t) => t.id),
  )

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
    tokens,
    markers: map.markers.filter((m) => !inRoomHiddenFromPlayer({ x: m.cx, y: m.cy }) && isPointKnown({ x: m.cx, y: m.cy })),
    lines: map.lines.filter((l) => !l.points.some(inRoomHiddenFromPlayer) && !l.points.some(inConcealZone) && isShapeKnown(l.points, { points: l.points, closed: l.closed })),
    // Tocha acesa dentro do prédio de teto fechado não sai: o halo dela
    // desenharia o interior na tela do jogador que está lá fora.
    // Tocha presa na ficha: o vínculo só vai se a ficha também vai; senão o
    // id de ficha que a névoa, a zona oculta ou o mestre escondem sairia pela rede.
    // Presa numa ficha que o mestre esconde, a luz nem sai (`masterHiddenTokenIds`).
    lights: visibleLights(map.lights, hiddenLayers)
      .filter((l) => !l.hidden && !inClosedRoof({ x: l.x, y: l.y }) && isVisible({ x: l.x, y: l.y }))
      .filter((l) => l.attachedTokenId === undefined || !masterHiddenTokenIds.has(l.attachedTokenId))
      .map((l) => (l.attachedTokenId === undefined || sentTokenIds.has(l.attachedTokenId) ? l : withoutAttachment(l))),
    stairs: visibleStairs(map.stairs, hiddenLayers).filter((s) => {
      const first = s.segments[0]
      if (s.hidden || s.secret || first === undefined || stairSamples(s).some(inRoomHiddenFromPlayer)) return false
      return isPointKnown({ x: (first.x1 + first.x2) / 2, y: (first.y1 + first.y2) / 2 })
    }),
    // A silhueta inteira responde à sala, não só o centro: sala secreta ou teto
    // fechado leva junto o objeto com qualquer amostra dela lá dentro
    // (`propSamplePoints`), como já leva escada, desenho e linha.
    props: visibleProps(map.props, hiddenLayers)
      .filter((p) => !p.hidden && !p.secret && !propSamplePoints(p).some(inRoomHiddenFromPlayer) && isVisible({ x: p.x, y: p.y }))
      .map(propForPlayer),
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
        const inZone = zones.length > 0 && mostly(interiorSamples(r.points, r.points), inConcealZone)
        // Teto fechado esconde o nome junto: o rótulo é desenhado DENTRO do
        // polígono e é anotação do mestre sobre o que tem lá dentro.
        const nameHidden = r.room.nameHiddenFromPlayers || roofClosed || inZone
        const hasTexts = r.room.textoAoEntrar !== undefined || r.room.notaDoMestre !== undefined
        if (!nameHidden && !roofClosed && r.room.roof === undefined && !hasTexts) return r
        // TEXTO DA SALA: a nota do mestre NUNCA sai. O texto de entrada só sai
        // para quem está dentro agora ou já esteve (`enteredRooms`), e nunca de
        // Sala sob teto fechado ou em zona oculta — o texto fala do que tem lá dentro.
        const { textoAoEntrar, notaDoMestre: _nota, ...room } = r.room
        const readable = !roofClosed && !inZone && hasEnterText(r.room)
        const occupied = readable && ownTokens.some((t) => isStrictlyInsideReadableRoom(r.points, { x: t.x, y: t.y }))
        if (occupied) occupiedRooms.push(r.id)
        const showText = readable && textoAoEntrar !== undefined && (occupied || enteredRooms?.has(r.id) === true)
        // `roof` atravessa SÓ quando o teto está fechado PARA ESTE JOGADOR: é o
        // sinal de "pinte a silhueta" (`player/PlayerView.tsx`). Com o teto
        // aberto o campo some e a Sala volta a desenhar como sempre desenhou.
        return {
          ...r,
          room: {
            ...room,
            name: nameHidden ? '' : r.room.name,
            roof: roofClosed ? true : undefined,
            ...(showText ? { textoAoEntrar: clampRoomText(textoAoEntrar) } : {}),
          },
        }
      }),
    // `knownWalls` antes da camada: a estante disfarçada é PAREDE, e segue a
    // camada Paredes (com Portas escondida ela não pode virar vão). A porta
    // secreta que sobra sai emendada nas vizinhas (`mergeSecretDoorSeams`).
    walls: mergeSecretDoorSeams(
      visibleWalls(knownWalls, hiddenLayers).flatMap((w) => {
        if (w.hidden) return []
        if (w.regionId !== undefined && secretRoomIds.has(w.regionId)) return []
        if (isUnderClosedRoof(w)) return []
        if (w.door !== null) return doorWallForPlayer(w, w.door)
        return wallForPlayer(w)
      }),
      secretDoorIds,
    ),
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
      .map((p) => pinForPlayer(p, oneWayExits?.get(p.id))),
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
  return { map: filtered, vision: sentVision, visibleDoorIds, concealed, blocked, roofs, occupiedRooms }
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
 * - `motivo` VAI só com a passagem trancada (`blockReasonOf`): "Desabou" diz
 *   o que a porta é agora, e nada da outra cena.
 * - `semVolta` (pino de uma saída) e `escolhas[].soIda` (encruzilhada) VÃO
 *   só quando o host marcou a saída em `oneWay`: dizem que não há volta por
 *   ali, nunca para onde se vai.
 */
function pinForPlayer(pin: Pin, oneWay?: ReadonlySet<string>): Pin {
  // LISTA DO QUE VAI, e não "copia tudo e apaga o que não pode": campo que o
  // arquivo trouxer e o app não conhece (versão futura, edição à mão) não
  // chega ao jogador por descuido (revisão de segurança, 22/09). `destino`,
  // `rotulo` e `saidas` ficam de fora — o destino de cada saída diria que a
  // outra cena existe. `notaDoMestre` ("só eu leio") fica de fora SEMPRE: o
  // jogador lê `description` e mais nada do texto do pino.
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
  // MOTIVO DO BLOQUEIO: só do pino de viagem trancado, e só um valor da lista.
  // Motivo guardado num pino reaberto é plano do mestre para depois — não sai.
  const motivo = blockReasonOf(pin)
  if (motivo !== null) forPlayer.motivo = motivo
  // ENCRUZILHADA: o jogador recebe `escolhas`, montado AQUI (nunca copiado do
  // mestre): por saída, só o id e o rótulo. Pino de uma saída não ganha o
  // campo: o cartão dele é o de sempre, e o recorte também.
  // SÓ IDA: um booleano por saída, e só com o que o HOST mandou marcar
  // (`oneWay`, de `oneWayExitsOf`). `semVolta` gravado no pino do mestre
  // (arquivo editado à mão) não é lido: o recorte é lista do que vai.
  const soIda = (exitId: string): boolean => oneWay !== undefined && oneWay.has(exitId)
  const escolhas = exitLabelsOf(pin)
  if (escolhas.length > 1) forPlayer.escolhas = escolhas.map((saida) => (soIda(saida.id) ? { ...saida, soIda: true } : saida))
  if (escolhas.length === 1 && soIda(escolhas[0].id)) forPlayer.semVolta = true
  return forPlayer
}

/**
 * MINHAS PISTAS — o que do cartão vai para o caderno do jogador: título, texto
 * e foto. LISTA DO QUE VAI, como `pinForPlayer`: nada de posição (a pista
 * sobrevive a sair da sala, e a posição diria onde o pino está depois que a
 * névoa o esconde), nada de id do pino, de cena ou de destino.
 */
export interface PlayerClueContent {
  title: string
  text: string
  image: string | null
}

/**
 * A pista de um pino. Passa SEMPRE por `pinForPlayer` antes, mesmo que quem
 * chama já tenha o recorte: foto em caminho de disco vira `null` aqui também.
 * Cartão sem texto nem foto não é pista (`null`).
 *
 * Quem chama responde por o jogador PODER ver o pino agora: o host só aceita
 * pino que saiu no último recorte da cena onde o jogador está.
 */
export function pinClueForPlayer(pin: Pin): PlayerClueContent | null {
  const safe = pinForPlayer(pin)
  const text = clampClueText(safe.description.trim())
  if (text === '' && safe.image === null) return null
  return { title: clueTitleFrom(text, CLUE_TITLE_ONLY_IMAGE), text, image: safe.image }
}

/**
 * A pista de um texto de Sala. `title` é o nome da Sala COMO O JOGADOR O VÊ
 * (vazio quando oculto; aí a primeira linha do texto nomeia a pista). A nota
 * do mestre nunca passa por aqui: quem chama lê a Sala do recorte.
 */
export function roomClueForPlayer(title: string, text: string): PlayerClueContent | null {
  const clamped = clampClueText(text.trim())
  if (clamped === '') return null
  return { title: clueTitleFrom(title, clueTitleFrom(clamped, CLUE_TITLE_ONLY_IMAGE)), text: clamped, image: null }
}

/**
 * O objeto (cama, baú, mesa) como o jogador pode recebê-lo: a SILHUETA e mais
 * nada. A tela dele pinta o retângulo chapado no lugar do móvel, com o tamanho
 * e a rotação que o mestre deu (`pixi/drawPropSilhouettes.ts`).
 *
 * LISTA DO QUE VAI, no molde de `pinForPlayer`: a versão anterior copiava o
 * objeto inteiro e só apagava a imagem, e com isso a trava de edição do mestre
 * (`locked`) e qualquer campo que o arquivo trouxesse sem o app conhecer
 * chegavam ao jogador. Ficam de fora:
 * - `src`: caminho no disco do mestre — o jogador não tem a imagem;
 * - `linkedMapPath`: diria que existe outro mapa ligado ao objeto;
 * - `locked`, `hidden`, `secret`: estado de edição do mestre (o que está
 *   oculto nem chega aqui: o filtro acima já tirou).
 * `layer` vai porque a tela do jogador também filtra por camada (`visibleProps`).
 */
function propForPlayer(prop: MapData['props'][number]): MapData['props'][number] {
  const forPlayer: MapData['props'][number] = {
    id: prop.id,
    x: prop.x,
    y: prop.y,
    width: prop.width,
    height: prop.height,
    src: '',
    linkedMapPath: null,
  }
  if (prop.rotation !== undefined) forPlayer.rotation = prop.rotation
  if (prop.layer !== undefined) forPlayer.layer = prop.layer
  return forPlayer
}
