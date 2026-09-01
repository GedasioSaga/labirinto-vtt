import type { Graphics } from 'pixi.js'
import type { GridSettings } from '../types/map'

export interface GridLine {
  axis: 'x' | 'y'
  position: number
}

export interface Viewport {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Os 3 alvos que passam por snap de grade. `'wall'`/`'prop'` grudam no
 * vértice/aresta da célula; `'token'` gruda no centro — ver
 * `snapPointForTarget` em `tokenInteraction.ts`. Vive aqui (não em
 * `types/tools.ts`, que A4 não edita) para o store (`mapStore.ts`, do
 * integrador) importar sem precisar duplicar o tipo.
 */
export type SnapTargetKind = 'token' | 'wall' | 'prop'

/** Um toggle de snap por alvo — substitui o único `snapEnabled` booleano. */
export type SnapTargets = Record<SnapTargetKind, boolean>

export function computeVisibleGridLines(cellSize: number, viewport: Viewport): GridLine[] {
  if (cellSize <= 0) return []

  const lines: GridLine[] = []

  const startX = Math.floor(viewport.left / cellSize) * cellSize
  for (let x = startX; x < viewport.right + cellSize; x += cellSize) {
    lines.push({ axis: 'x', position: x })
  }

  const startY = Math.floor(viewport.top / cellSize) * cellSize
  for (let y = startY; y < viewport.bottom + cellSize; y += cellSize) {
    lines.push({ axis: 'y', position: y })
  }

  return lines
}

/** Comprimento do traço/vão em px de mundo para linha tracejada/pontilhada. */
const DASH_LENGTH = 10
const DASH_GAP = 6
const DOT_LENGTH = 2
const DOT_GAP = 6

/**
 * Traça um segmento reto entre dois pontos no `graphics` já aberto, quebrado
 * em traços/pontos quando `lineStyle` pede — Pixi 8 não tem dash nativo em
 * `Graphics` (só em `Text`/CSS), então o padrão é desenhado manualmente como
 * uma sequência de `moveTo`/`lineTo` curtos. Não chama `stroke()`: quem
 * chama decide o estilo do traço (cor/largura/alpha/cap) uma vez só, depois
 * de desenhar todos os segmentos — chamar `stroke()` por segmento reconstrói
 * a geometria da malha inteira a cada linha, muito mais caro.
 * Compartilhado por `drawGrid.ts` (linhas retas) e `drawHexGrid.ts` (arestas
 * de hexágono): mesmo padrão visual nos dois formatos de grade.
 */
export function strokeDashedSegment(graphics: Graphics, x1: number, y1: number, x2: number, y2: number, lineStyle: GridSettings['lineStyle']): void {
  if (lineStyle === 'solid') {
    graphics.moveTo(x1, y1).lineTo(x2, y2)
    return
  }

  const dash = lineStyle === 'dashed' ? DASH_LENGTH : DOT_LENGTH
  const gap = lineStyle === 'dashed' ? DASH_GAP : DOT_GAP
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)
  if (length === 0) return
  const ux = dx / length
  const uy = dy / length

  let travelled = 0
  while (travelled < length) {
    const segmentEnd = Math.min(travelled + dash, length)
    graphics.moveTo(x1 + ux * travelled, y1 + uy * travelled)
    graphics.lineTo(x1 + ux * segmentEnd, y1 + uy * segmentEnd)
    travelled = segmentEnd + gap
  }
}
