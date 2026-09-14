import type { MapLine, MapMarker } from '../types/map'
import type { TraceRect } from './traceImage'
import { traceLines } from './traceLines'
import { refineLine } from './refineLines'
import { estimateLineWidth } from './estimateStroke'

/**
 * Detalhes ESCUROS desenhados sobre o chão dos mapas de referência: barras
 * pretas finas (hachura de escada, glifo "II") e manchas verde-escuras
 * (poço). Vetorizados como buraco no chão eles ganhavam contorno cinza e
 * cor errada; aqui viram `MapLine` preta e `MapMarker` elíptico, e
 * `paintOver` apaga os dois da imagem antes de vetorizar o chão.
 */

type Weight = (r: number, g: number, b: number, a: number) => number

/** Soma RGB abaixo disso = pixel escuro (preto e o miolo antisserrilhado do traço). */
const DARK_MAX_SUM = 90
/** Componente escuro maior que isso não é traço (buraco, pátio, fundo). */
const STROKE_MAX_AREA = 400
/**
 * Fração máxima de pixels "miolo" (4 vizinhos escuros) num traço fino. Traço de
 * 1 px com borda antisserrilhada tem 3 px escuros (miolo ~0,33, medido na
 * escada do Mapa3); corredor preto de 4–5 px tem miolo ≥ 0,5.
 */
const STROKE_MAX_CORE_RATIO = 0.42
/** Traço mais curto que isso é fresta (buraco que conta), não hachura: barra da escada mede 18 px. */
const STROKE_MIN_SPAN = 12
/** Acima desta fração de vizinhos cinzas o componente é buraco contornado, não traço. */
const STROKE_MAX_GRAY_NEIGHBORS = 0.25
const GRAY_SPREAD = 14
const GRAY_MIN_SUM = 200
/** Mancha verde-escura: área e fração de miolo mínimas (é cheia, não traço). */
const BLOB_MIN_AREA = 30
const BLOB_MIN_CORE_RATIO = 0.4
const GREEN_FULL = 107
const DARK_GREEN_FULL = 51
const DEFAULT_DARK_LINE_WIDTH = 1.5

const isDark = (r: number, g: number, b: number) => r + g + b < DARK_MAX_SUM
const isDarkGreen = (r: number, g: number, b: number) => r < 40 && b < 40 && g >= 25 && g <= 85

/** Intensidade de traço preto sobre verde: 0 no verde cheio, 1 no preto. */
export const darkStrokeWeight: Weight = (r, g, b, a) => (a > 0 && r < 40 && b < 40 ? Math.max(0, Math.min(1, 1 - g / GREEN_FULL)) : 0)

interface Component {
  pixels: number[]
  core: number
  touchesBorder: boolean
}

/** Componentes 8-conexos do predicado dentro de `rect`; índices no espaço da imagem inteira. */
function components(pixels: ArrayLike<number>, width: number, rect: TraceRect, test: (r: number, g: number, b: number) => boolean): Component[] {
  const w = rect.w
  const h = rect.h
  const on = new Uint8Array(w * h)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = ((rect.y + y) * width + rect.x + x) * 4
      if (test(pixels[i], pixels[i + 1], pixels[i + 2])) on[y * w + x] = 1
    }
  }
  const seen = new Uint8Array(w * h)
  const found: Component[] = []
  for (let start = 0; start < on.length; start += 1) {
    if (!on[start] || seen[start]) continue
    const comp: Component = { pixels: [], core: 0, touchesBorder: false }
    const stack = [start]
    seen[start] = 1
    while (stack.length > 0) {
      const p = stack.pop() as number
      const x = p % w
      const y = (p - x) / w
      comp.pixels.push((rect.y + y) * width + rect.x + x)
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) comp.touchesBorder = true
      const orth = [x > 0 && on[p - 1], x < w - 1 && on[p + 1], y > 0 && on[p - w], y < h - 1 && on[p + w]]
      if (orth.every(Boolean)) comp.core += 1
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const q = ny * w + nx
          if (on[q] && !seen[q]) {
            seen[q] = 1
            stack.push(q)
          }
        }
      }
    }
    found.push(comp)
  }
  return found
}

/**
 * O componente fecha algum pixel que não é dele? Flood fill a partir da borda
 * da caixa (com 1 px de folga): o que sobrar sem alcançar está cercado.
 */
