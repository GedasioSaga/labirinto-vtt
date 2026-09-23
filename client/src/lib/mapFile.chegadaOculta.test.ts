import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * MÃO ÚNICA no disco: `soChegada` é campo novo e opcional do pino de viagem.
 * Só `true` volta do arquivo; qualquer outro valor volta AUSENTE (o par de
 * sempre, visível), e mapa antigo não ganha o campo.
 */

const pino = (extra: string): string => `{"id": "p", "x": 1, "y": 2, "kind": "viagem", "description": "", "image": null${extra}}`

describe('mapFile: soChegada', () => {
  it('true vai e volta do disco', () => {
    const map = {
      ...createEmptyMap('map_c', 'C', 5, 5, 64),
      pins: [{ id: 'par', x: 64, y: 64, kind: 'viagem' as const, description: '', image: null, soChegada: true as const }],
    }
    expect(deserializeMap(serializeMap(map)).pins[0].soChegada).toBe(true)
  })

  it('valor fora da forma volta AUSENTE — nunca esconde um pino por engano', () => {
    for (const valor of ['false', '"true"', '1', 'null', '{}', '[true]']) {
      const lido = deserializeMap(`{"id": "torto", "pins": [${pino(`, "soChegada": ${valor}`)}]}`)
      expect(lido.pins[0].soChegada, `soChegada: ${valor}`).toBeUndefined()
      expect(serializeMap(lido), `soChegada: ${valor}`).not.toContain('soChegada')
    }
  })

  it('mapa antigo abre sem o campo e grava sem ele', () => {
    const antigo = deserializeMap(`{"id": "antigo", "pins": [${pino('')}]}`)
    expect(antigo.pins[0].soChegada).toBeUndefined()
    expect(serializeMap(antigo)).not.toContain('soChegada')
  })
})
