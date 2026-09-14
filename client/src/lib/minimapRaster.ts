import type { MapLine, MapMarker } from '../types/map'
import type { CompiledFloor } from './floorSdf'

/**
 * Rasterizador por software do estilo minimapa, com antisserrilhado por
 * cobertura: cada pixel é dividido em `samples × samples` subamostras e cada
 * camada (chão, traço da borda do chão, linhas, portas) marca as subamostras
 * que cobre numa máscara de bits. A cor final compõe as classes de subamostra
 * na ordem de cima para baixo — porta, linha, traço, chão, fundo — com o traço
 * e a linha translúcidos sobre o que estiver embaixo DAQUELA subamostra.
 *
 * É o modelo que reproduz os mapas de referência (render vetorial
 * antisserrilhado): filtro de caixa por pixel, medido contra `Objetivo/*.png`.
 * Longe de qualquer borda o pixel é classificado inteiro pelo centro, sem
 * subamostrar — só a faixa perto das bordas paga o custo.
 */

export type Rgb = [number, number, number]

export interface MinimapRasterStyle {
  background: Rgb
  floor: Rgb
  /** `null` desliga o traço da borda do chão. */
  stroke: Rgb | null
  strokeAlpha: number
  strokeWidth: number
  /** Opacidade das linhas (a cor vem de cada `MapLine`). */
  lineAlpha: number
  /** Subamostras por eixo (1..4). */
  samples: number
  /**
   * 'grid' = grade samples×samples. 'rooks' = mesma quantidade de subamostras
   * em n-torres (uma por linha e por coluna de uma grade samples²×samples²):
   * borda quase vertical ou horizontal ganha samples² níveis de cobertura em vez
   * de samples. `undefined` === 'grid'.
   */
  pattern?: 'grid' | 'rooks' | 'analytic'
  /** Com `pattern: 'analytic'`, também linhas e portas por área exata (padrão: só o chão). */
  analyticShapes?: boolean
}

/**
 * Área exata do pixel unitário centrado na origem que fica em {p : n·p ≤ s},
 * para normal unitária n. Borda reta → antisserrilhado sem quantização.
 */
export function halfPlaneCoverage(s: number, nx: number, ny: number): number {
  let a = Math.abs(nx)
  let b = Math.abs(ny)
  if (a < b) [a, b] = [b, a]
  const h = (a + b) / 2
  if (s <= -h) return 0
  if (s >= h) return 1
  if (b < 1e-6) return Math.min(1, Math.max(0, s + 0.5))
  const u = s + h
  if (u <= b) return (u * u) / (2 * a * b)
  if (u <= a) return (u - b / 2) / a
  const v = a + b - u
  return 1 - (v * v) / (2 * a * b)
}

/** Passo das diferenças centrais que estimam a normal do contorno no pixel. */
const GRADIENT_STEP = 0.5
const ELLIPSE_CLIP_SEGMENTS = 32

/** Área do polígono convexo `poly` (x,y alternados) recortado pelo pixel [x0,x0+1]×[y0,y0+1] (Sutherland-Hodgman). */
export function clippedPixelArea(poly: number[], x0: number, y0: number): number {
  let pts = poly
  const clip = (inside: (x: number, y: number) => boolean, cut: (ax: number, ay: number, bx: number, by: number) => [number, number]) => {
    const out: number[] = []
    const n = pts.length / 2
    for (let i = 0; i < n; i += 1) {
      const ax = pts[i * 2]
      const ay = pts[i * 2 + 1]
      const bx = pts[((i + 1) % n) * 2]
      const by = pts[((i + 1) % n) * 2 + 1]
      const aIn = inside(ax, ay)
      const bIn = inside(bx, by)
      if (aIn) out.push(ax, ay)
      if (aIn !== bIn) out.push(...cut(ax, ay, bx, by))
    }
    pts = out
  }
  const atX = (x: number) => (ax: number, ay: number, bx: number, by: number): [number, number] => [x, ay + ((by - ay) * (x - ax)) / (bx - ax)]
  const atY = (y: number) => (ax: number, ay: number, bx: number, by: number): [number, number] => [ax + ((bx - ax) * (y - ay)) / (by - ay), y]
  clip((x) => x >= x0, atX(x0))
  if (pts.length < 6) return 0
  clip((x) => x <= x0 + 1, atX(x0 + 1))
  if (pts.length < 6) return 0
  clip((_x, y) => y >= y0, atY(y0))
  if (pts.length < 6) return 0
  clip((_x, y) => y <= y0 + 1, atY(y0 + 1))
  if (pts.length < 6) return 0
  let area = 0
  const n = pts.length / 2
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    area += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1]
  }
  return Math.abs(area) / 2
}