function enclosesSomething(comp: Component, width: number): boolean {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of comp.pixels) {
    const x = p % width
    const y = (p - x) / width
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  const bw = x1 - x0 + 3
  const bh = y1 - y0 + 3
  const blocked = new Uint8Array(bw * bh)
  for (const p of comp.pixels) {
    const x = p % width
    const y = (p - x) / width
    blocked[(y - y0 + 1) * bw + (x - x0 + 1)] = 1
  }
  const reached = new Uint8Array(bw * bh)
  const stack: number[] = []
  for (let x = 0; x < bw; x += 1) stack.push(x, (bh - 1) * bw + x)
  for (let y = 0; y < bh; y += 1) stack.push(y * bw, y * bw + bw - 1)
  while (stack.length > 0) {
    const c = stack.pop() as number
    if (reached[c] || blocked[c]) continue
    reached[c] = 1
    const x = c % bw
    if (x > 0) stack.push(c - 1)
    if (x < bw - 1) stack.push(c + 1)
    if (c >= bw) stack.push(c - bw)
    if (c < bw * (bh - 1)) stack.push(c + bw)
  }
  for (let c = 0; c < bw * bh; c += 1) if (!blocked[c] && !reached[c]) return true
  return false
}

/**
 * Fração dos vizinhos (4-conexos, fora do componente) que são traço cinza. Buraco
 * de verdade no chão tem o contorno cinza do chão em volta (fresta do mapa2:
 * vizinhos #7b7c7b); traço preto desenhado sobre o chão só encosta em verde.
 */
function grayNeighborFraction(comp: Component, pixels: ArrayLike<number>, width: number, height: number): number {
  const inside = new Set(comp.pixels)
  let total = 0
  let gray = 0
  for (const p of comp.pixels) {
    const x = p % width
    const y = (p - x) / width
    const around = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1]
    for (const q of around) {
      if (q < 0 || inside.has(q)) continue
      total += 1
      const i = q * 4
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      if (Math.abs(r - g) <= GRAY_SPREAD && Math.abs(g - b) <= GRAY_SPREAD && r + g + b >= GRAY_MIN_SUM) gray += 1
    }
  }
  return total === 0 ? 0 : gray / total
}

function span(comp: Component, width: number): number {
  const xs = comp.pixels.map((p) => p % width)
  const ys = comp.pixels.map((p) => (p - (p % width)) / width)
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 1
}

/**
 * Máscara (imagem inteira) dos traços escuros finos cercados de chão. Fica de
 * fora o que é buraco de verdade: componente que envolve chão (glifo "II" do
 * Mapa3 tem miolo verde — as 3 ilhas pequenas do mapa) e fresta curta.
 */
export function darkStrokeMask(pixels: ArrayLike<number>, width: number, height: number, rect: TraceRect): Uint8Array {
  const mask = new Uint8Array(width * height)
  for (const comp of components(pixels, width, rect, isDark)) {
    if (comp.touchesBorder || comp.pixels.length > STROKE_MAX_AREA) continue
    if (comp.core / comp.pixels.length > STROKE_MAX_CORE_RATIO) continue
    if (span(comp, width) < STROKE_MIN_SPAN || enclosesSomething(comp, width)) continue
    if (grayNeighborFraction(comp, pixels, width, height) > STROKE_MAX_GRAY_NEIGHBORS) continue
    for (const p of comp.pixels) mask[p] = 1
  }
  return mask
}

function toHex(n: number): string {
  return Math.round(n).toString(16).padStart(2, '0')
}

