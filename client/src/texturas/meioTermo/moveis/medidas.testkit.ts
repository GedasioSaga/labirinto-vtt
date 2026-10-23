/**
 * MEDIDAS DE PIXEL de uma imagem de móvel (RGBA de cor pura), com os
 * critérios das provas do protótipo aprovado (`docs/design/objetos/prototipo/
 * pagina.js:1000-1025`): pixel opaco = alfa ≥ 242; saturação HSV; brilho =
 * 0,2126 R + 0,7152 G + 0,0722 B em 0..1. O CONTORNO são os pixels opacos com
 * vizinho (dos 4) não opaco: a borda de cada peça contra o chão.
 *
 * Só para teste: nenhum código do app importa isto.
 */
import { oklabDoRgb, type Oklab } from '../materiais'

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
  /** Menor luminância LINEAR (sRGB decodificado, Rec. 709) entre os pixels opacos: o piso do preto levantado. */
  readonly luminanciaLinearMinima: number
  /**
   * Opacidade média (0..1) do MIOLO das peças: pixel de peça (alfa ≥
   * `ALFA_DE_PECA`; a sombra no chão não chega lá) cujos 4 vizinhos também são
   * de peça. A borda suavizada fica de fora (na cadeira de lado, toda de
   * peças finas, ela é quase a imagem inteira); peça meio transparente sem
   * nada por baixo puxa a média para baixo mesmo quando já não conta como
   * opaca. A fresta de menos de 1 pixel entre duas peças (o assento e a
   * moldura no nível 1) fica no miolo e deixa o chão aparecer um pouco: por
   * isso o teto do teste é 0,96, e não o 0,98 dos pixels opacos.
   */
  readonly opacidadeDoMiolo: number
  /** Opacidade média (0..1) dos pixels opacos (alfa ≥ `ALFA_OPACO`). */
  readonly opacidadeDosOpacos: number
}

/** Alfa a partir do qual o pixel é de peça, não de sombra (a sombra mais forte tem alfa 0,34 x 255 = 87). */
export const ALFA_DE_PECA = 128

function brilho(px: Uint8ClampedArray, i: number): number {
  return (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255
}

function linear(c8: number): number {
  const u = c8 / 255
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
}

function luminanciaLinear(px: Uint8ClampedArray, i: number): number {
  return 0.2126 * linear(px[i]) + 0.7152 * linear(px[i + 1]) + 0.0722 * linear(px[i + 2])
}

function opaco(px: Uint8ClampedArray, W: number, H: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= W || y >= H) return false
  return px[(y * W + x) * 4 + 3] >= ALFA_OPACO
}

function dePeca(px: Uint8ClampedArray, W: number, H: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= W || y >= H) return false
  return px[(y * W + x) * 4 + 3] >= ALFA_DE_PECA
}

/** Os 4 vizinhos também são de peça: o pixel não está na borda suavizada. */
function deMiolo(px: Uint8ClampedArray, W: number, H: number, x: number, y: number): boolean {
  return dePeca(px, W, H, x - 1, y) && dePeca(px, W, H, x + 1, y) && dePeca(px, W, H, x, y - 1) && dePeca(px, W, H, x, y + 1)
}

/** `areaDaPegada` = a pegada do móvel em pixels da imagem (largura x altura x S²). */
export function medirImagem(px: Uint8ClampedArray, W: number, H: number, areaDaPegada: number): MedidasDaImagem {
  let opacos = 0
  let somaBrilho = 0
  let contornoMinimo = Infinity
  let brilhoMinimo = Infinity
  let luminanciaLinearMinima = Infinity
  let pixelsDePeca = 0
  let somaDaOpacidade = 0
  let somaDaOpacidadeDosOpacos = 0
  const saturacoes: number[] = []
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const alfa = px[(y * W + x) * 4 + 3]
      if (alfa >= ALFA_DE_PECA && deMiolo(px, W, H, x, y)) {
        pixelsDePeca += 1
        somaDaOpacidade += alfa / 255
      }
      if (!opaco(px, W, H, x, y)) continue
      const i = (y * W + x) * 4
      somaDaOpacidadeDosOpacos += alfa / 255
      const lin = luminanciaLinear(px, i)
      if (lin < luminanciaLinearMinima) luminanciaLinearMinima = lin
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
    luminanciaLinearMinima,
    opacidadeDoMiolo: pixelsDePeca > 0 ? somaDaOpacidade / pixelsDePeca : 0,
    opacidadeDosOpacos: opacos > 0 ? somaDaOpacidadeDosOpacos / opacos : 0,
  }
}

/** A cor média (OKLab, média por pixel) dos pixels opacos: o tom que o olho lê do móvel inteiro, com luz e textura. */
export function oklabMedio(px: Uint8ClampedArray, W: number, H: number): Oklab {
  let L = 0
  let a = 0
  let b = 0
  let n = 0
  for (let i = 0; i < W * H * 4; i += 4) {
    if (px[i + 3] < ALFA_OPACO) continue
    const [Li, ai, bi] = oklabDoRgb(px[i], px[i + 1], px[i + 2])
    L += Li
    a += ai
    b += bi
    n += 1
  }
  return n > 0 ? [L / n, a / n, b / n] : [0, 0, 0]
}

/** Distância euclidiana em OKLab. */
export function distanciaOklab(x: Oklab, y: Oklab): number {
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

const FNV_BASE = 2166136261
const FNV_PRIMO = 16777619

/** Digital FNV-1a dos bytes: mesma imagem, mesma digital. */
export function digitalDosPixels(px: Uint8ClampedArray): number {
  let h = FNV_BASE
  for (let i = 0; i < px.length; i += 1) h = Math.imul(h ^ px[i], FNV_PRIMO)
  return h >>> 0
}
