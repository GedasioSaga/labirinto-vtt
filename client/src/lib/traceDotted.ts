import type { MapLine, RegionPoint } from '../types/map'
import type { TraceRect } from './traceImage'

/**
 * Vetoriza linhas pontilhadas antisserrilhadas: cada ponto é um componente
 * pequeno de pixels com intensidade de traço; pontos vizinhos (2–4,5 px) em
 * direções opostas se encadeiam em polilinha. Período, comprimento e
 * largura do ponto são medidos (momentos ponderados) em vez de fixos — no
 * Mapa3 o período é 3 px e o ponto ~1,35 × 1,4 px, diferente do pontilhado
 * de 1 px ligado / 1 desligado que `traceLines.ts` reconhece.
 */

type Weight = (r: number, g: number, b: number, a: number) => number

export interface TraceDottedOptions {
  rect: TraceRect
  weight: Weight
  /** Pixel de fundo: ponto a até `backgroundRadius` px dele é contorno do chão, não pontilhado. */
  isBackground: Weight
  backgroundRadius?: number
  color: string
}

export interface Dot {
  x: number
  y: number
  ink: number
  cxx: number
  cyy: number
  cxy: number
}

/**
 * Intensidade mínima para um pixel entrar num ponto. Com 0,25 a cauda
 * antisserrilhada de um ponto (~0,33 em algumas fases) encostava no ponto
 * seguinte e a linha virava um componente só; o miolo real fica em 0,45–0,75.
 */
const DOT_MIN_WEIGHT = 0.35
const DOT_MAX_AREA = 6
const DOT_MAX_SPAN = 3
const LINK_MIN = 2
const LINK_MAX = 4.5
/** Cosseno máximo entre as duas ligações de um ponto do meio: exige ~120° ou mais (linha, não zigue-zague). */
const LINK_MAX_COS = -0.5
const MIN_DOTS = 3
/** Distância aceita em volta do período medido para ligar dois pontos. */
const PERIOD_TOLERANCE = 0.7
const DEFAULT_BACKGROUND_RADIUS = 2

function toHex(color: string): string {
  return color
}

export function traceDottedLines(pixels: ArrayLike<number>, width: number, height: number, options: TraceDottedOptions, makeId: (index: number) => string): MapLine[] {
  const dots = detectDots(pixels, width, height, options)
  return chainDots(dots, options, makeId)
}

/** Passo 1: pontos (componentes pequenos acima do limiar) com centro e momentos ponderados. */
export function detectDots(pixels: ArrayLike<number>, width: number, height: number, options: TraceDottedOptions): Dot[] {
  const { rect, weight } = options
  const radius = options.backgroundRadius ?? DEFAULT_BACKGROUND_RADIUS
  const w = rect.w
  const h = rect.h
  const at = (sx: number, sy: number) => {
    const i = (sy * width + sx) * 4
    return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]] as const
  }
  const weights = new Float32Array(w * h)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [r, g, b, a] = at(rect.x + x, rect.y + y)
      weights[y * w + x] = weight(r, g, b, a)
    }
  }
  const nearBackground = (sx: number, sy: number) => {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const nx = sx + dx
        const ny = sy + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true
        const [r, g, b, a] = at(nx, ny)
        if (options.isBackground(r, g, b, a) > 0) return true
      }
    }
    return false
  }

  // 1. Pontos: componentes pequenos acima do limiar.
  const seen = new Uint8Array(w * h)
  const dots: Dot[] = []
  for (let start = 0; start < w * h; start += 1) {
    if (seen[start] || weights[start] < DOT_MIN_WEIGHT) continue
    const comp: number[] = []
    const stack = [start]
    seen[start] = 1
    let tooBig = false
    while (stack.length > 0) {
      const p = stack.pop() as number
      comp.push(p)
      if (comp.length > DOT_MAX_AREA) tooBig = true
      const x = p % w
      const y = (p - x) / w
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const q = ny * w + nx
          if (!seen[q] && weights[q] >= DOT_MIN_WEIGHT) {
            seen[q] = 1
            stack.push(q)
          }
        }
      }
    }
    if (tooBig) continue
    const xs = comp.map((p) => p % w)
    const ys = comp.map((p) => (p - (p % w)) / w)
    const x0 = Math.min(...xs)
    const y0 = Math.min(...ys)
    if (Math.max(...xs) - x0 + 1 > DOT_MAX_SPAN || Math.max(...ys) - y0 + 1 > DOT_MAX_SPAN) continue
    if (nearBackground(rect.x + x0, rect.y + y0)) continue
    // Momentos sobre a caixa com 1 px de folga: a borda fraca do ponto entra com o peso dela.
    let ink = 0
    let sx = 0
    let sy = 0
    const samples: { x: number; y: number; w: number }[] = []
    for (let y = Math.max(0, y0 - 1); y <= Math.min(h - 1, Math.max(...ys) + 1); y += 1) {
      for (let x = Math.max(0, x0 - 1); x <= Math.min(w - 1, Math.max(...xs) + 1); x += 1) {
        const wt = weights[y * w + x]
        if (wt <= 0) continue
        const cx = rect.x + x + 0.5
        const cy = rect.y + y + 0.5
        samples.push({ x: cx, y: cy, w: wt })
        ink += wt
        sx += wt * cx
        sy += wt * cy
      }
    }
    const mx = sx / ink
    const my = sy / ink
    let cxx = 0
    let cyy = 0
    let cxy = 0
    for (const s of samples) {
      cxx += s.w * (s.x - mx) ** 2
      cyy += s.w * (s.y - my) ** 2
      cxy += s.w * (s.x - mx) * (s.y - my)
    }
    dots.push({ x: mx, y: my, ink, cxx: cxx / ink, cyy: cyy / ink, cxy: cxy / ink })
  }
  return dots
}

