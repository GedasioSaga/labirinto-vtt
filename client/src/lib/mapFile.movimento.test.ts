import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

describe('mapFile — regras de movimento da cena', () => {
  it('passo máximo e ocupação voltam iguais do arquivo', () => {
    const map = { ...createEmptyMap('docas', 'Docas', 10, 10, 50), movement: { maxStepCells: 6, tokensOccupy: true } }
    expect(deserializeMap(serializeMap(map)).movement).toEqual({ maxStepCells: 6, tokensOccupy: true })
  })

  it('mapa antigo, sem o campo, abre livre e sem inventar o campo', () => {
    const restored = deserializeMap(serializeMap(createEmptyMap('mercado', 'Mercado', 10, 10, 50)))
    expect('movement' in restored && restored.movement !== undefined).toBe(false)
  })

  it('arquivo editado à mão com lixo abre livre', () => {
    expect(deserializeMap('{"id": "x", "movement": {"maxStepCells": "muito", "tokensOccupy": 1}}').movement).toBeUndefined()
    expect(deserializeMap('{"id": "x", "movement": {"maxStepCells": -4}}').movement).toBeUndefined()
  })
})
