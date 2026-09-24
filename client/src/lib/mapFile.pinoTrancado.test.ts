import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * PINO TRANCADO VIRA PEDIDO no disco: `mudo` (o mestre desligou "Aceita
 * tentativas") é campo novo e opcional. Só `true` volta do arquivo; o resto
 * volta AUSENTE — o trancado de hoje, que aceita "Pedir ao mestre".
 */

const pino = (extra: string): string => `{"id": "p", "x": 1, "y": 2, "kind": "viagem", "description": "", "image": null, "passagem": "trancada"${extra}}`

describe('mapFile: mudo do pino trancado', () => {
  it('true vai e volta do disco', () => {
    const map = {
      ...createEmptyMap('map_t', 'T', 5, 5, 64),
      pins: [{ id: 'porta', x: 64, y: 64, kind: 'viagem' as const, description: '', image: null, passagem: 'trancada' as const, mudo: true as const }],
    }
    const lido = deserializeMap(serializeMap(map)).pins[0]
    expect(lido?.mudo).toBe(true)
    expect(lido?.passagem).toBe('trancada')
  })

  it('valor fora da forma volta AUSENTE', () => {
    for (const valor of ['false', '"true"', '1', 'null', '{}']) {
      const lido = deserializeMap(`{"id": "torto", "pins": [${pino(`, "mudo": ${valor}`)}]}`)
      expect(lido.pins[0]?.mudo, `mudo: ${valor}`).toBeUndefined()
      expect(serializeMap(lido), `mudo: ${valor}`).not.toContain('mudo')
    }
  })

  it('mapa antigo abre sem o campo', () => {
    const antigo = deserializeMap(`{"id": "antigo", "pins": [${pino('')}]}`)
    expect(antigo.pins[0]?.mudo).toBeUndefined()
    expect(antigo.pins[0]?.passagem).toBe('trancada')
  })
})
