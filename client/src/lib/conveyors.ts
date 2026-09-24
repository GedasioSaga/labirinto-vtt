import type { Conveyor, ConveyorDirection, MapData, Region, RegionPoint, Token } from '../types/map'
import { cabinDestinations } from './cabins'
import { moveCrossesWall } from './collision'
import { pointInRing, signedArea } from './floorContour'
import { NO_OWNER_RADII, seenOccupant, type OwnerVisionRadii } from './imposedOccupancy'
import { tokensOccupy } from './movementRules'

/**
 * MOVIMENTO IMPOSTO — esteira e corrente. Regra pura, sem DOM, sem Pixi, sem
 * store. O mestre marca uma SALA como esteira (direção e passo); "Avançar
 * esteiras" empurra cada ficha que está numa sala com esteira, casa por casa,
 * até o passo da esteira. A parede que barra movimento (`collision.ts`) segura
 * a ficha; a porta aberta deixa passar; a ficha que sai da sala é largada ali.
 *
 * A unidade é a SALA, igual à zona de perigo (`hazards.ts`): o que o mestre
 * narra é "a correnteza do canal", e o canal já é uma sala desenhada.
 */

export const CONVEYOR_DIRECTIONS: readonly ConveyorDirection[] = ['norte', 'sul', 'leste', 'oeste']

export const CONVEYOR_DIRECTION_LABELS: Record<ConveyorDirection, string> = {
  norte: 'Norte',
  sul: 'Sul',
  leste: 'Leste',
  oeste: 'Oeste',
}

/** Casas por Avançar de uma esteira nova. */
export const DEFAULT_CONVEYOR_STEP = 3
/** Passo máximo: mais que isso é teletransporte, não esteira. */
export const MAX_CONVEYOR_STEP = 10

/** Deslocamento de UMA casa, em casas da grade. Norte é y menor (para cima na tela). */
const DIRECTION_VECTOR: Record<ConveyorDirection, { dx: number; dy: number }> = {
  norte: { dx: 0, dy: -1 },
  sul: { dx: 0, dy: 1 },
  leste: { dx: 1, dy: 0 },
  oeste: { dx: -1, dy: 0 },
}

/** O que o mestre escolhe no painel: direção e passo. `null` desliga. */
export interface ConveyorSetting {
  direction: ConveyorDirection
  stepCells: number
}

export function isConveyorDirection(value: unknown): value is ConveyorDirection {
  return CONVEYOR_DIRECTIONS.some((d) => d === value)
}

export function isConveyorStep(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_CONVEYOR_STEP
}