/** Posições das subamostras dentro do pixel, em [0, 1)². */
export function subsamplePositions(samples: number, pattern: 'grid' | 'rooks' | 'analytic' = 'grid'): { x: number; y: number }[] {
  const s = Math.max(1, Math.min(MAX_SAMPLES, Math.round(samples)))
  const count = s * s
  if (pattern === 'rooks') {
    // Multiplicador coprimo com a quantidade: permutação que espalha as linhas.
    const step = count === 16 ? 7 : count === 9 ? 4 : count === 4 ? 3 : 1
    return Array.from({ length: count }, (_, i) => ({ x: (i + 0.5) / count, y: (((i * step) % count) + 0.5) / count }))
  }
  const positions: { x: number; y: number }[] = []
  for (let j = 0; j < s; j += 1) for (let i = 0; i < s; i += 1) positions.push({ x: (i + 0.5) / s, y: (j + 0.5) / s })
  return positions
}

export interface MinimapRasterInput {
  /** Canto superior esquerdo da área rasterizada, em px de mundo. */
  originX: number
  originY: number
  width: number
  height: number
  floor: CompiledFloor | null
  lines: MapLine[]
  markers: MapMarker[]
}

/** Metade da diagonal do pixel com folga: além disso do centro, nada muda dentro do pixel. */
const PIXEL_REACH = 0.75
const MAX_SAMPLES = 4
/** Período e comprimento do ponto do traço pontilhado, em px ao longo do caminho. */
const DOT_PERIOD = 2
const DOT_LENGTH = 1

const POPCOUNT = (() => {
  const table = new Uint8Array(1 << 16)
  for (let i = 1; i < table.length; i += 1) table[i] = table[i >> 1] + (i & 1)
  return table
})()

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0')
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}

interface Oriented {
  /** Origem local (início do segmento, ou centro do marcador). */
  ox: number
  oy: number
  ux: number
  uy: number
  /** Intervalo aceito ao longo de u e metade da largura em v. */
  uMin: number
  uMax: number
  halfV: number
  /** Elipse inscrita (semi-eixos `uMax` e `halfV`, centrada na origem) em vez do retângulo. */
  ellipse?: boolean
}

function insideOriented(shape: Oriented, x: number, y: number): boolean {
  const dx = x - shape.ox
  const dy = y - shape.oy
  const u = dx * shape.ux + dy * shape.uy
  const v = -dx * shape.uy + dy * shape.ux
  if (shape.ellipse) return (u / shape.uMax) ** 2 + (v / shape.halfV) ** 2 <= 1
  return u >= shape.uMin && u <= shape.uMax && Math.abs(v) <= shape.halfV
}

/** Folga (px) de quanto o centro do pixel está dentro (negativo) ou fora (positivo) da forma. */
function centerMargin(shape: Oriented, x: number, y: number): number {
  const dx = x - shape.ox
  const dy = y - shape.oy
  const u = dx * shape.ux + dy * shape.uy
  const v = -dx * shape.uy + dy * shape.ux
  if (shape.ellipse) {
    // (q − 1)·menor semi-eixo é limite inferior da distância à elipse, dos dois lados.
    const q = Math.hypot(u / shape.uMax, v / shape.halfV)
    return (q - 1) * Math.min(shape.uMax, shape.halfV)
  }
  return Math.max(shape.uMin - u, u - shape.uMax, Math.abs(v) - shape.halfV)
}

