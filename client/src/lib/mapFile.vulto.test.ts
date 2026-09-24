import { describe, expect, it } from 'vitest'
import { createEmptyMap, setFaceRangeCells } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * "Rostos só de perto: N casas" (`MapData.faceRangeCells`) no disco: número
 * inteiro de 1 a 99 vai e volta; mapa antigo abre sem a opção e grava sem ela;
 * valor torto (arquivo editado à mão) volta AUSENTE — a opção desligada, que é
 * o que a cena sempre fez.
 */
describe('mapFile: rostos só de perto', () => {
  it('3 casas vai e volta do disco', () => {
    const map = setFaceRangeCells(createEmptyMap('m', 'Salão', 5, 5, 64), 3)
    expect(deserializeMap(serializeMap(map)).faceRangeCells).toBe(3)
  })

  it('desligar tira a opção do arquivo', () => {
    const ligado = setFaceRangeCells(createEmptyMap('m', 'Salão', 5, 5, 64), 3)
    const desligado = setFaceRangeCells(ligado, null)
    expect(desligado.faceRangeCells).toBeUndefined()
    expect(serializeMap(desligado)).not.toContain('faceRangeCells')
  })

  it('mapa antigo abre sem a opção e grava sem ela', () => {
    const antigo = deserializeMap('{"id": "antigo"}')
    expect(antigo.faceRangeCells).toBeUndefined()
    expect(serializeMap(antigo)).not.toContain('faceRangeCells')
  })

  it('valor fora da forma volta AUSENTE (opção desligada)', () => {
    for (const valor of ['0', '-1', '2.5', '100', '"3"', 'true', 'null', '{}']) {
      const lido = deserializeMap(`{"id": "torto", "faceRangeCells": ${valor}}`)
      expect(lido.faceRangeCells, `faceRangeCells: ${valor}`).toBeUndefined()
      expect(serializeMap(lido), `faceRangeCells: ${valor}`).not.toContain('faceRangeCells')
    }
  })
})
