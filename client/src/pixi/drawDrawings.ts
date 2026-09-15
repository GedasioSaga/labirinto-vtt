import { Color, type Graphics } from 'pixi.js'
import type { Drawing, DrawingCap, DrawingPoint } from '../types/map'
import { catmullRomToBezierSegments } from '../lib/curveMath'
import { computeMarkerStroke, computePencilSegments, readFreehandTexture, type BrushTexture } from '../lib/brushTexture'
import { SELECTION_COLOR } from './constants'
import { resolveCameraScale, selectionOutlineWidth } from './drawWalls'

/**
 * Desenha os desenhos vetoriais (menos texto, que é `drawTextLabels.ts`).
 *
 * Seleção (auditoria 14/09): antes o desenho selecionado trocava a própria
 * cor por `SELECTION_COLOR`, engordava 2 px e clareava o preenchimento — o
 * usuário nunca via a cor que escolheu. Agora a cor, o preenchimento e a
 * espessura reais ficam intactos e a seleção é um contorno POR FORA,
 * desenhado antes (por baixo), com 2 px de tela:
 * - traço aberto (linha, curva, pincel): o mesmo caminho, mais largo;
 * - forma fechada (círculo, retângulo, elipse, polígono): `alignment: 0`
 *   (lado de fora), cobrindo a metade externa do traço real + 2 px.
 *
 * `cameraScale` omitido vem da escala de mundo do `graphics` no último render.
 */
export function drawDrawings(graphics: Graphics, drawings: Drawing[], selectedDrawingId: string | null = null, cameraScale?: number): void {
  graphics.clear()
  const outline = selectionOutlineWidth(resolveCameraScale(graphics, cameraScale))
  for (const drawing of drawings) {
    // Desenho de texto entra na Task 2, via drawTextLabels.ts (objeto Text do
    // Pixi por rótulo) — não neste Graphics compartilhado. Por ora a Task 1 só
    // precisa manter o union exaustivo sem quebrar a renderização dos tipos já
    // suportados.
    if (drawing.kind === 'text') continue

    const isSelected = drawing.id === selectedDrawingId
    const color = new Color(drawing.color).toNumber()
    const { width } = drawing
    const openOutline = { width: width + 2 * outline, color: SELECTION_COLOR, join: 'round' as const }
    const closedOutline = { width: width / 2 + outline, color: SELECTION_COLOR, alignment: 0 }

    if (drawing.kind === 'freehand') {
      if (drawing.points.length < 2) continue
      const cap = drawing.cap ?? 'round'
      if (isSelected) {
        tracePolyline(graphics, drawing.points)
        graphics.stroke({ ...openOutline, cap: outlineCap(cap) })
      }
      drawFreehandStroke(graphics, drawing.points, width, color, cap, readFreehandTexture(drawing))
    } else if (drawing.kind === 'line') {
      const cap = drawing.cap ?? 'round'
      if (isSelected) {
        graphics.moveTo(drawing.x1, drawing.y1).lineTo(drawing.x2, drawing.y2).stroke({ ...openOutline, cap: outlineCap(cap) })
      }
      graphics.moveTo(drawing.x1, drawing.y1).lineTo(drawing.x2, drawing.y2).stroke({ width, color, cap })
    } else if (drawing.kind === 'curve') {
      if (drawing.points.length < 2) continue
      const cap = drawing.cap ?? 'round'
      if (isSelected) {
        traceCurve(graphics, drawing.points)
        graphics.stroke({ ...openOutline, cap: outlineCap(cap) })
      }
      traceCurve(graphics, drawing.points)
      graphics.stroke({ width, color, cap, join: 'round' })
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
      if (drawing.kind === 'polygon' && drawing.points.length < 3) continue
      if (isSelected) {
        traceClosedShape(graphics, drawing)
        graphics.stroke(closedOutline)
      }
      traceClosedShape(graphics, drawing)
      if (drawing.filled) graphics.fill({ color, alpha: drawing.fillAlpha })
      graphics.stroke({ width, color })
    }
  }
}

type ClosedShape = Extract<Drawing, { kind: 'circle' | 'rect' | 'ellipse' | 'polygon' }>

function traceClosedShape(graphics: Graphics, shape: ClosedShape): void {
  if (shape.kind === 'circle') graphics.circle(shape.cx, shape.cy, shape.radius)
  else if (shape.kind === 'rect') graphics.rect(shape.x, shape.y, shape.w, shape.h)
  else if (shape.kind === 'ellipse') graphics.ellipse(shape.cx, shape.cy, shape.rx, shape.ry)
  else graphics.poly(shape.points)
}

function tracePolyline(graphics: Graphics, points: DrawingPoint[]): void {
  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
}

function traceCurve(graphics: Graphics, points: DrawingPoint[]): void {
  const first = points[0]
  graphics.moveTo(first.x, first.y)
  for (const segment of catmullRomToBezierSegments(points)) {
    graphics.bezierCurveTo(segment.c1.x, segment.c1.y, segment.c2.x, segment.c2.y, segment.end.x, segment.end.y)
  }
}

/** Ponta reta (`butt`) deixaria as pontas sem moldura: o contorno usa `square`. */
function outlineCap(cap: DrawingCap): DrawingCap | 'square' {
  return cap === 'butt' ? 'square' : cap
}

/**
 * Traço livre por textura (feature N1, "pincel: caneta, lápis e afins").
 * `width`/`color` são os reais do desenho — a seleção é contorno à parte,
 * desenhado antes pelo chamador. A textura varia em cima desse valor, não o
 * substitui.
 *
 * O ramo 'pen' não passa por `lib/brushTexture.ts` de propósito, para garantir
 * que `texture === undefined` (todo mapa legado, e todo Drawing criado antes de
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
    tracePolyline(graphics, points)
    graphics.stroke({ width: markerWidth, color, alpha, cap, join: 'round' })
    return
  }

  tracePolyline(graphics, points)
  graphics.stroke({ width, color, cap, join: 'round' })
}
