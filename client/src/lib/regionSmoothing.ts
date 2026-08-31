import type { RegionPoint } from '../types/map'

/**
 * Diagonal do bounding box de `points` — usada como escala de referência do
 * epsilon de `simplifyPolygon`, pra que o corte seja proporcional ao tamanho
 * da forma (uma região grande tolera um desvio absoluto maior que uma pequena).
 */
function boundingBoxDiagonal(points: RegionPoint[]): number {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const width = Math.max(...xs) - Math.min(...xs)
  const height = Math.max(...ys) - Math.min(...ys)
  return Math.hypot(width, height)
}

/**
 * Distância perpendicular de `point` à RETA que passa por `lineStart` e
 * `lineEnd` (não ao segmento clampado) — é essa a distância que o algoritmo
 * de Douglas-Peucker usa pra decidir se um ponto intermediário é redundante
 * em relação aos dois vizinhos "importantes" que o cercam.
 */
function perpendicularDistance(point: RegionPoint, lineStart: RegionPoint, lineEnd: RegionPoint): number {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  if (dx === 0 && dy === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y)

  const numerator = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x)
  return numerator / Math.hypot(dx, dy)
}

/**
 * Douglas-Peucker recursivo clássico sobre a cadeia aberta `points[0]..points[n-1]`:
 * acha o ponto mais distante da reta entre os dois extremos; se esse desvio
 * máximo for maior que `epsilon`, o ponto fica e a cadeia é dividida ali pra
 * recursão continuar dos dois lados; senão, todo ponto do meio é descartado
 * (fica só o par de extremos). Os dois extremos da cadeia (`points[0]` e
 * `points[n-1]`) nunca são descartados por construção.
 */
function douglasPeucker(points: RegionPoint[], epsilon: number): RegionPoint[] {
  if (points.length < 3) return points

  const first = points[0]
  const last = points[points.length - 1]

  let maxDistance = 0
  let maxIndex = 0
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], first, last)
    if (distance > maxDistance) {
      maxDistance = distance
      maxIndex = i
    }
  }

  if (maxDistance <= epsilon) return [first, last]

  const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon)
  const right = douglasPeucker(points.slice(maxIndex), epsilon)
  // `left` termina no mesmo ponto em que `right` começa (points[maxIndex]) —
  // descarta essa ponta de `left` pra não duplicar.
  return [...left.slice(0, -1), ...right]
}

/**
 * Remove pontos redundantes/em ziguezague de um contorno de Região, mantendo
 * o formato geral — é o que tira o "serrilhado de pixel" de um contorno
 * extraído de imagem. `epsilon` é proporcional ao tamanho da forma
 * (`epsilonRatio * diagonal do bounding box`), não um valor absoluto, pra se
 * comportar igual em região pequena ou grande.
 *
 * Contorno com menos de 4 pontos já é mínimo (triângulo) e volta sem mudança.
 * Se o resultado do Douglas-Peucker cair abaixo de 3 pontos (forma degenerada
 * a ponto de "achatar"), a função recusa e devolve os pontos originais —
 * uma Região precisa de pelo menos 3 pontos pra existir (mesma invariante de
 * `removeRegionPoint` em mapFactory.ts).
 */
export function simplifyPolygon(points: RegionPoint[], epsilonRatio = 0.02): RegionPoint[] {
  if (points.length < 4) return points

  const epsilon = epsilonRatio * boundingBoxDiagonal(points)
  if (epsilon <= 0) return points

  const simplified = douglasPeucker(points, epsilon)
  return simplified.length >= 3 ? simplified : points
}

/**
 * Corte de canto de Chaikin, clássico: cada aresta `(p_i, p_{i+1})` do
 * polígono FECHADO (aresta `n-1 -> 0` incluída, mesma convenção de
 * `regionEdgeMidpoints` em roomLink.ts) vira 2 pontos novos — `Q` a 25% do
 * caminho e `R` a 75% — dobrando a contagem de pontos a cada iteração e
 * arredondando cada canto numa curva suave.
 *
 * Polígono com menos de 3 pontos não tem aresta que faça sentido cortar;
 * volta sem mudança.
 */
export function chaikinSmooth(points: RegionPoint[], iterations = 1): RegionPoint[] {
  let current = points

  for (let iter = 0; iter < iterations; iter += 1) {
    const n = current.length
    if (n < 3) break

    const next: RegionPoint[] = []
    for (let i = 0; i < n; i += 1) {
      const p = current[i]
      const q = current[(i + 1) % n]
      next.push({ x: 0.75 * p.x + 0.25 * q.x, y: 0.75 * p.y + 0.25 * q.y })
      next.push({ x: 0.25 * p.x + 0.75 * q.x, y: 0.25 * p.y + 0.75 * q.y })
    }
    current = next
  }

  return current
}
