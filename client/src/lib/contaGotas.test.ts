/**
 * CONTA-GOTAS DO MAPA, parte pura: o pixel lido do Pixi vira o `#rrggbb` do
 * `<input type="color">`, e o ponto da tela vira o pixel inteiro a ler.
 */
import { describe, expect, it } from 'vitest'
import { pixelDaTela, rgbaParaHex } from './contaGotas'

describe('rgbaParaHex', () => {
  it('sai em #rrggbb minúsculo, com zero à esquerda', () => {
    expect(rgbaParaHex(255, 0, 0)).toBe('#ff0000')
    expect(rgbaParaHex(10, 171, 205, 255)).toBe('#0aabcd')
    expect(rgbaParaHex(0, 0, 0)).toBe('#000000')
    expect(rgbaParaHex(255, 255, 255, 255)).toBe('#ffffff')
  })

  it('arredonda e prende na faixa 0..255 o que vier fora dela', () => {
    expect(rgbaParaHex(-20, 300, 127.6)).toBe('#00ff80')
    expect(rgbaParaHex(Number.NaN, 16, 16)).toBe('#001010')
  })

  it('desfaz o alfa pré-multiplicado do extract', () => {
    // Vermelho puro a 50%: o Pixi devolve (128, 0, 0, 128).
    expect(rgbaParaHex(128, 0, 0, 128)).toBe('#ff0000')
    expect(rgbaParaHex(51, 102, 0, 102)).toBe('#80ff00')
  })

  it('alfa zero não tem cor: preto', () => {
    expect(rgbaParaHex(200, 100, 50, 0)).toBe('#000000')
  })
})

describe('pixelDaTela', () => {
  it('arredonda para baixo o ponto em px CSS', () => {
    expect(pixelDaTela(10.7, 3.2, 800, 600)).toEqual({ x: 10, y: 3 })
    expect(pixelDaTela(0, 0, 800, 600)).toEqual({ x: 0, y: 0 })
    expect(pixelDaTela(799.9, 599.9, 800, 600)).toEqual({ x: 799, y: 599 })
  })

  it('fora da tela (ou ponto inválido) não tem pixel', () => {
    expect(pixelDaTela(-1, 10, 800, 600)).toBeNull()
    expect(pixelDaTela(10, -0.5, 800, 600)).toBeNull()
    expect(pixelDaTela(800, 10, 800, 600)).toBeNull()
    expect(pixelDaTela(10, 600, 800, 600)).toBeNull()
    expect(pixelDaTela(Number.NaN, 10, 800, 600)).toBeNull()
    expect(pixelDaTela(10, 10, 0, 0)).toBeNull()
  })
})
