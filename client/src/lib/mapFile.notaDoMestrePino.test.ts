import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * NOTA DO MESTRE NO PINO, no disco: campo novo e opcional. Texto vai e volta;
 * valor que não é texto (arquivo editado à mão, versão futura) volta AUSENTE;
 * mapa antigo abre e grava sem o campo.
 */

const pino = (extra: string): string => `{"id": "p", "x": 1, "y": 2, "kind": "exclamacao", "description": "Um baú.", "image": null${extra}}`

describe('mapFile: notaDoMestre do pino', () => {
  it('texto vai e volta do disco, e a descrição continua a mesma', () => {
    const map = {
      ...createEmptyMap('map_n', 'N', 5, 5, 64),
      pins: [{ id: 'p', x: 64, y: 64, kind: 'exclamacao' as const, description: 'Um baú.', image: null, notaDoMestre: 'Mímico.' }],
    }
    const lido = deserializeMap(serializeMap(map)).pins[0]
    expect(lido.notaDoMestre).toBe('Mímico.')
    expect(lido.description).toBe('Um baú.')
  })

  it('valor que não é texto volta AUSENTE', () => {
    for (const valor of ['1', 'true', 'null', '{"x": 1}', '["a"]']) {
      const lido = deserializeMap(`{"id": "torto", "pins": [${pino(`, "notaDoMestre": ${valor}`)}]}`)
      expect(lido.pins[0].notaDoMestre, `notaDoMestre: ${valor}`).toBeUndefined()
      expect(serializeMap(lido), `notaDoMestre: ${valor}`).not.toContain('notaDoMestre')
    }
  })

  it('mapa antigo abre sem o campo e grava sem ele', () => {
    const antigo = deserializeMap(`{"id": "antigo", "pins": [${pino('')}]}`)
    expect(antigo.pins[0].notaDoMestre).toBeUndefined()
    expect(antigo.pins[0].description).toBe('Um baú.')
    expect(serializeMap(antigo)).not.toContain('notaDoMestre')
  })
})