/** Manchas verde-escuras cheias (poço) como elipse ajustada por momentos ponderados. */
export function darkGreenBlobs(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  rect: TraceRect,
  makeId: (index: number) => string,
): { markers: MapMarker[]; mask: Uint8Array } {
  const mask = new Uint8Array(width * height)
  const markers: MapMarker[] = []
  for (const comp of components(pixels, width, rect, isDarkGreen)) {
    if (comp.pixels.length < BLOB_MIN_AREA || comp.core / comp.pixels.length < BLOB_MIN_CORE_RATIO) continue
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const p of comp.pixels) {
      const x = p % width
      const y = (p - x) / width
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
    // Momentos sobre a caixa com 2 px de folga: a borda antisserrilhada entra com peso parcial.
    let sw = 0
    let sx = 0
    let sy = 0
    let cr = 0
    let cg = 0
    let cb = 0
    let coreWeight = 0
    const samples: { x: number; y: number; w: number }[] = []
    for (let y = Math.max(0, y0 - 2); y <= Math.min(height - 1, y1 + 2); y += 1) {
      for (let x = Math.max(0, x0 - 2); x <= Math.min(width - 1, x1 + 2); x += 1) {
        const i = (y * width + x) * 4
        const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]]
        if (r >= 40 || b >= 40 || g < 25) continue
        const w = Math.max(0, Math.min(1, (GREEN_FULL - g) / (GREEN_FULL - DARK_GREEN_FULL)))
        if (w <= 0) continue
        samples.push({ x: x + 0.5, y: y + 0.5, w })
        sw += w
        sx += w * (x + 0.5)
        sy += w * (y + 0.5)
        if (w >= 0.95) {
          cr += r
          cg += g
          cb += b
          coreWeight += 1
        }
        mask[y * width + x] = 1
      }
    }
    if (sw === 0 || coreWeight === 0) continue
    const mx = sx / sw
    const my = sy / sw
    let cxx = 0
    let cyy = 0
    let cxy = 0
    for (const s of samples) {
      cxx += s.w * (s.x - mx) ** 2
      cyy += s.w * (s.y - my) ** 2
      cxy += s.w * (s.x - mx) * (s.y - my)
    }
    cxx /= sw
    cyy /= sw
    cxy /= sw
    const angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy)
    const ux = Math.cos(angle)
    const uy = Math.sin(angle)
    const varU = cxx * ux * ux + 2 * cxy * ux * uy + cyy * uy * uy
    const varV = cxx * uy * uy - 2 * cxy * ux * uy + cyy * ux * ux
    // Elipse uniforma de semi-eixo a: variância a²/4; o filtro de caixa do pixel soma 1/12.
    const a = Math.sqrt(Math.max(0, 4 * (varU - 1 / 12)))
    const b = Math.sqrt(Math.max(0, 4 * (varV - 1 / 12)))
    markers.push({
      id: makeId(markers.length),
      cx: mx,
      cy: my,
      w: 2 * a,
      h: 2 * b,
      rotation: (angle * 180) / Math.PI,
      color: `#${toHex(cr / coreWeight)}${toHex(cg / coreWeight)}${toHex(cb / coreWeight)}`,
      shape: 'ellipse',
    })
  }
  return { markers, mask }
}

/**
 * Cópia da imagem com os pixels da máscara (mais `dilate` px em volta que não
 * sejam traço cinza nem porta) pintados de `rgb`.
 */
export function paintOver(pixels: ArrayLike<number>, width: number, height: number, mask: Uint8Array, rgb: [number, number, number], dilate: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length)
  for (let i = 0; i < pixels.length; i += 1) out[i] = pixels[i]
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue
      for (let dy = -dilate; dy <= dilate; dy += 1) {
        for (let dx = -dilate; dx <= dilate; dx += 1) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const i = (ny * width + nx) * 4
          const isMaskPixel = dx === 0 && dy === 0
          // Vizinho só é pintado se for escuro ou esverdeado: não apaga linha cinza nem porta laranja encostada.
          if (!isMaskPixel && !(out[i] < 40 && out[i + 2] < 40)) continue
          out[i] = rgb[0]
          out[i + 1] = rgb[1]
          out[i + 2] = rgb[2]
        }
      }
    }
  }
  return out
}

/** Traços escuros da máscara como `MapLine` preta, ajustados ao antisserrilhado e com largura medida. */
export function traceDarkLines(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  mask: Uint8Array,
  rect: TraceRect,
  makeId: (index: number) => string,
): MapLine[] {
  // Imagem sintética: traço = cinza, resto = verde — reaproveita a vetorização de traço cinza.
  const synthetic = new Uint8ClampedArray(width * height * 4)
  for (let p = 0; p < width * height; p += 1) {
    const o = p * 4
    synthetic[o] = mask[p] ? 133 : 0
    synthetic[o + 1] = mask[p] ? 133 : 107
    synthetic[o + 2] = mask[p] ? 133 : 0
    synthetic[o + 3] = 255
  }
  const traced = traceLines(synthetic, width, height, { rect, minPixels: 2 })
  const refined = traced.map((line) => ({
    points: refineLine(line, pixels, width, height, { weight: darkStrokeWeight, radius: 1.2 }),
    closed: line.closed,
    dotted: false,
  }))
  const lineWidth = estimateLineWidth(pixels, width, height, refined, darkStrokeWeight) ?? DEFAULT_DARK_LINE_WIDTH
  return refined.map((line, index) => ({ id: makeId(index), ...line, color: '#000000', width: lineWidth }))
}
