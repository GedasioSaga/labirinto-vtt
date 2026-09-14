import type { TraceRect } from './traceImage'

/**
 * Topologia da silhueta de um minimapa: quantas ilhas de chão e quantos
 * buracos fechados. Mesmos limiares da comparação do harness
 * (`recreate/compareMasks.ts`): chão = verde ≥ 40 ou soma RGB ≥ 120,
 * componente 4-conexo com pelo menos 12 px, buraco = componente de fundo que
 * não toca a borda da área.
 */

export interface MaskTopology {
  islands: number
  holes: number
}

const MIN_COMPONENT = 12

export function isMaskFloor(r: number, g: number, b: number): boolean {
  return g >= 40 || r + g + b >= 120
}

/** `pixels` pode ser a imagem inteira (`width`) com `rect` dentro dela, ou já recortada (rect na origem). */
export function maskTopology(pixels: ArrayLike<number>, width: number, rect: TraceRect): MaskTopology {
  const { w, h } = rect
  const mask = new Uint8Array(w * h)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = ((rect.y + y) * width + rect.x + x) * 4
      mask[y * w + x] = isMaskFloor(pixels[i], pixels[i + 1], pixels[i + 2]) ? 1 : 0
    }
  }
  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  let islands = 0
  let holes = 0
  for (let start = 0; start < mask.length; start += 1) {
    if (seen[start]) continue
    const value = mask[start]
    let size = 0
    let touchesBorder = false
    stack.push(start)
    seen[start] = 1
    while (stack.length > 0) {
      const p = stack.pop() as number
      size += 1
      const x = p % w
      const y = (p - x) / w
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true
      if (x > 0 && !seen[p - 1] && mask[p - 1] === value) { seen[p - 1] = 1; stack.push(p - 1) }
      if (x < w - 1 && !seen[p + 1] && mask[p + 1] === value) { seen[p + 1] = 1; stack.push(p + 1) }
      if (y > 0 && !seen[p - w] && mask[p - w] === value) { seen[p - w] = 1; stack.push(p - w) }
      if (y < h - 1 && !seen[p + w] && mask[p + w] === value) { seen[p + w] = 1; stack.push(p + w) }
    }
    if (size < MIN_COMPONENT) continue
    if (value === 1) islands += 1
    else if (!touchesBorder) holes += 1
  }
  return { islands, holes }
}
