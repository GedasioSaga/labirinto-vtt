import { describe, expect, it } from 'vitest'
import { deserializeMap } from './mapFile'

/**
 * FALA da patrulha no disco: ela só existe enquanto a ficha espera no ponto.
 * Um mapa salvo no meio da fala reabre com a patrulha parada, sem o balão.
 */
describe('mapFile: fala da patrulha', () => {
  it('fala gravada no arquivo é descartada na leitura', () => {
    const lido = deserializeMap(
      '{"id": "m", "tokens": [{"id": "g", "characterId": null, "name": "Guarda", "x": 1, "y": 2, "size": 1, "image": null, "fala": "Quem está aí?"}]}',
    )
    expect(lido.tokens[0].name).toBe('Guarda')
    expect('fala' in lido.tokens[0]).toBe(false)
  })
})
