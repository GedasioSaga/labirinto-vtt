/**
 * MEDIDAS DE PIXEL de uma imagem de móvel (RGBA de cor pura), com os
 * critérios das provas do protótipo aprovado (`docs/design/objetos/prototipo/
 * pagina.js:1000-1025`): pixel opaco = alfa ≥ 242; saturação HSV; brilho =
 * 0,2126 R + 0,7152 G + 0,0722 B em 0..1. O CONTORNO são os pixels opacos com
 * vizinho (dos 4) não opaco: a borda de cada peça contra o chão.
 *
 * Só para teste: nenhum código do app importa isto.
 */

/** Alfa a partir do qual o pixel conta como opaco (o mesmo do protótipo). */
export const ALFA_OPACO = 242

export interface MedidasDaImagem {
  readonly opacos: number
  readonly cobertura: number
  readonly saturacaoP95: number
  readonly brilhoMedio: number
  /** Menor brilho entre os pixels de contorno. */
  readonly contornoMinimo: number
  /** Menor brilho entre todos os pixels opacos. */
  readonly brilhoMinimo: number
}

function brilho(px: Uint8ClampedArray, i: number): number {
  return (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255
}

function opaco(px: Uint8ClampedArray, W: number, H: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= W || y >= H) return false
  return px[(y * W + x) * 4 + 3] >= ALFA_OPACO
}

/** `areaDaPegada` = a pegada do móvel em pixels da imagem (largura x altura x S²). */
export function medirImagem(px: Uint8ClampedArray, W: number, H: number, areaDaPegada: number): MedidasDaImagem {
  let opacos = 0
  let somaBrilho = 0
  let contornoMinimo = Infinity
  let brilhoMinimo = Infinity
  const saturacoes: number[] = []
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!opaco(px, W, H, x, y)) continue
      const i = (y * W + x) * 4
      const mx = Math.max(px[i], px[i + 1], px[i + 2])
      const mn = Math.min(px[i], px[i + 1], px[i + 2])
      saturacoes.push(mx > 0 ? (mx - mn) / mx : 0)
      const b = brilho(px, i)
      opacos += 1
      somaBrilho += b
      if (b < brilhoMinimo) brilhoMinimo = b
      const borda = !opaco(px, W, H, x - 1, y) || !opaco(px, W, H, x + 1, y) || !opaco(px, W, H, x, y - 1) || !opaco(px, W, H, x, y + 1)
      if (borda && b < contornoMinimo) contornoMinimo = b
    }
  }
  saturacoes.sort((a, b) => a - b)
  return {
    opacos,
    cobertura: opacos / areaDaPegada,
    saturacaoP95: saturacoes.length > 0 ? saturacoes[Math.floor(saturacoes.length * 0.95)] : 0,
    brilhoMedio: opacos > 0 ? somaBrilho / opacos : 0,
    contornoMinimo,
    brilhoMinimo,
  }
}

const FNV_BASE = 2166136261
const FNV_PRIMO = 16777619

/** Digital FNV-1a dos bytes: mesma imagem, mesma digital. */
export function digitalDosPixels(px: Uint8ClampedArray): number {
  let h = FNV_BASE
  for (let i = 0; i < px.length; i += 1) h = Math.imul(h ^ px[i], FNV_PRIMO)
  return h >>> 0
}
