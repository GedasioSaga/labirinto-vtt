import { describe, expect, it } from 'vitest'
import { LARGURA_MAXIMA, LARGURA_PADRAO, lerLarguraGuardada, prenderLargura } from './larguraDaPagina'

describe('largura da página do livro do mestre', () => {
  it('lixo no armazenamento volta ao padrão sem lançar; número fora da faixa é preso', () => {
    for (const lixo of [null, '', '   ', 'abc', '{"x":1}', 'NaN', 'Infinity', '-40', '0']) {
      expect(lerLarguraGuardada(lixo)).toBe(LARGURA_PADRAO)
    }
    expect(lerLarguraGuardada('400')).toBe(400)
    expect(lerLarguraGuardada(' 333.6 ')).toBe(334)
    expect(lerLarguraGuardada('100')).toBe(LARGURA_PADRAO)
    expect(lerLarguraGuardada('9999')).toBe(LARGURA_MAXIMA)
  })

  it('o teto segue a janela: em 1366 sobra mapa, em 1920 vale o teto, e nunca abaixo do padrão', () => {
    expect(prenderLargura(900, 1366)).toBe(1366 - 326 - 64 - 480)
    expect(prenderLargura(900, 1920)).toBe(LARGURA_MAXIMA)
    expect(prenderLargura(400, 1920)).toBe(400)
    expect(prenderLargura(400, 800)).toBe(LARGURA_PADRAO)
    expect(prenderLargura(Number.NaN, 1920)).toBe(LARGURA_PADRAO)
  })
})
