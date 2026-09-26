import type { MapData, RegionPoint, Token, Wall } from '../types/map'
import type { Point } from '../pixi/world'
import { DEFAULT_DOOR_SLACK, findTokenPath, isDoorPassable, moveCrossesWall } from './collision'
import { pointInRing } from './floorContour'
import { compileFloor, pieceBounds, type CompiledFloor } from './floorSdf'
import { playerHiddenRings } from './fogFilter'
import { clampToMaxStep, findOccupant, tokensOccupy } from './movementRules'
import { cabeNoPasso, casasDoTrajeto, fichaDaVez } from './confronto'

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

/**
 * `occupied`: a cena liga "Fichas ocupam espaço" e o destino cai sobre outra ficha ('Lugar ocupado').
 * `not_your_turn`: a cena tem iniciativa e a ficha pedida não é a da vez, ou
 * há CONFRONTO na cena (`lib/confronto.ts`) e a ficha está na fila fora da vez.
 * `too_far`: CONFRONTO — o trajeto passa do que resta do passo.
 */
export type TokenMoveRejection =
  | 'unknown_token'
  | 'not_owner'
  | 'locked'
  | 'not_your_turn'
  | 'outside_map'
  | 'wall'
  | 'outside_floor'
  | 'occupied'
  | 'too_far'

/**
 * Por que o movimento aceito parou em outro lugar que não o pedido.
 * `nearest_floor`: a ficha estava sem chão debaixo (o mestre apagou ou mudou
 * o chão) e foi levada ao chão mais próximo que ela alcança.
 */
export type TokenMoveLanding = 'nearest_floor'

/** `casas`: só quando o movimento conta no passo do confronto — é o que o host soma ao gasto da vez. */
export type TokenMoveResult =
  | { ok: true; x: number; y: number; landing?: TokenMoveLanding; casas?: number }
  | { ok: false; reason: TokenMoveRejection }

export interface TokenMoveOptions {
  /** Mestre: sem passo máximo e sem ocupação. */
  isHost?: boolean
  /**
   * Fichas que contam para "Fichas ocupam espaço". O host passa só as que o
   * JOGADOR enxerga (o recorte dele): ficha oculta, secreta ou na névoa não
   * pode recusar, porque a recusa diria que há alguém ali. Ausente = todas.
   */
  occupants?: readonly Token[]
  /**
   * INICIATIVA: id da ficha da vez NESTE mapa. Com valor, o jogador só move
   * essa ficha; ausente ou `null` = sem iniciativa aqui, todo mundo move. O
   * host (mestre) nunca espera a vez.
   */
  turnTokenId?: string | null
  /** Casas que a ficha da vez já andou nesta vez (confronto). Ausente = 0. */
  gastoNaVez?: number
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

/** Direções fixas (espaçadas por igual) em que se procura o chão mais próximo de uma ficha sem chão. */
const RESCUE_DIRECTIONS = 64
/**
 * Teto de direções do resgate somando as fixas e as miradas (pontas de parede,
 * peças de chão): mapa com milhares de paredes nunca vira laço gigante no mestre.
 */
const MAX_RESCUE_RAYS = 2048
/** Quanto o raio mirado passa ao lado da ponta de uma parede, em px: sai pelo vão sem raspar na ponta. */
const WALL_END_CLEARANCE = 1
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

/** Quanto a marcha passa da borda de uma área escondida ao sair dela, em px: basta para o ponto cair fora do anel. */
const RING_EXIT_EPSILON = 0.01

/**
 * Menor `s > t` em que o raio `from + (dx, dy)·s` cruza a borda de algum dos
 * `rings`; `null` se não cruza nenhuma. Entre `t` e esse `s` o raio não entra
 * nem sai de área escondida nenhuma.
 */
function nextRingCrossing(from: Point, dx: number, dy: number, t: number, rings: readonly RegionPoint[][]): number | null {
  let best: number | null = null
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[j]
      const b = ring[i]
      const ex = b.x - a.x
      const ey = b.y - a.y
      const denom = dx * ey - dy * ex
      if (denom === 0) continue // raio paralelo à aresta: não a cruza
      const ax = a.x - from.x
      const ay = a.y - from.y
      const s = (ax * ey - ay * ex) / denom
      const u = (ax * dy - ay * dx) / denom
      if (u < 0 || u > 1 || s <= t) continue
      if (best === null || s < best) best = s
    }
  }
  return best
}

/**
 * Primeiro ponto de chão PERMITIDO na direção (dx, dy) a partir de `from`,
 * andando pelo campo de distância. Chão dentro de `hidden` (escondido do
 * jogador) não encerra a marcha: ela o atravessa, porque o chão livre logo
 * atrás dele continua sendo o mais próximo naquela direção. A travessia salta
 * direto para a próxima borda de área escondida, então o tamanho da zona não
 * consome o teto de amostras (cada travessia gasta uma amostra por borda cruzada).
 */
