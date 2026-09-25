import type { ConcealZone, DoorState, Drawing, FloorPiece, HazardKind, LayerId, Light, MapData, MapLine, MapMarker, Pin, Region, RegionPoint, Stair, Token, TokenCompanion, Wall, WatchAlert } from '../types/map'
import { cellCenter, cellKeyAt, cellRunRects, concealedPieces, REVEAL_BRUSH_CELL, unveiledCellsOf } from './concealBrush'
import { isTokenPhotoData } from './tokenPhoto'
import { tokenAsSeenByPlayer, tokenPublicNameMode } from './tokenPublicName'
import { healthForPlayer } from './tokenHealth'
import { tokenConditionsForPlayer } from './tokenConditions'
import { withoutCarrier } from './carry'
import { guardAlerts, tokenWatchForPlayer, tokenWatchOf } from './npcWatch'
import { tokenPatrolForPlayer } from './npcPatrol'
import type { TurnRef } from './initiative'
import { isPointExplored, isShapeExplored, type Exploration } from './exploration'
import { pointInRing, signedArea } from './floorContour'
import { pieceBounds, pieceDistance, shapeCenter } from './floorSdf'
import { drawingLayer, regionLayer, stairLayer, visibleDrawings, visibleLights, visibleProps, visibleRegions, visibleStairs, visibleTokens, visibleWalls, wallLayer } from './layers'
import { blockReasonOf, isPinIcon, isPinReadDistance, isPlayerSafePinImage, passageOf } from './pins'
import { CLUE_TITLE_ONLY_IMAGE, clampClueText, clueTitleFrom } from './clues'
import { propPlayerImage, propPlayerLabel } from './propPlayerLook'
import { exitLabelsOf, isArrivalOnly, travelExitsOf, unreadExitLabels, type OneWayExits } from './pinTravel'
import { publicLockOf } from './pinLock'
import { withoutAttachment } from './lightAttachment'
import { marcaParaJogador } from './marcas'
import { itemOfPin, tokenReachesPin } from './items'
import { keyForPin } from './doorKey'
import { computeVisibility, hasLineOfSight, visionSegments, wallLetsSightThrough, type Segment } from './visibility'
import { isDoorPassable } from './collision'
import { DOOR_REACH_CELLS, distanceToWall, tokenRadiusOf, tokenReachesDoor } from './doorReach'
import { darkVision, type Darkness } from './darkness'
import { ancestorsOf, NESTING_TOLERANCE, pointInPolygonInclusive, pointOnPolygonBorder, subtreeIds } from './roomNesting'
import { roomHasRoof, roomIsComodo } from './roomOps'
import { rotatePointAround, rotationTrig } from './roomRotation'
import { clampRoomText, hasEnterText } from './roomText'
import { hazardRooms, hazardsOf, visionRadiusAt, type PlayerHazard } from './hazards'
import { cleanPublicSceneName } from './adventure'
import type { DiceRollEntry, HostDiceRoll } from './dice'
import { caravanMembers, caravanPoint, caravanTokenFor, isWorldMap } from './caravan'
import { triggersWithRegions, type PlayerAreaTrigger } from './areaTriggers'
import { isDarkAt, periodOfHour, type PlayerClock } from './campaignClock'
import { noiseDirection, type NoiseDirection } from './noise'
import { setaDoAbalo, type AbaloSeta } from './abalo'

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

/**
 * Raio de visão do jogador: um número vale para todas as fichas dele; a
 * função dá o raio de CADA ficha (a emprestada enxerga com o raio do dono,
 * não com o de quem a joga).
 */
export type VisionRadius = number | ((tokenId: string) => number)

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
   * ZONA DE PERIGO — só o que este jogador ENXERGA agora: tipo e polígono de
   * cada sala tomada que está na visão dele. Perigo é coisa que se move, então
   * vale a regra das entidades dinâmicas (visão atual, nunca o explorado).
   * Nunca o id da zona nem o da sala; `map.hazards` do recorte não existe.
   */
  hazards: PlayerHazard[]
  /**
   * ZONA DE PERIGO — perigos das salas onde está uma ficha deste recorte, se
   * o mestre não esconde a sala (secreta, zona oculta, teto). Visível ou não.
   * NÃO sai pela rede: é o que o host consulta para mandar "Você entrou no
   * fogo" sem contar o tipo de um perigo escondido.
   */
  hazardsHere: { tokenId: string; kind: HazardKind }[]
  /**
   * GATILHO DE ÁREA — só o que o mestre REVELOU, e só na área que o jogador
   * já conhece (a região saiu neste recorte): tipo e polígono. Anotação
   * estática, então vale o explorado, como a própria região. Nunca o id do
   * gatilho nem o da região; `map.gatilhos` do recorte não existe.
   */
  gatilhos: PlayerAreaTrigger[]
  /**
   * TEXTO DA SALA — ids das Salas COM texto de entrada em que uma ficha do
   * jogador está agora, estritamente dentro, e que ele pode ler (a Sala saiu
   * no recorte, fora de teto fechado e de zona oculta, e a ficha não está em
   * zona oculta nem em sala secreta). O chamador compara com as que ele já
   * visitou para mandar o cartão só na primeira entrada. Não sai pela rede.
   */
  occupiedRooms: string[]
  /**
   * DENTRO DA SALA SECRETA — ids das salas secretas que uma ficha do jogador
   * ocupa agora, estritamente dentro, e que por isso abriram para ELE. O
   * chamador as guarda como descobertas por este jogador e as devolve em
   * `discoveredSecretRooms`: a sala continua no mapa lembrado dele depois que
   * ele sai. Não sai pela rede.
   */
  occupiedSecretRooms: string[]
  /**
   * VER PELA PORTA ABERTA — a espiada deste jogador, ou `null` quando ninguém
   * dele está no vão de uma porta aberta de prédio de teto fechado. Sai pela
   * rede (`snapshot.peek`): a tela recorta o telhado desses prédios pela visão
   * de quem espia. Não traz nada novo — as ids são de prédios que já saíram em
   * `map.regions`, e a visão é a mesma que já vai em `vision`.
   */
  peek: RoofPeek | null
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
  /**
   * CONE PELO VÃO — retângulos de célula que o cone abre no chão do prédio de
   * teto fechado (janela, grade, "Espiar"), para o chamador desenhar como
   * vista sem virar memória: `forgetInside` apaga o que fica dentro do
   * prédio depois de marcar. Vazio sem prédio de teto fechado nem cone.
   */
  glimpses: RegionPoint[][]
  /**
   * A memória da planta DEPOIS deste recorte: o que está na visão agora entra
   * (versão atual), o que o jogador viu mudar ou sumir sai, o que o mestre
   * esconde item a item (oculto, secreto) sai; camada escondida fica guardada,
   * sem sair. O chamador guarda para o próximo recorte. Sem `remembered` na
   * entrada, volta só com o que está à vista agora.
   */
  plan: PlanMemory
}

/**
 * VER PELA PORTA ABERTA DE PRÉDIO FECHADO. O teto continua fechado; só o cone
 * que passa pela porta aberta, visto por quem está no vão, fica à vista.
 */
export interface RoofPeek {
  /** Prédios de teto fechado espiados agora, todos presentes em `map.regions`. */
  roofIds: string[]
  /** A visão enviada de cada ficha que está no vão: é o recorte do telhado. */
  vision: RegionPoint[][]
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
    ...playerHiddenRings(map),
    ...roofRoomsOf(map.regions).filter((r) => isUsablePolygon(r.points)).map((r) => r.points),
  ]
}

/**
 * O que a memória de um jogador não pode guardar, seja quem for: zonas ocultas
 * ativas e salas secretas — o mesmo `blocked` de `filterMapForPlayer`. O teto
 * fica de fora de propósito: ele é por jogador (abre para quem está dentro) e
 * quem o apaga da memória é o próprio snapshot (`roofs`).
 *
 * É o que a mesa retomada apaga da memória guardada antes de usá-la: o mestre
 * pode ter escondido, entre um dia e outro, algo que o jogador já tinha visto.
 */
export function memoryBlockedRings(map: MapData): RegionPoint[][] {
  return [...activeConcealRings(map), ...secretRoomsOf(map).map((r) => r.points)]
}

/**
 * Áreas que o mestre ESCONDE do jogador: zonas ocultas ativas e salas
 * secretas. Sem o teto de propósito: sala com teto é lugar onde a ficha pode
 * entrar andando (é entrando que o teto abre), e quem decide para onde a ficha
 * vai (`lib/moveValidation.ts`) precisa tratá-la como o movimento normal trata.
 */
export function playerHiddenRings(map: MapData): RegionPoint[][] {
  return [...activeConcealRings(map), ...secretRoomsOf(map).map((r) => r.points)]
}

/**
 * MAPA DE PAPEL — as Salas que o mestre pode gravar na memória de um jogador.
 * Fica de fora tudo o que o recorte nunca entrega: Sala secreta ou oculta (e o
 * que está dentro dela, mesma regra de `filterMapForPlayer`), Sala com teto e o
 * que está sob ele (o interior do prédio só abre andando para dentro) e
 * polígono que não dá para julgar. Região comum não é Sala: não entra.
 */
export function giftableRoomsOf(map: MapData): Region[] {
  const barred = new Set(
    map.regions.filter((r) => r.secret || r.hidden || roomHasRoof(r.room)).flatMap((r) => [...subtreeIds(map.regions, r.id)]),
  )
  return map.regions.filter((r) => r.room !== undefined && !barred.has(r.id) && isUsablePolygon(r.points))
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

/** Cone pelo vão de UMA ficha do jogador num prédio de teto fechado (`PlayerMapView.glimpses`). */
interface Glimpse {
  roof: ClosedRoof
  /** Olhar da ficha pela conta do jogador, com a mobília DESTE prédio no caminho. */
  sight: BoxedRing[]
  /** Olhar da mesma ficha pela conta da autoridade: o cone nunca passa dele. */
  authority: BoxedRing[]
  /** Onde procurar as células do cone: caixa do prédio ∩ caixa do olhar. */
  box: Box
}

/** Folga, em px de mundo, para a janela desenhada à mão contar como da BORDA do prédio. */
const OPENING_BORDER_TOLERANCE = 2
/** Teto de células por cone: prédio absurdo (ou coordenada torta) não trava o host — erra para o lado de esconder. */
const MAX_GLIMPSE_CELLS = 250_000

interface GlimpseInput {
  map: MapData
  roofs: readonly ClosedRoof[]
  /** As paredes como o jogador as conhece (porta secreta já virou parede). */
  walls: readonly Wall[]
  tokens: readonly Token[]
  /**
   * Olhar da ficha de índice `index` (o de `tokens`) pela conta da autoridade,
   * no escuro DESTE prédio: o cone nunca passa dele.
   */
  authorityFor: (roof: ClosedRoof, token: Token, index: number) => RegionPoint[][]
  /** Olhar da ficha pela conta do jogador (`segments`), no mesmo escuro de `authorityFor`. */
  sightFor: (roof: ClosedRoof, token: Token, segments: Segment[]) => RegionPoint[][]
  peekDoorIds: ReadonlySet<string> | undefined
  /** Obstáculos do olhar de quem está do lado de fora deste prédio. */
  segmentsFor: (roof: ClosedRoof) => Segment[]
}

/**
 * JANELA, PORTA ABERTA, GRADE E ESPIAR em prédio de teto fechado. Vão é uma
 * parede da BORDA do prédio que a visão atravessa (`wallLetsSightThrough`); a
 * ficha está JUNTO dele na mesma distância de alcançar uma porta
 * (`DOOR_REACH_CELLS` além da borda da ficha). Só essa ficha ganha cone — de
 * longe, o prédio é telhado, mesmo com a janela à vista. Sem grade válida no
 * mapa, nenhum cone: na dúvida, o teto fica fechado.
 */
function glimpsesThroughOpenings(input: GlimpseInput): Glimpse[] {
  const { map, roofs, walls, tokens } = input
  const grid = map.grid
  if (tokens.length === 0 || roofs.length === 0 || !Number.isFinite(grid) || grid <= 0) return []
  const out: Glimpse[] = []
  for (const roof of roofs) {
    if (roof.broken) continue
    const openings = walls.filter(
      (w) => wallLetsSightThrough(w, input.peekDoorIds) && wallLineSamples(w).every((p) => pointOnPolygonBorder(p, roof.points, OPENING_BORDER_TOLERANCE)),
    )
    if (openings.length === 0) continue
    let segments: Segment[] | null = null
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i]
      const reach = tokenRadiusOf(token, grid) + grid * DOOR_REACH_CELLS
      if (!openings.some((w) => distanceToWall(token, w) <= reach)) continue
      if (segments === null) segments = input.segmentsFor(roof)
      const sight = boxRings(input.sightFor(roof, token, segments))
      const authority = boxRings(input.authorityFor(roof, token, i))
      if (sight.length === 0 || authority.length === 0) continue
      // No escuro o olhar são vários anéis: a caixa de busca cobre todos.
      const box = {
        minX: Math.max(roof.minX, Math.min(...sight.map((b) => b.minX))),
        minY: Math.max(roof.minY, Math.min(...sight.map((b) => b.minY))),
        maxX: Math.min(roof.maxX, Math.max(...sight.map((b) => b.maxX))),
        maxY: Math.min(roof.maxY, Math.max(...sight.map((b) => b.maxY))),
      }
      if (box.minX > box.maxX || box.minY > box.maxY) continue
      out.push({ roof, sight, authority, box })
    }
  }
  return out
}

