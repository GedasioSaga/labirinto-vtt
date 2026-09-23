import type { HostScene, HostWorld } from '../net/hostSession'
import type { MapData, Token, Wall } from '../types/map'
import { snapPointForTarget } from '../pixi/tokenInteraction'
import { findTokenPath } from './collision'
import { compileFloor } from './floorSdf'
import type { PartyMember } from './party'
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
 *   mesma reunião.
 *
 * O centro segue o assentamento de ficha do editor (`snapPointForTarget` +
 * `seatTokenCenter`, o mesmo par de `arrivalSpot`): ficha de 2 casas senta na
 * linha da grade, de 1 e 3 no meio da casa.
 */
export function gatherSpots(map: MapData, pin: Point, sizes: readonly number[], movingTokenIds: ReadonlySet<string> = new Set()): (Point | null)[] {
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

  const taken: Seated[] = map.tokens.filter((t: Token) => !movingTokenIds.has(t.id)).map((t) => ({ point: { x: t.x, y: t.y }, size: tokenSizeInSquares(t) }))
  const overlaps = (p: Point, size: number): boolean =>
    taken.some((other) => Math.hypot(other.point.x - p.x, other.point.y - p.y) < ((size + other.size) / 2) * grid * OVERLAP_FACTOR)

  return sizes.map((size) => {
    for (const cell of cells) {
      const seat = map.gridShape === 'square' ? seatTokenCenter(cell, cell, grid, size) : cell
      if (!reachable(seat) || overlaps(seat, size)) continue
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
}

export function gatherCandidates(members: readonly PartyMember[]): GatherCandidate[] {
  return members.flatMap((member) => (member.token === null ? [] : [{ playerId: member.playerId, name: member.name, color: member.token.color }]))
}

function sceneOf(member: PartyMember, world: HostWorld): HostScene | undefined {
  if (member.sceneId === null) return world.open.sceneId === null ? world.open : undefined
  return [world.open, ...world.background].find((scene) => scene.sceneId === member.sceneId)
}

/**
 * Plano da reunião dos `members` marcados em volta de `pin`, que mora na cena
 * ABERTA (é nela que o mestre clicou no pino). Quem já está na cena só anda;
 * quem está em outra viaja. Ficha que não coube fica de fora do plano.
 */
export function planGather(members: readonly PartyMember[], world: HostWorld, pin: Point): GatherPlan {
  const openMap = world.open.map
  const joining: { member: PartyMember; token: Token; travels: boolean }[] = []
  for (const member of members) {
    if (member.token === null) continue
    const tokenId = member.token.id
    const token = sceneOf(member, world)?.map.tokens.find((t) => t.id === tokenId)
    if (token === undefined) continue
    joining.push({ member, token, travels: member.sceneId !== world.open.sceneId })
  }
  // Quem já está na cena vai sair do lugar: a casa de onde ele sai não conta como ocupada.
  const moving = new Set(joining.filter((j) => !j.travels).map((j) => j.token.id))
  const spots = gatherSpots(
    openMap,
    pin,
    joining.map((j) => tokenSizeInSquares(j.token)),
    moving,
  )
  const moves: GatherMove[] = []
  const leftOut: string[] = []
  joining.forEach((j, index) => {
    const spot = spots[index] ?? null
    if (spot === null) {
      leftOut.push(j.member.name)
      return
    }
    moves.push({ playerId: j.member.playerId, name: j.member.name, tokenId: j.token.id, travels: j.travels, x: spot.x, y: spot.y })
  })
  return { moves, leftOut }
}

/** O que a reunião precisa do mundo para acontecer. O App liga isto à ponte e à store; o teste, ao que quiser. */
export interface GatherEffects {
  /** A cena do pino (a aberta). `null` no mapa solto: aí ninguém viaja. */
  sceneId: string | null
  /** A travessia do "Mandar para…" com a casa já escolhida. `false` = não deu (sala fechada, ficha sumiu). */
  bringFromOtherScene(playerId: string, sceneId: string, at: Point): boolean
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
  for (const move of plan.moves) {
    if (!move.travels) continue
    const arrived = effects.sceneId !== null && effects.bringFromOtherScene(move.playerId, effects.sceneId, { x: move.x, y: move.y })
    if (!arrived) failed.push(move.name)
  }
  const local = plan.moves.filter((move) => !move.travels).map((move) => ({ id: move.tokenId, x: move.x, y: move.y }))
  if (local.length > 0) effects.placeInScene(local)
  return failed
}
