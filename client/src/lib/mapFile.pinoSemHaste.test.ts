import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * PINO SEM HASTE no disco: campo novo e opcional. `semHaste` só volta quando é
 * `true`; qualquer outra coisa volta AUSENTE — o pino de sempre, com haste. Mapa
 * antigo abre e grava sem o campo.
 */

const pino = (extra: string): string => `{"id": "p", "x": 1, "y": 2, "kind": "exclamacao", "description": "", "image": null${extra}}`

describe('mapFile: semHaste', () => {
  it('vai e volta do disco', () => {
    const map = {
      ...createEmptyMap('map_c', 'C', 5, 5, 64),
      pins: [{ id: 'bau', x: 64, y: 64, kind: 'exclamacao' as const, description: 'Baú', image: null, semHaste: true as const }],
    }
    const lido = deserializeMap(serializeMap(map)).pins[0]
    expect(lido.semHaste).toBe(true)
    // O ponto do pino não muda: a cabeça fica onde estava.
    expect({ x: lido.x, y: lido.y }).toEqual({ x: 64, y: 64 })
  })

  it('semHaste fora da forma volta AUSENTE: o pino de sempre, com haste', () => {
    for (const valor of ['false', '"true"', '1', 'null', '{}', '[]']) {
      const lido = deserializeMap(`{"id": "torto", "pins": [${pino(`, "semHaste": ${valor}`)}]}`)
      expect(lido.pins[0].semHaste, `semHaste: ${valor}`).toBeUndefined()
      expect(serializeMap(lido), `semHaste: ${valor}`).not.toContain('"semHaste"')
    }
  })

  it('mapa antigo abre sem o campo e grava sem ele', () => {
    const antigo = deserializeMap(`{"id": "antigo", "pins": [${pino('')}]}`)
    expect(antigo.pins[0].semHaste).toBeUndefined()
    expect(serializeMap(antigo)).not.toContain('"semHaste"')
  })
})