function marchToFloor(
  map: MapData,
  compiled: CompiledFloor,
  from: Point,
  dx: number,
  dy: number,
  hidden: readonly RegionPoint[][],
): FloorHit | null {
  const step = sampleStep(map)
  // Lipschitz ≥ 1 por construção; a guarda só impede divisão que pule chão se um dia vier 0 ou NaN.
  const lipschitz = compiled.lipschitz >= 1 ? compiled.lipschitz : 1
  const inset = map.grid * RESCUE_INSET_CELLS
  const allowed = (x: number, y: number): boolean => !hidden.some((ring) => pointInRing({ x, y }, ring))
  let t = 0
  for (let i = 0; i < MAX_RESCUE_SAMPLES_PER_DIRECTION; i += 1) {
    const x = from.x + dx * t
    const y = from.y + dy * t
    if (!isInsideMap(map, x, y)) return null
    const d = compiled.sample(x, y)
    if (d <= 0) {
      if (allowed(x, y)) {
        // Entra um pouco além da borda, se ali ainda for chão permitido (sala mais fina que a folga fica na borda mesmo).
        const ix = x + dx * inset
        const iy = y + dy * inset
        if (isInsideMap(map, ix, iy) && compiled.sample(ix, iy) <= 0 && allowed(ix, iy)) {
          return { x: ix, y: iy, distance: t + inset }
        }
        return { x, y, distance: t }
      }
      // Dentro de área escondida tudo até a próxima borda dela também é escondido: salta até lá.
      const exit = nextRingCrossing(from, dx, dy, t, hidden)
      t = exit === null ? t + step : exit + RING_EXIT_EPSILON
      continue
    }
    // Fora do chão, `d / lipschitz` nunca pula chão (a distância não cai mais rápido que isso).
    t += Math.max(d / lipschitz, step)
  }
  return null
}

interface Direction {
  dx: number
  dy: number
}

/** Direção unitária de `from` até `to`; `null` se coincidem ou a conta não é finita. */
function directionTo(from: Point, to: Point): Direction | null {
  const vx = to.x - from.x
  const vy = to.y - from.y
  const length = Math.hypot(vx, vy)
  if (!(length > 0) || !Number.isFinite(length)) return null
  return { dx: vx / length, dy: vy / length }
}

/**
 * Direções em que o resgate procura chão: as fixas, mais as miradas.
 *
 * As fixas sozinhas deixam a ficha presa quando o chão só é alcançado por uma
 * fresta mais estreita que o espaço entre dois raios vizinhos: o vão de uma
 * parede lá longe, ou uma sala estreita e distante. Toda fresta entre paredes
 * é limitada por ponta SOLTA de parede (que não emenda em outra parede que
 * barra), então um raio rente a cada lado de cada ponta solta passa por ela; e
 * um raio para o centro de cada peça de chão acha a peça estreita que caiu
 * entre dois raios fixos.
 *
 * Alvo que a ficha não enxerga (parede no meio) não vira raio: tudo que ele
 * acharia está atrás daquela parede. Com a regra da ponta solta, é o que
 * mantém o custo perto do das direções fixas em mapa cheio de salas muradas.
 */