/** Células do pincel (`REVEAL_BRUSH_CELL`) nas caixas cujo CENTRO passa em `test`. Caixa grande demais não entra. */
function cellsWhere(boxes: readonly Box[], test: (point: RegionPoint) => boolean): string[] {
  const keys = new Set<string>()
  for (const box of boxes) {
    const col0 = Math.floor(box.minX / REVEAL_BRUSH_CELL)
    const col1 = Math.floor(box.maxX / REVEAL_BRUSH_CELL)
    const row0 = Math.floor(box.minY / REVEAL_BRUSH_CELL)
    const row1 = Math.floor(box.maxY / REVEAL_BRUSH_CELL)
    const count = (col1 - col0 + 1) * (row1 - row0 + 1)
    if (!Number.isFinite(count) || count > MAX_GLIMPSE_CELLS) continue
    for (let col = col0; col <= col1; col += 1) {
      for (let row = row0; row <= row1; row += 1) {
        const center = { x: (col + 0.5) * REVEAL_BRUSH_CELL, y: (row + 0.5) * REVEAL_BRUSH_CELL }
        if (test(center)) keys.add(`${col},${row}`)
      }
    }
  }
  return [...keys]
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
/** Distância, em px de mundo, em que um vértice do anel de quem espia conta como raio parado NA parede. */
const PEEK_WALL_HIT = 1
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
  // `janela` fora: pedaço de porta cortado de uma janela herdou o campo, e
  // parede sem porta com `janela` deixaria a visão atravessar a porta secreta.
  const { janela: _janela, ...plain } = wall
  return { ...plain, blocksLight: true, blocksMove: true, door: null }
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
  const plain = ends.filter((e) => !seamIds.has(e.w.id)).sort((a, b) => along(a.p) - along(b.p))
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
 * Roda em `knownWalls`, ANTES de qualquer recorte e antes das duas visões:
 * daí para baixo a parede emendada é tratada exatamente como a parede lisa
 * seria. Rodando só no pacote final (como antes), sobravam três pistas:
 * - a visão (`vision`, que também vai pela rede) era calculada com os três
 *   pedaços, e o polígono ganhava vértices nas pontas exatas da porta;
 * - o pincel (`wallRunsWhere`) amostra cada parede a partir da ponta dela, e
 *   a borda do trecho pintado caía em posições medidas a partir da porta;
 * - pintado só sobre a porta, o pedaço dela saía sozinho, com o id dela.
 * Vizinha de outra cara (espessura, tipo, sala) não entra: a quebra ali já
 * existia no mapa do mestre antes de qualquer porta.
 */
function mergeSecretDoorSeams(walls: Wall[], seamIds: ReadonlySet<string>): Wall[] {
  if (seamIds.size === 0 || !walls.some((w) => seamIds.has(w.id))) return walls
  // Parede da corrente → a junção (na posição da primeira da lista) ou `null` (absorvida).
  const replaced = new Map<Wall, Wall | null>()
  for (const seam of walls) {
    if (!seamIds.has(seam.id) || replaced.has(seam)) continue
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
  // Janela também não: a visão a atravessa, e a sala secreta apareceria por ela.
  const fixed = walls.filter((o) => !isSecret(o) && !o.hidden && o.door === null && o.blocksLight && o.janela !== true)
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

/**
 * Chão sem as peças escondidas, cacheado pelo array imutável `map.floor`: o
 * contorno do chão (visão) é cacheado pela referência. Mais de uma chave por
 * chão: a visão do jogador, o cone de cada prédio e o segundo recorte de quem
 * espia pela porta aberta (com o chão do prédio espiado) pedem recortes
 * diferentes no mesmo snapshot — com uma chave só um apagava o outro
 * (contorno refeito a cada passo).
 */
const playerFloorCache = new WeakMap<FloorPiece[], Map<string, FloorPiece[]>>()
/** Recortes guardados por chão; passou disso, descarta o mais antigo (chão novo a cada edição, então é raro). */
const MAX_FLOOR_CUTS = 8

function floorWithout(floor: FloorPiece[], hiddenIds: ReadonlySet<string>): FloorPiece[] {
  if (hiddenIds.size === 0) return floor
  const key = [...hiddenIds].sort().join('|')
  let cuts = playerFloorCache.get(floor)
  const cached = cuts?.get(key)
  if (cached !== undefined) return cached
  const out = floor.filter((f) => !hiddenIds.has(f.id))
  if (cuts === undefined) {
    cuts = new Map()
    playerFloorCache.set(floor, cuts)
  }
  if (cuts.size >= MAX_FLOOR_CUTS) {
    const oldest = cuts.keys().next()
    if (oldest.done !== true) cuts.delete(oldest.value)
  }
  cuts.set(key, out)
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

/**
 * Pontos ao longo da parede a cada `BRUSH_WALL_STEP`, pontas inclusas — a
 * mesma malha de `wallRunsWhere`. `null` = coordenada não-finita ou parede
 * enorme: quem pergunta escolhe o lado de esconder.
 */
function wallStepSamples(wall: Wall): RegionPoint[] | null {
  const steps = Math.ceil(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) / BRUSH_WALL_STEP)
  if (!Number.isFinite(steps) || steps > BRUSH_WALL_MAX_STEPS) return null
  const n = Math.max(1, steps)
  return Array.from({ length: n + 1 }, (_, i) => ({ x: wall.x1 + ((wall.x2 - wall.x1) * i) / n, y: wall.y1 + ((wall.y2 - wall.y1) * i) / n }))
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
 * VULTO NO ESCURO: além desta fração do raio de visão de quem olha, a ficha de
 * outro jogador fora de toda luz chega sem rótulo. Metade do raio: perto o
 * bastante para ler o rosto, longe o bastante para o rótulo não entregar o
 * disfarce do outro lado da sala (a 700 px, na rodada 10).
 */
const SHADOW_DISTANCE_FRACTION = 0.5

/**
 * Quais fichas este jogador recebe como VULTO: as de OUTRO jogador (NPC não
 * muda; a própria nunca) mais longe que `SHADOW_DISTANCE_FRACTION` do raio de
 * TODA ficha dele e fora do raio de toda luz que ele recebe.
 * `otherPlayerTokenIds` já vem sem as fichas dele; `radiusOf` é o raio de
 * cada ficha dele (RAIO POR FICHA, ver `filterMapForGroup`).
 */
function shadowOfOtherPlayer(
  otherPlayerTokenIds: ReadonlySet<string>,
  ownTokens: readonly Token[],
  lights: readonly Light[],
  radiusOf: (token: Token) => number,
): (token: Token) => boolean {
  return (token) => {
    if (!otherPlayerTokenIds.has(token.id)) return false
    if (ownTokens.some((own) => Math.hypot(own.x - token.x, own.y - token.y) <= radiusOf(own) * SHADOW_DISTANCE_FRACTION)) return false
    return !lights.some((l) => Math.hypot(l.x - token.x, l.y - token.y) <= l.radius)
  }
}

/** O vulto: a peça no lugar, sem nome, sem cor (cinza da mesa) e sem foto. */
function asShadow(token: Token): Token {
  return { ...token, name: '', color: null, image: null, imageData: null }
}

/**
 * "QUEM VÊ" de cada pino, por id: os jogadores escolhidos pelo mestre. Pino
 * AUSENTE do mapa = "Todos" (o pino de sempre); presente com o conjunto vazio =
 * "Só estes" sem ninguém marcado, e ninguém recebe. A lista vive na sessão do
 * host (`net/hostSession.ts`), não no arquivo do mapa: id de jogador só existe
 * enquanto a sala está aberta.
 */
export type PinAudiences = ReadonlyMap<string, ReadonlySet<string>>

/**
 * O pino chega a este jogador pela lista de quem vê? Sem lista, sim. Sem
 * jogador (a tela da mesa, vista por todos), só o pino sem lista chega.
 */
function pinReachesPlayer(audiences: PinAudiences | undefined, pinId: string, playerId: string | undefined): boolean {
  const chosen = audiences?.get(pinId)
  return chosen === undefined || (playerId !== undefined && chosen.has(playerId))
}

/**
 * Barra de vida como o jogador pode recebê-la (`healthForPlayer`): a que o
 * mestre deixou só para si SOME do token — o campo inteiro, não só os
 * números —, e a que os jogadores veem vai como proporção. Vale também para o
 * token do próprio jogador: quem decide a barra é o mestre, ficha por ficha.
 */
function tokenHealthForPlayer(token: Token): Token {
  if (token.health === undefined) return token
  const health = healthForPlayer(token.health)
  const copy: Token = { ...token }
  if (health === null) delete copy.health
  else copy.health = health
  return copy
}

/**
 * A ficha como o jogador pode recebê-la: a foto só auto-contida
 * (`sanitizeTokenPhoto`) e a CONDIÇÃO só com os ids da lista
 * (`tokenConditionsForPlayer`) — texto que o mestre ou o arquivo enfiar no
 * campo não sai da máquina dele. Quem decide SE a ficha vai é o filtro de
 * `filterMapForPlayer`; a condição só atravessa junto com ela.
 *
 * LEVAR FICHA JUNTO: o vínculo (`levadoPor`) nunca sai. É arrumação do mestre,
 * e o id de quem leva apontaria para uma ficha que o recorte pode ter
 * escondido (colega na névoa, ficha secreta).
 */
function tokenForPlayer(token: Token): Token {
  return tokenConditionsForPlayer(sanitizeTokenPhoto(withoutCarrier(token)))
}

/** A ficha sem a mochila: é como o jogador recebe a ficha de outro. Sem mochila, o mesmo objeto. */
function withoutBackpack(token: Token): Token {
  if (!('mochila' in token)) return token
  const { mochila: _dele, ...semMochila } = token
  return semMochila
}

/**
 * A marca "Ficha de jogador" é do mestre (quem ele oferece a quem chega): no
 * mapa do jogador ela diria quais fichas em volta dele estão sem dono.
 */
function withoutMasterMarks(token: Token): Token {
  if (token.playerCharacter === undefined) return token
  const { playerCharacter: _masterOnly, ...rest } = token
  return rest
}

/** Uma ficha que quem chega sem personagem pode pedir: só o id e o nome. */
export interface ClaimableToken {
  tokenId: string
  name: string
}

/**
 * A LISTA DE FICHAS LIVRES de quem entra sem personagem. Vai a quem ainda não
 * tem visão nenhuma, então não passa pelo recorte da névoa: entra só o que o
 * MESTRE oferece — ficha marcada "Ficha de jogador" —, e nunca a que ele
 * esconde (secreta, oculta no editor, em camada oculta) nem a que já é de
 * alguém (`taken`: dono conectado ou não, assento guardado). Sai só id e nome:
 * nem cena, nem posição. Em ordem de nome; ficha repetida entre cenas, uma vez.
 */
export function claimableTokensForPlayer(maps: readonly MapData[], taken: ReadonlySet<string>): ClaimableToken[] {
  const seen = new Set<string>()
  const out: ClaimableToken[] = []
  for (const map of maps) {
    for (const token of visibleTokens(map.tokens, map.hiddenLayers)) {
      if (token.playerCharacter !== true || token.secret === true || token.hidden === true) continue
      if (taken.has(token.id) || seen.has(token.id)) continue
      seen.add(token.id)
      out.push({ tokenId: token.id, name: token.name })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.tokenId.localeCompare(b.tokenId))
}

/**
 * "REVELAR PARA…" de ficha secreta, escada secreta e zona oculta, por id do
 * item: os jogadores que DESCOBRIRAM. O contrário de `PinAudiences`: item
 * AUSENTE (ou com o conjunto vazio) = escondido de todos, como sempre; quem
 * está no conjunto recebe o item como se ele não fosse secreto — a ficha ainda
 * exige visão, e a zona deixa de esconder só para ele. Vive na sessão do host,
 * pelo mesmo motivo do "Quem vê": id de jogador só existe com a sala aberta.
 */
export type SecretReveals = ReadonlyMap<string, ReadonlySet<string>>

/** O marcador de "Oculta para jogadores" é do editor do mestre: a sala aberta sai sem ele. */
function withoutSecretMark(region: Region): Region {
  if (region.secret !== true) return region
  const copy = { ...region }
  delete copy.secret
  return copy
}

/** Ponto estritamente dentro do polígono: em cima do muro conta como fora (mesma regra do teto). */
function strictlyInside(points: readonly RegionPoint[], p: RegionPoint): boolean {
  return pointInPolygonInclusive(p, points) && !pointOnPolygonBorder(p, points)
}

/**
 * LUZ VISTA DE LONGE: o que o jogador recebe de uma luz fora da visão dele.
 * Montada campo a campo para nada além do ponto atravessar: raio 0 (sem halo,
 * então nada do que a luz ilumina aparece), sem a ficha que a carrega e sem
 * as marcas de editor do mestre.
 */
function farLightPoint(light: Light): Light {
  return { id: light.id, x: light.x, y: light.y, radius: 0, color: light.color, intensity: light.intensity, vistaDeLonge: true }
}

/** "Raio de visão aqui" que vale: número finito e positivo; o resto é ignorado. */
function roomVisionRadiusOf(region: Region): number | null {
  const raio = region.room?.raioDeVisao
  return typeof raio === 'number' && Number.isFinite(raio) && raio > 0 ? raio : null
}

interface RadiusRoom {
  points: RegionPoint[]
  radius: number
  area: number
}

/**
 * Raio de visão da ficha: o da Sala MAIS DE DENTRO (menor área) com "Raio de
 * visão aqui" que contém a ficha; sem nenhuma, o do jogador. Nome distinto do
 * `visionRadiusAt` de `./hazards` (a fumaça), que é aplicado por cima deste.
 */
function roomVisionRadiusAt(point: RegionPoint, rooms: readonly RadiusRoom[], playerRadius: number): number {
  let best: RadiusRoom | null = null
  for (const room of rooms) {
    if (!pointInPolygonInclusive(point, room.points)) continue
    if (best === null || room.area < best.area) best = room
  }
  return best === null ? playerRadius : best.radius
}

/** Porta explorada que o jogador nunca viu: aparece fechada e destrancada. */
function unseenDoor(door: DoorState): DoorState {
  return { open: false, locked: false, kind: door.kind }
}

/**
 * A porta como o jogador a vê: aberta ou fechada, nunca trancada — e sem o
 * "Abre com" (CHAVE ABRE PORTA): o jogador nunca descobre que portas uma chave
 * abre. Quem tem a chave só lê o nome dela na recusa do toque (`hostSession`).
 */
function withoutLock(door: DoorState): DoorState {
  const { abreCom: _chave, ...semChave } = door
  return { ...semChave, locked: false }
}

/**
 * A porta como o jogador a recebe: sem `opensFrom` (porta de um lado). O lado
 * que abre é regra do mestre — o jogador descobre tentando, e quem decide é o
 * host (`net/hostSession.ts`), com a porta do mapa do mestre.
 */
function doorForPlayer(door: DoorState): DoorState {
  const { opensFrom: _regraDoMestre, ...rest } = door
  return rest
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

/** Só os itens de `all` cujo id saiu em `sent`, na versão ORIGINAL (a do mapa, não a recortada). */
function keepSent<T extends { id: string }>(all: ReadonlyMap<string, T>, sent: readonly { id: string }[]): Map<string, T> {
  const ids = new Set(sent.map((item) => item.id))
  return new Map([...all].filter(([id]) => ids.has(id)))
}

/**
 * "Revelar planta" do mestre: o jogador passa a lembrar a planta como ela está
 * AGORA — só o que a revelação de fato mostra.
 *
 * NÃO entra o que está num lugar escondido NA HORA de revelar (zona oculta
 * ativa, sala secreta, interior de teto): lá o explorado também não é marcado
 * (`playerBlockedRings`), então o jogador nunca viu nem explorou o lugar. Se
 * entrasse, desligar a zona ou tirar o teto depois, com o jogador longe,
 * mandaria pela rede a versão "lembrada" de uma sala que ele nunca viu.
 * Também não entra item oculto ou secreto: ele não foi mostrado.
 *
 * A decisão de lugar é a MESMA do recorte: o próprio `filterMapForPlayer`, sem
 * token (ninguém vê nada agora) e com tudo na memória, diz o que sairia como
 * lembrado. Camada escondida não conta: é interruptor do mapa inteiro, e
 * religá-la mostra a planta revelada como sempre mostrou.
 */
export function planOfWholeMap(map: MapData): PlanMemory {
  const everything: PlanMemory = {
    walls: byId(map.walls),
    floor: byId(map.floor),
    regions: byId(map.regions),
    drawings: byId(map.drawings),
    markers: byId(map.markers),
    lines: byId(map.lines),
    stairs: byId(map.stairs),
    pins: byId(map.pins ?? []),
  }
  const { map: shown } = filterMapForPlayer({ ...map, hiddenLayers: [] }, '', {}, 0, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, everything)
  return {
    walls: keepSent(everything.walls, shown.walls),
    floor: keepSent(everything.floor, shown.floor),
    regions: keepSent(everything.regions, shown.regions),
    drawings: keepSent(everything.drawings, shown.drawings),
    markers: keepSent(everything.markers, shown.markers),
    lines: keepSent(everything.lines, shown.lines),
    stairs: keepSent(everything.stairs, shown.stairs),
    pins: keepSent(everything.pins, shown.pins),
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
 * `pinAudiences`: quem vê cada pino (`PinAudiences`); ausente = todo pino é de todos.
 * `enteredRooms`: Salas deste mapa em que o jogador JÁ entrou (texto da sala).
 * O texto de entrada dela continua no recorte depois que ele sai, para tocar
 * no rótulo e reler; de Sala onde ele nunca entrou o texto não sai.
 * `seenRooms`: CÔMODOS LEMBRADOS (`RoomMeta.comodo`) deste mapa que o jogador
 * já viu — o que o chamador guardou de `rememberedRooms` nos recortes de antes.
 * `secretReveals`: a quem o mestre revelou cada ficha secreta, escada secreta
 * e zona oculta (`SecretReveals`); ausente = segredo de todos.
 * `discoveredSecretRooms`: salas secretas deste mapa que ESTE jogador já
 * descobriu (esteve com a ficha dentro, `occupiedSecretRooms`). Abrem só para
 * ele, como se a ficha ainda estivesse lá; o resto da regra (névoa, explorado)
 * continua valendo.
 * `peekDoorIds`: portas que ESTE jogador está espiando agora ("Espiar", o host
 * decide e marca o prazo). A visão dele atravessa essas portas como se
 * estivessem abertas; o estado da porta no pacote continua o real.
 * `remembered`: memória da planta do jogador (`PlanMemory`). Com ela, o
 * explorado fora da visão mostra a versão LEMBRADA de cada item e nada do que o
 * jogador nunca viu (a parede que o mestre ergueu longe dele não aparece). Sem
 * ela, o explorado mostra o presente — só para quem não guarda memória por
 * jogador; o host sempre passa.
 * `seenMarks`: ids das marcas de jogador (bilhete no lugar) que ESTE jogador já
 * viu. No explorado só sai marca daqui; marca nova sai só pela visão atual —
 * senão o bilhete cravado no escuro lembrado entregaria onde o colega está agora.
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
  visionRadius: VisionRadius,
  explored?: Exploration,
  seenDoors?: ReadonlyMap<string, DoorState>,
  pinAudiences?: PinAudiences,
  enteredRooms?: ReadonlySet<string>,
  seenRooms?: ReadonlySet<string>,
  secretReveals?: SecretReveals,
  discoveredSecretRooms?: ReadonlySet<string>,
  peekDoorIds?: ReadonlySet<string>,
  remembered?: PlanMemory,
  seenMarks?: ReadonlySet<string>,
  oneWayExits?: OneWayExits,
  companions?: CompanionMarks,
): PlayerMapView {
  // Jogador sem entrada de posse não tem token nem visão. A marca do guarda
  // (?, !) mede as fichas de TODOS os jogadores que ele recebe, não só as dele.
  const ownTokenIds = ownership[playerId] ?? []
  return filterMapForGroup(map, [{ tokenIds: ownTokenIds, visionRadius }], explored, seenDoors, allPlayerTokens(ownership), {
    pinAudiences,
    enteredRooms,
    playerId,
    seenRooms,
    secretReveals,
    discoveredSecretRooms,
    peekDoorIds,
    remembered,
    seenMarks,
    oneWayExits,
    companionOf: companionsByToken(ownership, playerId, new Set(ownTokenIds), companions),
  })
}

/**
 * O que é de UM jogador no recorte, e não do grupo: quem vê cada pino e as
 * Salas em que ele já entrou. Sem `playerId` (a tela da mesa), pino com lista
 * de "Quem vê" não sai — a TV é de todos na mesa, e o pino escolhido para
 * alguns não pode aparecer para os outros por ela.
 */
export interface PlayerOnlyView {
  pinAudiences?: PinAudiences
  enteredRooms?: ReadonlySet<string>
  playerId?: string
  /** CÔMODOS LEMBRADOS deste jogador (`filterMapForPlayer`). A tela da mesa não passa: lá vale só o visto e o explorado. */
  seenRooms?: ReadonlySet<string>
  /** A quem o mestre revelou cada ficha secreta, escada secreta e zona oculta; ausente = segredo de todos. */
  secretReveals?: SecretReveals
  /** Salas secretas deste mapa que ESTE jogador já descobriu (`filterMapForPlayer`). A tela da mesa não passa. */
  discoveredSecretRooms?: ReadonlySet<string>
  /** Portas que ESTE jogador está espiando agora ("Espiar"): a visão dele atravessa como se estivessem abertas. */
  peekDoorIds?: ReadonlySet<string>
  /** Memória da planta DESTE jogador (`PlanMemory`), ver `filterMapForPlayer`. A tela da mesa não passa. */
  remembered?: PlanMemory
  /** Marcas de jogador (bilhete no lugar) que ESTE jogador já viu (`filterMapForPlayer`). A tela da mesa não passa: lá vale só a visão atual. */
  seenMarks?: ReadonlySet<string>
  /** SÓ IDA: por pino, as saídas marcadas pelo host (`filterMapForPlayer`). Ausente = nenhuma sai marcada. */
  oneWayExits?: OneWayExits
  /** MARCA DE COMPANHEIRO por id de ficha (`companionsByToken`, via `filterMapForPlayer`). A tela da mesa não passa: nenhuma ficha sai marcada. */
  companionOf?: ReadonlyMap<string, TokenCompanion>
}

/** OLHOS DO GUARDA: as fichas de todos os jogadores da sala — quem a marca do guarda considera. */
export function allPlayerTokens(ownership: Readonly<Record<string, readonly string[]>>): ReadonlySet<string> {
  return new Set(Object.values(ownership).flat())
}

/**
 * Um membro do grupo que a tela da mesa acompanha: as fichas dele e o raio de
 * visão DELE. RAIO POR FICHA: como função, cada ficha enxerga com o raio que
 * ela devolve (a emprestada, com o do dono).
 */
export interface GroupViewer {
  tokenIds: readonly string[]
  visionRadius: VisionRadius
}

/**
 * TELA DA MESA — o recorte de um GRUPO: a união do que as fichas de cada
 * membro enxergam, cada uma com o raio do próprio jogador (o raio maior do
 * grupo nunca vale para os outros). As fichas do grupo fazem o papel da ficha
 * própria do jogador: saem sempre, abrem teto de prédio e enxergam. Todo o
 * resto — névoa, zona oculta, sala secreta, teto, nome da cena, metadado do
 * mestre — é exatamente a regra de `filterMapForPlayer`, que é este mesmo
 * recorte com um grupo de um.
 *
 * `watchTargets`: as fichas que a marca do guarda (?, !) considera — as de
 * TODOS os jogadores (`allPlayerTokens`), porque o guarda que o grupo vê pode
 * ter visto quem não é do grupo. Sem ele, só as fichas do grupo contam. Em
 * qualquer caso, só as que o recorte entrega (nada na névoa, secreto, em zona
 * oculta ou sob teto fechado).
 */
export function filterMapForGroup(
  map: MapData,
  viewers: readonly GroupViewer[],
  explored?: Exploration,
  seenDoors?: ReadonlyMap<string, DoorState>,
  watchTargets?: ReadonlySet<string>,
  { pinAudiences, enteredRooms, playerId, seenRooms, secretReveals, discoveredSecretRooms, peekDoorIds, remembered, seenMarks, oneWayExits, companionOf }: PlayerOnlyView = {},
): PlayerMapView {
  if (isWorldMap(map))
    return filterWorldMapForGroup(map, viewers, explored, seenDoors, watchTargets, { pinAudiences, enteredRooms, playerId, seenRooms, secretReveals, discoveredSecretRooms, peekDoorIds, remembered, seenMarks, oneWayExits, companionOf })
  const hiddenLayers = map.hiddenLayers
  // Posse é exclusiva (um token, um dono); se viesse repetido, vale o primeiro raio.
  const radiusByToken = new Map<string, number>()
  for (const viewer of viewers) {
    for (const id of viewer.tokenIds) {
      if (radiusByToken.has(id)) continue
      const radius = viewer.visionRadius
      radiusByToken.set(id, typeof radius === 'number' ? radius : radius(id))
    }
  }
  const owned: ReadonlySet<string> = new Set(radiusByToken.keys())
  const layerTokens = visibleTokens(map.tokens, hiddenLayers)
  const ownTokens = layerTokens.filter((t) => owned.has(t.id) && !t.hidden)
  /** O mestre revelou este item a este jogador ("Revelar para…")? */
  const revealedToPlayer = (itemId: string): boolean => playerId !== undefined && secretReveals?.get(itemId)?.has(playerId) === true
  /** "Oculto para jogadores" PARA ESTE jogador: secreto e não revelado a ele. */
  const secretFromPlayer = (item: { id: string; secret?: boolean }): boolean => item.secret === true && !revealedToPlayer(item.id)

  // Zona oculta ativa: ponto dentro dela não conta como visível nem explorado.
  // A visão continua passando (a zona esconde conteúdo, não é parede).
  // PINCEL DE REVELAR: ponto numa célula que o mestre pintou deixa de ser
  // escondido POR ESTA zona — outra zona ativa por cima continua valendo.
  // Zona revelada SÓ a este jogador ("Revelar para…") não esconde nada dele:
  // sai daqui, e com ela o preto, o veto de memória e o veto de visão.
  const playerConcealZones = activeConcealZones(map).filter((zone) => !revealedToPlayer(zone.id))
  const concealRings = playerConcealZones.map((z) => z.points.map((p) => ({ x: p.x, y: p.y })))
  const zones: ActiveZone[] = playerConcealZones.flatMap((zone, i) =>
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
  const allSecretRooms = secretRoomsOf(map)
  /**
   * DENTRO DA SALA SECRETA — a sala abre PARA ESTE JOGADOR quando uma ficha
   * dele está estritamente dentro (em cima do muro ainda é fora: na dúvida,
   * fecha) ou quando ele já a descobriu (`discoveredSecretRooms`). Aberta, ela é
   * uma Sala comum para ele: paredes, portas, nome, chão e pinos NÃO secretos.
   * Geometria indecidível nunca abre. Os outros jogadores continuam sem ela.
   */
  const occupiedSecretIds = allSecretRooms
    .filter((r) => isUsablePolygon(r.points) && ownTokens.some((t) => strictlyInside(r.points, { x: t.x, y: t.y })))
    .map((r) => r.id)
  const openSecretIds = new Set([
    ...occupiedSecretIds,
    ...allSecretRooms.filter((r) => discoveredSecretRooms?.has(r.id) === true && isUsablePolygon(r.points)).map((r) => r.id),
  ])
  const secretRooms = allSecretRooms.filter((r) => !openSecretIds.has(r.id))
  /** Secreta e ainda FECHADA para este jogador. */
  const isClosedSecret = (r: Region): boolean => r.secret === true && !openSecretIds.has(r.id)
  // Sub-sala de sala secreta ou oculta some junto, com as paredes dela. O nome
  // oculto da sala de fora NÃO passa para a de dentro. Sala secreta aberta para
  // o jogador leva junto as sub-salas comuns; sub-sala secreta continua fechada.
  const hiddenByAncestorIds = new Set(
    map.regions.filter((r) => r.parentId !== undefined && ancestorsOf(map.regions, r.id).some((a) => isClosedSecret(a) || a.hidden)).map((r) => r.id),
  )
  const secretRoomIds = new Set([...secretRooms.flatMap((r) => [...subtreeIds(map.regions, r.id)]), ...hiddenByAncestorIds])
  // Aberta dentro de uma sala que continua fechada (sub-sala de secreta) não conta: segue sumida.
  const occupiedSecretRooms = occupiedSecretIds.filter((id) => !secretRoomIds.has(id))
  const secretRoomRings = boxRings(secretRooms.map((r) => r.points))
  const inSecretRoom = (point: RegionPoint): boolean => secretRoomRings.length > 0 && inAnyRing(secretRoomRings, point)
  // Sala do jogador = toda região que não some por ser secreta ou oculta. Não
  // passa por `hiddenLayers`: com a camada Salas escondida a Biblioteca não sai,
  // mas a parede dela continua saindo — e o vão também saía.
  const playerRegions = map.regions.filter((r) => !r.hidden && !isClosedSecret(r) && !secretRoomIds.has(r.id) && isUsablePolygon(r.points))
  // RAIO DE VISÃO DA SALA: só Sala que o jogador pode conhecer (`playerRegions`)
  // — secreta ou oculta não muda o raio, senão a visão denunciaria a sala.
  const radiusRooms: RadiusRoom[] = playerRegions.flatMap((r) => {
    const radius = roomVisionRadiusOf(r)
    return radius === null ? [] : [{ points: r.points, radius, area: Math.abs(signedArea(r.points)) }]
  })
  // Raio de cada ficha: o do dono (`radiusByToken`; `ownTokens` só tem id que
  // está lá, o 0 nunca é usado), trocado pelo da Sala mais de dentro com "Raio
  // de visão aqui" (`roomVisionRadiusAt`) e, por cima, a ZONA DE PERIGO: dentro
  // da fumaça o raio cai para o teto dela (`visionRadiusAt`, nunca aumenta).
  const radiusOf = (token: Token): number => {
    const at = { x: token.x, y: token.y }
    return visionRadiusAt(map, at, roomVisionRadiusAt(at, radiusRooms, radiusByToken.get(token.id) ?? 0))
  }
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
  const knownWalls = mergeSecretDoorSeams(disguised.size === 0 ? withSecretDoorsAsWalls : withSecretDoorsAsWalls.flatMap((w) => disguised.get(w) ?? [w]), secretDoorIds)

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
   * Sala secreta FECHADA vence: quem já sumiu inteiro não precisa de teto. A
   * secreta ABERTA para este jogador (ocupada ou descoberta) sai como cômodo
   * comum, então o teto dela vale igual ao de qualquer prédio — filtrar pelo
   * `secret` bruto arrancava o teto e entregava o NPC lá dentro a quem está fora.
   * Polígono com
   * menos de 3 vértices ou com coordenada não-finita é INDECIDÍVEL: a sala some
   * do pacote (`brokenRoofIds`) em vez de virar um teto que nunca fecha.
   */
  const roofCandidates = roofRoomsOf(visibleRegions(map.regions, hiddenLayers)).filter(
    (r) => !r.hidden && !isClosedSecret(r) && !secretRoomIds.has(r.id),
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
  /** Dentro de algum prédio de teto fechado, cone pelo vão ou não. Só para o chão que sai da conta da visão. */
  const underClosedRoof = (point: RegionPoint): boolean => closedRoofs.some((roof) => inRoof(roof, point))
  /**
   * CONE PELO VÃO (`PlayerMapView.glimpses`), preenchido logo depois da visão
   * da autoridade — antes de qualquer pergunta sobre conteúdo. A única conta
   * que roda antes é o chão escondido (`hiddenFloorIds`), e ela usa
   * `underClosedRoof` de propósito: a visão enviada é calculada sem o chão do
   * prédio, e o pedaço do cone volta recortado em `playerFloor`.
   */
  const glimpses: Glimpse[] = []
  /** O olhar da ficha junto ao vão alcança este ponto de dentro de `roof` (pela conta do jogador E pela da autoridade)? */
  const inGlimpseOf = (roof: ClosedRoof, point: RegionPoint): boolean =>
    glimpses.some((g) => g.roof === roof && inRoof(roof, point) && inAnyRing(g.sight, point) && inAnyRing(g.authority, point))
  const inGlimpse = (point: RegionPoint): boolean => glimpses.some((g) => inGlimpseOf(g.roof, point))
  /** Escondido pelo teto: dentro de prédio de teto fechado, fora do cone pelo vão (`inGlimpseOf`). */
  const inClosedRoof = (point: RegionPoint): boolean => closedRoofs.some((roof) => inRoof(roof, point) && !inGlimpseOf(roof, point))
  /**
   * Ponto que o jogador não recebe por causa da SALA: secreta ou de teto
   * fechado — menos o cone pelo vão (já fora de `inClosedRoof`) e menos o cone
   * de quem espia pela porta aberta (`roofHides`, definido depois da visão,
   * que é de onde o cone sai).
   */
  const inRoomHiddenFromPlayer = (point: RegionPoint): boolean => inSecretRoom(point) || roofHides(point)

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
  /** A caixa da parede encosta na caixa de alguma zona: fora disso nenhum ponto dela está numa zona. */
  const nearZone = (w: Wall): boolean =>
    zones.some((z) => Math.max(w.x1, w.x2) >= z.minX && Math.min(w.x1, w.x2) <= z.maxX && Math.max(w.y1, w.y2) >= z.minY && Math.min(w.y1, w.y2) <= z.maxY)
  /**
   * ZONA AO LONGO DA PAREDE, a cada passo do pincel (`wallStepSamples`), e
   * não só nas pontas e no meio (`wallSamples`). Com 3 amostras, a zona que
   * cobre só o trecho entre elas passava despercebida: a parede saía inteira
   * atravessando a zona — e toda parede com porta secreta dentro de zona
   * (emendada em `mergeSecretDoorSeams`, logo comprida) caía nesse caso.
   * Parede enorme perto de zona conta como tocando: erra para o lado de esconder.
   */
  const touchesZone = (w: Wall): boolean => {
    if (!nearZone(w)) return false
    const samples = wallStepSamples(w)
    return samples === null || samples.some(inZoneRing)
  }
  /**
   * Parede INTEIRA dentro de zona, ao longo dela (mesma malha de `touchesZone`).
   * Com 3 amostras, a parede com pontas e meio na zona mas um trecho fora dela
   * contava como inteira dentro. Parede enorme cai nas 3 amostras de antes.
   */
  const insideZone = (w: Wall): boolean => nearZone(w) && (wallStepSamples(w) ?? wallSamples(w)).every(inZoneRing)
  const outsideZones = (points: readonly RegionPoint[]): readonly RegionPoint[] =>
    zones.length === 0 ? points : points.filter((p) => !hiddenByZone(p))
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
  const underIdsOf = (roofs: readonly ClosedRoof[]): Set<string> =>
    new Set(roofs.flatMap((roof) => [...subtreeIds(map.regions, roof.id)].filter((id) => id !== roof.id)))
  const underRoofIds = underIdsOf(closedRoofs)
  /** Prédio que o jogador vê MESMO: teto fechado que não está dentro de outro prédio de teto fechado. */
  const visibleRoofIds = new Set(
    closedRoofs
      .filter((roof) => !closedRoofs.some((outer) => outer.id !== roof.id && mostly(roof.points, (p) => inRoof(outer, p))))
      .map((roof) => roof.id),
  )

  /**
   * Parede que é MOBÍLIA de dentro de um dos tetos `roofs`.
   *
   * Duas perguntas, não uma: a parede está inteira dentro do polígono E não é o
   * CONTORNO dele. Sem a segunda, a parede do próprio muro (e a porta da frente
   * nela) sumia; sem a primeira, a divisória encostada no muro vazava. O
   * `regionId` é só um atalho: parede desenhada à mão sobre o muro não tem
   * nenhum, e era exatamente o caso que quebrava.
   */
  const underRoofOwner = new Map(closedRoofs.flatMap((roof) => [...subtreeIds(map.regions, roof.id)].filter((id) => id !== roof.id).map((id) => [id, roof] as const)))
  /** O prédio de teto fechado de que esta parede é mobília, ou `undefined`. */
  const interiorRoofOf = (w: Wall): ClosedRoof | undefined => {
    const owner = w.regionId === undefined ? undefined : underRoofOwner.get(w.regionId)
    if (owner !== undefined) return owner
    if (closedRoofs.length === 0) return undefined
    if (w.regionId !== undefined && visibleRoofIds.has(w.regionId)) return undefined
    const samples = wallSamples(w)
    return closedRoofs.find((roof) => samples.every((p) => inRoof(roof, p)) && samples.some((p) => !pointOnPolygonBorder(p, roof.points)))
  }
  /**
   * Parede de dentro do prédio que o cone pelo vão alcança: parede comum sai
   * só no trecho do cone (`wallRunsWhere`); porta, só inteira dentro dele —
   * partida ao meio ela deixaria de ser a porta que o host conhece.
   */
  const glimpsedInteriorWall = (w: Wall, roof: ClosedRoof): Wall[] => {
    if (glimpses.length === 0) return []
    // O olhar PARA na parede: o traço dela é a borda do anel, onde o teste de
    // ponto não decide. Vale o ponto a `DOOR_VISION_PROBE` px de um dos lados.
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1)
    const nx = len === 0 ? 0 : (-(w.y2 - w.y1) / len) * DOOR_VISION_PROBE
    const ny = len === 0 ? 0 : ((w.x2 - w.x1) / len) * DOOR_VISION_PROBE
    const seen = (p: RegionPoint): boolean =>
      inGlimpseOf(roof, p) || inGlimpseOf(roof, { x: p.x + nx, y: p.y + ny }) || inGlimpseOf(roof, { x: p.x - nx, y: p.y - ny })
    if (w.door !== null) return wallSamples(w).every(seen) ? [w] : []
    return wallRunsWhere(w, seen)
  }
  /**
   * Prédio de teto fechado que a parede `w` fica embaixo de, entre `roofs`
   * (mobília interior OU dentro do polígono): usado pelo cone de quem espia
   * pela porta aberta, que testa contra o conjunto de tetos ainda não
   * espiados.
   */
  const wallUnderRoofs = (roofs: readonly ClosedRoof[]): ((w: Wall) => boolean) => {
    const underIds = roofs === closedRoofs ? underRoofIds : underIdsOf(roofs)
    /** Prédio que o jogador vê MESMO: teto fechado que não está dentro de outro prédio de teto fechado. */
    const topRoofIds = new Set(
      roofs.filter((roof) => !roofs.some((outer) => outer.id !== roof.id && mostly(roof.points, (p) => inRoof(outer, p)))).map((roof) => roof.id),
    )
    return (w) => {
      if (w.regionId !== undefined && underIds.has(w.regionId)) return true
      if (roofs.length === 0) return false
      if (w.regionId !== undefined && topRoofIds.has(w.regionId)) return false
      const samples = wallSamples(w)
      return roofs.some((roof) => samples.every((p) => inRoof(roof, p)) && samples.some((p) => !pointOnPolygonBorder(p, roof.points)))
    }
  }
  const isUnderClosedRoof = wallUnderRoofs(closedRoofs)

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
  // Só a sala secreta FECHADA para este jogador: a que abriu vira memória dele como qualquer cômodo.
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
      : map.floor.filter((f) => mostly(floorPieceSamples(f), (p) => inAnyRing(hiddenAreas, p) || underClosedRoof(p))).map((f) => f.id),
  )

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
  const concealed = zones.flatMap((zone, i) => concealedPieces(zone.ring, unveiledShown[i]))

  /**
   * CENA ESCURA e SALA ESCURA (`lib/darkness.ts`). `null` = nada escuro para
   * este jogador: a visão sai exatamente como antes da feature.
   *
   * O escuro recorta a VISÃO, e a visão também sai pela rede (`vision`). Por
   * isso só entra aqui o que o jogador pode saber:
   * - sala escura que ele não recebe (camada Salas escondida, secreta, oculta,
   *   dentro de sala secreta, engolida por teto fechado) NÃO escurece nada — senão o corte na visão
   *   desenharia o formato dela;
   * - sala escura que toca zona oculta continua escura, e o preto da zona
   *   (`concealed`, que o jogador já recebe) entra junto como véu (`veils`):
   *   o corte segue a borda da zona, nunca o trecho da sala que ela cobre.
   *   Descartar a sala inteira (a versão anterior) acendia a sala toda, e o
   *   que estava no escuro dela saía no pacote;
   * - luz que o jogador não recebe não ilumina: a da camada escondida, a
   *   oculta, a de dentro de sala secreta, teto fechado ou zona, e a tocha presa
   *   numa ficha que o mestre esconde (o claro andando entregaria o NPC).
   */
  const darkRoomsOnLayer = visibleRegions(map.regions, hiddenLayers).filter(
    (r) => r.room?.dark === true && !r.hidden && !r.secret && !secretRoomIds.has(r.id) && isUsablePolygon(r.points),
  )
  const isInteriorRoom = (r: Region): boolean => underRoofIds.has(r.id) || swallowedByClosedRoof(r)
  const openDarkRooms = darkRoomsOnLayer.filter((r) => !isInteriorRoom(r))
  const darknessForPlayer = (darkRooms: readonly Region[]): Darkness | null => {
    if (map.dark !== true && darkRooms.length === 0) return null
    const darkBoxes = boxRings(darkRooms.map((r) => r.points))
    const veils = boxRings(concealed).filter((v) =>
      darkBoxes.some((d) => v.maxX >= d.minX && v.minX <= d.maxX && v.maxY >= d.minY && v.minY <= d.maxY),
    )
    const layerTokenById = new Map(layerTokens.map((t) => [t.id, t]))
    const knownTokenIds = new Set(map.tokens.map((t) => t.id))
    const carriedByHidden = (l: Light): boolean => {
      if (l.attachedTokenId === undefined || !knownTokenIds.has(l.attachedTokenId)) return false
      const carrier = layerTokenById.get(l.attachedTokenId)
      return carrier === undefined || carrier.hidden === true || (!owned.has(carrier.id) && secretFromPlayer(carrier))
    }
    const lights = visibleLights(map.lights, hiddenLayers).filter((l) => {
      const at = { x: l.x, y: l.y }
      return !l.hidden && Number.isFinite(l.radius) && l.radius > 0 && !inRoomHiddenFromPlayer(at) && !hiddenByZone(at) && !carriedByHidden(l)
    })
    return {
      sceneDark: map.dark === true,
      rooms: darkRooms.map((r) => r.points),
      veils: veils.map((v) => v.ring),
      lights: lights.map((l) => ({ x: l.x, y: l.y, radius: l.radius })),
      cell: map.grid,
    }
  }

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
  const darkness = darknessForPlayer(openDarkRooms)
  /** Olhar de UMA ficha em `origin`: um anel sem escuro; com escuro, vários (`darkVision`). */
  const sightFrom = (origin: RegionPoint, segments: Segment[], radius: number, dark: Darkness | null): RegionPoint[][] =>
    dark === null ? [computeVisibility(origin, segments, radius)] : darkVision(origin, segments, radius, dark)
  /**
   * Anéis de visão de cada ficha (mesmo índice de `ownTokens`). As DUAS
   * visões abaixo passam por aqui, então o escuro corta o que sai no pacote e
   * o desenho da visão enviada do mesmo jeito. RAIO POR FICHA (`radiusOf`): o
   * escuro corta o anel de cada uma no raio dela, não num raio único do grupo.
   */
  const visionByToken = (segments: Segment[]): RegionPoint[][][] =>
    ownTokens.map((t) => sightFrom({ x: t.x, y: t.y }, segments, radiusOf(t), darkness))
  const authoritySegments = ownTokens.length > 0 ? visionSegments(knownWalls === map.walls ? map : { ...map, walls: knownWalls }, peekDoorIds) : []
  const authorityByToken = visionByToken(authoritySegments)
  /**
   * ESCURO DO CONE PELO VÃO: o de sempre mais as salas escuras de dentro DESTE
   * prédio. Elas ficam fora de `darkness` de propósito (o jogador não recebe
   * cômodo interior, e o corte na visão enviada desenharia o formato dele),
   * mas a janela deixa olhar lá dentro — sem elas, o guarda no depósito escuro
   * saía no pacote pelo cone. O corte aqui só vira as CÉLULAS do cone, que já
   * são o que o jogador vê do interior. `null` = este prédio não tem cômodo
   * escuro: o cone usa o olhar da autoridade já calculado.
   */
  const glimpseDarkness = new Map<ClosedRoof, Darkness | null>()
  const glimpseDarknessOf = (roof: ClosedRoof): Darkness | null => {
    const cached = glimpseDarkness.get(roof)
    if (cached !== undefined) return cached
    const subtree = subtreeIds(map.regions, roof.id)
    const inside = darkRoomsOnLayer.filter(
      (r) => isInteriorRoom(r) && r.id !== roof.id && (subtree.has(r.id) || mostly(interiorSamples(r.points, r.points), (p) => inRoof(roof, p))),
    )
    const dark = inside.length === 0 ? null : darknessForPlayer([...openDarkRooms, ...inside])
    glimpseDarkness.set(roof, dark)
    return dark
  }
  const authorityVision = authorityByToken.flat()
  const rings = boxRings(authorityVision)
  // Anéis por ficha, para "ler só de perto".
  const pinReaders: PinReader[] = ownTokens.map((t, i) => ({ x: t.x, y: t.y, sight: boxRings(authorityByToken[i]) }))
  /** Parede de zona oculta: sai inteira fora da zona, só no pedaço pintado dentro dela. */
  const zoneCutWall = (w: Wall): Wall[] => {
    if (zones.length === 0 || !insideZone(w)) return [w]
    return brushed ? wallRunsWhere(w, inBrushReveal) : []
  }
  const isSecretRoomWall = (w: Wall): boolean => w.regionId !== undefined && secretRoomIds.has(w.regionId)
  const playerFloorForVision = floorWithout(map.floor, hiddenFloorIds)
  /**
   * Chão da conta do cone DESTE prédio: o do jogador mais as peças que só o
   * teto dele escondia (o chão que o balde cria ao encher o interior). Sem
   * elas, a borda do chão da rua passava exatamente na janela e barrava o
   * olhar: prédio com chão próprio nunca tinha cone. Peça em zona oculta ou
   * sala secreta continua fora — a borda dela segue barrando o cone. O olhar
   * daqui nunca sai no fio: vira só as células do cone, e o cone nunca passa
   * da conta da autoridade.
   */
  const floorForGlimpse = (roof: ClosedRoof): FloorPiece[] => {
    const own = new Set(
      map.floor
        .filter((f) => hiddenFloorIds.has(f.id) && mostly(floorPieceSamples(f), (p) => inRoof(roof, p) && !inAnyRing(hiddenAreas, p)))
        .map((f) => f.id),
    )
    if (own.size === 0) return playerFloorForVision
    return floorWithout(map.floor, new Set([...hiddenFloorIds].filter((id) => !own.has(id))))
  }
  glimpses.push(
    ...glimpsesThroughOpenings({
      map,
      roofs: closedRoofs,
      walls: knownWalls,
      tokens: ownTokens,
      // Prédio sem cômodo escuro reaproveita o olhar da autoridade já calculado.
      authorityFor: (roof, token, i) => {
        const dark = glimpseDarknessOf(roof)
        return dark === null ? authorityByToken.slice(i, i + 1).flat() : sightFrom({ x: token.x, y: token.y }, authoritySegments, radiusOf(token), dark)
      },
      sightFor: (roof, token, segments) => sightFrom({ x: token.x, y: token.y }, segments, radiusOf(token), glimpseDarknessOf(roof) ?? darkness),
      peekDoorIds,
      // A conta do jogador vista de dentro deste prédio: as paredes que ele
      // recebe, mais a mobília DESTE prédio (que o cone vai mostrar) — nunca a
      // de outro prédio fechado nem a da sala secreta.
      segmentsFor: (roof) =>
        visionSegments(
          {
            ...map,
            walls: knownWalls.filter((w) => !isSecretRoomWall(w) && (interiorRoofOf(w) ?? roof) === roof).flatMap(zoneCutWall),
            floor: floorForGlimpse(roof),
          },
          peekDoorIds,
        ),
    }),
  )

  /**
   * VER PELA PORTA ABERTA DE PRÉDIO FECHADO. Ficha do jogador no vão de uma
   * porta aberta (e destrancada) do CONTORNO de um prédio de teto fechado — ao
   * alcance dela, a mesma conta de `lib/doorReach.ts` que o host usa para
   * abrir porta — espia o lado de dentro. O teto continua fechado: só o que a
   * visão DESSA ficha alcança pela porta sai do teto (`roofHides`). O raycast já
   * para nas paredes de dentro, então quem espia vê o cômodo em frente à porta
   * e não o prédio inteiro. Prédio de geometria indecidível nunca é espiado.
   */
  const peekerIndexes = new Set<number>()
  const peekedRoofIds = new Set<string>()
  // Porta aberta ao alcance de alguma ficha do jogador: poucas, então o teste de contorno (o caro) só roda nelas.
  const doorsInReach =
    ownTokens.length === 0 || closedRoofs.length === 0
      ? []
      : knownWalls.filter(
          (w) =>
            !w.hidden &&
            isDoorPassable(w.door) &&
            !isSecretRoomWall(w) &&
            !inConcealZone(wallMidpoint(w)) &&
            ownTokens.some((t) => tokenReachesDoor(t, w, map.grid)),
        )
  for (const roof of closedRoofs) {
    if (roof.broken) continue
    const doors = doorsInReach.filter((w) => wallLineSamples(w).every((p) => pointOnPolygonBorder(p, roof.points)))
    if (doors.length === 0) continue
    ownTokens.forEach((t, i) => {
      if (!doors.some((d) => tokenReachesDoor(t, d, map.grid))) return
      peekerIndexes.add(i)
      peekedRoofIds.add(roof.id)
    })
  }
  const peekVision = authorityVision.filter((_, i) => peekerIndexes.has(i))
  const peekRings = boxRings(peekVision)
  const inPeekCone = (point: RegionPoint): boolean => peekRings.length > 0 && inAnyRing(peekRings, point)
  /** Teto fechado que ninguém do jogador está espiando: esconde como sempre. */
  const unpeekedRoofs = closedRoofs.filter((roof) => !peekedRoofIds.has(roof.id))
  const inUnpeekedRoof = (point: RegionPoint): boolean => unpeekedRoofs.some((roof) => inRoof(roof, point))
  /**
   * O ponto está sob teto fechado para este jogador. Dentro do prédio espiado,
   * o cone de quem está no vão fica de fora; um prédio de teto fechado DENTRO
   * do espiado continua escondendo o dele (`inUnpeekedRoof`). Cobre também o
   * cone pelo vão (`inClosedRoof`, que já descontou `inGlimpseOf`).
   */
  const roofHides = (point: RegionPoint): boolean => {
    if (peekRings.length === 0) return inClosedRoof(point)
    return inUnpeekedRoof(point) || (inClosedRoof(point) && !inPeekCone(point))
  }
  /** Parede de dentro de um teto que ninguém espia. */
  const isUnderUnpeekedRoof = peekRings.length === 0 ? isUnderClosedRoof : wallUnderRoofs(unpeekedRoofs)
  /** Parede de dentro de um prédio espiado (e só dele): candidata a sair pelo cone. */
  const isPeekInterior = (w: Wall): boolean => peekRings.length > 0 && isUnderClosedRoof(w) && !isUnderUnpeekedRoof(w)

  // `knownWalls` (e não `map.walls`): a porta/estante da sala secreta chega ao
  // jogador disfarçada de parede, e a sombra dela precisa sair igual.
  const playerWalls = knownWalls.flatMap((w): Wall[] => {
    if (isSecretRoomWall(w)) return []
    const roof = interiorRoofOf(w)
    if (roof !== undefined) return glimpsedInteriorWall(w, roof).flatMap(zoneCutWall)
    return zoneCutWall(w)
  })
  const wallsChanged = playerWalls.length !== knownWalls.length || playerWalls.some((w, i) => w !== knownWalls[i])
  let vision = authorityVision
  if (ownTokens.length > 0 && (wallsChanged || hiddenFloorIds.size > 0)) {
    const playerSegments = visionSegments({ ...map, walls: playerWalls, floor: playerFloorForVision }, peekDoorIds)
    /**
     * Quem espia enxerga com as paredes de dentro do prédio espiado INTEIRAS e
     * com o chão dele: são elas que param o raio no cômodo da frente. Sem elas
     * a visão enviada atravessaria o prédio e desenharia na névoa o que está
     * atrás da divisória. As paredes que o raio acerta são as que o cone vê —
     * e só essas saem no pacote (`peekedWallForPlayer`).
     */
    const peekSegments =
      peekerIndexes.size === 0
        ? playerSegments
        : visionSegments(
            {
              ...map,
              walls: [...playerWalls, ...knownWalls.filter((w) => !isSecretRoomWall(w) && isPeekInterior(w)).flatMap(zoneCutWall)],
              floor: floorWithout(
                map.floor,
                new Set(map.floor.filter((f) => mostly(floorPieceSamples(f), (p) => inAnyRing(hiddenAreas, p) || inUnpeekedRoof(p))).map((f) => f.id)),
              ),
            },
            peekDoorIds,
          )
    vision = ownTokens.map((t, i) => sightFrom({ x: t.x, y: t.y }, peekerIndexes.has(i) ? peekSegments : playerSegments, radiusOf(t), darkness)).flat()
  }

  const isVisible = (point: RegionPoint): boolean => !hiddenByZone(point) && (inAnyRing(rings, point) || inBrushReveal(point))

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
    // As amostras que contam (`openSamples`): o pincel que deixa parte do
    // cômodo escondida não o faz "lembrado" — senão o corredor pintado
    // entregava o polígono do cômodo inteiro, e a planta de dentro com ele.
    const samples = openSamples(interiorSamples(room.points, room.points), { points: room.points, closed: true })
    if (samples.some(isVisible)) return true
    if (explored !== undefined && isShapeExplored(explored, samples)) return true
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
   * LUZ VISTA DE LONGE, fora da visão: marcada pelo mestre, fora de zona
   * oculta, de sala secreta, de teto fechado e de cômodo ainda não visto
   * (`inHiddenPlace`), e com LINHA DE VISÃO livre de uma ficha do jogador até
   * ela sobre os obstáculos da autoridade (porta secreta é parede; porta
   * fechada segura). O raio do jogador não conta.
   */
  const isSeenFromAfar = (light: Light): boolean => {
    if (light.vistaDeLonge !== true) return false
    const point = { x: light.x, y: light.y }
    if (hiddenByZone(point) || inHiddenPlace(point)) return false
    return ownTokens.some((t) => hasLineOfSight({ x: t.x, y: t.y }, point, authoritySegments))
  }

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

  // Planta estática: visível agora, já explorada ou dentro de cômodo lembrado. Nunca usar para entidade dinâmica.
  const isPointKnown = (point: RegionPoint): boolean => isVisible(point) || isPointExploredOpen(point) || inKnownComodo(point)
  const isShapeKnown = (points: readonly RegionPoint[], outline: ShapeOutline): boolean => {
    const open = openSamples(points, outline)
    // Cômodo lembrado: só pelas amostras que contam (`open`), como o resto.
    return isShapeVisible(open) || (explored !== undefined && isShapeExplored(explored, open)) || open.some(inKnownComodo)
  }

  /**
   * Planta estática: visível agora, ou lembrada (`recallItems`). Nunca usar
   * para entidade dinâmica. Sem memória da planta (`remembered` ausente), vale
   * a regra antiga: o explorado sozinho mostra o presente. Alimenta `plan`
   * (a memória DEPOIS deste recorte) — o que sai para a TELA continua pelas
   * regras de sempre (`isPointKnown`/`isShapeKnown`, cômodo incluso), abaixo.
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
    placeOk: (m) => !inHiddenPlace(markerCenter(m)) && !inConcealZone(markerCenter(m)),
    seenNow: (m) => isVisible(markerCenter(m)),
    unseenOk: (m) => exploredPoint(markerCenter(m)),
  })

  const lines = recallItems(map.lines, remembered?.lines, {
    allowed: () => true,
    shown: () => true,
    placeOk: (l) => !l.points.some(inHiddenPlace) && !l.points.some(inConcealZone),
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
      return mid !== null && !inConcealZone(mid) && !stairSamples(s).some(inHiddenPlace)
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
      if (samples.some(inHiddenPlace)) return false
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
      if (interiorRoofOf(w) !== undefined) return false
      // Porta com o meio escondido não sai nem pelas amostras dos lados.
      if (w.door !== null) return !inConcealZone(wallMidpoint(w))
      return !wallSamples(w).some(inConcealZone)
    },
    seenNow: (w) =>
      w.door !== null ? doorSamples(w, DOOR_VISION_PROBE).some(isVisible) : wallSideSamples(w, map.grid, DOOR_VISION_PROBE).some(isVisible),
    // Parede ou porta que o jogador nunca viu NÃO sai. A névoa cobria a planta
    // na tela, mas a rede entregava o nível inteiro (12.724 de 15.073 paredes
    // na a09) para quem abrisse o DevTools. Com memória da planta, só sai o
    // visto agora ou lembrado (`recallItems`); sem ela, a regra antiga: o
    // explorado mostra o presente. Sem explorado, só a visão atual conta.
    unseenOk: (w) => {
      if (memoryMode || explored === undefined) return false
      const probe = explored.cell * DOOR_EXPLORED_PROBE_CELLS
      if (w.door !== null) return doorSamples(w, probe).some(isPointExploredOpen)
      return [...wallSideSamples(w, map.grid, DOOR_VISION_PROBE), ...wallSideSamples(w, map.grid, probe)].some(isPointExploredOpen)
    },
  })

  /**
   * Porta dentro da visão sai com o estado real; explorada fora dela, com o
   * lembrado; senão não sai. O CADEADO nunca sai: a porta trancada chega como
   * porta fechada comum, e o jogador só descobre que está trancada tentando
   * abrir (a recusa `locked` do host). A lembrança (`seenDoors`) é gravada a
   * partir deste recorte, então também nasce sem cadeado.
   */
  const doorWallForPlayer = (w: Wall, door: DoorState): Wall[] => {
    // Porta com o meio escondido não sai nem pelas amostras dos lados.
    if (inConcealZone(wallMidpoint(w))) return []
    if (doorSamples(w, DOOR_VISION_PROBE).some(isVisible)) {
      visibleDoorIds.push(w.id)
      return [{ ...w, door: doorForPlayer(withoutLock(door)) }]
    }
    // Porta de cômodo lembrado sai mesmo sem célula explorada ao lado (o
    // cômodo acabou de ser visto): com o estado LEMBRADO, nunca o atual.
    // A lembrança do cômodo não vence sala secreta nem teto fechado lá dentro
    // (`inHiddenPlace`): porta solta, sem `regionId`, com o meio na sala
    // escondida é dela — a amostra do lado que cai no cômodo não a leva junto.
    const probe = (explored?.cell ?? map.grid) * DOOR_EXPLORED_PROBE_CELLS
    const comodoCounts = !inHiddenPlace(wallMidpoint(w))
    const known = (p: RegionPoint): boolean => isPointExploredOpen(p) || (comodoCounts && !inHiddenPlace(p) && inKnownComodo(p))
    if (!doorSamples(w, probe).some(known)) return []
    const rememberedDoor = seenDoors?.get(w.id)
    // A lembrada vem do mapa do mestre (`hostSession` guarda a porta vista inteira): passa pelo mesmo corte.
    return [{ ...w, door: doorForPlayer(rememberedDoor === undefined ? unseenDoor(door) : withoutLock(rememberedDoor)) }]
  }

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
    placeOk: (f) => !hiddenFloorIds.has(f.id),
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

  /** Ponto no cone de quem espia e fora do que a zona esconde. */
  const seenByPeek = (point: RegionPoint): boolean => inPeekCone(point) && !hiddenByZone(point)
  /**
   * Parede de dentro do prédio espiado, no pacote. Só o trecho que o cone VÊ:
   * a amostra na própria reta cai na borda do anel (o raio para nela), então a
   * pergunta é feita também a `DOOR_VISION_PROBE` px de cada lado. Porta de
   * dentro vista sai inteira, com o estado real — ela é pequena, e cortá-la
   * mudaria o id que o toque usa. Parede que nenhum raio de quem espia acerta
   * nem é amostrada (`peekTouchesWall`): prédio grande tem muita parede longe
   * do cone.
   */
  const peekedWallForPlayer = (w: Wall): Wall[] => {
    if (!isPeekInterior(w)) return []
    if (w.door !== null) {
      if (inConcealZone(wallMidpoint(w)) || !doorSamples(w, DOOR_VISION_PROBE).some((p) => seenByPeek(p) && isVisible(p))) return []
      visibleDoorIds.push(w.id)
      return [w]
    }
    if (!peekTouchesWall(w)) return []
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1)
    if (len === 0) return []
    const nx = (-(w.y2 - w.y1) / len) * DOOR_VISION_PROBE
    const ny = ((w.x2 - w.x1) / len) * DOOR_VISION_PROBE
    const runs = wallRunsWhere(
      w,
      (p) => !inConcealZone(p) && (seenByPeek(p) || seenByPeek({ x: p.x + nx, y: p.y + ny }) || seenByPeek({ x: p.x - nx, y: p.y - ny })),
    )
    // Vista de ponta a ponta: sai a própria parede, com o id de sempre.
    const whole = runs.length === 1 && runs[0].x1 === w.x1 && runs[0].y1 === w.y1 && runs[0].x2 === w.x2 && runs[0].y2 === w.y2
    return whole ? [w] : runs
  }
  /**
   * Algum raio de quem espia termina nesta parede, ou (parede que não segura a
   * luz) alguma amostra dela está no cone. Todo trecho visto de uma parede que
   * segura a luz tem vértice do anel em cima: é onde o raio para.
   */
  const peekTouchesWall = (w: Wall): boolean => {
    if (!w.blocksLight) return wallLineSamples(w).some(seenByPeek)
    return peekVision.some((ring) => ring.some((v) => distanceToWall(v, w) <= PEEK_WALL_HIT))
  }

  /** Preenchida no recorte das regiões abaixo: só entra Sala que saiu no pacote. */
  const occupiedRooms: string[] = []

  /**
   * Células do cone pelo vão: centro no olhar da ficha junto ao vão, fora de
   * zona que esconde e de sala secreta. É o recorte do chão do prédio que sai e
   * o buraco que a tela do jogador abre no telhado (`glimpses`).
   */
  const glimpseCells = cellsWhere(
    glimpses.map((g) => g.box),
    (p) => inGlimpse(p) && !hiddenByZone(p) && !inSecretRoom(p),
  )

  /**
   * Células (da grade do pincel) do chão do prédio espiado que o cone mostra:
   * o CENTRO dentro do prédio, fora de qualquer teto que ainda esconde, de sala
   * secreta e de zona oculta, e à vista. Varre só a caixa do prédio cortada
   * pela caixa do cone, e só com espiada.
   */
  function peekFloorCells(): string[] {
    if (peekRings.length === 0) return []
    const keys = new Set<string>()
    for (const roof of closedRoofs) {
      if (!peekedRoofIds.has(roof.id)) continue
      for (const ring of peekRings) {
        const minX = Math.max(roof.minX, ring.minX)
        const maxX = Math.min(roof.maxX, ring.maxX)
        const minY = Math.max(roof.minY, ring.minY)
        const maxY = Math.min(roof.maxY, ring.maxY)
        if (minX > maxX || minY > maxY) continue
        for (let row = Math.floor(minY / REVEAL_BRUSH_CELL); row <= Math.floor(maxY / REVEAL_BRUSH_CELL); row += 1) {
          for (let col = Math.floor(minX / REVEAL_BRUSH_CELL); col <= Math.floor(maxX / REVEAL_BRUSH_CELL); col += 1) {
            const center = { x: (col + 0.5) * REVEAL_BRUSH_CELL, y: (row + 0.5) * REVEAL_BRUSH_CELL }
            if (inRoof(roof, center) && !roofHides(center) && !inSecretRoom(center) && isVisible(center)) keys.add(cellKeyAt(center))
          }
        }
      }
    }
    return [...keys]
  }
  const peekCells = peekFloorCells()

  /**
   * Chão que o jogador recebe. Peça escondida (`hiddenFloorIds`) continua sem
   * sair, mas o pedaço dela sob o corredor pintado sai recortado nas células
   * pintadas (`floorInCells`): sem isso o corredor revelado aparecia como uma
   * faixa do fundo, sem o chão que o mestre vê ali. A ordem das peças se
   * mantém, então 'subtract' continua abrindo buraco no que vem antes. O chão
   * do prédio espiado sai do mesmo jeito, nas células que o cone mostra.
   */
  // O cone pelo vão e a espiada devolvem o chão do prédio do mesmo jeito: só nas células deles.
  const floorCells = peekCells.length === 0 && glimpseCells.length === 0 ? shownCells : [...new Set([...shownCells, ...peekCells, ...glimpseCells])]
  const playerFloor = map.floor.flatMap((f): FloorPiece[] => {
    if (f.hidden) return []
    if (!hiddenFloorIds.has(f.id)) return [f]
    const clipped = floorCells.length > 0 ? floorInCells(f, floorCells) : null
    return clipped === null ? [] : [clipped]
  })

  /**
   * Parede sem porta com algum trecho DENTRO da zona (`touchesZone`, amostrada
   * ao longo dela): sai recortada nos trechos que a zona NÃO esconde — fora
   * dela, ou no pedaço pintado (`wallRunsWhere` com `!hiddenByZone`). Mesma
   * regra de `zoneCutWall`: inteira fora da zona, só no pintado dentro dela.
   * Recortar só no pintado (`inBrushReveal`, que exige `inZoneRing`) apagava
   * também o trecho de FORA da zona: a parede lisa que só atravessa a zona
   * sumia inteira para o jogador, mas seguia na visão como parede invisível.
   * Amostra pintada não vale como "sem trecho escondido" para sair inteira:
   * o recorte é amostra a amostra, então o trecho escondido nunca vai junto.
   */
  const wallForPlayer = (w: Wall): Wall[] => {
    if (!touchesZone(w)) return [w]
    return wallRunsWhere(w, (p) => !hiddenByZone(p))
  }

  /**
   * Região que o jogador nunca recebe, ANTES de perguntar se ele a conhece: é
   * o mestre (ou o teto) que esconde, não a névoa.
   * - secreta, oculta no editor, ou sub-sala de uma secreta/oculta;
   * - interior de prédio de teto fechado (`underRoofIds`, `swallowedByClosedRoof`:
   *   cômodo órfão, Área sem `parentId`, prédio dentro de prédio);
   * - sala de teto que a geometria não sabe julgar (`brokenRoofIds`): não vira silhueta, some.
   */
  const regionHiddenByMaster = (r: Region): boolean =>
    r.hidden === true ||
    isClosedSecret(r) ||
    hiddenByAncestorIds.has(r.id) ||
    underRoofIds.has(r.id) ||
    brokenRoofIds.has(r.id) ||
    swallowedByClosedRoof(r)

  // ZONA DE PERIGO: o objeto do mestre (ids de zona e de sala, perigo onde o
  // jogador não está) NUNCA vai no mapa do recorte. O que ele pode ver sai
  // separado, em `hazards`, montado mais abaixo.
  // GATILHO DE ÁREA: mesma regra — o objeto do mestre fica aqui; o que foi
  // revelado sai separado, em `gatilhos`.
  // TEXTO DE CHEGADA: fica aqui também. No snapshot, quem já está na cena o
  // receberia de novo a cada broadcast (e a tela da mesa o mostraria a todos);
  // ele viaja só no `scene.changed` de quem chega (`net/hostSession.ts`).
  // MAPA POR ANDARES: o nome do prédio é do mestre; o rótulo do andar viaja à
  // parte (`snapshot.andares`), só quando o host decide que ele vale.
  // RELÓGIO DA CAMPANHA: a marca "externa" também é do mestre; o jogador
  // recebe só se a cena dele está escura, à parte (`clockForPlayer`).
  // NÍVEL DE ALERTA da cena: é do mestre, e sai junto — "caçada" no pacote
  // contaria ao jogador o que a cena já sabe dele.
  const {
    hazards: _masterHazards,
    gatilhos: _masterTriggers,
    textoChegada: _arrivalText,
    andar: _masterFloor,
    externa: _masterOutdoor,
    alerta: _masterAlert,
    ...mapWithoutHazards
  } = map

  // Token do próprio jogador sai sempre, mesmo secreto ou em zona oculta: é ele quem o move.
  // Ficha secreta revelada a este jogador ("Revelar para…") segue a regra da
  // ficha comum: só com visão, e nunca dentro de teto fechado ou zona.
  const playerTokens = layerTokens.filter(
    (t) => !t.hidden && (owned.has(t.id) || (!secretFromPlayer(t) && !roofHides({ x: t.x, y: t.y }) && isVisible({ x: t.x, y: t.y }))),
  )
  /**
   * OLHOS DO GUARDA. A marca (?, !) conta só as fichas de jogador (`watchTargets`,
   * ou as do próprio grupo) que ESTE recorte entrega: colega na névoa, "Oculto
   * para jogadores", em zona oculta ou sob teto fechado não acende marca — a
   * marca contaria que há alguém ali, e é exatamente isso que a névoa e o mestre
   * esconderam. Só a marca sai, e só na ficha do guarda que já está no recorte:
   * quem foi visto, e o cone (`vigia`), ficam no mestre (`tokenWatchForPlayer`).
   * Sem guarda no recorte, nada é calculado.
   */
  // Para o pino PRESO a uma ficha (ver `pins`, abaixo): as fichas da cena e as
  // que este recorte entrega.
  const mapTokenIds = new Set(map.tokens.map((t) => t.id))
  const deliveredTokenIds = new Set(playerTokens.map((t) => t.id))
  const watchable = watchTargets ?? owned
  const seenTargets = new Set(playerTokens.filter((t) => watchable.has(t.id)).map((t) => t.id))
  const alerts =
    seenTargets.size > 0 && playerTokens.some((t) => tokenWatchOf(t) !== null)
      ? guardAlerts(map, seenTargets, ownTokens.length > 0 ? authoritySegments : undefined)
      : new Map<string, WatchAlert>()

  const sentTokenIds = new Set(playerTokens.map((t) => t.id))
  // Ficha que o MESTRE esconde deste jogador (oculta, secreta ou na camada
  // Fichas escondida). A tocha presa nela fica no centro dela e anda com ela:
  // enviar a luz, mesmo sem o vínculo, entregaria a posição e o trajeto do NPC.
  const layerTokenIds = new Set(layerTokens.map((t) => t.id))
  const masterHiddenTokenIds = new Set(
    map.tokens.filter((t) => !sentTokenIds.has(t.id) && (t.hidden || secretFromPlayer(t) || !layerTokenIds.has(t.id))).map((t) => t.id),
  )
  const playerStairs = visibleStairs(map.stairs, hiddenLayers).filter((s) => {
    const first = s.segments[0]
    if (s.hidden || secretFromPlayer(s) || first === undefined || stairSamples(s).some(inHiddenPlace)) return false
    return isPointKnown({ x: (first.x1 + first.x2) / 2, y: (first.y1 + first.y2) / 2 })
  })
  // ESCADA QUE LEVA A OUTRO ANDAR: o pino dela vai SÓ junto com a escada — a
  // mesma regra que decide a escada decide o pino, e nunca a do ponto do pino.
  // Escada secreta, em sala oculta, no escuro ou apagada: o pino não sai.
  const playerStairIds = new Set(playerStairs.map((s) => s.id))
  // Tocha acesa dentro do prédio de teto fechado não sai: o halo dela
  // desenharia o interior na tela do jogador que está lá fora.
  // Tocha presa na ficha: o vínculo só vai se a ficha também vai; senão o
  // id de ficha que a névoa, a zona oculta ou o mestre escondem sairia pela rede.
  // Presa numa ficha que o mestre esconde, a luz nem sai (`masterHiddenTokenIds`).
  const lightsInPlay = visibleLights(map.lights, hiddenLayers)
    .filter((l) => !l.hidden && !inClosedRoof({ x: l.x, y: l.y }))
    .filter((l) => l.attachedTokenId === undefined || !masterHiddenTokenIds.has(l.attachedTokenId))
  const lightForPlayer = (l: Light): Light => (l.attachedTokenId === undefined || sentTokenIds.has(l.attachedTokenId) ? l : withoutAttachment(l))
  const playerLights = lightsInPlay.filter((l) => isVisible({ x: l.x, y: l.y })).map(lightForPlayer)
  // LUZ VISTA DE LONGE: fora da visão, sai só o ponto (`farLightPoint`) — e
  // só no pacote; o vulto (`isShadow`) continua medido pelas luzes da visão.
  const sentLights = lightsInPlay.flatMap((l): Light[] => {
    if (isVisible({ x: l.x, y: l.y })) return [lightForPlayer(l)]
    return isSeenFromAfar(l) ? [farLightPoint(l)] : []
  })
  // VULTO NO ESCURO: só no recorte de UM jogador (a tela da mesa não passa
  // `playerId`). "Outro jogador" = as fichas de jogador (`watchTargets`) que
  // não são deste recorte.
  const otherPlayerTokenIds = new Set(playerId === undefined ? [] : [...(watchTargets ?? [])].filter((id) => !owned.has(id)))
  const isShadow = shadowOfOtherPlayer(otherPlayerTokenIds, ownTokens, playerLights, radiusOf)

  // Nome: o dono lê o real; os outros, o "Nome para os jogadores" (o de trabalho do mestre não sai).
  // MOCHILA: só a da PRÓPRIA ficha sai. O que o colega carrega é dele e do
  // mestre — ver a ficha dele no mapa não conta o que tem no bolso.
  // Marca de companheiro DEPOIS do filtro: ficha que não sai não leva o nome do dono a lugar nenhum.
  // Ficha disfarçada pelo mestre (outro nome ou nenhum) também não: a marca diria quem está por trás.
  // Sem `companionOf` (tela da mesa), nenhuma sai marcada — e `companion` do mapa do mestre nunca passa.
  // Vulto também não: a marca poria o nome do dono no rótulo que o vulto tirou.
  const tokens = playerTokens
    .map((t) => {
      const seen = withoutMasterMarks(withoutNpcMark(tokenForPlayer(tokenAsSeenByPlayer(owned.has(t.id) ? t : withoutBackpack(t), owned.has(t.id)))))
      if (isShadow(t)) return withCompanionMark(asShadow(seen), undefined)
      const mark = tokenPublicNameMode(t.publicName) === 'same' ? companionOf?.get(t.id) : undefined
      return withCompanionMark(seen, mark)
    })
    .map(tokenHealthForPlayer)
    .map((t) => tokenWatchForPlayer(t, alerts.get(t.id) ?? null))
    // ROTA DE PATRULHA: os pontos dizem por onde o NPC vai passar — é do
    // mestre. O jogador vê o NPC andar só porque a ficha está na visão dele.
    .map(tokenPatrolForPlayer)

  const filtered: MapData = {
    ...mapWithoutHazards,
    // O nome do mapa é o nome da CENA (a aventura cria a cena com
    // `createEmptyMap(id, nomeDaCena, …)`): o jogador descobre onde está pelo
    // que vê, nunca pelo nome que o mestre deu. Nada na tela dele lê este campo.
    name: '',
    // Metadado do mestre: vínculo de cenário, dono e áreas reveladas não são do jogador.
    scenarioLink: null,
    ownerId: null,
    // "Visão nesta cena" é regra do mestre: o jogador recebe o círculo já
    // cortado (`vision`), nunca o número que o desenhou.
    visionCells: undefined,
    // "Cena escura" também: o escuro já vem aplicado na visão e no que sai.
    dark: undefined,
    fog: { mode: map.fog.mode, revealed: [] },
    background: map.background.type === 'image' ? { type: 'image', src: '' } : map.background,
    tokens,
    markers: map.markers.filter((m) => !inHiddenPlace({ x: m.cx, y: m.cy }) && isPointKnown({ x: m.cx, y: m.cy })),
    lines: map.lines.filter((l) => !l.points.some(inHiddenPlace) && !l.points.some(inConcealZone) && isShapeKnown(l.points, { points: l.points, closed: l.closed })),
    // Luz: ver `playerLights`/`sentLights` (teto fechado, tocha presa na ficha, vista de longe).
    lights: sentLights,
    stairs: playerStairs,
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
      return isShapeKnown(samples, drawingOutline(d))
    }),
    regions: visibleRegions(map.regions, hiddenLayers)
      .filter((r) => {
        if (regionHiddenByMaster(r)) return false
        // Teto fechado: o "conhecido" é medido NO CONTORNO, nunca no interior
        // — que está bloqueado justamente por causa do teto. Ver `contourSamples`.
        // O contorno afastado é o que se mede também contra o pincel: o
        // interior do teto fechado continua escondido mesmo pintado (`brushedRoom`).
        if (closedRoofIds.has(r.id)) {
          const contour = contourSamples(r.points)
          return isShapeKnown(contour, { points: contour.length > 0 ? [...contour, contour[0]] : contour, closed: false })
        }
        // Cômodo: o não visto nem aparece; o lembrado sai inteiro, visto ou não agora.
        if (unseenComodoIds.has(r.id)) return false
        if (knownComodoIds.has(r.id)) return true
        return isShapeKnown(interiorSamples(r.points, r.points), { points: r.points, closed: true })
      })
      .map(withoutSecretMark)
      .map((r) => {
        if (r.room === undefined) return r
        const roofClosed = closedRoofIds.has(r.id)
        // Sala com a maioria do interior dentro de zona ativa: o nome é do que a zona esconde.
        const inZone = zones.length > 0 && mostly(interiorSamples(r.points, r.points), inConcealZone)
        // Teto fechado esconde o nome junto: o rótulo é desenhado DENTRO do
        // polígono e é anotação do mestre sobre o que tem lá dentro.
        // Nome que o mestre escondeu DEPOIS que o jogador viu também some da memória.
        const nameHidden =
          r.room.nameHiddenFromPlayers || currentRegions.get(r.id)?.room?.nameHiddenFromPlayers === true || roofClosed || inZone
        const hasTexts = r.room.textoAoEntrar !== undefined || r.room.notaDoMestre !== undefined
        if (
          !nameHidden &&
          !roofClosed &&
          r.room.roof === undefined &&
          r.room.comodo === undefined &&
          !hasTexts &&
          r.room.dark === undefined &&
          r.room.faccao === undefined &&
          r.room.raioDeVisao === undefined
        )
          return r
        // TEXTO DA SALA: a nota do mestre NUNCA sai. O texto de entrada só sai
        // para quem está dentro agora ou já esteve (`enteredRooms`), e nunca de
        // Sala sob teto fechado ou em zona oculta — o texto fala do que tem lá dentro.
        // `comodo` é configuração do mestre: a tela do jogador não precisa dele.
        // FACÇÃO: quem manda aqui é anotação do mestre e nunca sai, nem para quem está dentro.
        // O "Raio de visão aqui" também fica: já está aplicado na visão enviada.
        const { textoAoEntrar, notaDoMestre: _nota, comodo: _comodo, faccao: _faccao, raioDeVisao: _raio, ...room } = r.room
        const readable = !roofClosed && !inZone && hasEnterText(r.room)
        const occupied = readable && ownTokens.some((t) => isStrictlyInsideReadableRoom(r.points, { x: t.x, y: t.y }))
        if (occupied) occupiedRooms.push(r.id)
        const showText = readable && textoAoEntrar !== undefined && (occupied || enteredRooms?.has(r.id) === true)
        // `roof` atravessa SÓ quando o teto está fechado PARA ESTE JOGADOR: é o
        // sinal de "pinte a silhueta" (`player/PlayerView.tsx`). Com o teto
        // aberto o campo some e a Sala volta a desenhar como sempre desenhou.
        // "Sala escura" é regra do mestre: o jogador recebe a visão já cortada, nunca o campo.
        return {
          ...r,
          room: {
            ...room,
            name: nameHidden ? '' : r.room.name,
            roof: roofClosed ? true : undefined,
            dark: undefined,
            ...(showText ? { textoAoEntrar: clampRoomText(textoAoEntrar) } : {}),
          },
        }
      }),
    // `knownWalls` antes da camada: a estante disfarçada é PAREDE, e segue a
    // camada Paredes (com Portas escondida ela não pode virar vão). A porta
    // secreta já vem emendada nas vizinhas (`mergeSecretDoorSeams` em `knownWalls`).
    walls: visibleWalls(knownWalls, hiddenLayers).flatMap((w) => {
      if (w.hidden) return []
      if (w.regionId !== undefined && secretRoomIds.has(w.regionId)) return []
      // Mobília de prédio de teto fechado: o cone pelo vão alcança, OU quem
      // espia pela porta aberta alcança (`peekedWallForPlayer`) — os dois cones
      // são independentes, e a parede sai pelo que a mostrar.
      const roof = interiorRoofOf(w)
      const pieces = roof === undefined ? [w] : glimpsedInteriorWall(w, roof)
      return [
        ...pieces.flatMap((piece) => (piece.door !== null ? doorWallForPlayer(piece, piece.door) : wallForPlayer(piece))),
        ...peekedWallForPlayer(w),
      ]
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
    // SÓ IDA: a marca de cada saída vem do host (`oneWayExits`), e só no pino que sai.
    // PRESO À FICHA: o pino preso anda com a ficha, então conta onde ela está
    // agora. Ele só sai quando a ficha dele sai neste recorte (a visão dela,
    // não a memória do explorado) — senão o navio na névoa se revelaria pela
    // prancha. Ficha que não está mais na cena deixa o pino parado, e aí
    // vale a regra de sempre. `presoA` em si nunca sai (`pinForPlayer`).
    // MARCO ("todos veem") troca SÓ a pergunta da névoa: chega sem estar à
    // vista nem explorado, e nada em volta vem junto. Tudo o que o mestre
    // esconde (as regras acima, sala secreta, teto, zona oculta) continua valendo.
    // LER SÓ DE PERTO: o texto e a imagem só vão com uma ficha a N casas
    // enxergando o pino (`canReadPin`); longe, o pino sai marcado `longe` e
    // vazio. É o que segura a carta até contra o "Revelar planta", que marca
    // o mapa inteiro como explorado.
    // Marco que chegou SÓ por ser marco (nem à vista, nem explorado) sai com
    // `soMarco`: ver de longe não é estar lá, e a passagem por ele não vale
    // (`validTravel` lê a marca neste mesmo recorte).
    pins: (map.pins ?? []).flatMap((p) => {
      if (isArrivalOnly(p)) return []
      if (!pinReachesPlayer(pinAudiences, p.id, playerId)) return []
      // Pino de escada: a escada manda (ver `playerStairIds`); o segredo do próprio pino também.
      // E só a escada que LEVA a algum lugar: o par que o guardião desligou (a de baixo foi
      // desligada, apagada ou religada a outro andar) fica sem destino e não sai — senão o
      // toque abriria "Descer por aqui?" para o host recusar. A escada continua desenhada.
      if (p.escadaId !== undefined) {
        if (!playerStairIds.has(p.escadaId) || p.hidden || p.secret || travelExitsOf(p).length === 0) return []
        return [pinForPlayer(p, ownTokens, map.grid, true, true, oneWayExits?.get(p.id))]
      }
      if (p.hidden || p.secret || hiddenLayers.includes('anotacoes')) return []
      if (p.presoA !== undefined && mapTokenIds.has(p.presoA) && !deliveredTokenIds.has(p.presoA)) return []
      const point = { x: p.x, y: p.y }
      if (inHiddenPlace(point)) return []
      const known = isPointKnown(point)
      const reached = p.marco === true ? !hiddenByZone(point) : known
      if (!reached) return []
      return [pinForPlayer(p, ownTokens, map.grid, canReadPin(p, pinReaders, map.grid, hiddenByZone), known, oneWayExits?.get(p.id))]
    }),
    // BILHETE NO LUGAR: quem passar ali depois vê. Sai na visão atual; no
    // explorado, só a marca que ele JÁ VIU (`seenMarks`, como `seenDoors`) —
    // a marca nasce no centro da ficha de quem a deixa, então marca nova no
    // escuro lembrado seria a posição atual do colega, que a névoa esconde.
    // Zona oculta ativa, sala secreta e teto fechado escondem a marca como
    // escondem o chão (cômodo ainda não visto também, `inHiddenPlace`). Sai
    // SEMPRE pela lista do que vai (`marcaParaJogador`): autor e hora são do
    // mestre. Mapa sem o campo continua sem o campo.
    ...(map.marcas === undefined
      ? {}
      : {
          marcas: map.marcas
            .filter((m) => {
              const point = { x: m.x, y: m.y }
              if (inHiddenPlace(point)) return false
              return isVisible(point) || (seenMarks?.has(m.id) === true && isPointExploredOpen(point))
            })
            .map(marcaParaJogador),
        }),
    // Metadado do mestre: nome, estado e células do pincel das zonas não saem; só `concealed` (geometria).
    concealZones: [],
  }

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
  /**
   * O cone pelo vão também entra na visão enviada, pelo mesmo motivo: ela é
   * calculada sem o chão do prédio (a sombra dele desenharia o prédio), e a
   * borda do chão da rua corta a visão bem na janela. Sem isto a névoa preta
   * tampava o buraco que a tela do jogador abre no telhado. Não vira memória:
   * `forgetInside(view.roofs)` apaga o que fica dentro do prédio.
   */
  const glimpseRects = cellRunRects(new Set(glimpseCells))
  const extraSight = [...sightRects, ...glimpseRects]
  const sentVision = extraSight.length > 0 ? [...vision, ...extraSight] : vision

  /**
   * ZONA DE PERIGO. Primeiro, a sala tomada que o MESTRE esconde fica de fora
   * de tudo — desenho e aviso:
   * - Sala escondida por ele (`regionHiddenByMaster`) ou de camada escondida;
   * - silhueta de teto fechado (o fogo de dentro não se vê da rua);
   * - sala em que uma zona oculta ativa encosta (o perigo é da sala inteira, e
   *   mostrá-lo diria o que acontece na parte escondida).
   *
   * Do resto, o DESENHO (`hazards`) sai quando a própria Sala saiu no recorte e
   * alguma amostra do interior está na visão AGORA — regra das entidades que
   * se movem. E `hazardsHere` lista o perigo das salas onde está uma ficha do
   * jogador, visível ou não: na fumaça a visão encolhe e pode não alcançar
   * amostra nenhuma de um salão, mas quem está dentro sabe que está. Esse
   * campo é do host (decide o aviso) e não vai pela rede.
   */
  const layerRegionIds = new Set(visibleRegions(map.regions, hiddenLayers).map((r) => r.id))
  const sentRooms = new Set(filtered.regions.map((r) => r.id))
  const touchesConcealZone = (points: RegionPoint[]): boolean =>
    zones.length > 0 &&
    (interiorSamples(points, points).some(inConcealZone) || concealed.some((zone) => zone.some((p) => pointInRing(p, points))))
  const hazardHiddenByMaster = (room: Region): boolean =>
    !layerRegionIds.has(room.id) || regionHiddenByMaster(room) || closedRoofIds.has(room.id) || touchesConcealZone(room.points)
  const hazards: PlayerHazard[] = []
  const hazardsHere: { tokenId: string; kind: HazardKind }[] = []
  for (const hazard of hazardsOf(map)) {
    for (const room of hazardRooms(map, hazard)) {
      if (hazardHiddenByMaster(room)) continue
      for (const t of ownTokens) {
        if (pointInRing({ x: t.x, y: t.y }, room.points)) hazardsHere.push({ tokenId: t.id, kind: hazard.kind })
      }
      if (!sentRooms.has(room.id) || !isShapeVisible(interiorSamples(room.points, room.points))) continue
      hazards.push({ kind: hazard.kind, points: room.points.map((p) => ({ x: p.x, y: p.y })) })
    }
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

  /**
   * GATILHO DE ÁREA. Não revelado não sai de jeito nenhum. Revelado sai só
   * com a MESMA exclusão do perigo (`hazardHiddenByMaster`: sala escondida pelo
   * mestre ou de camada escondida, silhueta de teto fechado, sala tocada por
   * zona oculta) e só se a região saiu neste recorte — o jogador já conhece a
   * área, então a marca não conta nada do que a névoa esconde.
   */
  const gatilhos: PlayerAreaTrigger[] = triggersWithRegions(map)
    .filter(({ trigger, region }) => trigger.revealed && sentRooms.has(region.id) && !hazardHiddenByMaster(region))
    .map(({ trigger, region }) => ({ kind: trigger.kind, points: region.points.map((p) => ({ x: p.x, y: p.y })) }))
  /**
   * VER PELA PORTA ABERTA — a espiada deste jogador, para `PlayerMapView.peek`.
   * Só o prédio que saiu no pacote entra: o id de um prédio engolido por outro
   * teto fechado não atravessa. Sem anel de quem espia (alcance zero), nada
   * saiu pelo cone: não há o que recortar.
   */
  const peekRoofIds = peekRings.length === 0 ? [] : [...peekedRoofIds].filter((id) => sentRooms.has(id))
  const peek: RoofPeek | null =
    peekRoofIds.length === 0 ? null : { roofIds: peekRoofIds, vision: [...peekerIndexes].sort((a, b) => a - b).map((i) => vision[i]) }
  /**
   * A MEMÓRIA DA PLANTA depois deste recorte (`PlayerMapView.plan`): cada tipo
   * de item passa pelo próprio `recallItems` (acima), que decide sozinho o que
   * entra, o que sai e o que a lembrança esquece. Separado do `filtered` de
   * cima de propósito: o que vai para a TELA agora segue as regras ricas de
   * sempre (cômodo, cadeado, pino com "quem vê"/marco/escada); o `plan` é só o
   * que o chamador guarda para alimentar o próximo recorte como `remembered`.
   */
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
  return {
    map: filtered,
    vision: sentVision,
    visibleDoorIds,
    concealed,
    blocked,
    roofs,
    occupiedRooms,
    occupiedSecretRooms,
    peek,
    hazards,
    hazardsHere,
    gatilhos,
    rememberedRooms,
    unseenInsideRemembered,
    glimpses: glimpseRects,
    plan,
  }
}

/**
 * CARAVANA NO MAPA-MUNDI (`lib/caravan.ts`). O grupo é UMA ficha só:
 * - a visão sai do ponto da caravana (as fichas do grupo são postas nele antes
 *   do recorte, então ficha esquecida longe dali não enxerga nada por conta própria);
 * - todas as fichas de jogador que o recorte entregaria viram a caravana — a
 *   própria inclusive. Nome, foto, vida, condições, mochila e id de cada uma
 *   ficam no mestre; o jogador não arrasta nada aqui, quem move é o mestre.
 * Todo o resto (névoa, zona oculta, sala secreta, nome da cena) é a regra de sempre.
 */
function filterWorldMapForGroup(
  map: MapData,
  viewers: readonly GroupViewer[],
  explored?: Exploration,
  seenDoors?: ReadonlyMap<string, DoorState>,
  watchTargets?: ReadonlySet<string>,
  only: PlayerOnlyView = {},
): PlayerMapView {
  const { worldMap: _worldMap, ...plain } = map
  const party = watchTargets ?? new Set(viewers.flatMap((viewer) => viewer.tokenIds))
  const members = caravanMembers(map, party)
  const at = caravanPoint(members)
  // `only` segue adiante: "QUEM VÊ" de cada pino e o resto do que é só deste
  // jogador valem no mapa-mundi como em qualquer cena.
  if (at === null) {
    const view = filterMapForGroup(plain, viewers, explored, seenDoors, watchTargets, only)
    return { ...view, map: { ...view.map, worldMap: true } }
  }
  const memberIds = new Set(members.map((t) => t.id))
  const stacked: MapData = { ...plain, tokens: map.tokens.map((t) => (memberIds.has(t.id) ? { ...t, x: at.x, y: at.y } : t)) }
  const view = filterMapForGroup(stacked, viewers, explored, seenDoors, watchTargets, only)
  const caravanSent = view.map.tokens.some((t) => memberIds.has(t.id))
  const others = view.map.tokens.filter((t) => !memberIds.has(t.id))
  const tokens = caravanSent ? [caravanTokenFor(members, at), ...others] : others
  return { ...view, map: { ...view.map, worldMap: true, tokens } }
}

/** MAPA POR ANDARES: o que o jogador guarda de um andar onde NÃO está agora. */
export interface FloorMemoryView {
  map: MapData
  /** Zonas ocultas ativas do andar (só a geometria), para pintar preto por cima. */
  concealed: RegionPoint[][]
}

/**
 * MAPA POR ANDARES — o recorte de um andar onde o jogador já esteve e não está
 * agora: o mesmo recorte de sempre com um grupo VAZIO. Sem ninguém olhando, não
 * há visão; sobra só a planta estática que `explored` e `seenDoors` (a memória
 * DELE, somente leitura) já conhecem. Toda ficha — dele, de colega, do mestre —
 * fica de fora: ficha exige visão, e ninguém dele está lá. Teto de prédio fica
 * fechado, zona oculta e sala secreta continuam escondidas. `only` leva o
 * "QUEM VÊ" dos pinos (`pinAudiences` + `playerId`): pino escolhido só para
 * outro jogador não sai nem pela memória do andar.
 */
export function filterFloorMemory(
  map: MapData,
  explored: Exploration,
  seenDoors: ReadonlyMap<string, DoorState>,
  only: PlayerOnlyView = {},
): FloorMemoryView {
  const view = filterMapForGroup(map, [], explored, seenDoors, undefined, only)
  return { map: view.map, concealed: view.concealed }
}

/**
 * MINHAS FICHAS EM OUTRAS CENAS — uma ficha do jogador numa cena que ele não
 * está vendo agora. Vai pela rede: só o id, o nome que o DONO lê e o nome da
 * Sala onde ela está ('' = sem Sala, ou Sala cujo nome o jogador não pode
 * ler). Nunca a cena (nome ou id) nem a posição.
 */
export interface OwnTokenElsewhere {
  tokenId: string
  name: string
  room: string
}

/**
 * As fichas do jogador no RECORTE `view` de uma cena, com a Sala de cada uma.
 * Lê só o que já saiu de `filterMapForPlayer`: ficha que o mestre escondeu
 * (oculta, camada Fichas escondida) não está no recorte e não entra; Sala
 * secreta, oculta, sob teto fechado ou ainda desconhecida não saiu nas regiões,
 * e nome escondido chega vazio — então nada aqui diz mais do que o jogador
 * veria se olhasse por esta ficha. Sala dentro de Sala: vale a menor.
 */
export function ownTokensInView(view: PlayerMapView, ownedIds: readonly string[]): OwnTokenElsewhere[] {
  const owned = new Set(ownedIds)
  const namedRooms = view.map.regions.flatMap((r) => (r.room !== undefined && r.room.name !== '' && isUsablePolygon(r.points) ? [{ points: r.points, name: r.room.name }] : []))
  return view.map.tokens
    .filter((t) => owned.has(t.id))
    .map((t) => {
      const point = { x: t.x, y: t.y }
      let room = ''
      let roomArea = Number.POSITIVE_INFINITY
      for (const r of namedRooms) {
        if (!pointInPolygonInclusive(point, r.points) || pointOnPolygonBorder(point, r.points)) continue
        const area = Math.abs(signedArea(r.points))
        if (area >= roomArea) continue
        roomArea = area
        room = r.name
      }
      return { tokenId: t.id, name: t.name, room }
    })
}

/** O host vê o mapa inteiro, inclusive itens ocultos. */
export function filterMapForHost(map: MapData): MapData {
  return map
}

/**
 * INICIATIVA — de quem é a vez, como o jogador pode saber: o id da ficha da
 * vez SÓ quando ela está no recorte que ele já recebe (`view`, a saída de
 * `filterMapForPlayer`) e a vez é deste mapa. Ficha secreta, oculta, atrás da
 * parede, fora da visão ou de outra cena não está no recorte: `null`, e o
 * campo nem sai — "é a vez de alguém que você não vê" já diria que há alguém.
 */
export function turnForPlayer(view: MapData, turn: TurnRef | null): string | null {
  if (turn === null || turn.mapId !== view.id) return null
  return view.tokens.some((t) => t.id === turn.tokenId) ? turn.tokenId : null
}

/**
 * RELÓGIO DA CAMPANHA como o jogador pode recebê-lo: o PERÍODO (manhã, tarde,
 * noite), nunca a hora exata, e `escuro` só quando a cena DELE (`map`, a cena
 * da ficha dele) é externa e é noite. Sem relógio no mestre: `null`, e o campo
 * nem sai.
 */
export function clockForPlayer(hour: number | null, map: Pick<MapData, 'externa'>): PlayerClock | null {
  if (hour === null) return null
  const periodo = periodOfHour(hour)
  return isDarkAt(hour, map) ? { periodo, escuro: true } : { periodo }
}

/** ALARME PARA VÁRIAS CENAS como o host o guarda: o texto e as cenas escolhidas pelo mestre. */
export interface SceneAlarm {
  id: string
  text: string
  sceneIds: readonly string[]
}

/**
 * O alarme como o jogador pode recebê-lo: só quem está AGORA numa das cenas
 * escolhidas (`sceneId` é a cena da ficha dele), e só `id` e `text` — nunca a
 * lista de cenas, que diria ao jogador que as outras existem. Sem cena
 * (`null`), outra cena ou sem alarme: `null`, e nada sai.
 */
export function alarmForPlayer(alarm: SceneAlarm | null, sceneId: string | null): { id: string; text: string } | null {
  if (alarm === null || sceneId === null || !alarm.sceneIds.includes(sceneId)) return null
  return { id: alarm.id, text: alarm.text }
}

/**
 * Folga de meia casa no alcance de "ler a N casas": a ficha na casa vizinha em
 * DIAGONAL (√2 ≈ 1,41 casa do pino) lê a 1 casa; a duas casas em linha reta, não.
 */
const PIN_READ_SLACK_CELLS = 0.5

/** Uma ficha do jogador com o anel de visão DELA (da autoridade, não o enviado). */
interface PinReader {
  readonly x: number
  readonly y: number
  readonly sight: readonly BoxedRing[]
}

/**
 * O jogador pode ler este pino agora? Pino sem `lerDePerto` (inclusive valor
 * fora da forma) lê de onde vier, como sempre. Com ele, precisa de UMA ficha
 * própria que esteja a até N casas do pino E o enxergue agora pelo próprio
 * anel (fora de zona oculta) — explorado não basta
 * (o "Revelar planta" marca tudo) e parede no meio não deixa ler. Grade
 * inválida nunca libera: na dúvida, o texto fica no host.
 */
function canReadPin(pin: Pin, readers: readonly PinReader[], grid: number, hiddenByZone: (point: RegionPoint) => boolean): boolean {
  if (!isPinReadDistance(pin.lerDePerto)) return true
  if (!Number.isFinite(grid) || grid <= 0) return false
  const point = { x: pin.x, y: pin.y }
  if (hiddenByZone(point)) return false
  const reach = (pin.lerDePerto + PIN_READ_SLACK_CELLS) * grid
  // A MESMA ficha: perto E enxergando pelo anel dela. Com o anel somado de
  // todas, a ficha colada atrás da parede "leria" pelo olho do cão a 5 casas.
  // O pincel da zona não conta: ele mostra a casa, não põe o olho da ficha lá.
  return readers.some((r) => Math.hypot(r.x - pin.x, r.y - pin.y) <= reach && inAnyRing(r.sight, point))
}

/**
 * O pino como o jogador pode recebê-lo. Sai SEMPRE numa cópia:
 * - `image` só em data URL (`isPlayerSafePinImage`) — nunca um caminho do
 *   disco do mestre;
 * - `destino` (pino de viagem) NUNCA: o id da cena de destino e o do pino par
 *   diriam ao jogador que a outra cena existe, antes de o mestre deixar passar.
 * - `passagem` VAI, de propósito: o cartão do jogador precisa saber se oferece
 *   "Passar", "Pedir para passar" ou "Está trancada". O modo diz como a porta
 *   se comporta, não para onde ela leva. O `mudo` do trancado vai pelo mesmo
 *   motivo (oferecer ou não "Pedir ao mestre").
 * - `motivo` VAI só com a passagem trancada (`blockReasonOf`): "Desabou" diz
 *   o que a porta é agora, e nada da outra cena.
 * - `semVolta` (pino de uma saída) e `escolhas[].soIda` (encruzilhada) VÃO
 *   só quando o host marcou a saída em `oneWay`: dizem que não há volta por
 *   ali, nunca para onde se vai.
 * - `abreCom` NUNCA (CHAVE ABRE PORTA): o jogador não descobre que pinos uma
 *   chave abre. Em troca, `chave` — o nome do item que ELE já carrega — sai só
 *   no pino trancado que uma ficha dele, encostada, abre (`ownTokens`: as
 *   fichas dele, com a mochila do mapa do mestre).
 * - `presoA` NUNCA: o id da ficha que o pino acompanha é do mestre. O jogador
 *   vê o pino andar (x/y já chegam no lugar novo), não a ligação.
 * - `portaLigada` (alavanca) NUNCA: a porta ligada pode estar em outra sala,
 *   atrás da névoa, e o id dela diria que ela existe. O jogador recebe o tipo
 *   `alavanca` (o cartão oferece "Puxar") e vê a porta mexer só se ela estiver
 *   no recorte dele.
 * - `soMarco` quando `known` é falso: o pino só chegou por ser marco, e a
 *   passagem por ele não vale daqui.
 * - `nome` NUNCA: é o nome só do mestre, e o cartão do jogador é a descrição.
 * - `passe` (o item e as fichas que abrem a catraca) NUNCA: diria o que abre
 *   a passagem e quem já pode passar. Quem confere é o host, na ficha do
 *   mapa do mestre (`net/hostSession.ts`).
 */
function pinForPlayer(pin: Pin, ownTokens: readonly Token[], grid: number, readable: boolean, known: boolean, oneWay?: ReadonlySet<string>): Pin {
  // LISTA DO QUE VAI, e não "copia tudo e apaga o que não pode": campo que o
  // arquivo trouxer e o app não conhece (versão futura, edição à mão) não
  // chega ao jogador por descuido (revisão de segurança, 22/09). `destino`,
  // `rotulo` e `saidas` ficam de fora — o destino de cada saída diria que a
  // outra cena existe —, e `passe` também (a lista de quem tem passe).
  // `marco` e `lerDePerto` também: são regra do host.
  // `nome` também, e de propósito: é o rótulo SÓ DO MESTRE ("Faca") — o
  // jogador lê a descrição (teste em `fogFilter.pinoNome.test.ts`).
  // `notaDoMestre` ("só eu leio") fica de fora SEMPRE: o jogador lê
  // `description` e mais nada do texto do pino.
  // `colecao` também: a frase inteira é do mestre; o jogador recebe o
  // progresso DELE pela mensagem `colecoes` do host.
  // Pino "só de perto" com a ficha longe sai vazio e marcado `longe`.
  const forPlayer: Pin = {
    id: pin.id,
    x: pin.x,
    y: pin.y,
    kind: pin.kind,
    description: readable ? pin.description : '',
    image: readable && isPlayerSafePinImage(pin.image) ? pin.image : null,
  }
  if (!readable) forPlayer.longe = true
  if (!known) forPlayer.soMarco = true
  // Ícone: o cartão e o mapa do jogador desenham o símbolo, então ele vai —
  // mas só um dos nomes conhecidos (texto livre de arquivo editado à mão não
  // atravessa) e nunca no pino de viagem, que desenha a passagem.
  if (pin.kind !== 'viagem' && isPinIcon(pin.icon)) forPlayer.icon = pin.icon
  if (pin.locked !== undefined) forPlayer.locked = pin.locked
  if (pin.hidden !== undefined) forPlayer.hidden = pin.hidden
  if (pin.secret !== undefined) forPlayer.secret = pin.secret
  if (pin.passagem !== undefined) forPlayer.passagem = pin.passagem
  // Escada: o id da ESCADA desta cena, que o jogador já recebe — é por ele que
  // o toque na escada acha o pino. Só chega aqui pino de escada que saiu.
  if (pin.escadaId !== undefined) forPlayer.escadaId = pin.escadaId
  // Pino trancado MUDO: a marca vai, para o cartão não oferecer "Pedir ao
  // mestre" que o host recusaria. Em qualquer outro modo ela não diz nada e
  // fica de fora (sobra de quando o pino era trancado).
  if (pin.mudo === true && passageOf(pin) === 'trancada') forPlayer.mudo = true
  // MOTIVO DO BLOQUEIO: só do pino de viagem trancado, e só um valor da lista.
  // Motivo guardado num pino reaberto é plano do mestre para depois — não sai.
  const motivo = blockReasonOf(pin)
  if (motivo !== null) forPlayer.motivo = motivo
  // ENCRUZILHADA: o jogador recebe `escolhas`, montado AQUI (nunca copiado do
  // mestre): por saída, só o id e o rótulo. Pino de uma saída não ganha o
  // campo: o cartão dele é o de sempre, e o recorte também. Placa "só de
  // perto" com a ficha longe: o rótulo é texto da placa e não sai — cada saída
  // vai só com o id e "Saída N", e o jogador ainda consegue pedir a passagem.
  // SÓ IDA: um booleano por saída, e só com o que o HOST mandou marcar
  // (`oneWay`, de `oneWayExitsOf`). `semVolta` gravado no pino do mestre
  // (arquivo editado à mão) não é lido: o recorte é lista do que vai.
  const soIda = (exitId: string): boolean => oneWay !== undefined && oneWay.has(exitId)
  const escolhas = exitLabelsOf(pin)
  if (escolhas.length > 1) {
    const visiveis = readable ? escolhas : unreadExitLabels(escolhas)
    forPlayer.escolhas = visiveis.map((saida) => (soIda(saida.id) ? { ...saida, soIda: true } : saida))
  }
  if (escolhas.length === 1 && soIda(escolhas[0].id)) forPlayer.semVolta = true
  // ITEM PEGÁVEL: o cartão precisa do nome e de saber se pede ao mestre.
  // Cópia limpa (`itemOfPin`), nunca o objeto do mestre.
  const item = itemOfPin(pin)
  if (item !== null) forPlayer.item = item
  const key = keyForPin(pin, ownTokens.filter((t) => tokenReachesPin(t, pin, grid)))
  if (key !== null) forPlayer.chave = key.item.nome
  // FECHADURA COM SEGREDO: `segredo` (resposta e porta ligada) nunca vai. O
  // jogador recebe `fechadura`, montada AQUI a partir do segredo — só a forma e
  // (nos volantes) as casas, e só enquanto ela está fechada. Uma `fechadura` que viesse no
  // mapa do mestre não é copiada.
  const fechadura = publicLockOf(pin)
  if (fechadura !== null) forPlayer.fechadura = fechadura
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
  // A pista não leva chave: sem fichas, `pinForPlayer` não calcula o `chave`.
  const safe = pinForPlayer(pin, [], 0, true, true)
  const text = clampClueText(safe.description.trim())
  if (text === '' && safe.image === null) return null
  return { title: clueTitleFrom(text, CLUE_TITLE_ONLY_IMAGE), text, image: safe.image }
}

/**
 * "ONDE ESTOU": o nome da cena como o jogador pode recebê-lo. Só o nome
 * PÚBLICO que o mestre escreveu para os jogadores, limpo e no teto; sem ele,
 * `undefined` e o snapshot sai sem o campo. Recebe só o `publicName` de
 * propósito: o nome interno da cena (`name`) nem entra aqui, então não tem
 * como sair.
 *
 * Quem chama responde por ser a cena ONDE O JOGADOR ESTÁ (`sceneFor` do host).
 */
export function sceneNameForPlayer(scene: { readonly publicName?: string }): string | undefined {
  return scene.publicName === undefined ? undefined : cleanPublicSceneName(scene.publicName)
}

/**
 * DADO ROLADO NA SALA: o que da rolagem o jogador recebe. A rolagem ESCONDIDA
 * do mestre não existe para ele (`null`). A aberta vai inteira, mas só com os
 * campos que a mesa lê: montada campo a campo, e não por cópia, para que nada
 * que o host viesse a pendurar nela (cena, id de jogador) vá junto ao fio.
 */
export function diceRollForPlayer(roll: HostDiceRoll): DiceRollEntry | null {
  if (roll.hidden === true) return null
  const entry: DiceRollEntry = {
    id: roll.id,
    from: roll.from,
    count: roll.count,
    sides: roll.sides,
    modifier: roll.modifier,
    results: [...roll.results],
    total: roll.total,
    at: roll.at,
  }
  return roll.master === true ? { ...entry, master: true } : entry
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
 * ABALO POR DISTÂNCIA — o que do ponto de origem vai ao jogador que está na
 * cena dele: só o RUMO de 8 pontas (`lib/abalo.ts`), nunca o ponto. É visto da
 * PRÓPRIA ficha do jogador, e só da ficha que o recorte dele leva (mesma
 * camada e mesmo "escondido" de `filterMapForPlayer`): ficha que o mestre
 * escondeu não dá seta, e a ficha de outro jogador nunca serve de referência.
 * Até uma casa de distância, `aqui`. Sem ficha no recorte: `null` (sem seta).
 *
 * Quem chama responde por o jogador ESTAR na cena de `map` e por o mestre ter
 * escolhido a origem: o abalo é um som que ele decidiu fazer ouvir, então a
 * seta vale mesmo com a origem no escuro — é o rumo, e não o lugar.
 */
export function abaloSetaForPlayer(map: MapData, playerId: string, ownership: Record<string, string[]>, origem: RegionPoint): AbaloSeta | null {
  const owned = new Set(ownership[playerId] ?? [])
  const ficha = visibleTokens(map.tokens, map.hiddenLayers).find((t) => owned.has(t.id) && !t.hidden)
  if (ficha === undefined) return null
  return setaDoAbalo({ x: ficha.x, y: ficha.y }, origem, map.grid)
}

/**
 * ENCONTRO MARCADO — a marca "esperando" que este jogador pode receber: só as
 * fichas que JÁ saíram no recorte dele (`view.map.tokens`, depois de névoa,
 * zona oculta, ficha secreta ou escondida e outra cena). Ficha que espera no
 * escuro não ganha marca: a marca diria que ela existe e onde.
 *
 * Só o id vai. Quem ela espera e onde combinou ficam no host: são do dono da
 * ficha e do mestre, não da mesa.
 */
export function waitingTokensForPlayer(view: Pick<PlayerMapView, 'map'>, waitingTokenIds: ReadonlySet<string>): string[] {
  return view.map.tokens.filter((t) => waitingTokenIds.has(t.id)).map((t) => t.id)
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
  // OBJETO COM RÓTULO OU IMAGEM: só chega aqui objeto que o jogador enxerga
  // (oculto, secreto, sob teto fechado e fora da visão já saíram acima), então
  // o nome e a cópia pequena vão junto dele e de mais nenhum. Passam pela regra
  // de `propPlayerLook.ts`: rótulo aparado e curto, imagem só em data URL.
  const label = propPlayerLabel(prop.playerLabel)
  if (label !== undefined) forPlayer.playerLabel = label
  const image = propPlayerImage(prop.playerImage)
  if (image !== undefined) forPlayer.playerImage = image
  return forPlayer
}

/**
 * RUÍDO NO MAPA, o recorte do jogador: o que ele ouve de um ruído em `point`.
 * Só a DIREÇÃO (`lib/noise.ts`), a partir da ficha DELE mais perto do ruído,
 * e só se ela estiver a até `rangePx`. Nunca a posição nem o que o fez — isso
 * nem entra no valor devolvido. As fichas que ouvem são as mesmas que dão
 * visão em `filterMapForPlayer`: dele, não escondidas, com a camada de fichas
 * à mostra. `null` = não ouve (sem ficha, longe, ou ponto/alcance inválido).
 */
export function noiseCueForPlayer(
  map: MapData,
  playerId: string,
  ownership: Record<string, string[]>,
  point: RegionPoint,
  rangePx: number,
): NoiseDirection | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  if (!Number.isFinite(rangePx) || rangePx <= 0) return null
  const owned = new Set(ownership[playerId] ?? [])
  let nearest: Token | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const token of visibleTokens(map.tokens, map.hiddenLayers)) {
    if (!owned.has(token.id) || token.hidden) continue
    const distance = Math.hypot(token.x - point.x, token.y - point.y)
    if (distance > rangePx || distance >= nearestDistance) continue
    nearest = token
    nearestDistance = distance
  }
  return nearest === null ? null : noiseDirection(nearest, point, map.grid)
}
