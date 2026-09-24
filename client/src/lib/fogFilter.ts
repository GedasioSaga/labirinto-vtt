import type { DoorState, Drawing, FloorPiece, MapData, Pin, Region, RegionPoint, Token, Wall } from '../types/map'
import { isTokenPhotoData } from './tokenPhoto'
import { isPointExplored, isShapeExplored, type Exploration } from './exploration'
import { pointInRing, signedArea } from './floorContour'
import { pieceBounds, pieceDistance, shapeCenter } from './floorSdf'
import { visibleDrawings, visibleLights, visibleProps, visibleRegions, visibleStairs, visibleTokens, visibleWalls } from './layers'
import { isPlayerSafePinImage } from './pins'
import { CLUE_TITLE_ONLY_IMAGE, clampClueText, clueTitleFrom } from './clues'
import { exitLabelsOf, isArrivalOnly } from './pinTravel'
import { computeVisibility, visionSegments } from './visibility'
import { ancestorsOf, NESTING_TOLERANCE, pointInPolygonInclusive, pointOnPolygonBorder, subtreeIds } from './roomNesting'
import { roomHasRoof, roomIsComodo } from './roomOps'
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
   * TEXTO DA SALA — ids das Salas COM texto de entrada em que uma ficha do
   * jogador está agora, estritamente dentro, e que ele pode ler (a Sala saiu
   * no recorte, fora de teto fechado e de zona oculta, e a ficha não está em
   * zona oculta nem em sala secreta). O chamador compara com as que ele já
   * visitou para mandar o cartão só na primeira entrada. Não sai pela rede.
   */
  occupiedRooms: string[]
  /**
   * CÔMODO LEMBRADO — os cômodos (`RoomMeta.comodo`) que este jogador CONHECE
   * neste recorte: vistos agora (ficha dentro, ou olhando para dentro pela
   * porta), já lembrados (`seenRooms`) ou com o interior já explorado. O
   * chamador guarda os ids para devolvê-los em `seenRooms` e marca o polígono
   * INTEIRO no explorado — é isso que levanta a névoa do cômodo todo, e não só
   * do pedaço que a linha de visão alcançou. Não sai pela rede.
   *
   * `roomsInside`: polígonos das Salas DENTRO do cômodo que a lembrança dele
   * não cobre — prédios de teto (abertos OU fechados) que encostam no cômodo
   * e não o contêm, e Salas sem teto aninhadas nele (o quarto dentro da
   * casa). O chamador os bloqueia ao marcar o cômodo: senão o contorno
   * lembrado cobriria a Sala de dentro, e a memória entregaria o interior dela
   * (o quarto atrás da porta trancada, a casa quando o teto abrisse).
   */
  rememberedRooms: { id: string; points: RegionPoint[]; roomsInside: RegionPoint[][] }[]
  /**
   * Cômodos ainda NÃO vistos que ficam DENTRO de um cômodo lembrado (a
   * despensa no canto da sala). O chamador não marca explorado em célula que
   * toque neles ao marcar os lembrados: sem isso o polígono da sala levantaria
   * a névoa da despensa junto. O vizinho de parede não entra: a marcação só
   * pega célula inteira dentro do lembrado, e bloqueá-lo deixaria escura a
   * faixa colada na parede comum. Não sai pela rede.
   */
  unseenInsideRemembered: RegionPoint[][]
}

/**
 * Quanto a amostra do anel de visão precisa estar DENTRO do cômodo, em px de
 * mundo, para contar como "olhou para dentro". O anel de quem está na sala ao
 * lado encosta na parede comum — em cima da borda do cômodo vizinho, com o
 * erro de arredondamento da intersecção —, e isso não é ver o vizinho.
 */
const SEEN_INSIDE_DEPTH = 2

interface BoxedRoom extends Box {
  id: string
  points: RegionPoint[]
}

function boxRooms(regions: readonly Region[]): BoxedRoom[] {
  return regions.flatMap((r) => {
    const box = boxOf(r.points)
    return box === null ? [] : [{ id: r.id, points: r.points, ...box }]
  })
}

/** Ponto ESTRITAMENTE dentro do cômodo: em cima da parede (com `depth` de folga) ainda é fora. */
function inRoomStrictly(room: BoxedRoom, p: RegionPoint, depth: number = NESTING_TOLERANCE): boolean {
  return (
    p.x >= room.minX &&
    p.x <= room.maxX &&
    p.y >= room.minY &&
    p.y <= room.maxY &&
    pointInPolygonInclusive(p, room.points) &&
    !pointOnPolygonBorder(p, room.points, depth)
  )
}

