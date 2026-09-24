import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import type { Token } from '../types/map'

/**
 * `Token.publicName` no disco: texto ("Outro") e `null` ("Nenhum") vão e
 * voltam; mapa antigo abre sem o campo ("O mesmo") e grava sem ele. Valor
 * fora da forma (arquivo editado à mão) volta AUSENTE — "O mesmo", que é o
 * que a ficha sempre mostrou.
 */

const ficha = (extra: string): string => `{"id": "t", "characterId": null, "name": "Capataz traidor", "x": 1, "y": 2, "size": 1, "image": null${extra}}`

function comFicha(extra: Partial<Token>) {
  const token: Token = { id: 't', characterId: null, name: 'Capataz traidor', x: 1, y: 2, size: 1, image: null, ...extra }
  return { ...createEmptyMap('map_n', 'N', 5, 5, 64), tokens: [token] }
}

describe('mapFile: publicName da ficha', () => {
  it('"Outro" vai e volta do disco', () => {
    expect(deserializeMap(serializeMap(comFicha({ publicName: 'Estivador' }))).tokens[0].publicName).toBe('Estivador')
  })

  it('"Nenhum" (null) vai e volta do disco', () => {
    expect(deserializeMap(serializeMap(comFicha({ publicName: null }))).tokens[0].publicName).toBeNull()
  })

  it('mapa antigo abre sem o campo e grava sem ele', () => {
    const antigo = deserializeMap(`{"id": "antigo", "tokens": [${ficha('')}]}`)
    expect('publicName' in antigo.tokens[0]).toBe(false)
    expect(serializeMap(antigo)).not.toContain('publicName')
  })

  it('valor fora da forma volta AUSENTE ("O mesmo")', () => {
    for (const valor of ['1', 'true', '{}', '["x"]']) {
      const lido = deserializeMap(`{"id": "torto", "tokens": [${ficha(`, "publicName": ${valor}`)}]}`)
      expect(lido.tokens[0].publicName, `publicName: ${valor}`).toBeUndefined()
      expect(serializeMap(lido), `publicName: ${valor}`).not.toContain('publicName')
    }
  })
})
