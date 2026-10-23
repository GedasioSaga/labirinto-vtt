/**
 * MEDIDAS DE REPETIÇÃO de uma imagem em tons de cinza (um byte por pixel),
 * para os testes do chão sem período do Meio-Termo. O critério é o da prova
 * (i) do protótipo aprovado (`docs/design/vila-meio-termo/README.md:98` e
 * `provas/gerar-provas.cjs:301-351`):
 *
 * - blocos de 96 x 96 px: nenhum par igual (FNV-1a sobre os bytes do bloco);
 * - autocorrelação do DETALHE (luz menos a média numa caixa de 9 x 9) sem pico
 *   acima de 0,3 de 16 a 384 px, nos dois eixos, de 4 em 4 px de atraso e
 *   lendo 1 pixel a cada 2 (como a prova).
 *
 * Só para teste: nenhum código do app importa isto.
 */

export interface Cinza {
  readonly largura: number
  readonly altura: number
  /** Um byte de luz por pixel, linha a linha. */
  readonly luz: Uint8Array
}

const FNV_BASE = 2166136261
const FNV_PRIMO = 16777619

/** Quantos blocos de `lado` x `lado` repetem EXATAMENTE um bloco anterior da grade. */
export function blocosIguais(img: Cinza, lado: number): { blocos: number; iguais: number } {
  const vistos = new Set<number>()
  let blocos = 0
  let iguais = 0
  for (let by = 0; by + lado <= img.altura; by += lado) {
    for (let bx = 0; bx + lado <= img.largura; bx += lado) {
      let h = FNV_BASE
      for (let y = by; y < by + lado; y += 1) {
        const linha = y * img.largura
        for (let x = bx; x < bx + lado; x += 1) h = Math.imul(h ^ img.luz[linha + x], FNV_PRIMO)
      }
      blocos += 1
      const chave = h >>> 0
      if (vistos.has(chave)) iguais += 1
      else vistos.add(chave)
    }
  }
  return { blocos, iguais }
}

/** Raio da caixa da média local (9 x 9). */
const RAIO_DO_DETALHE = 4

/** Luz menos a média da caixa de 9 x 9 em volta (imagem integral); a borda fica 0. */
function detalhe(img: Cinza): Float32Array {
  const W = img.largura
  const H = img.altura
  const soma = new Float64Array((W + 1) * (H + 1))
  for (let y = 0; y < H; y += 1) {
    let linha = 0
    for (let x = 0; x < W; x += 1) {
      linha += img.luz[y * W + x]
      soma[(y + 1) * (W + 1) + x + 1] = soma[y * (W + 1) + x + 1] + linha
    }
  }
  const R = RAIO_DO_DETALHE
  const area = (2 * R + 1) * (2 * R + 1)
  const fino = new Float32Array(W * H)
  for (let y = R; y < H - R; y += 1) {
    for (let x = R; x < W - R; x += 1) {
      const s = soma[(y + R + 1) * (W + 1) + x + R + 1] - soma[(y - R) * (W + 1) + x + R + 1] - soma[(y + R + 1) * (W + 1) + x - R] + soma[(y - R) * (W + 1) + x - R]
      fino[y * W + x] = img.luz[y * W + x] - s / area
    }
  }
  return fino
}

export interface PicoDeAutocorrelacao {
  readonly r: number
  readonly atraso: number
  readonly eixo: 'x' | 'y'
}

/** O maior valor da autocorrelação do detalhe entre `de` e `ate` px de atraso, de `passo` em `passo`. */
export function maiorAutocorrelacao(img: Cinza, de = 16, ate = 384, passo = 4): PicoDeAutocorrelacao {
  const W = img.largura
  const H = img.altura
  const fino = detalhe(img)
  let energia = 0
  for (let i = 0; i < fino.length; i += 1) energia += fino[i] * fino[i]
  let maior: PicoDeAutocorrelacao = { r: -Infinity, atraso: 0, eixo: 'x' }
  if (energia === 0) return maior
  for (let atraso = de; atraso <= ate; atraso += passo) {
    for (const eixo of ['x', 'y'] as const) {
      const dx = eixo === 'x' ? atraso : 0
      const dy = eixo === 'y' ? atraso : 0
      let s = 0
      for (let y = 0; y + dy < H; y += 2) {
        for (let x = 0; x + dx < W; x += 2) s += fino[y * W + x] * fino[(y + dy) * W + x + dx]
      }
      // Lendo 1 pixel a cada 2 nos dois eixos, a soma cobre 1/4 da energia.
      const r = (s * 4) / energia
      if (r > maior.r) maior = { r, atraso, eixo }
    }
  }
  return maior
}
