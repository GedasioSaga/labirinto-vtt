import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 100, y: 100, size: 1, image: null, ...extra }
}

describe('mapFile — veículo com lugares', () => {
  it('o cesto com lugares e quem está a bordo volta igual do arquivo', () => {
    const map = { ...createEmptyMap('a06', 'Poço', 10, 10, 64), tokens: [ficha('cesto', { veiculo: { lugares: 2, passageiros: ['gui'] } }), ficha('gui')] }
    const restored = deserializeMap(serializeMap(map))
    expect(restored.tokens[0].veiculo).toEqual({ lugares: 2, passageiros: ['gui'] })
    expect(restored.tokens).toEqual(map.tokens)
  })

  it('mapa antigo, sem o campo, abre sem inventar o campo', () => {
    const antigo = '{"id": "a06", "tokens": [{"id": "gui", "characterId": null, "name": "Gui", "x": 1, "y": 2, "size": 1}]}'
    const restored = deserializeMap(antigo)
    expect(restored.tokens.map((t) => t.id)).toEqual(['gui'])
    expect('veiculo' in restored.tokens[0]).toBe(false)
  })

  it('arquivo editado à mão: veículo torto some, passageiro torto sai da lista', () => {
    const torto = deserializeMap('{"id": "x", "tokens": [{"id": "a", "name": "a", "x": 0, "y": 0, "size": 1, "veiculo": {"lugares": "muitos"}}]}')
    expect('veiculo' in torto.tokens[0]).toBe(false)
    const lista = deserializeMap('{"id": "x", "tokens": [{"id": "a", "name": "a", "x": 0, "y": 0, "size": 1, "veiculo": {"lugares": 1, "passageiros": ["b", "c", 3]}}]}')
    expect(lista.tokens[0].veiculo).toEqual({ lugares: 1, passageiros: ['b'] })
  })
})