/** Passos 2 e 3: liga os pontos pelo período e extrai as cadeias como linhas pontilhadas. */
export function chainDots(dots: Dot[], options: Pick<TraceDottedOptions, 'color'>, makeId: (index: number) => string): MapLine[] {

  // 2. Ligações guiadas pelo período: o espaçamento dominante entre vizinhos é o
  // período do pontilhado; liga todo par a essa distância (± tolerância) e, em
  // cada ponto com mais de 2 ligações, fica o par mais oposto. "Vizinho mais
  // próximo mútuo" quebrava a cadeia sempre que outra linha pontilhada passava perto
  // (medido: 73 pontos, 10 encadeados, num recorte do Mapa3).
  const cell = LINK_MAX
  const grid = new Map<string, number[]>()
  dots.forEach((d, i) => {
    const key = `${Math.floor(d.x / cell)}:${Math.floor(d.y / cell)}`
    const list = grid.get(key)
    if (list) list.push(i)
    else grid.set(key, [i])
  })
  const nearby = (i: number): { j: number; dist: number }[] => {
    const d = dots[i]
    const found: { j: number; dist: number }[] = []
    const gx = Math.floor(d.x / cell)
    const gy = Math.floor(d.y / cell)
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        for (const j of grid.get(`${gx + ox}:${gy + oy}`) ?? []) {
          if (j === i) continue
          const dist = Math.hypot(dots[j].x - d.x, dots[j].y - d.y)
          if (dist >= LINK_MIN && dist <= LINK_MAX) found.push({ j, dist })
        }
      }
    }
    return found
  }
  const candidatesByDot = dots.map((_, i) => nearby(i))
  const nearestDistances = candidatesByDot.filter((c) => c.length > 0).map((c) => Math.min(...c.map((x) => x.dist)))
  if (nearestDistances.length === 0) return []
  const period = [...nearestDistances].sort((a, b) => a - b)[Math.floor(nearestDistances.length / 2)]
  const linked = candidatesByDot.map((list) => list.filter((c) => Math.abs(c.dist - period) <= PERIOD_TOLERANCE))
  const pruned: number[][] = linked.map((list, i) => {
    if (list.length <= 2) return list.map((c) => c.j)
    const d = dots[i]
    let bestPair: [number, number] | null = null
    let bestCos = Infinity
    for (let a = 0; a < list.length; a += 1) {
      for (let b = a + 1; b < list.length; b += 1) {
        const pa = dots[list[a].j]
        const pb = dots[list[b].j]
        const cos = ((pa.x - d.x) * (pb.x - d.x) + (pa.y - d.y) * (pb.y - d.y)) / (list[a].dist * list[b].dist)
        if (cos < bestCos) {
          bestCos = cos
          bestPair = [list[a].j, list[b].j]
        }
      }
    }
    return bestPair && bestCos <= LINK_MAX_COS ? bestPair : [list.reduce((x, y) => (y.dist < x.dist ? y : x)).j]
  })
  const neighbors = pruned.map((list, i) => list.filter((j) => pruned[j].includes(i)))

  // 3. Cadeias.
  const used = new Uint8Array(dots.length)
  const chains: number[][] = []
  const walk = (start: number) => {
    const chain = [start]
    used[start] = 1
    let previous = -1
    let current = start
    for (;;) {
      const next = neighbors[current].find((j) => j !== previous && !used[j])
      if (next === undefined) break
      chain.push(next)
      used[next] = 1
      previous = current
      current = next
    }
    return chain
  }
  dots.forEach((_, i) => {
    if (!used[i] && neighbors[i].length <= 1) chains.push(walk(i))
  })
  dots.forEach((_, i) => {
    if (!used[i]) chains.push(walk(i))
  })

  const lines: MapLine[] = []
  const horizontal: boolean[] = []
  // Medida da caixa do ponto só na direção PERPENDICULAR à linha: ao longo dela a
  // variância soma a cauda dos pontos vizinhos (media ~2,6 px para um ponto de ~1,4).
  const widthSamples: number[] = []
  const heightSamples: number[] = []
  for (const chain of chains) {
    if (chain.length < MIN_DOTS) continue
    const points: RegionPoint[] = chain.map((i) => ({ x: dots[i].x, y: dots[i].y }))
    const isHorizontal = Math.abs(points[points.length - 1].x - points[0].x) >= Math.abs(points[points.length - 1].y - points[0].y)
    for (const i of chain) {
      if (isHorizontal) heightSamples.push(Math.sqrt(Math.max(0.25, 12 * dots[i].cyy - 1)))
      else widthSamples.push(Math.sqrt(Math.max(0.25, 12 * dots[i].cxx - 1)))
    }
    let length = 0
    for (let k = 1; k < points.length; k += 1) length += Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y)
    // Medidas do ponto ao longo e através da cadeia (variância de retângulo = L²/12, mais 1/12 do pixel).
    const along: number[] = []
    const across: number[] = []
    chain.forEach((i, k) => {
      const a = points[Math.max(0, k - 1)]
      const b = points[Math.min(points.length - 1, k + 1)]
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const ux = (b.x - a.x) / len
      const uy = (b.y - a.y) / len
      const d = dots[i]
      along.push(d.cxx * ux * ux + 2 * d.cxy * ux * uy + d.cyy * uy * uy)
      across.push(d.cxx * uy * uy - 2 * d.cxy * ux * uy + d.cyy * ux * ux)
    })
    const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
    const dotLength = Math.sqrt(Math.max(0.25, 12 * median(along) - 1))
    const dotWidth = Math.sqrt(Math.max(0.25, 12 * median(across) - 1))
    lines.push({
      id: makeId(lines.length),
      points: simplifyKeepingEnds(points),
      closed: false,
      dotted: true,
      color: toHex(options.color),
      width: dotWidth,
      dotPeriod: length / (chain.length - 1),
      dotLength,
    })
    horizontal.push(isHorizontal)
  }
  const medianOf = (values: number[]) => (values.length === 0 ? undefined : [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)])
  const dotWidth = medianOf(widthSamples)
  const dotHeight = medianOf(heightSamples)
  // Caixa única por mapa; se só existe uma orientação, o outro lado vem da medida ao longo da própria linha.
  return lines.map((line, k) => ({
    ...line,
    dotWidth: dotWidth ?? (horizontal[k] ? line.dotLength : line.width),
    dotHeight: dotHeight ?? (horizontal[k] ? line.width : line.dotLength),
  }))
}

/** Tira pontos colineares (desvio ≤ 0,35 px) mantendo as pontas: a cadência do pontilhado depende do comprimento. */
function simplifyKeepingEnds(points: RegionPoint[]): RegionPoint[] {
  if (points.length <= 2) return points
  const out = [points[0]]
  for (let k = 1; k < points.length - 1; k += 1) {
    const a = out[out.length - 1]
    const b = points[k + 1]
    const p = points[k]
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const dist = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / len
    if (dist > 0.35) out.push(p)
  }
  out.push(points[points.length - 1])
  return out
}
