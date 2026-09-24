import type { EntourageSeat, GatherArrival, HostScene, HostWorld } from '../net/hostSession'
import type { MapData, Token, Wall } from '../types/map'
import { snapPointForTarget } from '../pixi/tokenInteraction'
import { carrierIdOf } from './carry'
import { findTokenPath } from './collision'
import { compileFloor } from './floorSdf'
import type { PartyMember } from './party'
import { PIN_HEAD_OFFSET, PIN_HEAD_RADIUS } from './pins'
import { seatTokenCenter, tokenSizeInSquares, type Point } from './tokenSize'

/**
 * REUNIR O GRUPO AQUI (G5) — a parte pura: ONDE cada ficha assenta em volta
 * do pino e QUEM viaja. Sem store, sem rede, sem DOM: quem aplica é o App
 * (a travessia pelo mesmo caminho do "Mandar para…", o resto num passo só do
 * desfazer).
 */

/**
 * Até quantas casas do pino a procura vai. Três anéis dão 48 casas — sobra
 * para 7 jogadores mesmo com parede e ficha em volta; mais longe que isso já
 * não é "aqui", e quem não coube é avisado ao mestre.
 */
export const GATHER_MAX_RING = 3

/**
 * Duas fichas se sobrepõem quando os centros ficam mais perto que a soma dos
 * raios vezes isto. Menor que 1 para que casas VIZINHAS (centros a uma casa)
 * não contem como ocupadas; maior que 0,7 para que a mesma casa sempre conte.
 */
const OVERLAP_FACTOR = 0.9

/** Folga, em px de mundo, para a parede "passar por dentro" da casa: parede na linha da grade não conta. */
const WALL_INSIDE_EPSILON = 1

/** Distância do ponto ao SEGMENTO da parede. */
function distanceToSegment(p: Point, wall: Wall): number {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(p.x - wall.x1, p.y - wall.y1)
  const t = Math.max(0, Math.min(1, ((p.x - wall.x1) * dx + (p.y - wall.y1) * dy) / lengthSquared))
  return Math.hypot(p.x - (wall.x1 + dx * t), p.y - (wall.y1 + dy * t))
}

/**
 * Deslocamentos (em casas) dos anéis em volta do pino, do mais perto ao mais
 * longe. A casa do próprio pino fica de fora: ficha em cima dele cobre a
 * cabeça, e o mestre perde o clique no pino onde acabou de reunir o grupo.
 * Empate de distância segue a ordem de leitura (linha, depois coluna): o
 * resultado é o mesmo em toda chamada.
 */
function ringOffsets(maxRing: number): Point[] {
  const offsets: Point[] = []
  for (let dy = -maxRing; dy <= maxRing; dy += 1) {
    for (let dx = -maxRing; dx <= maxRing; dx += 1) {
      if (dx !== 0 || dy !== 0) offsets.push({ x: dx, y: dy })
    }
  }
  return offsets.sort((a, b) => a.x * a.x + a.y * a.y - (b.x * b.x + b.y * b.y))
}

interface Seated {
  point: Point
  size: number
}

/** Um círculo que nenhuma ficha assentada pode cobrir (ex.: a cabeça do pino, para ele continuar tocável). */
export interface KeepClear {
  x: number
  y: number
  radius: number
}

/**
 * O que o séquito que chega por um pino não pode cobrir: a cabeça, para o pino
 * continuar tocável, e a ponta cravada (a casa do próprio pino). O séquito
 * senta em volta do DONO, e a casa do pino, colada à dele, entraria no anel.
 */
export function pinClearance(pin: Point): KeepClear[] {
  return [
    { x: pin.x, y: pin.y - PIN_HEAD_OFFSET, radius: PIN_HEAD_RADIUS },
    { x: pin.x, y: pin.y, radius: 0 },
  ]
}

/** As fichas do mapa que ocupam casa, menos as de `movingTokenIds` (vão sair do lugar). */
function seatedTokens(map: MapData, movingTokenIds: ReadonlySet<string>): Seated[] {
  return map.tokens.filter((t: Token) => !movingTokenIds.has(t.id)).map((t) => ({ point: { x: t.x, y: t.y }, size: tokenSizeInSquares(t) }))
}

