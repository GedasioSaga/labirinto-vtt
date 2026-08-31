import { Color, type Graphics } from 'pixi.js'
import type { Drawing } from '../types/map'
import { catmullRomToBezierSegments } from '../lib/curveMath'
import { SELECTION_COLOR } from './constants'

export function drawDrawings(graphics: Graphics, drawings: Drawing[], selectedDrawingId: string | null = null): void {
  graphics.clear()
  for (const drawing of drawings) {
    // Desenho de texto entra na Task 2, via drawTextLabels.ts (objeto Text do
    // Pixi por rótulo) — não neste Graphics compartilhado. Por ora a Task 1 só
    // precisa manter o union exaustivo sem quebrar a renderização dos tipos já
    // suportados.
    if (drawing.kind === 'text') continue

    const isSelected = drawing.id === selectedDrawingId
    const color = isSelected ? SELECTION_COLOR : new Color(drawing.color).toNumber()
    const width = isSelected ? drawing.width + 2 : drawing.width

    if (drawing.kind === 'freehand') {
      if (drawing.points.length < 2) continue
      const [first, ...rest] = drawing.points
      graphics.moveTo(first.x, first.y)
      for (const point of rest) graphics.lineTo(point.x, point.y)
      graphics.stroke({ width, color, cap: 'round', join: 'round' })
    } else if (drawing.kind === 'line') {
      graphics.moveTo(drawing.x1, drawing.y1).lineTo(drawing.x2, drawing.y2).stroke({ width, color, cap: 'round' })
    } else if (drawing.kind === 'curve') {
      if (drawing.points.length < 2) continue
      const first = drawing.points[0]
      graphics.moveTo(first.x, first.y)
      for (const segment of catmullRomToBezierSegments(drawing.points)) {
        graphics.bezierCurveTo(segment.c1.x, segment.c1.y, segment.c2.x, segment.c2.y, segment.end.x, segment.end.y)
      }
      graphics.stroke({ width, color, cap: 'round', join: 'round' })
      if (isSelected) {
        for (const point of drawing.points) {
          graphics.circle(point.x, point.y, 5).fill({ color: SELECTION_COLOR })
        }
        // Ponto médio de cada trecho consecutivo (i, i+1) — vazado (só stroke),
        // mesma distinção visual vértice-preenchido/midpoint-vazado usada pelos
        // handles de Região. Curva não fecha como polígono: length-1 midpoints.
        for (let i = 0; i < drawing.points.length - 1; i += 1) {
          const a = drawing.points[i]
          const b = drawing.points[i + 1]
          graphics.circle((a.x + b.x) / 2, (a.y + b.y) / 2, 4).stroke({ width: 2, color: SELECTION_COLOR })
        }
      }
    } else {
      graphics.circle(drawing.cx, drawing.cy, drawing.radius)
      if (drawing.filled) graphics.fill({ color, alpha: isSelected ? 0.35 : 0.5 })
      graphics.stroke({ width, color })
    }
  }
}
