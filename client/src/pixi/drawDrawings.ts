import { Color, type Graphics } from 'pixi.js'
import type { Drawing, DrawingCap, DrawingPoint } from '../types/map'
import { catmullRomToBezierSegments } from '../lib/curveMath'
import { computeMarkerStroke, computePencilSegments, readFreehandTexture, type BrushTexture } from '../lib/brushTexture'
import { SELECTION_COLOR } from './constants'

// RISCO Nº 2 do plano (docs/PLANO-FASES.md §5): antes desta constante, a
// seleção SUBSTITUÍA o alpha por um hardcode (0.35 selecionado / 0.5 não
// selecionado) — undefined comportamento pra fillAlpha != 0.5. Agora
// MULTIPLICA fillAlpha pelo fator: com o default de sempre (fillAlpha=0.5),
// 0.5 * 0.7 = 0.35, byte a byte o valor antigo — mapa legado não muda de
// aparência. Com fillAlpha diferente (via DrawingStyleControls), a seleção
// escurece proporcionalmente em vez de saturar num valor fixo.
const SELECTED_FILL_ALPHA_FACTOR = 0.7

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
      drawFreehandStroke(graphics, drawing.points, width, color, drawing.cap ?? 'round', readFreehandTexture(drawing))
    } else if (drawing.kind === 'line') {
      graphics.moveTo(drawing.x1, drawing.y1).lineTo(drawing.x2, drawing.y2).stroke({ width, color, cap: drawing.cap ?? 'round' })
    } else if (drawing.kind === 'curve') {
      if (drawing.points.length < 2) continue
      const first = drawing.points[0]
      graphics.moveTo(first.x, first.y)
      for (const segment of catmullRomToBezierSegments(drawing.points)) {
        graphics.bezierCurveTo(segment.c1.x, segment.c1.y, segment.c2.x, segment.c2.y, segment.end.x, segment.end.y)
      }
      graphics.stroke({ width, color, cap: drawing.cap ?? 'round', join: 'round' })
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
    } else if (drawing.kind === 'circle') {
      graphics.circle(drawing.cx, drawing.cy, drawing.radius)
      if (drawing.filled) graphics.fill({ color, alpha: drawing.fillAlpha * (isSelected ? SELECTED_FILL_ALPHA_FACTOR : 1) })
      graphics.stroke({ width, color })
    } else if (drawing.kind === 'rect') {
      graphics.rect(drawing.x, drawing.y, drawing.w, drawing.h)
      if (drawing.filled) graphics.fill({ color, alpha: drawing.fillAlpha * (isSelected ? SELECTED_FILL_ALPHA_FACTOR : 1) })
      graphics.stroke({ width, color })
    } else if (drawing.kind === 'ellipse') {
      graphics.ellipse(drawing.cx, drawing.cy, drawing.rx, drawing.ry)
      if (drawing.filled) graphics.fill({ color, alpha: drawing.fillAlpha * (isSelected ? SELECTED_FILL_ALPHA_FACTOR : 1) })
      graphics.stroke({ width, color })
    } else if (drawing.kind === 'polygon') {
      if (drawing.points.length < 3) continue
      graphics.poly(drawing.points)
      if (drawing.filled) graphics.fill({ color, alpha: drawing.fillAlpha * (isSelected ? SELECTED_FILL_ALPHA_FACTOR : 1) })
      graphics.stroke({ width, color })
    }
  }
}

/**
 * Traço livre por textura (feature N1, "pincel: caneta, lápis e afins").
 * `width`/`color` já vêm com o ajuste de seleção aplicado pelo chamador
 * (mesmo valor que o resto desta função usa) — a textura varia em cima
 * desse valor, não o substitui.
 *
 * O ramo 'pen' é IDÊNTICO byte a byte ao código de antes desta fase — não
 * passa por `lib/brushTexture.ts` de propósito, para garantir que
 * `texture === undefined` (todo mapa legado, e todo Drawing criado antes de
 * existir preferência de textura) continua renderizando exatamente igual.
 */
function drawFreehandStroke(
  graphics: Graphics,
  points: DrawingPoint[],
  width: number,
  color: number,
  cap: DrawingCap,
  texture: BrushTexture,
): void {
  if (texture === 'pencil') {
    for (const segment of computePencilSegments(points, width)) {
      graphics.moveTo(segment.from.x, segment.from.y).lineTo(segment.to.x, segment.to.y)
      graphics.stroke({ width: segment.width, color, alpha: segment.alpha, cap, join: 'round' })
    }
    return
  }

  if (texture === 'marker') {
    const { width: markerWidth, alpha } = computeMarkerStroke(width)
    const [first, ...rest] = points
    graphics.moveTo(first.x, first.y)
    for (const point of rest) graphics.lineTo(point.x, point.y)
    graphics.stroke({ width: markerWidth, color, alpha, cap, join: 'round' })
    return
  }

  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
  graphics.stroke({ width, color, cap, join: 'round' })
}