function overlapsSeated(taken: readonly Seated[], p: Point, size: number, grid: number): boolean {
  return taken.some((other) => Math.hypot(other.point.x - p.x, other.point.y - p.y) < ((size + other.size) / 2) * grid * OVERLAP_FACTOR)
}

/** `true` = uma ficha de `size` casas em `p` encostaria numa ficha do mapa (fora as de `movingTokenIds`). */
export function seatIsTaken(map: MapData, p: Point, size: number, movingTokenIds: ReadonlySet<string> = new Set()): boolean {
  return overlapsSeated(seatedTokens(map, movingTokenIds), p, size, map.grid)
}

/**
 * As casas livres em volta de `pin`, uma para cada tamanho de ficha em
 * `sizes` (na mesma ordem). `null` = não coube até `GATHER_MAX_RING`.
 *
 * Uma casa serve quando:
 * - fica dentro do mundo;
 * - o centro está no chão (quando o mapa tem chão — sem peça de chão, tudo vale);
 * - nenhuma parede que barra movimento fica ENTRE ela e o pino: a ficha não
 *   aparece do outro lado de uma parede, no cômodo vizinho ou dentro de uma
 *   coluna. É a mesma regra de trajeto do movimento (`findTokenPath`): porta
 *   aberta deixa passar, fechada não;
 * - nenhuma parede corta a própria casa;
 * - nenhuma outra ficha a ocupa — nem as que já estão no mapa (menos as de
 *   `movingTokenIds`, que vão sair do lugar), nem as já assentadas nesta
 *   mesma reunião;
 * - a ficha não cobre nenhum círculo de `keepClear`.
 *
 * O centro segue o assentamento de ficha do editor (`snapPointForTarget` +
 * `seatTokenCenter`, o mesmo par de `arrivalSpot`): ficha de 2 casas senta na
 * linha da grade, de 1 e 3 no meio da casa.
 */
export function gatherSpots(
  map: MapData,
  pin: Point,
  sizes: readonly number[],
  movingTokenIds: ReadonlySet<string> = new Set(),
  keepClear: readonly KeepClear[] = [],
): (Point | null)[] {
  const grid = map.grid
  const width = map.width * grid
  const height = map.height * grid
  const floor = compileFloor(map.floor)
  const blocking = map.walls.filter((wall) => wall.blocksMove)
  const origin = snapPointForTarget('token', map.gridShape, pin.x, pin.y, grid)
  const originKey = `${Math.round(origin.x)}|${Math.round(origin.y)}`

  const cells: Point[] = []
  const seen = new Set<string>([originKey])
  for (const offset of ringOffsets(GATHER_MAX_RING)) {
    // Em grade hexagonal o deslocamento cai perto de um hexágono, e o snap
    // escolhe qual; dois deslocamentos no mesmo hexágono viram um candidato só.
    const cell = snapPointForTarget('token', map.gridShape, origin.x + offset.x * grid, origin.y + offset.y * grid, grid)
    const key = `${Math.round(cell.x)}|${Math.round(cell.y)}`
    if (seen.has(key)) continue
    seen.add(key)
    cells.push(cell)
  }

  const reachable = (p: Point): boolean => {
    if (p.x < 0 || p.y < 0 || p.x > width || p.y > height) return false
    if (floor.bounds !== null && floor.sample(p.x, p.y) > 0) return false
    if (findTokenPath(pin, p, blocking, grid) === null) return false
    return blocking.every((wall) => distanceToSegment(p, wall) >= grid / 2 - WALL_INSIDE_EPSILON)
  }

  const taken = seatedTokens(map, movingTokenIds)
  const coversKeepClear = (p: Point, size: number): boolean => keepClear.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < (size * grid) / 2 + c.radius)

  return sizes.map((size) => {
    for (const cell of cells) {
      const seat = map.gridShape === 'square' ? seatTokenCenter(cell, cell, grid, size) : cell
      if (!reachable(seat) || overlapsSeated(taken, seat, size, grid) || coversKeepClear(seat, size)) continue
      taken.push({ point: seat, size })
      return seat
    }
    return null
  })
}

