import { describe, expect, it } from 'vitest'
import { contornoDoTom, corDoBarranco, luminanciaDoRgb, PISO_DO_CONTORNO, TONS_DO_BARRANCO } from './barranco'
import { oklabDoRgb } from './materiais'
import type { Rgb } from '../ruido'

function deltaE(a: Rgb, b: Rgb): number {
  const x = oklabDoRgb(a[0], a[1], a[2])
  const y = oklabDoRgb(b[0], b[1], b[2])
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

function saturacao(c: Rgb): number {
  const mx = Math.max(c[0], c[1], c[2])
  return mx > 0 ? (mx - Math.min(c[0], c[1], c[2])) / mx : 0
}

describe('barranco liso do Meio-Termo: os tons', () => {
  it('o contorno é o tom escuro da própria cor: nunca abaixo do piso, nunca preto, e se lê contra a sombra', () => {
    const { contorno, sombra, base } = TONS_DO_BARRANCO
    expect(luminanciaDoRgb(contorno)).toBeGreaterThanOrEqual(PISO_DO_CONTORNO)
    // Mais escuro que a sombra, no mesmo matiz quente (vermelho > verde > azul, como a base).
    expect(luminanciaDoRgb(contorno)).toBeLessThan(luminanciaDoRgb(sombra))
    expect(contorno[0]).toBeGreaterThan(contorno[1])
    expect(contorno[1]).toBeGreaterThan(contorno[2])
    expect(base[0]).toBeGreaterThan(base[1])
    expect(deltaE(contorno, sombra)).toBeGreaterThanOrEqual(0.06)
    expect(saturacao(contorno)).toBeLessThanOrEqual(0.62)
  })

  it('o piso sobe o contorno de uma cor escura demais (a receita do protótipo, não preto)', () => {
    const escuro = contornoDoTom([40, 30, 25], 0.06)
    expect(luminanciaDoRgb(escuro)).toBeGreaterThanOrEqual(0.06)
  })

  it('o perfil é liso: realce no lábio, sombra no pé, e nenhum degrau entre frações vizinhas', () => {
    const { realce, sombra } = TONS_DO_BARRANCO
    expect(corDoBarranco(0)).toEqual([...realce])
    expect(corDoBarranco(1)).toEqual([...sombra])
    const luz = (c: Rgb) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    let maiorSalto = 0
    let anterior = luz(corDoBarranco(0))
    for (let i = 1; i <= 100; i += 1) {
      const atual = luz(corDoBarranco(i / 100))
      // Desce do lábio ao pé, sem voltar a clarear (o veio claro do antigo voltava).
      expect(atual).toBeLessThanOrEqual(anterior + 1e-9)
      maiorSalto = Math.max(maiorSalto, anterior - atual)
      anterior = atual
    }
    // A cada 1% da altura, no máximo 2 de 255 (medido 1,72, com o arredondamento dos canais): o
    // antigo pulava ~45 de 255 do lábio para a terra e ~40 no veio, em ~2% da altura cada.
    expect(maiorSalto).toBeLessThanOrEqual(2)
  })
})