/** Ponto dentro da Sala OU em cima da parede dela (a folga de `pointInPolygonInclusive`): na dúvida, é da Sala de dentro. */
function inRoomInclusive(room: BoxedRoom, p: RegionPoint): boolean {
  return (
    p.x >= room.minX - NESTING_TOLERANCE &&
    p.x <= room.maxX + NESTING_TOLERANCE &&
    p.y >= room.minY - NESTING_TOLERANCE &&
    p.y <= room.maxY + NESTING_TOLERANCE &&
    pointInPolygonInclusive(p, room.points)
  )
}

/**
 * Algum vértice do anel de visão, ou o meio de alguma aresta dele, cai DENTRO
 * do cômodo. O meio da aresta é o que pega a porta: o cone que entra pela
 * porta pode ter todos os vértices EM CIMA das paredes do corredor (batente e
 * parede do fundo), mas a aresta entre eles atravessa o corredor por dentro.
 */
function ringReachesInto(ring: readonly RegionPoint[], room: BoxedRoom, counts: (p: RegionPoint) => boolean): boolean {
  const n = ring.length
  for (let i = 0; i < n; i += 1) {
    const a = ring[i]
    const b = ring[(i + 1) % n]
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    if (inRoomStrictly(room, a, SEEN_INSIDE_DEPTH) && counts(a)) return true
    if (inRoomStrictly(room, mid, SEEN_INSIDE_DEPTH) && counts(mid)) return true
  }
  return false
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
 * `explored`: memória do jogador ANTES desta visão (quem marca é o chamador).
 * Só a planta estática (regiões, desenhos e textos, escadas, portas, linhas,
 * marcadores) entra por estar explorada; token, prop e luz mudam de lugar e
 * continuam exigindo visão atual, senão a memória viraria espionagem.
 * `seenDoors`: último estado visto de cada porta (somente leitura). Porta
 * explorada fora da visão sai com esse estado, nunca com o atual: senão o
 * jogador longe veria o mestre abrir ou destrancar a porta.
 * `enteredRooms`: Salas deste mapa em que o jogador JÁ entrou (texto da sala).
 * O texto de entrada dela continua no recorte depois que ele sai, para tocar
 * no rótulo e reler; de Sala onde ele nunca entrou o texto não sai.
 * `seenRooms`: CÔMODOS LEMBRADOS (`RoomMeta.comodo`) deste mapa que o jogador
 * já viu — o que o chamador guardou de `rememberedRooms` nos recortes de antes.
 */
export function filterMapForPlayer(
  map: MapData,
  playerId: string,
  ownership: Record<string, string[]>,
  visionRadius: number,
  explored?: Exploration,
  seenDoors?: ReadonlyMap<string, DoorState>,
  enteredRooms?: ReadonlySet<string>,
  seenRooms?: ReadonlySet<string>,
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
   * A ficha está DENTRO da Sala: estritamente dentro (em cima do muro ainda é
   * fora, mesma regra do teto) e num ponto que o jogador pode saber — nem zona
   * oculta, nem sala secreta. Vale para o texto de entrada e para o cômodo.
   */
  const isStrictlyInsideReadableRoom = (points: readonly RegionPoint[], p: RegionPoint): boolean =>
    pointInPolygonInclusive(p, points) && !pointOnPolygonBorder(p, points) && !inConcealZone(p) && !inSecretRoom(p)

  /**
   * CÔMODO LEMBRADO (`RoomMeta.comodo`). Candidato é o cômodo que o jogador
   * PODERIA receber: nem oculto, nem secreto, nem dentro de sala secreta ou de
   * prédio de teto fechado para ele — ali quem manda é o teto, e lembrar do
   * cômodo não pode abrir prédio nenhum. Conhecido é o que ele vê agora (ficha
   * dentro, ou o anel de visão entrando nele pela porta), o que já lembrava
   * (`seenRooms`) e o de interior já explorado ("Revelar planta").
   *
   * Conhecido, o cômodo sai INTEIRO: a Sala e o que é planta lá dentro (pino,
   * marcador, desenho, linha, escada, porta com o estado lembrado). Ficha, luz e
   * objeto continuam exigindo a visão de agora. Não conhecido, NADA de dentro
   * sai — nem a silhueta, que é o que o teto por cômodo entregava.
   */
  const comodoCandidates = visibleRegions(map.regions, hiddenLayers).filter(
    (r) =>
      roomIsComodo(r.room) &&
      !r.hidden &&
      !r.secret &&
      !secretRoomIds.has(r.id) &&
      isUsablePolygon(r.points) &&
      !underRoofIds.has(r.id) &&
      !swallowedByClosedRoof(r),
  )
  const seesInto = (room: BoxedRoom): boolean => {
    if (ownTokens.some((t) => isStrictlyInsideReadableRoom(room.points, { x: t.x, y: t.y }))) return true
    const samples = interiorSamples(room.points, room.points)
    if (samples.some(isVisible)) return true
    if (explored !== undefined && isShapeExplored(explored, outsideZones(samples))) return true
    return authorityVision.some((ring) => ringReachesInto(ring, room, (p) => !inConcealZone(p) && !inSecretRoom(p)))
  }
  const comodoRooms = boxRooms(comodoCandidates)
  /**
   * Zona oculta ativa sobre o interior INTEIRO: a lembrança (`seenRooms`) não
   * vence a zona — mesma régua da Sala comum, que só sai com alguma amostra do
   * interior conhecida FORA da zona. Com a zona revelada, a lembrança volta.
   */
  const hasOpenInterior = (room: BoxedRoom): boolean => outsideZones(interiorSamples(room.points, room.points)).length > 0
  const knownComodos = comodoRooms.filter(
    (room) => hasOpenInterior(room) && (seenRooms?.has(room.id) === true || seesInto(room)),
  )
  const knownComodoIds = new Set(knownComodos.map((room) => room.id))
  const unseenComodos = comodoRooms.filter((room) => !knownComodoIds.has(room.id))
  const unseenComodoIds = new Set(unseenComodos.map((room) => room.id))
  const inUnseenComodo = (p: RegionPoint): boolean => unseenComodos.some((room) => inRoomStrictly(room, p))
  /**
   * A Sala `outer` CONTÉM o cômodo: é MAIOR que ele E cobre a maioria das
   * amostras dele. As duas perguntas, não uma: a Sala de dentro que divide
   * parede com o cômodo e ocupa mais da metade dele (o galpão no canto do
   * pátio, o quarto no fundo da casa) também cobre a maioria das amostras —
   * pela maioria sozinha ela virava "de fora", e a lembrança do cômodo a
   * entregava inteira.
   */
  const containsComodo = (room: BoxedRoom, outer: RegionPoint[], inside: (p: RegionPoint) => boolean): boolean =>
    Math.abs(signedArea(outer)) >= Math.abs(signedArea(room.points)) && mostly(interiorSamples(room.points, room.points), inside)
  /**
   * Prédios de teto — ABERTOS ou fechados — que encostam no cômodo lembrado e
   * NÃO o contêm (a casa no meio do pátio). A lembrança do pátio não vale lá
   * dentro: o teto só esconde enquanto está fechado, e sem esta exclusão a
   * ficha que entra na casa (teto aberto) recebia o interior INTEIRO pelo
   * pátio, inclusive o quarto atrás de porta fechada. O prédio que CONTÉM o
   * cômodo (o quarto lembrado dentro da casa aberta, `containsComodo`) não
   * entra: ali a lembrança é do próprio interior do prédio, e o teto fechado
   * já o apaga.
   */
  const roofsInsideComodo = new Map(
    knownComodos.map((room) => [
      room.id,
      roofBoxes.filter(
        (roof) =>
          roof.maxX >= room.minX &&
          roof.minX <= room.maxX &&
          roof.maxY >= room.minY &&
          roof.minY <= room.maxY &&
          !containsComodo(room, roof.points, (p) => inRoof(roof, p)),
      ),
    ]),
  )
  /**
   * Salas SEM teto que moram dentro do cômodo lembrado (o quarto, Sala comum,
   * dentro da casa-cômodo — o padrão Casa > Quarto da vila). Cada Sala segue a
   * PRÓPRIA regra: a comum sai quando o interior dela é visto ou explorado, o
   * cômodo quando é conhecido. A lembrança do cômodo de fora não vale lá
   * dentro — sem esta exclusão, entrar na sala da frente entregava o quarto de
   * porta trancada inteiro, com os pinos, e a grade do explorado dele.
   * Dentro é "alguma amostra do interior estritamente no cômodo"; a Sala que
   * CONTÉM o cômodo (a casa comum em volta dele, `containsComodo`) não entra.
   */
  const plainRooms = boxRooms(map.regions.filter((r) => r.room !== undefined && !roomHasRoof(r.room) && isUsablePolygon(r.points)))
  const roomsInsideComodo = new Map(
    knownComodos.map((room) => [
      room.id,
      plainRooms.filter(
        (inner) =>
          inner.id !== room.id &&
          interiorSamples(inner.points, inner.points).some((p) => inRoomStrictly(room, p)) &&
          !containsComodo(room, inner.points, (p) => inRoomInclusive(inner, p)),
      ),
    ]),
  )
  const inNestedRoomOfComodo = (room: BoxedRoom, p: RegionPoint): boolean =>
    (roofsInsideComodo.get(room.id) ?? []).some((roof) => inRoof(roof, p)) ||
    (roomsInsideComodo.get(room.id) ?? []).some((inner) => inRoomInclusive(inner, p))
  /**
   * Planta dentro de cômodo lembrado: conhecida — fora de zona oculta, fora
   * de cômodo ainda não visto DENTRO dele (a despensa no canto da sala), fora
   * de prédio de teto dentro dele (`roofsInsideComodo`) e fora de Sala sem
   * teto dentro dele (`roomsInsideComodo`).
   */
  const inKnownComodo = (p: RegionPoint): boolean =>
    !inConcealZone(p) && !inUnseenComodo(p) && knownComodos.some((room) => inRoomStrictly(room, p) && !inNestedRoomOfComodo(room, p))
  /** Ponto que o jogador não recebe por causa da SALA: secreta, de teto fechado ou cômodo ainda não visto. */
  const inHiddenPlace = (p: RegionPoint): boolean => inRoomHiddenFromPlayer(p) || inUnseenComodo(p)

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

  // Planta estática: visível agora, já explorada ou dentro de cômodo lembrado. Nunca usar para entidade dinâmica.
  const isPointKnown = (point: RegionPoint): boolean => isVisible(point) || isPointExploredOpen(point) || inKnownComodo(point)
  const isShapeKnown = (points: readonly RegionPoint[]): boolean =>
    isShapeVisible(points) || (explored !== undefined && isShapeExplored(explored, outsideZones(points))) || points.some(inKnownComodo)

  const visibleDoorIds: string[] = []
  /** Porta dentro da visão sai com o estado real; explorada fora dela, com o lembrado; senão não sai. */
  const doorWallForPlayer = (w: Wall, door: DoorState): Wall[] => {
    // Porta com o meio escondido não sai nem pelas amostras dos lados.
    if (inConcealZone(wallMidpoint(w))) return []
    if (doorSamples(w, DOOR_VISION_PROBE).some(isVisible)) {
      visibleDoorIds.push(w.id)
      return [w]
    }
    // Porta de cômodo lembrado sai mesmo sem célula explorada ao lado (o
    // cômodo acabou de ser visto): com o estado LEMBRADO, nunca o atual.
    // A lembrança do cômodo não vence sala secreta nem teto fechado lá dentro
    // (`inHiddenPlace`): porta solta, sem `regionId`, com o meio na sala
    // escondida é dela — a amostra do lado que cai no cômodo não a leva junto.
    const probe = (explored?.cell ?? map.grid) * DOOR_EXPLORED_PROBE_CELLS
    const remembered = !inHiddenPlace(wallMidpoint(w))
    const known = (p: RegionPoint): boolean => isPointExploredOpen(p) || (remembered && !inHiddenPlace(p) && inKnownComodo(p))
    if (!doorSamples(w, probe).some(known)) return []
    return [{ ...w, door: seenDoors?.get(w.id) ?? unseenDoor(door) }]
  }

  /** Preenchida no recorte das regiões abaixo: só entra Sala que saiu no pacote. */
  const occupiedRooms: string[] = []

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
    markers: map.markers.filter((m) => !inHiddenPlace({ x: m.cx, y: m.cy }) && isPointKnown({ x: m.cx, y: m.cy })),
    lines: map.lines.filter((l) => !l.points.some(inHiddenPlace) && !l.points.some(inConcealZone) && isShapeKnown(l.points)),
    // Tocha acesa dentro do prédio de teto fechado não sai: o halo dela
    // desenharia o interior na tela do jogador que está lá fora.
    lights: visibleLights(map.lights, hiddenLayers).filter(
      (l) => !l.hidden && !inClosedRoof({ x: l.x, y: l.y }) && isVisible({ x: l.x, y: l.y }),
    ),
    stairs: visibleStairs(map.stairs, hiddenLayers).filter((s) => {
      const first = s.segments[0]
      if (s.hidden || s.secret || first === undefined || stairSamples(s).some(inHiddenPlace)) return false
      return isPointKnown({ x: (first.x1 + first.x2) / 2, y: (first.y1 + first.y2) / 2 })
    }),
    // A silhueta inteira responde à sala, não só o centro: sala secreta ou teto
    // fechado leva junto o objeto com qualquer amostra dela lá dentro
    // (`propSamplePoints`), como já leva escada, desenho e linha.
    props: visibleProps(map.props, hiddenLayers)
      .filter((p) => !p.hidden && !p.secret && !propSamplePoints(p).some(inHiddenPlace) && isVisible({ x: p.x, y: p.y }))
      .map(propForPlayer),
    drawings: visibleDrawings(map.drawings, hiddenLayers).filter((d) => {
      if (d.secret) return false
      const samples = drawingSamplePoints(d)
      if (samples.some(inHiddenPlace)) return false
      // Traço com uma ponta na zona desenharia o que ela esconde.
      if (isStrokeDrawing(d) && samples.some(inConcealZone)) return false
      return isShapeKnown(samples)
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
        if (closedRoofIds.has(r.id)) return isShapeKnown(contourSamples(r.points))
        // Cômodo: o não visto nem aparece; o lembrado sai inteiro, visto ou não agora.
        if (unseenComodoIds.has(r.id)) return false
        if (knownComodoIds.has(r.id)) return true
        return isShapeKnown(interiorSamples(r.points, r.points))
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
        if (!nameHidden && !roofClosed && r.room.roof === undefined && r.room.comodo === undefined && !hasTexts) return r
        // TEXTO DA SALA: a nota do mestre NUNCA sai. O texto de entrada só sai
        // para quem está dentro agora ou já esteve (`enteredRooms`), e nunca de
        // Sala sob teto fechado ou em zona oculta — o texto fala do que tem lá dentro.
        // `comodo` é configuração do mestre: a tela do jogador não precisa dele.
        const { textoAoEntrar, notaDoMestre: _nota, comodo: _comodo, ...room } = r.room
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
    walls: visibleWalls(map.walls, hiddenLayers).flatMap((w) => {
      if (w.hidden) return []
      if (w.regionId !== undefined && secretRoomIds.has(w.regionId)) return []
      if (isUnderClosedRoof(w)) return []
      if (w.door !== null) return doorWallForPlayer(w, w.door)
      return wallSamples(w).some(inConcealZone) ? [] : [w]
    }),
    floor: map.floor.filter((f) => !f.hidden && !hiddenFloorIds.has(f.id)),
    // Pino de ponto de interesse: anotação estática, então vale o explorado
    // (mesma regra de linha/marcador). `image` só atravessa em data URL — se
    // um dia alguém guardar caminho de disco no campo, o jogador recebe
    // `null` em vez do computador do mestre (`isPlayerSafePinImage`).
    // CHEGADA OCULTA (mão única) sai ANTES de qualquer outra regra: não é
    // questão de névoa nem de explorado — o jogador nunca recebe o pino, nem o
    // id dele, estando ou não em cima dele. Ver `isArrivalOnly`.
    pins: (map.pins ?? [])
      .filter((p) => {
        if (isArrivalOnly(p)) return false
        if (p.hidden || p.secret || hiddenLayers.includes('anotacoes')) return false
        const point = { x: p.x, y: p.y }
        return !inHiddenPlace(point) && isPointKnown(point)
      })
      .map(pinForPlayer),
    // Metadado do mestre: nome e estado das zonas não saem; só `concealed` (geometria).
    concealZones: [],
  }
  const rememberedRooms = knownComodos.map((room) => ({
    id: room.id,
    points: room.points,
    roomsInside: [
      ...(roofsInsideComodo.get(room.id) ?? []).map((roof) => roof.points),
      ...(roomsInsideComodo.get(room.id) ?? []).map((inner) => inner.points),
    ],
  }))
  const unseenInsideRemembered = unseenComodos
    .filter((unseen) => interiorSamples(unseen.points, unseen.points).some((p) => knownComodos.some((room) => inRoomStrictly(room, p))))
    .map((room) => room.points)
  return { map: filtered, vision, visibleDoorIds, concealed, blocked, roofs, occupiedRooms, rememberedRooms, unseenInsideRemembered }
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