/** Uma ficha que a reunião põe em volta do pino. */
export interface GatherMove {
  playerId: string
  name: string
  tokenId: string
  /** `true` = vem de OUTRA cena: atravessa pelo caminho do "Mandar para…" e o jogador lê o aviso. */
  travels: boolean
  x: number
  y: number
  /**
   * LEVAR FICHA JUNTO: a ficha que leva esta, quando ela também viaja na
   * reunião e sai da MESMA cena. A travessia dela traz esta junto; esta só
   * assenta na casa planejada. Ausente = viaja (ou anda) por conta própria.
   */
  vemCom?: string
  /**
   * MONTARIA E FAMILIAR: as outras fichas do dono que vêm junto, cada uma numa
   * casa colada à dele. Ausente = só a ficha dele. Séquito que não coube fica
   * onde estava.
   */
  entourage?: EntourageSeat[]
}

export interface GatherPlan {
  moves: GatherMove[]
  /** Nomes de quem não coube em volta do pino: o mestre é avisado, e a ficha fica onde estava. */
  leftOut: string[]
}

/** Um jogador da lista "Reunir o grupo aqui": só quem tem ficha em alguma cena. */
export interface GatherCandidate {
  playerId: string
  name: string
  /** Cor da ficha (`#rrggbb`), a mesma bolinha do painel Grupo. */
  color: string
  /** Cena onde a ficha está (`null` = mapa solto): é por ela que a lista agrupa. */
  sceneId: string | null
  /** Nome da cena, que o MESTRE lê no grupo ("PC - Cais (3)"). Nunca vai ao jogador. */
  sceneLabel: string
  /**
   * Já está no pino: na cena dele, a até `GATHER_MAX_RING` casas. Vem no
   * grupo "Já aqui", por último e desmarcado — o caso comum é trazer quem
   * está longe, e quem já está em volta do pino não precisa andar.
   */
  alreadyHere: boolean
}

/** Rótulo de quem tem ficha numa cena que o mundo do host não abriu (arquivo falhou): ainda aparece, sem nome. */
const UNKNOWN_SCENE_LABEL = 'Outra cena'

/** A lista em ordem de chegada; `pin` é o pino da cena ABERTA, o que decide quem "já está aqui". */
export function gatherCandidates(members: readonly PartyMember[], world: HostWorld, pin: Point): GatherCandidate[] {
  const grid = world.open.map.grid
  return members.flatMap((member) => {
    if (member.token === null) return []
    const scene = sceneOf(member, world)
    // Casas inteiras (Chebyshev), como os anéis de `gatherSpots`: ficha de 2 casas senta na linha da grade, o arredondamento a põe no anel certo.
    const ring = Math.round(Math.max(Math.abs(member.token.x - pin.x), Math.abs(member.token.y - pin.y)) / grid)
    return [
      {
        playerId: member.playerId,
        name: member.name,
        color: member.token.color,
        sceneId: scene === undefined ? member.sceneId : scene.sceneId,
        sceneLabel: scene?.name ?? member.sceneName ?? UNKNOWN_SCENE_LABEL,
        alreadyHere: scene === world.open && ring <= GATHER_MAX_RING,
      },
    ]
  })
}

/** O grupo de quem já está no pino: sempre o último da lista. */
export const GATHER_HERE_LABEL = 'Já aqui'

/** Um bloco da lista: uma cena (ou "Já aqui"), com a caixa que marca todos de uma vez. */
export interface GatherGroup {
  key: string
  /** "PC - Cais (3)": nome da cena e quantos jogadores há nela. */
  label: string
  alreadyHere: boolean
  candidates: GatherCandidate[]
}

/**
 * Agrupa a lista por cena, na ordem em que cada cena aparece pela primeira vez
 * (a ordem de chegada da ponte), com "Já aqui" por último. Dentro do grupo, a
 * ordem de chegada também.
 */
export function gatherGroups(candidates: readonly GatherCandidate[]): GatherGroup[] {
  const byKey = new Map<string, { name: string; alreadyHere: boolean; candidates: GatherCandidate[] }>()
  for (const candidate of candidates) {
    // Prefixos diferentes: uma cena de id "aqui" não se mistura com o grupo "Já aqui".
    const key = candidate.alreadyHere ? 'aqui' : `cena:${candidate.sceneId ?? ''}`
    const group = byKey.get(key)
    if (group !== undefined) group.candidates.push(candidate)
    else byKey.set(key, { name: candidate.alreadyHere ? GATHER_HERE_LABEL : candidate.sceneLabel, alreadyHere: candidate.alreadyHere, candidates: [candidate] })
  }
  const groups = [...byKey].map(([key, group]) => ({
    key,
    label: `${group.name} (${group.candidates.length})`,
    alreadyHere: group.alreadyHere,
    candidates: group.candidates,
  }))
  return [...groups.filter((g) => !g.alreadyHere), ...groups.filter((g) => g.alreadyHere)]
}