function rescueDirections(map: MapData, from: Point): Direction[] {
  const directions: Direction[] = []
  for (let i = 0; i < RESCUE_DIRECTIONS; i += 1) {
    const angle = (i / RESCUE_DIRECTIONS) * 2 * Math.PI
    directions.push({ dx: Math.cos(angle), dy: Math.sin(angle) })
  }
  const blockers = map.walls.filter((wall) => wall.blocksMove && !isDoorPassable(wall.door))
  const seen = (target: Point): boolean => !blockers.some((wall) => moveCrossesWall(from, target, wall))
  const aimAt = (target: Point): void => {
    if (directions.length >= MAX_RESCUE_RAYS || !seen(target)) return
    const direction = directionTo(from, target)
    if (direction !== null) directions.push(direction)
  }
  for (const piece of map.floor) {
    if (piece.hidden || piece.op !== 'add') continue
    const b = pieceBounds(piece)
    aimAt({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 })
  }
  // Quantas paredes que barram terminam em cada ponto: 1 é ponta solta (borda de vão).
  const endKey = (x: number, y: number): string => `${x},${y}`
  const endCount = new Map<string, number>()
  for (const wall of blockers) {
    for (const key of [endKey(wall.x1, wall.y1), endKey(wall.x2, wall.y2)]) endCount.set(key, (endCount.get(key) ?? 0) + 1)
  }
  for (const wall of blockers) {
    for (const end of [
      { x: wall.x1, y: wall.y1 },
      { x: wall.x2, y: wall.y2 },
    ]) {
      if (endCount.get(endKey(end.x, end.y)) !== 1) continue
      const toEnd = directionTo(from, end)
      if (toEnd === null) continue
      // Perpendicular ao raio: um alvo de cada lado da ponta.
      aimAt({ x: end.x - toEnd.dy * WALL_END_CLEARANCE, y: end.y + toEnd.dx * WALL_END_CLEARANCE })
      aimAt({ x: end.x + toEnd.dy * WALL_END_CLEARANCE, y: end.y - toEnd.dx * WALL_END_CLEARANCE })
    }
  }
  return directions
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
  const hits: FloorHit[] = []
  for (const { dx, dy } of rescueDirections(map, from)) {
    const hit = marchToFloor(map, compiled, from, dx, dy, hidden)
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

/**
 * As travas que seguram a ficha de um JOGADOR, qualquer que seja o jeito de
 * andar: o passo (`validateTokenMove`) e a troca de piso pela escada
 * (`handleTokenPiso` no host). Cadeado do mestre, vez da iniciativa
 * (`turnTokenId` ausente ou `null` = sem iniciativa aqui) e vez do CONFRONTO
 * (só prende ficha que está na fila). O mestre não passa por aqui.
 */
export function travaDaFichaDoJogador(
  map: Pick<MapData, 'confronto'>,
  token: Pick<Token, 'id' | 'locked'>,
  turnTokenId: string | null | undefined,
): 'locked' | 'not_your_turn' | null {
  if (token.locked) return 'locked'
  const turn = turnTokenId ?? null
  if (turn !== null && turn !== token.id) return 'not_your_turn'
  const confronto = map.confronto
  if (confronto !== undefined && confronto.fila.includes(token.id) && fichaDaVez(confronto) !== token.id) return 'not_your_turn'
  return null
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
    const trava = travaDaFichaDoJogador(map, token, options.turnTokenId)
    if (trava !== null) return { ok: false, reason: trava }
  }

  // CONFRONTO: o passo conta só para pedido de jogador e só para ficha da
  // fila (a vez já foi checada acima); o mestre e quem está fora da fila andam livres.
  const confronto = options.isHost ? undefined : map.confronto
  const naFila = confronto !== undefined && confronto.fila.includes(token.id)

  if (!isInsideMap(map, request.x, request.y)) return { ok: false, reason: 'outside_map' }

  const from = { x: token.x, y: token.y }
  // Passo máximo da cena: o jogador anda até o último ponto do alcance, na
  // direção que pediu. Parede e chão são checados no trecho que ele anda DE
  // FATO — obstáculo além do alcance não recusa um passo que nem chega lá.
  const to = options.isHost ? { x: request.x, y: request.y } : clampToMaxStep(map, from, { x: request.x, y: request.y })
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

  // "Lugar ocupado" só depois de saber que o caminho existe, senão
  // a recusa diria que há alguém atrás de uma parede.
  if (!options.isHost && tokensOccupy(map) && findOccupant(options.occupants ?? map.tokens, token.id, to, map.grid) !== undefined) {
    return { ok: false, reason: 'occupied' }
  }

  if (confronto === undefined || !naFila) return { ok: true, x: to.x, y: to.y }
  // O passo é medido no MESMO trajeto que acabou de passar (o vão da porta
  // aberta conta), na régua do mapa.
  const casas = casasDoTrajeto(map, path)
  if (!cabeNoPasso(confronto.passo, options.gastoNaVez ?? 0, casas)) return { ok: false, reason: 'too_far' }
  return { ok: true, x: to.x, y: to.y, casas }
}

/**
 * Por que o traço do token não passou. Nomes separados de `TokenMoveRejection`
 * de propósito: aquele é o veredito do HOST sobre o pedido de um jogador
 * (posse, trava, fora do mapa); este descreve só o OBSTÁCULO no caminho, que é
 * o que a tela do mestre precisa contar.
 */
export type BlockedMoveReason = 'wall' | 'door_closed' | 'door_locked' | 'door_secret'

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
 * depois porta secreta, depois porta trancada, depois parede sólida. É a ordem do que o mestre pode
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

  const closed = crossing.find((wall) => wall.door !== null && !wall.door.locked && wall.door.secret !== true)
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

  // Secreta barra aberta ou fechada (`isDoorPassable`): abrir não resolve, e
  // não abre sozinha no arrasto. Vem antes da trancada: o cadeado só importa
  // depois que a passagem é revelada.
  const secret = crossing.find((wall) => wall.door?.secret === true)
  if (secret !== undefined) return { reason: 'door_secret', wallId: secret.id, opensPath: false }

  const locked = crossing.find((wall) => wall.door !== null)
  if (locked !== undefined) return { reason: 'door_locked', wallId: locked.id, opensPath: false }

  const solid = crossing.at(0)
  // Sem cruzamento e sem trajeto: não acontece hoje (findTokenPath só devolve
  // null depois que o traço reto cruzou alguma coisa), mas o chamador recebe
  // "passou" em vez de um wallId inventado se um dia acontecer.
  if (solid === undefined) return null
  return { reason: 'wall', wallId: solid.id, opensPath: false }
}
