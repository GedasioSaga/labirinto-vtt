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
