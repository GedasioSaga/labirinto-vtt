import { Color, type Graphics } from 'pixi.js'
import type { Region, RegionPoint } from '../types/map'
import { isDegenerateRegion } from './shapes'
import { SELECTION_COLOR } from './constants'

const HATCH_SPACING = 10
const HATCH_ANGLE = Math.PI / 4 // 45°
const HATCH_COLOR = 0x000000
const HATCH_ALPHA = 0.35
const HATCH_WIDTH = 2

interface HatchSegment {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * Gera segmentos de linha diagonal (45°) confinados ao polígono da região.
 * Funciona rotacionando os pontos pra um espaço onde as linhas de hachura viram
 * horizontais, aplicando o algoritmo clássico de scanline (par-ímpar) pra achar
 * os trechos que ficam dentro do polígono — o mesmo método usado pra preencher
 * polígonos côncavos — e rotacionando os segmentos resultantes de volta. Como os
 * segmentos já nascem recortados ao polígono, nunca vazam pra fora do contorno,
 * mesmo em regiões não-retangulares (formato em L, muitos vértices).
 */
function computeHatchSegments(points: RegionPoint[]): HatchSegment[] {
  const cos = Math.cos(-HATCH_ANGLE)
  const sin = Math.sin(-HATCH_ANGLE)
  const rotated = points.map((p) => ({ u: p.x * cos - p.y * sin, v: p.x * sin + p.y * cos }))

  const vValues = rotated.map((p) => p.v)
  const vMin = Math.min(...vValues)
  const vMax = Math.max(...vValues)

  const cosBack = Math.cos(HATCH_ANGLE)
  const sinBack = Math.sin(HATCH_ANGLE)

  const segments: HatchSegment[] = []
  for (let v = vMin + HATCH_SPACING; v < vMax; v += HATCH_SPACING) {
    const us = scanlineIntersections(rotated, v)
    for (let i = 0; i + 1 < us.length; i += 2) {
      const u1 = us[i]
      const u2 = us[i + 1]
      segments.push({
        x1: u1 * cosBack - v * sinBack,
        y1: u1 * sinBack + v * cosBack,
        x2: u2 * cosBack - v * sinBack,
        y2: u2 * sinBack + v * cosBack,
      })
    }
  }
  return segments
}

/** Interseções da reta v=constante com as arestas do polígono, em ordem crescente de u. */
function scanlineIntersections(points: { u: number; v: number }[], v: number): number[] {
  const us: number[] = []
  const n = points.length
  for (let i = 0; i < n; i++) {
    const a = points[i]
    const b = points[(i + 1) % n]
    const crosses = (a.v <= v && b.v > v) || (b.v <= v && a.v > v)
    if (!crosses) continue
    const t = (v - a.v) / (b.v - a.v)
    us.push(a.u + t * (b.u - a.u))
  }
  return us.sort((x, y) => x - y)
}

export function drawRegions(graphics: Graphics, regions: Region[], selectedRegionId: string | null = null): void {
  graphics.clear()
  for (const region of regions) {
    if (isDegenerateRegion(region.points)) continue
    const [first, ...rest] = region.points
    graphics.moveTo(first.x, first.y)
    for (const point of rest) {
      graphics.lineTo(point.x, point.y)
    }
    graphics.closePath()
    const isSelected = region.id === selectedRegionId
    const color = isSelected ? SELECTION_COLOR : new Color(region.fillColor).toNumber()
    graphics.fill({ color, alpha: isSelected ? 0.25 : 0.15 })
    graphics.stroke({ width: isSelected ? 4 : 2, color })

    if (!isSelected && region.fillPattern === 'hatch') {
      const segments = computeHatchSegments(region.points)
      for (const segment of segments) {
        graphics.moveTo(segment.x1, segment.y1)
        graphics.lineTo(segment.x2, segment.y2)
      }
      if (segments.length > 0) {
        graphics.stroke({ width: HATCH_WIDTH, color: HATCH_COLOR, alpha: HATCH_ALPHA })
      }
    }
  }
}
