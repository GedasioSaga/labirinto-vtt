import type { Wall } from '../types/map'
import type { Point } from '../pixi/world'
import { moveCrossesWall } from './collision'

/**
 * ONDE A PEÇA NOVA NASCE.
 *
 * Até aqui, "Adicionar token" largava a peça no centro da vista sem perguntar
 * nada a ninguém: com a vista enquadrada numa parede, o disco nascia metade
 * dentro e metade fora dela. A matemática que sabe responder isso já existia
 * (`collision.ts`), mas só era chamada ao MOVER — nascer não passava por lá.
 *
 * Este módulo é só a DECISÃO DE POSIÇÃO: recebe o ponto que o usuário pediu
 * (centro da vista, ou o clique da ferramenta Token) e devolve o ponto mais
 * perto dele onde o disco do token cabe sem encostar em parede — ou `null`
 * quando não existe lugar assim por perto, para quem chama poder AVISAR em
 * vez de largar a peça em cima da parede em silêncio.
 *
 * Não cria token, não mexe em store e não desenha: entra ponto, sai ponto.
 */

/** Espessura máxima da linha de parede em px de TELA — espelha `WALL_SCREEN_PX.thick` (`pixi/drawWalls.ts:32`). */
const MAX_WALL_SCREEN_PX = 3
/** Borda borrada do traço (antialias), também em px de tela. */
const WALL_ANTIALIAS_PX = 1
/** Passo mínimo da busca, em px de mundo: abaixo disso a varredura fica cara sem mudar o resultado visível. */
const MIN_SEARCH_STEP = 4
/** Pontos mínimos por anel da busca — anel pequeno não pode virar só 2 direções. */
const MIN_RING_SAMPLES = 8
/** Até onde procurar, em anéis. Com o passo padrão (meio raio do token) isso dá ~6 células de distância. */
const DEFAULT_MAX_RINGS = 24

/**
 * Raio do disco do token em px de mundo. Mesma conta de
 * `pixi/tokensRenderer.ts:231` (`(gridSize * token.size) / 2 - 2`) — se lá
 * mudar, aqui muda junto, senão a folga calculada aqui mede um disco que a
 * tela não desenha. Nunca devolve zero ou negativo (grade minúscula).
 */
export function tokenRadiusFor(gridSize: number, tokenSize: number): number {
  return Math.max(1, (gridSize * tokenSize) / 2 - 2)
}

/**
 * Folga entre a borda do disco e a LINHA DO MEIO da parede, em px de mundo.
 *
 * A parede é traçada com espessura constante em px de TELA (`drawWalls.ts`
 * converte com `strokeWidthInWorld`), então quanto mais longe a câmera, mais
 * mundo ela cobre — por isso a folga depende da escala da câmera e não é uma
 * constante. Cobre meia espessura da parede mais grossa e a borda borrada.
 */
export function wallClearanceForScale(cameraScale: number): number {
  const safeScale = cameraScale > 0 ? cameraScale : 1
  return (MAX_WALL_SCREEN_PX / 2 + WALL_ANTIALIAS_PX) / safeScale
}

export interface TokenSpawnOptions {
  /** Raio do disco do token em px de mundo — use `tokenRadiusFor`. */
  radius: number
  /** Folga até a linha da parede em px de mundo — use `wallClearanceForScale`. */
  clearance?: number
  /** Distância entre anéis da busca, em px de mundo. Default: meio raio do token. */
  step?: number
  /** Quantos anéis tentar antes de desistir. */
  maxRings?: number
}

/** Distância do ponto ao SEGMENTO da parede (não à reta infinita dela). */
function distanceToWall(point: Point, wall: Wall): number {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - wall.x1, point.y - wall.y1)
  const raw = ((point.x - wall.x1) * dx + (point.y - wall.y1) * dy) / lengthSquared
  const t = Math.max(0, Math.min(1, raw))
  return Math.hypot(point.x - (wall.x1 + dx * t), point.y - (wall.y1 + dy * t))
}

/**
 * Cabe aqui? TODA parede conta, inclusive a que não bloqueia movimento e a
 * que tem porta aberta: a pergunta desta função é visual — "sobra linha de
 * parede por baixo do disco?" — e essas paredes são desenhadas igual.
 */
function fitsAt(point: Point, walls: readonly Wall[], minDistance: number): boolean {
  return walls.every((wall) => distanceToWall(point, wall) >= minDistance)
}

/** Ir do ponto pedido até o candidato atravessaria parede fechada? Reusa a regra de movimento (porta aberta deixa passar). */
function separatedByWall(from: Point, to: Point, walls: readonly Wall[]): boolean {
  return walls.some((wall) => moveCrossesWall(from, to, wall))
}

/**
 * Ponto onde a peça nova pode nascer, o mais perto possível de `preferred`.
 *
 * - `preferred` já livre → devolve ele mesmo (o caso comum não muda em nada).
 * - senão, varre anéis cada vez maiores em volta e devolve o primeiro ponto
 *   livre que ainda esteja do MESMO LADO das paredes fechadas — a peça não
 *   pula para o cômodo vizinho só porque lá sobrava espaço.
 * - se nenhum ponto livre do mesmo lado aparecer, devolve o ponto livre mais
 *   perto (é o que acontece quando `preferred` cai EXATAMENTE em cima da
 *   linha da parede: aí "mesmo lado" não quer dizer nada, todo candidato
 *   atravessa a parede na conta de `moveCrossesWall`).
 * - `null` = não existe lugar livre dentro do alcance da busca. Quem chama
 *   precisa dizer isso na tela em vez de criar a peça.
 */
export function findTokenSpawn(preferred: Point, walls: readonly Wall[], options: TokenSpawnOptions): Point | null {
  const clearance = options.clearance ?? wallClearanceForScale(1)
  const minDistance = options.radius + clearance
  if (walls.length === 0 || fitsAt(preferred, walls, minDistance)) return preferred

  const step = options.step ?? Math.max(MIN_SEARCH_STEP, options.radius / 2)
  const maxRings = options.maxRings ?? DEFAULT_MAX_RINGS
  let nearestAnywhere: Point | null = null

  for (let ring = 1; ring <= maxRings; ring += 1) {
    const distance = ring * step
    // Passo ao longo do anel ≈ passo entre anéis: nenhum vão fica sem amostra.
    const samples = Math.max(MIN_RING_SAMPLES, Math.ceil((2 * Math.PI * distance) / step))
    for (let i = 0; i < samples; i += 1) {
      const angle = (2 * Math.PI * i) / samples
      const candidate = { x: preferred.x + Math.cos(angle) * distance, y: preferred.y + Math.sin(angle) * distance }
      if (!fitsAt(candidate, walls, minDistance)) continue
      if (!separatedByWall(preferred, candidate, walls)) return candidate
      if (nearestAnywhere === null) nearestAnywhere = candidate
    }
  }

  return nearestAnywhere
}
