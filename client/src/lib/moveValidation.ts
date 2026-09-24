import type { MapData, Wall } from '../types/map'
import type { Point } from '../pixi/world'
import { DEFAULT_DOOR_SLACK, findTokenPath, moveCrossesWall } from './collision'
import { pointInRing } from './floorContour'
import { compileFloor, type CompiledFloor } from './floorSdf'
import { playerHiddenRings } from './fogFilter'

/**
 * Validação autoritativa de movimento de token (modo jogador). O servidor/host
 * chama isto antes de aplicar o pedido; o cliente do jogador nunca é confiável.
 * Colisão é calculada pelo centro do token (`token.x`, `token.y`).
 */

export interface TokenMoveRequest {
  playerId: string
  tokenId: string
  x: number
  y: number
}

export type TokenMoveRejection = 'unknown_token' | 'not_owner' | 'locked' | 'outside_map' | 'wall' | 'outside_floor'

/**
 * Por que o movimento aceito parou em outro lugar que não o pedido.
 * `nearest_floor`: a ficha estava sem chão debaixo (o mestre apagou ou mudou
 * o chão) e foi levada ao chão mais próximo que ela alcança.
 */
export type TokenMoveLanding = 'nearest_floor'

export type TokenMoveResult =
  | { ok: true; x: number; y: number; landing?: TokenMoveLanding }
  | { ok: false; reason: TokenMoveRejection }

export interface TokenMoveOptions {
  isHost?: boolean
}

/** Fração da célula entre amostras do trajeto: garante corredor de 1/4 de célula detectado. */
const SAMPLES_PER_CELL = 4
/** Passo mínimo de amostragem, em px de mundo, para grade inválida (0 ou negativa). */
const MIN_SAMPLE_STEP = 1
/** Teto de amostras do trajeto: coordenada hostil nunca vira laço gigante no mestre. */
export const MAX_PATH_SAMPLES = 10_000

/** `!(a && b)` e não `a || b`: NaN falha em toda comparação e precisa cair em "fora". */
function isInsideMap(map: MapData, x: number, y: number): boolean {
  return x >= 0 && x <= map.width * map.grid && y >= 0 && y <= map.height * map.grid
}

/** Direções em que se procura o chão mais próximo de uma ficha sem chão. */
const RESCUE_DIRECTIONS = 64
/** Teto de amostras POR direção: mapa hostil (enorme, grade 1) nunca vira laço gigante no mestre. */
const MAX_RESCUE_SAMPLES_PER_DIRECTION = 512
/** Quanto a ficha entra além da borda do chão achado, em fração da célula: não fica equilibrada na linha. */
const RESCUE_INSET_CELLS = 0.25

function sampleStep(map: MapData): number {
  return Math.max(map.grid / SAMPLES_PER_CELL, MIN_SAMPLE_STEP)
}

interface FloorHit {
  x: number
  y: number
  distance: number
}

/**
 * Primeiro ponto de chão PERMITIDO na direção (dx, dy) a partir de `from`,
 * andando pelo campo de distância. Chão que `allowed` recusa (escondido do
 * jogador) não encerra a marcha: ela o atravessa, porque o chão livre logo
 * atrás dele continua sendo o mais próximo naquela direção.
 */
