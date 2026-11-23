import type { RegionPoint } from '../types/map'

/**
 * LINHA DE VISÃO PURA (23/11/2026): a geometria de `visibility.ts` que não depende do mapa. Mora à parte
 * porque o alcance da batalha (`batalha/alcance/casas.ts` e `quemEntra.ts`) roda também no Worker do
 * Lobby, e o `visibility.ts` puxa o contorno do chão e os objetos, cujo fecho chega a Tauri, Pixi e
 * zustand (guarda `lib/nuvem/pureza.test.ts`). Só conta e tipo: nenhum import de valor.
 */

export interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Abaixo disto o raio é tratado como paralelo ao segmento. */
export const PARALLEL_EPSILON = 1e-12
/** Intersecção colada na origem é ignorada: token em cima de uma linha não fica cego. */
export const MIN_HIT_DISTANCE = 1e-6

/**
 * Linha de visão SEM limite de alcance: nenhum obstáculo corta o trecho de
 * `from` até `to`. Os mesmos obstáculos e a mesma folga de `computeVisibility`
 * (encostar no obstáculo na própria origem não cega); o alvo em cima de um
 * obstáculo (lampião pendurado na parede) conta como visto.
 */
export function hasLineOfSight(from: RegionPoint, to: RegionPoint, segments: readonly Segment[]): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (!Number.isFinite(length)) return false
  if (length < MIN_HIT_DISTANCE) return true
  // Folgas em px convertidas para a fração do trecho (0 = origem, 1 = alvo).
  const minT = MIN_HIT_DISTANCE / length
  const maxT = 1 - MIN_HIT_DISTANCE / length
  const minX = Math.min(from.x, to.x)
  const maxX = Math.max(from.x, to.x)
  const minY = Math.min(from.y, to.y)
  const maxY = Math.max(from.y, to.y)
  for (const s of segments) {
    // Caixa do obstáculo longe da caixa do trecho: não corta.
    if (Math.max(s.x1, s.x2) < minX || Math.min(s.x1, s.x2) > maxX || Math.max(s.y1, s.y2) < minY || Math.min(s.y1, s.y2) > maxY) continue
    const ex = s.x2 - s.x1
    const ey = s.y2 - s.y1
    const denom = dx * ey - dy * ex
    if (Math.abs(denom) < PARALLEL_EPSILON) continue
    const wx = s.x1 - from.x
    const wy = s.y1 - from.y
    const t = (wx * ey - wy * ex) / denom
    if (t < minT || t > maxT) continue
    const u = (wx * dy - wy * dx) / denom
    if (u >= 0 && u <= 1) return false
  }
  return true
}
