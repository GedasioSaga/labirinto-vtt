import type { DoorSide, Token, Wall } from '../types/map'

/**
 * Alcance e acerto de porta — compartilhado pelo host (validar o pedido do
 * jogador, `net/hostSession.ts`) e pela tela do jogador (destaque da porta
 * clicável e acerto do toque, `player/PlayerView.tsx`). Mesma conta nos dois
 * lados: o que a tela destaca é o que o host aceita.
 */

/** Folga além da borda do token, em células: "porta encostada no token". */
export const DOOR_REACH_CELLS = 1

export interface ReachPoint {
  x: number
  y: number
}

/** Distância do ponto ao SEGMENTO (não à linha) — mesma projeção escalar de `addDoorOnWall`. */
export function distanceToWall(point: ReachPoint, wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>): number {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - wall.x1, point.y - wall.y1)
  const t = Math.max(0, Math.min(1, ((point.x - wall.x1) * dx + (point.y - wall.y1) * dy) / lengthSquared))
  return Math.hypot(point.x - (wall.x1 + dx * t), point.y - (wall.y1 + dy * t))
}

/** Raio do token em px de mundo (mesma conta do desenho em PlayerView). */
export function tokenRadiusOf(token: Pick<Token, 'size'>, grid: number): number {
  return (grid / 2) * token.size
}

/** A porta está encostada no token: até `DOOR_REACH_CELLS` célula da borda dele. */
export function tokenReachesDoor(token: Pick<Token, 'x' | 'y' | 'size'>, wall: Wall, grid: number): boolean {
  if (wall.door === null) return false
  const reach = tokenRadiusOf(token, grid) + grid * DOOR_REACH_CELLS
  return distanceToWall({ x: token.x, y: token.y }, wall) <= reach
}

/**
 * De que lado da parede está o ponto (`DoorSide`, relativo ao sentido
 * (x1,y1)->(x2,y2)); `null` em cima da linha dela. Produto vetorial: positivo
 * é a direita de quem anda pela parede na tela, onde y cresce para baixo.
 */
export function sideOfWall(point: ReachPoint, wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>): DoorSide | null {
  const cross = (wall.x2 - wall.x1) * (point.y - wall.y1) - (wall.y2 - wall.y1) * (point.x - wall.x1)
  if (cross > 0) return 'right'
  if (cross < 0) return 'left'
  return null
}

/**
 * PORTA DE UM LADO: quem está em `point` pode abrir a porta? Porta sem
 * `opensFrom` abre dos dois lados; em cima da linha (no vão) não há lado errado.
 */
export function doorOpensFrom(wall: Wall, point: ReachPoint): boolean {
  const from = wall.door?.opensFrom
  if (from === undefined) return true
  const side = sideOfWall(point, wall)
  return side === null || side === from
}

/** Porta mais próxima do ponto dentro de `tolerance` (px de mundo), ou `null`. */
export function findDoorAt(walls: readonly Wall[], point: ReachPoint, tolerance: number): Wall | null {
  let best: Wall | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const wall of walls) {
    if (wall.door === null) continue
    const distance = distanceToWall(point, wall)
    if (distance <= tolerance && distance < bestDistance) {
      best = wall
      bestDistance = distance
    }
  }
  return best
}