function marchToFloor(
  map: MapData,
  compiled: CompiledFloor,
  from: Point,
  dx: number,
  dy: number,
  allowed: (point: Point) => boolean,
): FloorHit | null {
  const step = sampleStep(map)
  // Lipschitz ≥ 1 por construção; a guarda só impede divisão que pule chão se um dia vier 0 ou NaN.
  const lipschitz = compiled.lipschitz >= 1 ? compiled.lipschitz : 1
  const inset = map.grid * RESCUE_INSET_CELLS
  let t = 0
  for (let i = 0; i < MAX_RESCUE_SAMPLES_PER_DIRECTION; i += 1) {
    const x = from.x + dx * t
    const y = from.y + dy * t
    if (!isInsideMap(map, x, y)) return null
    const d = compiled.sample(x, y)
    if (d <= 0 && allowed({ x, y })) {
      // Entra um pouco além da borda, se ali ainda for chão permitido (sala mais fina que a folga fica na borda mesmo).
      const ix = x + dx * inset
      const iy = y + dy * inset
      if (isInsideMap(map, ix, iy) && compiled.sample(ix, iy) <= 0 && allowed({ x: ix, y: iy })) {
        return { x: ix, y: iy, distance: t + inset }
      }
      return { x, y, distance: t }
    }
    // Fora do chão, `d / lipschitz` nunca pula chão (a distância não cai mais rápido que isso);
    // dentro de chão escondido `d` é ≤ 0 e `step` atravessa amostra por amostra.
    t += Math.max(d / lipschitz, step)
  }
  return null
}

/**
 * Chão mais próximo que a ficha em `from` (fora do chão) alcança: sem
 * atravessar parede, e fora de zona oculta e sala secreta que não contêm a
 * própria ficha. O ponto volta para o jogador (é onde a ficha dele passa a
 * estar); um ponto de chão escondido diria que ali existe chão.
 *
 * Sala com teto é destino permitido, como no movimento normal
 * (`validateTokenMove` não consulta teto): é entrando que o teto abre.
 */
function findNearestFloor(map: MapData, compiled: CompiledFloor, from: Point): Point | null {
  const hidden = playerHiddenRings(map).filter((ring) => ring.length >= 3 && !pointInRing(from, ring))
  const allowed = (point: Point): boolean => !hidden.some((ring) => pointInRing(point, ring))
  const hits: FloorHit[] = []
  for (let i = 0; i < RESCUE_DIRECTIONS; i += 1) {
    const angle = (i / RESCUE_DIRECTIONS) * 2 * Math.PI
    const hit = marchToFloor(map, compiled, from, Math.cos(angle), Math.sin(angle), allowed)
    if (hit !== null) hits.push(hit)
  }
  hits.sort((a, b) => a.distance - b.distance)
  for (const hit of hits) {
    const point = { x: hit.x, y: hit.y }
    if (findTokenPath(from, point, map.walls, map.grid) === null) continue
    return point
  }
  return null
}

function pathStaysOnFloor(map: MapData, compiled: CompiledFloor, fromX: number, fromY: number, toX: number, toY: number): boolean {
  // Sem peça 'add' visível não há chão para restringir o movimento.
  if (!compiled.bounds) return true
  const step = sampleStep(map)
  const length = Math.hypot(toX - fromX, toY - fromY)
  const wanted = Math.ceil(length / step)
  const segments = Number.isFinite(wanted) ? Math.min(MAX_PATH_SAMPLES, Math.max(1, wanted)) : MAX_PATH_SAMPLES
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    if (compiled.sample(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t) > 0) return false
  }
  return true
}

export function validateTokenMove(
  map: MapData,
  request: TokenMoveRequest,
  ownership: Record<string, string[]>,
  options: TokenMoveOptions = {},
): TokenMoveResult {
  const token = map.tokens.find((t) => t.id === request.tokenId)
  if (!token) return { ok: false, reason: 'unknown_token' }

  if (!options.isHost) {
    const owned = ownership[request.playerId] ?? [] // jogador sem entrada no mapa de posse não possui nada
    if (!owned.includes(token.id)) return { ok: false, reason: 'not_owner' }
    if (token.locked) return { ok: false, reason: 'locked' }
  }

  if (!isInsideMap(map, request.x, request.y)) return { ok: false, reason: 'outside_map' }

  const from = { x: token.x, y: token.y }
  const to = { x: request.x, y: request.y }
  const compiled = compileFloor(map.floor)

  // O chão sumiu debaixo da ficha (o mestre apagou ou mudou o chão): todo
  // trajeto partiria de fora do chão e seria recusado para sempre. O arrasto
  // leva a ficha ao chão mais próximo, e `landing` conta o porquê.
  if (compiled.bounds && compiled.sample(from.x, from.y) > 0) {
    const landing = findNearestFloor(map, compiled, from)
    if (landing === null) return { ok: false, reason: 'outside_floor' }
    return { ok: true, x: landing.x, y: landing.y, landing: 'nearest_floor' }
  }

  // Pode ter 2 trechos: entrar em diagonal por porta aberta passa pelo vão (lib/collision.ts).
  const path = findTokenPath(from, to, map.walls, map.grid)
  if (path === null) return { ok: false, reason: 'wall' }

  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]
    const b = path[i]
    if (a === undefined || b === undefined) continue
    if (!pathStaysOnFloor(map, compiled, a.x, a.y, b.x, b.y)) return { ok: false, reason: 'outside_floor' }
  }

  return { ok: true, x: to.x, y: to.y }
}

