import type { MapData, Wall } from '../types/map'
import type { Point } from '../pixi/world'
import { DEFAULT_DOOR_SLACK, findTokenPath, moveCrossesWall } from './collision'
import { compileFloor } from './floorSdf'

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

export type TokenMoveResult = { ok: true; x: number; y: number } | { ok: false; reason: TokenMoveRejection }

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

function pathStaysOnFloor(map: MapData, fromX: number, fromY: number, toX: number, toY: number): boolean {
  const compiled = compileFloor(map.floor)
  // Sem peça 'add' visível não há chão para restringir o movimento.
  if (!compiled.bounds) return true
  const step = Math.max(map.grid / SAMPLES_PER_CELL, MIN_SAMPLE_STEP)
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
  // Pode ter 2 trechos: entrar em diagonal por porta aberta passa pelo vão (lib/collision.ts).
  const path = findTokenPath(from, to, map.walls, map.grid)
  if (path === null) return { ok: false, reason: 'wall' }

  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]
    const b = path[i]
    if (a === undefined || b === undefined) continue
    if (!pathStaysOnFloor(map, a.x, a.y, b.x, b.y)) return { ok: false, reason: 'outside_floor' }
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
