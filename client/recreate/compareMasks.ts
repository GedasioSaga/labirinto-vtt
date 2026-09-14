/**
 * Roda DENTRO do browser. Compara objetivo e tentativa em dois níveis:
 * - silhueta do chão (etapa 1): IoU, ilhas e buracos com retângulo de cada um,
 *   imagem de diferença (vermelho = faltou, azul = sobrou, cinza = acertou);
 * - cor pixel a pixel (etapas 2+, "frame por frame"): fração dos pixels com
 *   tinta (não-fundo em qualquer das duas) cuja cor bate dentro da tolerância.
 */

export interface Crop {
  x: number
  y: number
  w: number
  h: number
}

export interface ComponentBox {
  size: number
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface MaskReport {
  iou: number
  targetPixels: number
  attemptPixels: number
  missing: number
  extra: number
  targetIslands: number
  attemptIslands: number
  targetHoles: number
  attemptHoles: number
  targetHoleBoxes: ComponentBox[]
  attemptHoleBoxes: ComponentBox[]
  /** Pixels com tinta em qualquer das duas imagens. */
  inkPixels: number
  /** Fração de `inkPixels` com cor igual dentro de `COLOR_TOLERANCE`. */
  inkColorMatch: number
  diffUrl: string
  colorDiffUrl: string
}

/** Componente menor que isso (px) não conta como ilha/buraco: é antisserrilhado. */
const MIN_COMPONENT = 12
/** Soma das diferenças absolutas de R, G e B aceita como "mesma cor". */
const COLOR_TOLERANCE = 60
/** Abaixo disso (soma RGB) o pixel é fundo. */
const INK_MIN_SUM = 40

export async function loadPixels(url: string, width: number, height: number): Promise<Uint8ClampedArray> {
  const image = new Image()
  image.src = url
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  ctx.drawImage(image, 0, 0)
  return ctx.getImageData(0, 0, width, height).data
}

/** Chão = qualquer coisa que não seja fundo quase preto (inclui linhas, portas e poço sobre o chão). */
export function toMask(pixels: Uint8ClampedArray, width: number, height: number, crop: Crop): Uint8Array {
  const mask = new Uint8Array(crop.w * crop.h)
  for (let y = 0; y < crop.h; y += 1) {
    for (let x = 0; x < crop.w; x += 1) {
      const sx = x + crop.x
      const sy = y + crop.y
      if (sx >= width || sy >= height) continue
      const i = (sy * width + sx) * 4
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      mask[y * crop.w + x] = g >= 40 || r + g + b >= 120 ? 1 : 0
    }
  }
  return mask
}

/** Componentes 4-conexos com valor `value`; `enclosedOnly` ignora os que tocam a borda. */
function findComponents(mask: Uint8Array, w: number, h: number, value: number, enclosedOnly: boolean, crop: Crop): ComponentBox[] {
  const seen = new Uint8Array(mask.length)
  const stack: number[] = []
  const boxes: ComponentBox[] = []
  for (let start = 0; start < mask.length; start += 1) {
    if (seen[start] || mask[start] !== value) continue
    const box = { size: 0, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    let touchesBorder = false
    stack.push(start)
    seen[start] = 1
    while (stack.length > 0) {
      const p = stack.pop() as number
      const x = p % w
      const y = (p - x) / w
      box.size += 1
      box.x0 = Math.min(box.x0, x + crop.x)
      box.y0 = Math.min(box.y0, y + crop.y)
      box.x1 = Math.max(box.x1, x + crop.x)
      box.y1 = Math.max(box.y1, y + crop.y)
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true
      const neighbors = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]
      for (const n of neighbors) {
        if (n >= 0 && !seen[n] && mask[n] === value) {
          seen[n] = 1
          stack.push(n)
        }
      }
    }
    if (box.size >= MIN_COMPONENT && !(enclosedOnly && touchesBorder)) boxes.push(box)
  }
  return boxes.sort((a, b) => b.size - a.size)
}

export async function compareFloorMasks(
  targetUrl: string,
  attemptUrl: string,
  width: number,
  height: number,
  crop: Crop,
): Promise<MaskReport> {
  const targetRgba = await loadPixels(targetUrl, width, height)
  const attemptRgba = await loadPixels(attemptUrl, width, height)
  const target = toMask(targetRgba, width, height, crop)
  const attempt = toMask(attemptRgba, width, height, crop)

  const makeCanvas = () => {
    const canvas = document.createElement('canvas')
    canvas.width = crop.w
    canvas.height = crop.h
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    return { canvas, ctx, image: ctx.createImageData(crop.w, crop.h) }
  }
  const silhouette = makeCanvas()
  const colors = makeCanvas()

  let intersection = 0
  let union = 0
  let missing = 0
  let extra = 0
  let targetPixels = 0
  let attemptPixels = 0
  let inkPixels = 0
  let inkMatches = 0
  for (let y = 0; y < crop.h; y += 1) {
    for (let x = 0; x < crop.w; x += 1) {
      const i = y * crop.w + x
      const t = target[i]
      const a = attempt[i]
      targetPixels += t
      attemptPixels += a
      const o = i * 4
      const d = silhouette.image.data
      d[o + 3] = 255
      if (t && a) {
        intersection += 1
        union += 1
        d[o] = d[o + 1] = d[o + 2] = 90
      } else if (t) {
        union += 1
        missing += 1
        d[o] = 255
      } else if (a) {
        union += 1
        extra += 1
        d[o + 1] = 120
        d[o + 2] = 255
      }

      // Cor: pixel da tentativa desenhado esmaecido; o que não bate fica magenta.
      const s = ((y + crop.y) * width + x + crop.x) * 4
      const tr = targetRgba[s]
      const tg = targetRgba[s + 1]
      const tb = targetRgba[s + 2]
      const ar = attemptRgba[s]
      const ag = attemptRgba[s + 1]
      const ab = attemptRgba[s + 2]
      const c = colors.image.data
      c[o + 3] = 255
      if (tr + tg + tb < INK_MIN_SUM && ar + ag + ab < INK_MIN_SUM) continue
      inkPixels += 1
      if (Math.abs(tr - ar) + Math.abs(tg - ag) + Math.abs(tb - ab) <= COLOR_TOLERANCE) {
        inkMatches += 1
        c[o] = ar >> 2
        c[o + 1] = ag >> 2
        c[o + 2] = ab >> 2
      } else {
        c[o] = 255
        c[o + 2] = 255
      }
    }
  }
  silhouette.ctx.putImageData(silhouette.image, 0, 0)
  colors.ctx.putImageData(colors.image, 0, 0)

  const targetHoleBoxes = findComponents(target, crop.w, crop.h, 0, true, crop)
  const attemptHoleBoxes = findComponents(attempt, crop.w, crop.h, 0, true, crop)
  return {
    iou: union === 0 ? 1 : intersection / union,
    targetPixels,
    attemptPixels,
    missing,
    extra,
    targetIslands: findComponents(target, crop.w, crop.h, 1, false, crop).length,
    attemptIslands: findComponents(attempt, crop.w, crop.h, 1, false, crop).length,
    targetHoles: targetHoleBoxes.length,
    attemptHoles: attemptHoleBoxes.length,
    targetHoleBoxes,
    attemptHoleBoxes,
    inkPixels,
    inkColorMatch: inkPixels === 0 ? 1 : inkMatches / inkPixels,
    diffUrl: silhouette.canvas.toDataURL('image/png'),
    colorDiffUrl: colors.canvas.toDataURL('image/png'),
  }
}
