import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * ALAVANCA no disco: `kind: 'alavanca'` é o quarto tipo de pino e
 * `portaLigada` é campo novo e opcional. Sem o tipo na lista, toda alavanca
 * voltaria do disco como "!"; ligação fora da forma volta AUSENTE (alavanca
 * solta), e mapa antigo não ganha o campo.
 */

const pino = (extra: string): string => `{"id": "a", "x": 1, "y": 2, "kind": "alavanca", "description": "", "image": null${extra}}`

describe('mapFile: alavanca', () => {
  it('a alavanca e a porta ligada vão e voltam do disco', () => {
    const map = {
      ...createEmptyMap('map_a', 'A', 5, 5, 64),
      pins: [{ id: 'a', x: 64, y: 64, kind: 'alavanca' as const, description: '', image: null, portaLigada: 'porta-1' }], // literal: `kind` é PinKind, não string
    }
    const lido = deserializeMap(serializeMap(map)).pins[0]
    expect(lido.kind).toBe('alavanca')
    expect(lido.portaLigada).toBe('porta-1')
  })

  it('ligação fora da forma volta AUSENTE', () => {
    for (const valor of ['""', '1', 'null', '{}', '["porta-1"]', 'true']) {
      const lido = deserializeMap(`{"id": "torto", "pins": [${pino(`, "portaLigada": ${valor}`)}]}`)
      expect(lido.pins[0].kind, `portaLigada: ${valor}`).toBe('alavanca')
      expect(lido.pins[0].portaLigada, `portaLigada: ${valor}`).toBeUndefined()
      expect(serializeMap(lido), `portaLigada: ${valor}`).not.toContain('portaLigada')
    }
  })

  it('mapa antigo abre sem o campo e grava sem ele', () => {
    const antigo = deserializeMap(`{"id": "antigo", "pins": [{"id": "p", "x": 1, "y": 2, "kind": "exclamacao", "description": "", "image": null}]}`)
    expect(antigo.pins[0].kind).toBe('exclamacao')
    expect(antigo.pins[0].portaLigada).toBeUndefined()
    expect(serializeMap(antigo)).not.toContain('portaLigada')
  })
})
