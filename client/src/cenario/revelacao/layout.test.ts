import { describe, expect, it } from 'vitest'
import { calcularLayout, ESPACO_DO_PULAR, MARGEM, type EntradaDoLayout } from './layout'

/** A imagem do protótipo (a fortaleza em pé, 407 x 637). */
const FORTALEZA = { proporcao: 407 / 637, naturalAltura: 637 }

function entrada(extra: Partial<EntradaDoLayout> = {}): EntradaDoLayout {
  return {
    W: 1280,
    H: 800,
    ...FORTALEZA,
    madeira: 16,
    metal: 9,
    temPainel: true,
    espacoDoPular: ESPACO_DO_PULAR,
    // O painel "mede" o mínimo pedido, ou 220 px de texto, sem passar do máximo.
    alturaDoPainel: (_largura, minima, maxima) => Math.min(maxima, Math.max(minima, 220)),
    ...extra,
  }
}

const dentroDaTela = (r: { x: number; y: number; w: number; h: number }, W: number, H: number) => r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H

describe('layout da revelação', () => {
  it('tela larga: imagem à esquerda e painel à direita, alinhados pelo topo, tudo dentro da tela', () => {
    const L = calcularLayout(entrada())
    expect(L?.coluna).toBe(false)
    if (!L) return
    expect(L.trilho.x).toBe(L.ow)
    expect(L.trilho.y + L.carro.y).toBe(0)
    expect(dentroDaTela(L.grupo, L.W, L.H)).toBe(true)
    expect(L.imgH).toBeLessThanOrEqual(637)
    expect(L.canos).toHaveLength(2)
    // A entrada começa fora da tela, à direita.
    expect(L.grupo.x + L.entradaX).toBeGreaterThan(L.W)
  })

  it('celular: um embaixo do outro, a porta abre para baixo e tudo cabe acima do "Pular"', () => {
    const L = calcularLayout(entrada({ W: 390, H: 760, alturaDoPainel: (_l, _min, maxima) => Math.min(maxima, 260) }))
    expect(L?.coluna).toBe(true)
    if (!L) return
    expect(L.trilho.y).toBe(L.oh)
    expect(L.transformOrigin).toMatch(/^50% /)
    expect(L.grupo.x).toBeGreaterThanOrEqual(MARGEM - 1)
    expect(L.grupo.x + L.grupo.w).toBeLessThanOrEqual(L.W - MARGEM + 1)
    expect(L.grupo.y + L.grupo.h).toBeLessThanOrEqual(L.H - ESPACO_DO_PULAR)
  })

  it('celular com descrição enorme: o painel cede (o texto rola) e a imagem guarda pelo menos 150 px', () => {
    const L = calcularLayout(entrada({ W: 360, H: 640, alturaDoPainel: (_l, _min, maxima) => maxima }))
    if (!L) throw new Error('sem layout')
    expect(L.imgH).toBeGreaterThanOrEqual(150)
    expect(L.grupo.y + L.grupo.h).toBeLessThanOrEqual(L.H - ESPACO_DO_PULAR + 1)
  })

  it('sem imagem: o painel sozinho no centro, sem dobradiças', () => {
    const L = calcularLayout(entrada({ proporcao: null, naturalAltura: 0 }))
    if (!L) throw new Error('sem layout')
    expect(L.semImagem).toBe(true)
    expect(L.canos).toHaveLength(0)
    expect(Math.abs(L.grupo.x + L.grupo.w / 2 - L.W / 2)).toBeLessThanOrEqual(1)
    expect(dentroDaTela(L.grupo, L.W, L.H)).toBe(true)
  })

  it('sem nome e sem descrição: só a imagem, sem painel', () => {
    const L = calcularLayout(entrada({ temPainel: false }))
    if (!L) throw new Error('sem layout')
    expect(L.pw).toBe(0)
    expect(L.canos).toHaveLength(0)
    expect(L.grupo.w).toBe(L.ow)
  })

  it('palco sem tamanho (escondido): sem layout', () => {
    expect(calcularLayout(entrada({ W: 0, H: 0 }))).toBeNull()
  })
})