function sceneOf(member: PartyMember, world: HostWorld): HostScene | undefined {
  if (member.sceneId === null) return world.open.sceneId === null ? world.open : undefined
  return [world.open, ...world.background].find((scene) => scene.sceneId === member.sceneId)
}

/** `map` com `taken` ocupando casa, como fichas de mentira: casas já dadas nesta reunião cujas fichas ainda não chegaram. */
function withTakenSeats(map: MapData, taken: readonly Seated[]): MapData {
  const pseudo = taken.map((seat, index): Token => ({ id: `reunir:casa-${index}`, characterId: null, name: '', x: seat.point.x, y: seat.point.y, size: seat.size, image: null }))
  return { ...map, tokens: [...map.tokens, ...pseudo] }
}

/**
 * As casas do séquito em volta de `center` (a casa do dono), na ordem de
 * `tokens`. `taken` são as casas já dadas nesta reunião; cada casa dada aqui
 * entra nela, para o séquito do próximo dono não cair em cima. `pin` é o pino
 * da reunião: o séquito não senta nele nem cobre a cabeça (`pinClearance`).
 */
function entourageSpots(map: MapData, center: Point, pin: Point, tokens: readonly Token[], moving: ReadonlySet<string>, taken: Seated[]): EntourageSeat[] {
  if (tokens.length === 0) return []
  const seats = gatherSpots(withTakenSeats(map, taken), center, tokens.map(tokenSizeInSquares), moving, pinClearance(pin))
  const placed: EntourageSeat[] = []
  tokens.forEach((token, index) => {
    const seat = seats[index] ?? null
    if (seat === null) return
    placed.push({ tokenId: token.id, x: seat.x, y: seat.y })
    taken.push({ point: seat, size: tokenSizeInSquares(token) })
  })
  return placed
}

/**
 * Plano da reunião dos `members` marcados em volta de `pin`, que mora na cena
 * ABERTA (é nela que o mestre clicou no pino). Quem já está na cena só anda;
 * quem está em outra viaja. Ficha que não coube fica de fora do plano.
 *
 * MONTARIA E FAMILIAR (`PartyMember.entourageIds`) vêm junto, numa casa
 * colada à do dono. Os donos sentam PRIMEIRO, todos em volta do pino; o
 * séquito depois, em volta de cada dono — o pônei não toma de um jogador a
 * casa perto do pino.
 */
export function planGather(members: readonly PartyMember[], world: HostWorld, pin: Point): GatherPlan {
  const openMap = world.open.map
  const joining: { member: PartyMember; token: Token; entourage: Token[]; travels: boolean }[] = []
  for (const member of members) {
    if (member.token === null) continue
    const tokenId = member.token.id
    const sceneMap = sceneOf(member, world)?.map
    const token = sceneMap?.tokens.find((t) => t.id === tokenId)
    if (sceneMap === undefined || token === undefined) continue
    const wanted = new Set(member.entourageIds ?? [])
    const entourage = sceneMap.tokens.filter((t) => t.id !== tokenId && wanted.has(t.id))
    joining.push({ member, token, entourage, travels: member.sceneId !== world.open.sceneId })
  }
  // Quem já está na cena vai sair do lugar, com o séquito: as casas de onde saem não contam como ocupadas.
  const moving = new Set(joining.filter((j) => !j.travels).flatMap((j) => [j.token, ...j.entourage].map((t) => t.id)))
  const spots = gatherSpots(
    openMap,
    pin,
    joining.map((j) => tokenSizeInSquares(j.token)),
    moving,
  )
  const taken: Seated[] = []
  joining.forEach((j, index) => {
    const spot = spots[index] ?? null
    if (spot !== null) taken.push({ point: spot, size: tokenSizeInSquares(j.token) })
  })
  const moves: GatherMove[] = []
  const leftOut: string[] = []
  joining.forEach((j, index) => {
    const spot = spots[index] ?? null
    if (spot === null) {
      leftOut.push(j.member.name)
      return
    }
    const vemCom = carrierTravelingAlong(j, joining)
    const move: GatherMove = { playerId: j.member.playerId, name: j.member.name, tokenId: j.token.id, travels: j.travels, x: spot.x, y: spot.y, ...(vemCom === null ? {} : { vemCom }) }
    const entourage = entourageSpots(openMap, spot, pin, j.entourage, moving, taken)
    if (entourage.length > 0) move.entourage = entourage
    moves.push(move)
  })
  // LEVAR FICHA JUNTO: quem é levado junto viaja DEPOIS de quem o leva. Se
  // fosse antes, chegaria sozinho a uma cena sem quem o leva, e a travessia
  // solta o vínculo (`adventureStore.transferToken`): a reunião desfaria o
  // que o mestre prendeu.
  const along = (move: GatherMove): number => (move.vemCom === undefined ? 0 : 1)
  return { moves: [...moves].sort((a, b) => along(a) - along(b)), leftOut }
}

