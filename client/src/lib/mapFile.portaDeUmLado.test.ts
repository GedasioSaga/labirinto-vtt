import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * PORTA DE UM LADO no disco: `DoorState.opensFrom` é campo novo e opcional.
 * Só 'left' ou 'right' voltam; qualquer outro valor volta AUSENTE (abre dos
 * dois lados, como sempre), e mapa salvo antes continua sem o campo.
 */
const parede = (door: string): string => `{"id": "w", "x1": 0, "y1": 0, "x2": 50, "y2": 0, "blocksLight": true, "blocksMove": true, "door": ${door}}`

describe('mapFile: porta de um lado', () => {
  it("'left' e 'right' vão e voltam do disco", () => {
    for (const lado of ['left', 'right'] as const) {
      const map = {
        ...createEmptyMap('map_l', 'L', 5, 5, 64),
        walls: [{ id: 'w', x1: 0, y1: 0, x2: 50, y2: 0, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' as const, opensFrom: lado } }],
      }
      expect(deserializeMap(serializeMap(map)).walls[0]?.door).toEqual({ open: false, locked: false, kind: 'normal', opensFrom: lado })
    }
  })

  it('valor fora da forma volta AUSENTE', () => {
    for (const valor of ['"cima"', 'true', '1', 'null', '{}', '"RIGHT"']) {
      const lido = deserializeMap(`{"id": "torto", "walls": [${parede(`{"open": false, "locked": false, "kind": "normal", "opensFrom": ${valor}}`)}]}`)
      expect(lido.walls[0]?.door, `opensFrom: ${valor}`).toEqual({ open: false, locked: false, kind: 'normal' })
      expect(serializeMap(lido), `opensFrom: ${valor}`).not.toContain('opensFrom')
    }
  })

  it('mapa salvo antes abre igual a hoje: sem o campo e grava sem ele', () => {
    const antigo = deserializeMap(`{"id": "antigo", "walls": [${parede('{"open": true, "locked": false, "kind": "normal"}')}]}`)
    expect(antigo.walls[0]?.door).toEqual({ open: true, locked: false, kind: 'normal' })
    expect(serializeMap(antigo)).not.toContain('opensFrom')
  })
})