/** As esteiras do mapa. Campo opcional: ausência é o caso comum, não defeito. */
export function conveyorsOf(map: Pick<MapData, 'conveyors'>): readonly Conveyor[] {
  return map.conveyors ?? []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readConveyor(raw: unknown): Conveyor | null {
  if (!isRecord(raw)) return null
  const { id, roomId, direction, stepCells } = raw
  if (typeof id !== 'string' || id === '' || typeof roomId !== 'string' || roomId === '') return null
  if (!isConveyorDirection(direction) || !isConveyorStep(stepCells)) return null
  return { id, roomId, direction, stepCells }
}

/**
 * `MapData.conveyors` como veio do disco (cru). Esteira fora da forma sai
 * sozinha; segunda esteira na mesma sala sai (vale a primeira); lista que
 * sobra vazia é AUSÊNCIA — o mapa não ganha campo que não tinha.
 */
export function readConveyors(raw: unknown): Conveyor[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seenRooms = new Set<string>()
  const out: Conveyor[] = []
  for (const item of raw) {
    const conveyor = readConveyor(item)
    if (conveyor === null || seenRooms.has(conveyor.roomId)) continue
    seenRooms.add(conveyor.roomId)
    out.push(conveyor)
  }
  return out.length === 0 ? undefined : out
}

/** O mapa com exatamente estas esteiras; nenhuma APAGA o campo. */
function withConveyors(map: MapData, conveyors: readonly Conveyor[]): MapData {
  const { conveyors: _antigas, ...semEsteira } = map
  return conveyors.length === 0 ? semEsteira : { ...semEsteira, conveyors: [...conveyors] }
}

function roomById(map: MapData, id: string): Region | null {
  const region = map.regions.find((r) => r.id === id)
  return region !== undefined && region.room !== undefined && region.points.length >= 3 ? region : null
}

export function conveyorOfRoom(map: MapData, roomId: string): Conveyor | null {
  return conveyorsOf(map).find((c) => c.roomId === roomId) ?? null
}

/**
 * O mestre liga a esteira da sala, troca direção/passo, ou desliga (`null`).
 * Sala que não existe, passo inválido ou a mesma escolha devolvem o MESMO
 * mapa — sem entrada de histórico à toa.
 */
export function setRoomConveyor(map: MapData, roomId: string, setting: ConveyorSetting | null, newId: () => string): MapData {
  if (roomById(map, roomId) === null) return map
  const current = conveyorOfRoom(map, roomId)
  if (setting === null) {
    return current === null ? map : withConveyors(map, conveyorsOf(map).filter((c) => c !== current))
  }
  if (!isConveyorDirection(setting.direction) || !isConveyorStep(setting.stepCells)) return map
  if (current !== null && current.direction === setting.direction && current.stepCells === setting.stepCells) return map
  if (current === null) {
    return withConveyors(map, [...conveyorsOf(map), { id: newId(), roomId, direction: setting.direction, stepCells: setting.stepCells }])
  }
  return withConveyors(
    map,
    conveyorsOf(map).map((c) => (c === current ? { ...c, direction: setting.direction, stepCells: setting.stepCells } : c)),
  )
}

/** Esteira com a sala que ainda existe (sala apagada deixa de empurrar). */
interface LiveConveyor {
  conveyor: Conveyor
  ring: RegionPoint[]
  area: number
}

function liveConveyors(map: MapData): LiveConveyor[] {
  return conveyorsOf(map).flatMap((conveyor): LiveConveyor[] => {
    const room = roomById(map, conveyor.roomId)
    return room === null ? [] : [{ conveyor, ring: room.points, area: Math.abs(signedArea(room.points)) }]
  })
}

/** A esteira da sala MAIS DE DENTRO que contém o ponto (o quarto, não a casa inteira). */
function conveyorAt(live: readonly LiveConveyor[], point: RegionPoint): LiveConveyor | null {
  let best: LiveConveyor | null = null
  for (const candidate of live) {
    if (!pointInRing(point, candidate.ring)) continue
    if (best === null || candidate.area < best.area) best = candidate
  }
  return best
}

function insideMap(map: MapData, point: RegionPoint): boolean {
  return point.x >= 0 && point.y >= 0 && point.x <= map.width * map.grid && point.y <= map.height * map.grid
}

/**
 * Onde a esteira larga a ficha: casa por casa, até o passo. Para ANTES de
 * cruzar parede que barra movimento (porta fechada, trancada ou secreta
 * inclusive — `moveCrossesWall`), antes de sair do mapa e, com "Fichas ocupam
 * espaço", antes da casa de outra ficha que o dono dela enxerga dali, com o
 * raio dele na sala (`seenOccupant`, `radii`; `blockers` é `null` sem a
 * regra); e para DEPOIS da casa que a tirou da sala da esteira (foi largada na
 * ponta).
 */
function conveyedPosition(
  map: MapData,
  token: Token,
  belt: LiveConveyor,
  blockers: readonly Token[] | null,
  radii: OwnerVisionRadii,
): RegionPoint {
  const { dx, dy } = DIRECTION_VECTOR[belt.conveyor.direction]
  let at: RegionPoint = { x: token.x, y: token.y }
  for (let step = 0; step < belt.conveyor.stepCells; step += 1) {
    const next = { x: at.x + dx * map.grid, y: at.y + dy * map.grid }
    if (!insideMap(map, next) || map.walls.some((wall) => moveCrossesWall(at, next, wall))) break
    if (blockers !== null && seenOccupant(map, { ...token, x: at.x, y: at.y }, next, blockers, radii) !== undefined) break
    at = next
    if (!pointInRing(at, belt.ring)) break
  }
  return at
}

/**
 * As fichas que PODEM segurar a esteira e a cabine com "Fichas ocupam espaço",
 * ou `null` com a regra desligada. Quem segura de fato é só a que o dono da
 * ficha que anda enxerga (`lib/imposedOccupancy.ts`): a oculta, a secreta, a
 * da névoa, da zona oculta ou do teto fechado não seguram.
 */
function occupyBlockers(map: MapData, tokens: readonly Token[]): readonly Token[] | null {
  return tokensOccupy(map) ? tokens : null
}

/**
 * Quanto a ficha já andou na direção da esteira: quem vai na frente anda
 * primeiro, para a fila na mesma esteira andar junta com a ocupação ligada.
 */
function lead(token: Token, belt: LiveConveyor): number {
  const { dx, dy } = DIRECTION_VECTOR[belt.conveyor.direction]
  return token.x * dx + token.y * dy
}

/**
 * As esteiras do Avançar: cada ficha cujo centro está numa sala com esteira
 * anda (quem vai na frente primeiro). Devolve o chão depois delas e quem andou.
 */
function runConveyors(map: MapData, live: readonly LiveConveyor[], radii: OwnerVisionRadii): { tokens: Token[]; moved: Set<string> } {
  let tokens = [...map.tokens]
  const moved = new Set<string>()
  const riders = map.tokens
    .flatMap((token): { token: Token; belt: LiveConveyor }[] => {
      const belt = conveyorAt(live, { x: token.x, y: token.y })
      return belt === null ? [] : [{ token, belt }]
    })
    .sort((a, b) => lead(b.token, b.belt) - lead(a.token, a.belt))
  for (const { token, belt } of riders) {
    const to = conveyedPosition(map, token, belt, occupyBlockers(map, tokens.filter((t) => t.id !== token.id)), radii)
    if (to.x === token.x && to.y === token.y) continue
    moved.add(token.id)
    tokens = tokens.map((t) => (t.id === token.id ? { ...t, x: to.x, y: to.y } : t))
  }
  return { tokens, moved }
}

/**
 * UM AVANÇAR: primeiro as esteiras (toda ficha cujo centro está numa sala com
 * esteira anda), depois as cabines contínuas (`lib/cabins.ts`: quem ficou
 * parado na casa de um pino com próxima parada é levado a ela; quem a esteira
 * moveu estava andando e não pega a cabine). Conta onde cada ficha estava
 * ANTES do Avançar, então uma esteira que despeja em outra não encadeia no
 * mesmo clique. Ninguém se mexe: devolve o MESMO mapa.
 *
 * `radii` é o raio de visão do dono de cada ficha na sala (`ownerVisionRadii`
 * sobre os jogadores do host): com "Fichas ocupam espaço", só segura quem esse
 * raio alcança. Sem sala aberta, ninguém tem dono e o raio cobre o mapa.
 */
export function advanceConveyors(map: MapData, radii: OwnerVisionRadii = NO_OWNER_RADII): MapData {
  const live = liveConveyors(map)
  const belts = live.length === 0 ? { tokens: map.tokens, moved: new Set<string>() } : runConveyors(map, live, radii)
  const rides = cabinDestinations(map, belts.tokens, belts.moved, occupyBlockers(map, belts.tokens), radii)
  if (belts.moved.size === 0 && rides.size === 0) return map
  const tokens = belts.tokens.map((token) => {
    const to = rides.get(token.id)
    return to === undefined ? token : { ...token, x: to.x, y: to.y }
  })
  return { ...map, tokens }
}

/** O que o painel da Sala mostra: a esteira dela e se o Avançar (de TODAS as esteiras) muda algo. */
export interface RoomConveyorState {
  direction: ConveyorDirection | null
  stepCells: number
  canAdvance: boolean
}

export function roomConveyorState(map: MapData, roomId: string, radii: OwnerVisionRadii = NO_OWNER_RADII): RoomConveyorState {
  const conveyor = conveyorOfRoom(map, roomId)
  return {
    direction: conveyor?.direction ?? null,
    stepCells: conveyor?.stepCells ?? DEFAULT_CONVEYOR_STEP,
    canAdvance: advanceConveyors(map, radii) !== map,
  }
}
