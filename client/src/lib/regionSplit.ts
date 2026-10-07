import type { RegionPoint, RegionSplit, RegionSplitDirection } from '../types/map'

/**
 * SALA EM DUAS CORES (pedido de 07/10/2026): uma reta corta a sala e o lado
 * de lá ganha a segunda cor. A reta é dada pela direção e por onde ela corta,
 * de 0 (começo da sala) a 1 (fim), medido ao longo da normal da reta.
 */

export const SPLIT_AT_MIN = 0.05
export const SPLIT_AT_MAX = 0.95
export const SPLIT_AT_DEFAULT = 0.5

const DIRECTIONS: readonly RegionSplitDirection[] = ['vertical', 'horizontal', 'diagonal']
const HEX_COLOR = /^#[0-9a-f]{6}$/i

/** Normal da reta: o lado da segunda cor é onde `n · p` passa do corte. */
const NORMAL: Record<RegionSplitDirection, { x: number; y: number }> = {
  vertical: { x: 1, y: 0 },
  horizontal: { x: 0, y: 1 },
  diagonal: { x: 1, y: 1 },
}

/** O campo como veio do arquivo, só se servir; senão `undefined` (sala de uma cor). */
export function readRegionSplit(value: unknown): RegionSplit | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { color, direction, at } = value as Record<string, unknown>
  if (typeof color !== 'string' || !HEX_COLOR.test(color)) return undefined
  if (!DIRECTIONS.includes(direction as RegionSplitDirection)) return undefined
  if (typeof at !== 'number' || !Number.isFinite(at)) return undefined
  return { color, direction: direction as RegionSplitDirection, at: Math.min(SPLIT_AT_MAX, Math.max(SPLIT_AT_MIN, at)) }
}

/**
 * O pedaço da sala que fica com a segunda cor: o polígono recortado pelo
 * meio-plano além da reta (Sutherland–Hodgman com um plano só). Vazio quando
 * nada sobra.
 */
export function splitSecondPart(points: readonly RegionPoint[], split: RegionSplit): RegionPoint[] {
  if (points.length < 3) return []
  const n = NORMAL[split.direction]
  const dot = (p: RegionPoint) => p.x * n.x + p.y * n.y
  const values = points.map(dot)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const cut = min + (max - min) * split.at
  const out: RegionPoint[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const va = values[i] - cut
    const vb = values[(i + 1) % points.length] - cut
    if (va >= 0) out.push({ x: a.x, y: a.y })
    // A aresta atravessa a reta: entra o ponto onde ela corta.
    if ((va >= 0) !== (vb >= 0)) {
      const t = va / (va - vb)
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return out.length >= 3 ? out : []
}