/**
 * Por que o traço do token não passou. Nomes separados de `TokenMoveRejection`
 * de propósito: aquele é o veredito do HOST sobre o pedido de um jogador
 * (posse, trava, fora do mapa); este descreve só o OBSTÁCULO no caminho, que é
 * o que a tela do mestre precisa contar.
 */
export type BlockedMoveReason = 'wall' | 'door_closed' | 'door_locked'

export interface BlockedMove {
  reason: BlockedMoveReason
  /** Parede que barrou — quando é porta, o PEDAÇO que virou porta (é ele que tem `door`). */
  wallId: string
  /**
   * Só em `door_closed`: abrir ESTA porta libera o traço inteiro (nada mais
   * barra). `false` quando outra parede continuaria segurando — aí abrir a
   * porta não adiantaria nada e não se mexe nela.
   */
  opensPath: boolean
}

/**
 * Quem barrou o traço reto de `from` a `to`, e por quê. `null` quando o
 * movimento passa (direto ou pelo vão de uma porta aberta), exatamente pelo
 * mesmo critério de `resolveTokenMove` — as duas respondem a partir de
 * `findTokenPath`, então nunca divergem sobre "passou ou não".
 *
 * Existe porque `resolveTokenMove` devolve só um Ponto: "voltou pra origem"
 * não diz QUAL parede segurou nem se era porta, e era isso que fazia a recusa
 * chegar muda na tela (jornada "não consigo entrar na casa").
 *
 * Ordem de preferência quando várias paredes cruzam o traço: porta fechada,
 * depois porta trancada, depois parede sólida. É a ordem do que o mestre pode
 * RESOLVER — uma porta no caminho é a explicação útil, mesmo que a parede
 * sólida ao lado também cruze.
 */
export function describeBlockedMove(
  from: Point,
  to: Point,
  walls: readonly Wall[],
  doorSlack: number = DEFAULT_DOOR_SLACK,
): BlockedMove | null {
  if (findTokenPath(from, to, walls, doorSlack) !== null) return null

  // `moveCrossesWall` já ignora parede que não bloqueia e porta passável:
  // o que sobra aqui é exatamente quem barrou.
  const crossing = walls.filter((wall) => moveCrossesWall(from, to, wall))

  const closed = crossing.find((wall) => wall.door !== null && !wall.door.locked)
  if (closed !== undefined) {
    const opened = walls.map((wall) =>
      wall.id === closed.id && wall.door !== null ? { ...wall, door: { ...wall.door, open: true } } : wall,
    )
    return {
      reason: 'door_closed',
      wallId: closed.id,
      opensPath: findTokenPath(from, to, opened, doorSlack) !== null,
    }
  }

  const locked = crossing.find((wall) => wall.door !== null)
  if (locked !== undefined) return { reason: 'door_locked', wallId: locked.id, opensPath: false }

  const solid = crossing.at(0)
  // Sem cruzamento e sem trajeto: não acontece hoje (findTokenPath só devolve
  // null depois que o traço reto cruzou alguma coisa), mas o chamador recebe
  // "passou" em vez de um wallId inventado se um dia acontecer.
  if (solid === undefined) return null
  return { reason: 'wall', wallId: solid.id, opensPath: false }
}