/**
 * A ficha que leva `j` e viaja na mesma reunião, saindo da mesma cena — é a
 * travessia dela que traz `j` junto. `null`: `j` vai por conta própria.
 */
function carrierTravelingAlong(j: { member: PartyMember; token: Token; travels: boolean }, joining: readonly { member: PartyMember; token: Token; travels: boolean }[]): string | null {
  const carrierId = carrierIdOf(j.token)
  if (!j.travels || carrierId === null) return null
  const carrier = joining.find((k) => k.token.id === carrierId)
  return carrier !== undefined && carrier.travels && carrier.member.sceneId === j.member.sceneId ? carrierId : null
}

/** O que a reunião precisa do mundo para acontecer. O App liga isto à ponte e à store; o teste, ao que quiser. */
export interface GatherEffects {
  /** A cena do pino (a aberta). `null` no mapa solto: aí ninguém viaja. */
  sceneId: string | null
  /** A travessia do "Mandar para…" com a casa já escolhida (e a do séquito). `false` = não deu (sala fechada, ficha sumiu). */
  bringFromOtherScene(playerId: string, sceneId: string, at: GatherArrival): boolean
  /** As fichas que já estão na cena andam juntas, num passo só do desfazer. */
  placeInScene(positions: { id: string; x: number; y: number }[]): void
}

/**
 * Aplica o plano. PRIMEIRO as travessias: `transferToken` reescreve o
 * histórico da cena do pino com a ficha que chega (é assim que o Ctrl+Z não a
 * duplica nem a devolve para a outra cena). DEPOIS, o passo único de quem já
 * estava aqui — por cima do histórico já reescrito, então desfazer esse passo
 * volta só as fichas locais para onde estavam, e as que vieram de longe ficam.
 * Devolve os nomes de quem não pôde vir.
 */
export function applyGatherPlan(plan: GatherPlan, effects: GatherEffects): string[] {
  const failed: string[] = []
  const arrived = new Set<string>()
  // Quem veio junto de quem leva (LEVAR FICHA JUNTO) já está na cena: só
  // assenta na casa planejada, no mesmo passo de quem já estava aqui.
  const broughtAlong = new Set<string>()
  for (const move of plan.moves) {
    if (!move.travels) continue
    if (move.vemCom !== undefined && arrived.has(move.vemCom)) {
      broughtAlong.add(move.tokenId)
      continue
    }
    const at: GatherArrival = move.entourage === undefined ? { x: move.x, y: move.y } : { x: move.x, y: move.y, entourage: move.entourage }
    const ok = effects.sceneId !== null && effects.bringFromOtherScene(move.playerId, effects.sceneId, at)
    if (ok) arrived.add(move.tokenId)
    else failed.push(move.name)
  }
  // O séquito de quem já estava aqui anda no MESMO passo do desfazer. Quem
  // veio junto de quem leva só assenta; o séquito dele não atravessou.
  const local = plan.moves
    .filter((move) => !move.travels || broughtAlong.has(move.tokenId))
    .flatMap((move) => [
      { id: move.tokenId, x: move.x, y: move.y },
      ...(move.travels ? [] : (move.entourage ?? [])).map((seat) => ({ id: seat.tokenId, x: seat.x, y: seat.y })),
    ])
  if (local.length > 0) effects.placeInScene(local)
  return failed
}
