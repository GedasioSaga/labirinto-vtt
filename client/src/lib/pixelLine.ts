/**
 * Traço de 1 px nítido, pixel a pixel (Bresenham), para linhas de mapa estilo
 * minimapa: sem antisserrilhado, sem meio-pixel borrado. Vértices em
 * coordenadas de mundo; o pixel (x, y) cobre [x, x+1) × [y, y+1), então o
 * vértice (x + 0.5, y + 0.5) cai exatamente no centro dele.
 *
 * Pontilhado alterna aceso/apagado ao longo do caminho inteiro, sem reiniciar
 * a cada segmento — assim a cadência não "tropeça" nos vértices.
 */

export interface PixelPoint {
  x: number
  y: number
}

export interface PixelLineInput {
  points: PixelPoint[]
  closed: boolean
  dotted: boolean
}

function bresenham(x0: number, y0: number, x1: number, y1: number, visit: (x: number, y: number) => void): void {
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0
  let y = y0
  for (;;) {
    visit(x, y)
    if (x === x1 && y === y1) return
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

/** Pixels acesos do traço, sem repetição, na ordem do caminho. */
export function rasterizePixelLine(line: PixelLineInput): PixelPoint[] {
  const vertices = line.points.map((p) => ({ x: Math.floor(p.x), y: Math.floor(p.y) }))
  if (vertices.length === 0) return []
  if (line.closed && vertices.length > 2) vertices.push(vertices[0])

  const out: PixelPoint[] = []
  const seen = new Set<number>()
  let step = 0
  let last: PixelPoint | null = null
  const visit = (x: number, y: number) => {
    // Ponta compartilhada entre dois segmentos: conta uma vez só.
    if (last && last.x === x && last.y === y) return
    last = { x, y }
    const lit = !line.dotted || step % 2 === 0
    step += 1
    const key = y * 65536 + x
    if (!lit || seen.has(key)) return
    seen.add(key)
    out.push({ x, y })
  }

  if (vertices.length === 1) {
    visit(vertices[0].x, vertices[0].y)
    return out
  }
  for (let i = 0; i + 1 < vertices.length; i += 1) {
    bresenham(vertices[i].x, vertices[i].y, vertices[i + 1].x, vertices[i + 1].y, visit)
  }
  return out
}