export function rasterizeMinimap(input: MinimapRasterInput, style: MinimapRasterStyle): Uint8ClampedArray {
  const { width: w, height: h, originX, originY } = input
  const s = Math.max(1, Math.min(MAX_SAMPLES, Math.round(style.samples)))
  const count = s * s
  const full = (1 << count) - 1
  const subsamples = subsamplePositions(s, style.pattern)

  const floorBits = new Uint16Array(w * h)
  const strokeBits = new Uint16Array(w * h)
  // Modo analítico: frações exatas por pixel em vez de máscara de subamostras.
  const analytic = style.pattern === 'analytic'
  const fracFloorOnly = analytic ? new Float32Array(w * h) : null
  const fracStrokeOnFloor = analytic ? new Float32Array(w * h) : null
  const fracStrokeOnBg = analytic ? new Float32Array(w * h) : null
  // Linhas e portas com cobertura exata só sob pedido: traço preto fino (escada) com cobertura
  // fracionária deixa de escurecer o pixel central e o buraco some (medido: Mapa3 16/16 → 8/16).
  const fracLine = analytic && style.analyticShapes ? new Float32Array(w * h) : null
  const fracMarker = analytic && style.analyticShapes ? new Float32Array(w * h) : null
  const lineBits = new Uint16Array(w * h)
  const markerBits = new Uint16Array(w * h)
  const lineColor = new Uint8Array(w * h * 3)
  const markerColor = new Uint8Array(w * h * 3)

  if (input.floor) {
    const { sample, lipschitz } = input.floor
    const strokeHalf = style.stroke ? style.strokeWidth / 2 : -1
    const reach = PIXEL_REACH * lipschitz
    for (let py = 0; py < h; py += 1) {
      for (let px = 0; px < w; px += 1) {
        const wx = originX + px
        const wy = originY + py
        const dc = sample(wx + 0.5, wy + 0.5)
        const i = py * w + px
        const nearEdge = Math.abs(dc) <= reach
        const nearStroke = strokeHalf >= 0 && Math.abs(Math.abs(dc) - strokeHalf) <= reach
        if (analytic && fracFloorOnly && fracStrokeOnFloor && fracStrokeOnBg) {
          const half = Math.max(0, strokeHalf)
          if (Math.abs(dc) > half + reach) {
            if (dc < 0) fracFloorOnly[i] = 1
            continue
          }
          // Normal pela diferença central da distância; o campo é ~linear dentro do pixel perto da borda.
          const gx = sample(wx + 0.5 + GRADIENT_STEP, wy + 0.5) - sample(wx + 0.5 - GRADIENT_STEP, wy + 0.5)
          const gy = sample(wx + 0.5, wy + 0.5 + GRADIENT_STEP) - sample(wx + 0.5, wy + 0.5 - GRADIENT_STEP)
          const norm = Math.hypot(gx, gy)
          const nx = norm > 1e-9 ? gx / norm : 1
          const ny = norm > 1e-9 ? gy / norm : 0
          // Distância em p ≈ dc + n·p: chão = {n·p < −dc}; traço = {|dc + n·p| ≤ half}.
          const inside = halfPlaneCoverage(-dc, nx, ny)
          if (strokeHalf < 0) {
            fracFloorOnly[i] = inside
          } else {
            const floorOnly = halfPlaneCoverage(-dc - half, nx, ny)
            const outerStroke = halfPlaneCoverage(half - dc, nx, ny)
            fracFloorOnly[i] = floorOnly
            fracStrokeOnFloor[i] = inside - floorOnly
            fracStrokeOnBg[i] = outerStroke - inside
          }
          continue
        }
        if (!nearEdge && !nearStroke) {
          if (dc < 0) floorBits[i] = full
          if (strokeHalf >= 0 && Math.abs(dc) < strokeHalf) strokeBits[i] = full
          continue
        }
        let fb = 0
        let sb = 0
        let bit = 1
        for (const sub of subsamples) {
          const d = sample(wx + sub.x, wy + sub.y)
          if (d < 0) fb |= bit
          if (strokeHalf >= 0 && Math.abs(d) <= strokeHalf) sb |= bit
          bit <<= 1
        }
        floorBits[i] = fb
        strokeBits[i] = sb
      }
    }
  }

  /** Contorno da forma em coordenadas de mundo (retângulo ou elipse poligonizada). */
  const outline = (shape: Oriented): number[] => {
    const px = -shape.uy
    const py = shape.ux
    if (shape.ellipse) {
      const pts: number[] = []
      for (let k = 0; k < ELLIPSE_CLIP_SEGMENTS; k += 1) {
        const t = (k / ELLIPSE_CLIP_SEGMENTS) * Math.PI * 2
        const u = Math.cos(t) * shape.uMax
        const v = Math.sin(t) * shape.halfV
        pts.push(shape.ox + u * shape.ux + v * px, shape.oy + u * shape.uy + v * py)
      }
      return pts
    }
    const corner = (u: number, v: number) => [shape.ox + u * shape.ux + v * px, shape.oy + u * shape.uy + v * py]
    return [...corner(shape.uMin, -shape.halfV), ...corner(shape.uMax, -shape.halfV), ...corner(shape.uMax, shape.halfV), ...corner(shape.uMin, shape.halfV)]
  }

  const paint = (shape: Oriented, bits: Uint16Array, colors: Uint8Array, rgb: Rgb, fraction: Float32Array | null = null) => {
    const poly = fraction ? outline(shape) : null
    const ex = Math.abs(shape.ux) * Math.max(Math.abs(shape.uMin), Math.abs(shape.uMax)) + Math.abs(shape.uy) * shape.halfV
    const ey = Math.abs(shape.uy) * Math.max(Math.abs(shape.uMin), Math.abs(shape.uMax)) + Math.abs(shape.ux) * shape.halfV
    const cx = shape.ox + shape.ux * (shape.uMin + shape.uMax) * 0.5
    const cy = shape.oy + shape.uy * (shape.uMin + shape.uMax) * 0.5
    const x0 = Math.max(0, Math.floor(cx - ex - originX - 1))
    const x1 = Math.min(w - 1, Math.ceil(cx + ex - originX + 1))
    const y0 = Math.max(0, Math.floor(cy - ey - originY - 1))
    const y1 = Math.min(h - 1, Math.ceil(cy + ey - originY + 1))
    for (let py = y0; py <= y1; py += 1) {
      for (let px = x0; px <= x1; px += 1) {
        const wx = originX + px
        const wy = originY + py
        const margin = centerMargin(shape, wx + 0.5, wy + 0.5)
        if (margin > PIXEL_REACH) continue
        if (fraction && poly) {
          // Cobertura exata: área da forma dentro do pixel. Sobreposição de formas soma (limitada a 1).
          const area = margin < -PIXEL_REACH ? 1 : clippedPixelArea(poly, wx, wy)
          if (area <= 0) continue
          const i = py * w + px
          fraction[i] = Math.min(1, fraction[i] + area)
          colors[i * 3] = rgb[0]
          colors[i * 3 + 1] = rgb[1]
          colors[i * 3 + 2] = rgb[2]
          continue
        }
        let b = 0
        if (margin < -PIXEL_REACH) {
          b = full
        } else {
          let bit = 1
          for (const sub of subsamples) {
            if (insideOriented(shape, wx + sub.x, wy + sub.y)) b |= bit
            bit <<= 1
          }
        }
        if (b === 0) continue
        const i = py * w + px
        bits[i] |= b
        colors[i * 3] = rgb[0]
        colors[i * 3 + 1] = rgb[1]
        colors[i * 3 + 2] = rgb[2]
      }
    }
  }

  for (const line of input.lines) {
    const rgb = hexToRgb(line.color)
    // Traço preto (escada, glifo) fica em subamostras: com cobertura exata o pixel central não
    // escurece o bastante e o buraco some. Cinza e demais cores usam área exata.
    const lineFraction = rgb[0] + rgb[1] + rgb[2] === 0 ? null : fracLine
    const halfV = line.width / 2
    const pts = line.points
    const segments = line.closed && pts.length > 2 ? pts.length : pts.length - 1
    let travelled = 0
    for (let k = 0; k < segments; k += 1) {
      const a = pts[k]
      const b = pts[(k + 1) % pts.length]
      const length = Math.hypot(b.x - a.x, b.y - a.y)
      if (length === 0) continue
      const ux = (b.x - a.x) / length
      const uy = (b.y - a.y) / length
      if (!line.dotted) {
        // Ponta quadrada: o traço de 1 px entre centros de pixel cobre os pixels das pontas inteiros.
        paint({ ox: a.x, oy: a.y, ux, uy, uMin: -halfV, uMax: length + halfV, halfV }, lineBits, lineColor, rgb, lineFraction)
      } else {
        // Pontos a cada `period` px de caminho, sem reiniciar a cadência no vértice.
        const period = line.dotPeriod ?? DOT_PERIOD
        const dotLength = line.dotLength ?? DOT_LENGTH
        const firstDot = Math.ceil(travelled / period - 1e-9) * period - travelled
        const screenBox = line.dotWidth !== undefined && line.dotHeight !== undefined
        for (let t = firstDot; t <= length + 1e-6; t += period) {
          if (screenBox) {
            const cx = a.x + ux * t
            const cy = a.y + uy * t
            const hw = (line.dotWidth as number) / 2
            paint({ ox: cx, oy: cy, ux: 1, uy: 0, uMin: -hw, uMax: hw, halfV: (line.dotHeight as number) / 2 }, lineBits, lineColor, rgb, lineFraction)
          } else {
            paint({ ox: a.x, oy: a.y, ux, uy, uMin: t - dotLength / 2, uMax: t + dotLength / 2, halfV }, lineBits, lineColor, rgb, lineFraction)
          }
        }
      }
      travelled += length
    }
    if (line.dotted && pts.length === 1) {
      paint({ ox: pts[0].x, oy: pts[0].y, ux: 1, uy: 0, uMin: -0.5, uMax: 0.5, halfV }, lineBits, lineColor, rgb, lineFraction)
    }
  }

  for (const marker of input.markers) {
    const rad = (marker.rotation * Math.PI) / 180
    paint(
      {
        ox: marker.cx,
        oy: marker.cy,
        ux: Math.cos(rad),
        uy: Math.sin(rad),
        uMin: -marker.w / 2,
        uMax: marker.w / 2,
        halfV: marker.h / 2,
        ellipse: marker.shape === 'ellipse',
      },
      markerBits,
      markerColor,
      hexToRgb(marker.color),
      fracMarker,
    )
  }

  const out = new Uint8ClampedArray(w * h * 4)
  const [br, bg, bb] = style.background
  const [fr, fg, fb] = style.floor
  const stroke = style.stroke ?? style.background
  const sa = style.strokeAlpha
  const la = style.lineAlpha
  if (analytic && fracFloorOnly && fracStrokeOnFloor && fracStrokeOnBg) {
    for (let i = 0; i < w * h; i += 1) {
      // Frações exatas de porta e linha; a linha por baixo da porta é suposta independente.
      const m = fracMarker ? Math.min(1, fracMarker[i]) : POPCOUNT[markerBits[i]] / count
      const bitsLine = POPCOUNT[lineBits[i] & ~markerBits[i] & full] / count
      const l = fracLine ? Math.min(1, fracLine[i] + bitsLine) * (1 - m) : bitsLine
      const rest = 1 - m - l
      const ff = fracFloorOnly[i]
      const sf = fracStrokeOnFloor[i]
      const sb = fracStrokeOnBg[i]
      const bgFrac = Math.max(0, 1 - ff - sf - sb)
      // Sob a linha, sem máscara de chão por subamostra: mistura proporcional à fração de chão do pixel.
      const floorFrac = ff + sf
      const o = i * 4
      for (let c = 0; c < 3; c += 1) {
        const bgc = style.background[c]
        const flc = style.floor[c]
        const stc = stroke[c]
        const base = ff * flc + sf * (sa * stc + (1 - sa) * flc) + sb * (sa * stc + (1 - sa) * bgc) + bgFrac * bgc
        const under = floorFrac * flc + (1 - floorFrac) * bgc
        out[o + c] = m * markerColor[i * 3 + c] + l * (la * lineColor[i * 3 + c] + (1 - la) * under) + rest * base
      }
      out[o + 3] = 255
    }
    return out
  }
  for (let i = 0; i < w * h; i += 1) {
    const m = markerBits[i]
    const l = lineBits[i] & ~m
    const st = strokeBits[i] & ~l & ~m
    const f = floorBits[i]
    const floorOnly = f & ~st & ~l & ~m
    const nm = POPCOUNT[m]
    const nlf = POPCOUNT[l & f]
    const nlb = POPCOUNT[l & ~f & full]
    const nsf = POPCOUNT[st & f]
    const nsb = POPCOUNT[st & ~f & full]
    const nf = POPCOUNT[floorOnly]
    const nbg = count - nm - nlf - nlb - nsf - nsb - nf
    const lr = lineColor[i * 3]
    const lg = lineColor[i * 3 + 1]
    const lb = lineColor[i * 3 + 2]
    const channel = (bgc: number, flc: number, stc: number, lnc: number, mkc: number) =>
      (nm * mkc +
        nlf * (la * lnc + (1 - la) * flc) +
        nlb * (la * lnc + (1 - la) * bgc) +
        nsf * (sa * stc + (1 - sa) * flc) +
        nsb * (sa * stc + (1 - sa) * bgc) +
        nf * flc +
        nbg * bgc) /
      count
    const o = i * 4
    out[o] = channel(br, fr, stroke[0], lr, markerColor[i * 3])
    out[o + 1] = channel(bg, fg, stroke[1], lg, markerColor[i * 3 + 1])
    out[o + 2] = channel(bb, fb, stroke[2], lb, markerColor[i * 3 + 2])
    out[o + 3] = 255
  }
  return out
}
