import { describe, expect, it } from 'vitest'
import { createEmptyMap, setMapSize } from './mapFactory'
import type { MapLine } from '../types/map'

const corredor: MapLine = {
  id: 'corredor',
  points: [{ x: 100, y: 250 }, { x: 200, y: 250 }],
  closed: false,
  dotted: false,
  color: '#ddd',
  width: 2,
}

describe('setMapSize (tamanho do mapa em quadrados)', () => {
  it('Mina +20 quadrados: muda só largura e altura, mesmo id e mesma grade, nada sai do lugar', () => {
    const mina = { ...createEmptyMap('mapa-mina', 'Mina Funda', 30, 10, 50), lines: [corredor] }
    const maior = setMapSize(mina, 50, 10)
    expect(maior).toEqual({ ...mina, width: 50, height: 10 })
    expect(maior.id).toBe('mapa-mina')
    expect(maior.grid).toBe(50)
    expect(maior.lines).toBe(mina.lines)
  })

  it('diminuir também muda o tamanho sem apagar o que ficou fora', () => {
    const mina = { ...createEmptyMap('mapa-mina', 'Mina Funda', 30, 10, 50), lines: [corredor] }
    const menor = setMapSize(mina, 2, 3)
    expect(menor.width).toBe(2)
    expect(menor.height).toBe(3)
    expect(menor.lines).toEqual([corredor])
  })

  it('o mesmo tamanho devolve o próprio mapa: nada para desfazer nem para mandar aos jogadores', () => {
    const mina = createEmptyMap('mapa-mina', 'Mina Funda', 30, 10, 50)
    expect(setMapSize(mina, 30, 10)).toBe(mina)
  })

  it('valor inválido (zero, negativo, fração, NaN, infinito) não muda nada', () => {
    const mina = createEmptyMap('mapa-mina', 'Mina Funda', 30, 10, 50)
    for (const [w, h] of [[0, 10], [30, -1], [30.5, 10], [Number.NaN, 10], [30, Number.POSITIVE_INFINITY]]) {
      expect(setMapSize(mina, w, h)).toBe(mina)
    }
    expect(mina.width).toBe(30)
  })
})
