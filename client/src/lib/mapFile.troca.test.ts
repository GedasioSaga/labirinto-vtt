import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 100, y: 100, size: 1, image: null, ...extra }
}

describe('mapFile — moedas e troca (a bolsa no disco)', () => {
  it('a bolsa volta igual do arquivo, junto com a mochila e o veículo da mesma ficha', () => {
    const map = {
      ...createEmptyMap('t01', 'Feira', 10, 10, 64),
      tokens: [
        ficha('carroca', { moedas: 12, veiculo: { lugares: 2, passageiros: ['duda'] }, mochila: [{ id: 'i1', nome: 'Corda' }] }),
        ficha('duda', { moedas: 3 }),
      ],
    }
    const restored = deserializeMap(serializeMap(map))
    expect(restored.tokens[0].moedas).toBe(12)
    expect(restored.tokens[0].veiculo).toEqual({ lugares: 2, passageiros: ['duda'] })
    expect(restored.tokens[0].mochila).toEqual([{ id: 'i1', nome: 'Corda' }])
    expect(restored.tokens).toEqual(map.tokens)
  })

  it('mapa antigo, sem bolsa, abre sem inventar o campo', () => {
    const antigo = '{"id": "t01", "tokens": [{"id": "duda", "characterId": null, "name": "Duda", "x": 1, "y": 2, "size": 1}]}'
    const restored = deserializeMap(antigo)
    expect(restored.tokens.map((t) => t.id)).toEqual(['duda'])
    expect('moedas' in restored.tokens[0]).toBe(false)
  })

  it('arquivo editado à mão: bolsa torta (negativa, quebrada, texto, zero, acima do teto) some', () => {
    for (const torta of ['-5', '2.5', '"muitas"', '0', '1000000']) {
      const lido = deserializeMap(`{"id": "x", "tokens": [{"id": "a", "name": "a", "x": 0, "y": 0, "size": 1, "moedas": ${torta}}]}`)
      expect('moedas' in lido.tokens[0]).toBe(false)
    }
    const boa = deserializeMap('{"id": "x", "tokens": [{"id": "a", "name": "a", "x": 0, "y": 0, "size": 1, "moedas": 7}]}')
    expect(boa.tokens[0].moedas).toBe(7)
  })
})
