import type { MapFrameLayout, MapFrameTitle } from '../lib/mapFrame'

/**
 * Título da moldura desenhado num canvas 2D girado −90° (lê de baixo para
 * cima) e posicionado pela CAIXA DE TINTA, não pela métrica da fonte: o
 * mesmo bitmap é usado para escolher a fonte que mais bate com a referência
 * (`fitTitleFont`) e para desenhar — o resultado é determinístico.
 */

export interface TitleFont {
  family: string
  size: number
  weight: 'normal' | 'bold'
}

export interface TitleBitmap {
  canvas: HTMLCanvasElement
  /** Caixa de tinta dentro do canvas: esquerda/topo inclusivos, direita/base exclusivos. */
  inkLeft: number
  inkTop: number
  inkRight: number
  inkBottom: number
}

/** Tinta = alfa acima disso (canto antisserrilhado fraco não conta para a caixa). */
const INK_ALPHA = 48

export const TITLE_FONT_CANDIDATES: TitleFont[] = (() => {
  const families = ['Tahoma', 'Verdana', 'Arial', 'Segoe UI', 'Microsoft Sans Serif', 'Trebuchet MS', 'Calibri', 'Consolas', 'Lucida Console', 'Courier New', 'Georgia']
  const out: TitleFont[] = []
  for (const family of families) {
    for (const weight of ['normal', 'bold'] as const) {
      for (let size = 10; size <= 17; size += 1) out.push({ family, size, weight })
    }
  }
  return out
})()

export function renderTitleBitmap(text: string, font: TitleFont, color: string): TitleBitmap | null {
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) return null
  const css = `${font.weight} ${font.size}px "${font.family}"`
  measure.font = css
  const textWidth = Math.ceil(measure.measureText(text).width)
  const pad = font.size
  const canvas = document.createElement('canvas')
  canvas.width = font.size * 3
  canvas.height = textWidth + pad * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.font = css
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.translate(canvas.width / 2, canvas.height - pad)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText(text, 0, 0)

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  let inkLeft = Infinity
  let inkTop = Infinity
  let inkRight = -Infinity
  let inkBottom = -Infinity
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (data[(y * canvas.width + x) * 4 + 3] < INK_ALPHA) continue
      inkLeft = Math.min(inkLeft, x)
      inkTop = Math.min(inkTop, y)
      inkRight = Math.max(inkRight, x + 1)
      inkBottom = Math.max(inkBottom, y + 1)
    }
  }
  if (!Number.isFinite(inkLeft)) return null
  return { canvas, inkLeft, inkTop, inkRight, inkBottom }
}

/** Canto superior esquerdo do bitmap para a caixa de tinta ficar centrada em `cx` e terminar em `bottom`. */
export function titleBitmapOrigin(title: MapFrameTitle, bitmap: TitleBitmap): { x: number; y: number } {
  return {
    x: Math.round(title.cx - (bitmap.inkLeft + bitmap.inkRight) / 2),
    y: Math.round(title.bottom - bitmap.inkBottom),
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)]
}

/**
 * Escolhe a fonte cujo título, composto sobre o fundo da barra, tem a menor
 * diferença absoluta de cor com a referência na área do título.
 * `offsetX/offsetY` = onde a moldura está no mundo em relação ao layout.
 */
export function fitTitleFont(
  reference: ArrayLike<number>,
  width: number,
  height: number,
  layout: MapFrameLayout,
  offsetX: number,
  offsetY: number,
  barFill: string,
  candidates: TitleFont[] = TITLE_FONT_CANDIDATES,
): TitleFont | null {
  const title = layout.title
  if (!title) return null
  const [fr, fg, fb] = hexToRgb(barFill)
  const [tr, tg, tb] = hexToRgb(title.color)
  const x0 = Math.max(0, Math.floor(offsetX + title.cx - title.thickness))
  const x1 = Math.min(width, Math.ceil(offsetX + title.cx + title.thickness))
  const y0 = Math.max(0, Math.floor(offsetY + title.bottom - title.length - title.thickness))
  const y1 = Math.min(height, Math.ceil(offsetY + title.bottom + 2))

  let best: TitleFont | null = null
  let bestScore = Infinity
  for (const font of candidates) {
    const bitmap = renderTitleBitmap(title.text, font, title.color)
    if (!bitmap) continue
    const inkLength = bitmap.inkBottom - bitmap.inkTop
    // Comprimento de tinta muito diferente do medido: nem compara.
    if (Math.abs(inkLength - title.length) > title.length * 0.2) continue
    const origin = titleBitmapOrigin(title, bitmap)
    const ctx = bitmap.canvas.getContext('2d') as CanvasRenderingContext2D
    const glyph = ctx.getImageData(0, 0, bitmap.canvas.width, bitmap.canvas.height).data
    let score = 0
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const gx = x - offsetX - origin.x
        const gy = y - offsetY - origin.y
        let a = 0
        if (gx >= 0 && gy >= 0 && gx < bitmap.canvas.width && gy < bitmap.canvas.height) a = glyph[(gy * bitmap.canvas.width + gx) * 4 + 3] / 255
        const i = (y * width + x) * 4
        score +=
          Math.abs(reference[i] - (fr * (1 - a) + tr * a)) +
          Math.abs(reference[i + 1] - (fg * (1 - a) + tg * a)) +
          Math.abs(reference[i + 2] - (fb * (1 - a) + tb * a))
      }
    }
    if (score < bestScore) {
      bestScore = score
      best = font
    }
  }
  return best
}
