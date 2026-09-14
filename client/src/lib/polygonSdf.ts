/**
 * Distância assinada a polígono simples (negativa dentro), rápida para
 * polígono de muitos vértices — o caso de peça vetorizada de imagem, com
 * centenas de arestas. Força bruta custa O(arestas) por amostra; aqui as
 * arestas ficam num índice de células:
 * - sinal: regra par-ímpar só com as arestas da faixa horizontal do ponto;
 * - distância: busca em anéis de células a partir da célula do ponto, parando
 *   quando nenhuma aresta mais distante pode ser a mais próxima.
 * Longe da borda (além de `MAX_RINGS` células) devolve um LIMITE INFERIOR do
 * módulo, com o sinal certo — suficiente para o motor (floorSdf.ts), que só
 * precisa de valor exato perto da borda.
 */

export type PolygonDistance = (x: number, y: number) => number

interface Vertex {
  x: number
  y: number
}

/** Até aqui a força bruta ganha do índice. */
const BRUTE_FORCE_MAX_VERTICES = 24
/** Anéis de células examinados antes de desistir e devolver o limite inferior. */
const MAX_RINGS = 4

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const ex = bx - ax
  const ey = by - ay
  const wx = px - ax
  const wy = py - ay
  const lengthSq = ex * ex + ey * ey
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, (wx * ex + wy * ey) / lengthSq))
  return Math.hypot(wx - ex * t, wy - ey * t)
}

function crosses(px: number, py: number, ax: number, ay: number, bx: number, by: number): boolean {
  return (ay > py) !== (by > py) && px < ((bx - ax) * (py - ay)) / (by - ay) + ax
}

export function polygonDistanceBrute(px: number, py: number, vertices: Vertex[]): number {
  let best = Infinity
  let inside = false
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const a = vertices[j]
    const b = vertices[i]
    best = Math.min(best, segmentDistance(px, py, a.x, a.y, b.x, b.y))
    if (crosses(px, py, a.x, a.y, b.x, b.y)) inside = !inside
  }
  return inside ? -best : best
}

export function createPolygonDistance(vertices: Vertex[]): PolygonDistance {
  const n = vertices.length
  if (n < 3) return () => Infinity
  if (n <= BRUTE_FORCE_MAX_VERTICES) return (x, y) => polygonDistanceBrute(x, y, vertices)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const v of vertices) {
    minX = Math.min(minX, v.x)
    minY = Math.min(minY, v.y)
    maxX = Math.max(maxX, v.x)
    maxY = Math.max(maxY, v.y)
  }
  // ~2 arestas por célula em média, com piso para polígono minúsculo.
  const cell = Math.max(4, Math.sqrt(((maxX - minX + 1) * (maxY - minY + 1)) / n) * 2)
  const margin = cell * (MAX_RINGS + 1)
  const originX = minX - margin
  const originY = minY - margin
  const cols = Math.ceil((maxX - minX + 2 * margin) / cell) + 1
  const rows = Math.ceil((maxY - minY + 2 * margin) / cell) + 1

  const ax = new Float64Array(n)
  const ay = new Float64Array(n)
  const bx = new Float64Array(n)
  const by = new Float64Array(n)
  const cells: number[][] = Array.from({ length: cols * rows }, () => [])
  const rowEdges: number[][] = Array.from({ length: rows }, () => [])
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    ax[i] = vertices[j].x
    ay[i] = vertices[j].y
    bx[i] = vertices[i].x
    by[i] = vertices[i].y
    const c0 = Math.floor((Math.min(ax[i], bx[i]) - originX) / cell)
    const c1 = Math.floor((Math.max(ax[i], bx[i]) - originX) / cell)
    const r0 = Math.floor((Math.min(ay[i], by[i]) - originY) / cell)
    const r1 = Math.floor((Math.max(ay[i], by[i]) - originY) / cell)
    for (let r = r0; r <= r1; r += 1) {
      rowEdges[r].push(i)
      for (let c = c0; c <= c1; c += 1) cells[r * cols + c].push(i)
    }
  }

  return (x, y) => {
    const ci = Math.floor((x - originX) / cell)
    const cj = Math.floor((y - originY) / cell)
    // Fora do índice (só acontece com folga de ruído muito grande): força bruta, sempre correta.
    if (ci < 0 || cj < 0 || ci >= cols || cj >= rows) return polygonDistanceBrute(x, y, vertices)

    let inside = false
    for (const e of rowEdges[cj]) {
      if (crosses(x, y, ax[e], ay[e], bx[e], by[e])) inside = !inside
    }

    let best = Infinity
    for (let ring = 0; ring <= MAX_RINGS; ring += 1) {
      for (let r = cj - ring; r <= cj + ring; r += 1) {
        if (r < 0 || r >= rows) continue
        const edgeOfRing = r === cj - ring || r === cj + ring
        for (let c = ci - ring; c <= ci + ring; c += edgeOfRing ? 1 : 2 * ring) {
          if (c >= 0 && c < cols) {
            for (const e of cells[r * cols + c]) best = Math.min(best, segmentDistance(x, y, ax[e], ay[e], bx[e], by[e]))
          }
          if (ring === 0) break
        }
      }
      // Toda aresta ainda não vista está a pelo menos `ring * cell` do ponto.
      if (best <= ring * cell) break
    }
    const magnitude = Math.min(best, MAX_RINGS * cell)
    return inside ? -magnitude : magnitude
  }
}
