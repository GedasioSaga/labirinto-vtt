import { describe, it, expect } from 'vitest'
import { placeHint } from './hintPlacement'

// Valores reais do editor: painel lateral de 264px a 16px da borda, então o
// primeiro x livre é 296.
const BASE = { originLeft: 0, viewportWidth: 1280, minLeft: 296, edgeGap: 16 }

describe('placeHint', () => {
  it('centraliza o balão no ícone quando há espaço dos dois lados', () => {
    const { left, arrow } = placeHint({ ...BASE, anchorCenter: 640, hintWidth: 300 })
    expect(left).toBe(490)
    // Com o balão centrado, a seta cai no meio dele.
    expect(arrow).toBe(150)
  })

  it('recua o balão para não invadir o painel lateral', () => {
    const { left, arrow } = placeHint({ ...BASE, anchorCenter: 379, hintWidth: 300 })
    expect(left).toBe(296)
    // O balão parou em 296, mas a seta segue apontando o ícone em 379.
    expect(arrow).toBe(83)
  })

  it('recua o balão para não vazar pela borda direita', () => {
    const { left, arrow } = placeHint({ ...BASE, anchorCenter: 1240, hintWidth: 300 })
    expect(left).toBe(964)
    expect(arrow).toBe(276)
  })

  it('mantém a seta dentro do balão quando o ícone fica fora dele', () => {
    // Ícone muito à esquerda do balão recuado: sem clamp a seta sairia do balão.
    const { arrow } = placeHint({ ...BASE, anchorCenter: 100, hintWidth: 300 })
    expect(arrow).toBe(12)
  })

  it('mantém a seta dentro do balão no extremo direito', () => {
    const { arrow } = placeHint({ ...BASE, anchorCenter: 1279, hintWidth: 300 })
    expect(arrow).toBe(288)
  })

  it('prioriza o painel lateral quando a janela é estreita demais para os dois limites', () => {
    // 296 + 400 + 16 = 712 > 700: os limites se cruzam.
    const { left } = placeHint({ ...BASE, viewportWidth: 700, anchorCenter: 500, hintWidth: 400 })
    expect(left).toBe(296)
  })

  it('devolve o deslocamento relativo à origem, não à viewport', () => {
    const { left } = placeHint({ ...BASE, originLeft: 464, anchorCenter: 640, hintWidth: 300 })
    expect(left).toBe(490 - 464)
  })
})
