import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * PORTA SECRETA no disco: `DoorState.secret` é campo novo e opcional. Só `true`
 * volta do arquivo; qualquer outro valor volta AUSENTE (porta comum, como
 * sempre), e mapa antigo não ganha o campo.
 */
const parede = (door: string): string => `{"id": "w", "x1": 0, "y1": 0, "x2": 50, "y2": 0, "blocksLight": true, "blocksMove": true, "door": ${door}}`

describe('mapFile: porta secreta', () => {
  it('true vai e volta do disco', () => {
    const map = {
      ...createEmptyMap('map_s', 'S', 5, 5, 64),
      walls: [{ id: 'w', x1: 0, y1: 0, x2: 50, y2: 0, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' as const, secret: true } }],
    }
    expect(deserializeMap(serializeMap(map)).walls[0]?.door).toEqual({ open: false, locked: false, kind: 'normal', secret: true })
  })

  it('valor fora da forma volta AUSENTE', () => {
    for (const valor of ['false', '"true"', '1', 'null', '{}']) {
      const lido = deserializeMap(`{"id": "torto", "walls": [${parede(`{"open": false, "locked": false, "kind": "normal", "secret": ${valor}}`)}]}`)
      expect(lido.walls[0]?.door, `secret: ${valor}`).toEqual({ open: false, locked: false, kind: 'normal' })
      expect(serializeMap(lido), `secret: ${valor}`).not.toContain('secret')
    }
  })

  it('porta antiga abre sem o campo e grava sem ele', () => {
    const antigo = deserializeMap(`{"id": "antigo", "walls": [${parede('{"open": true, "locked": false}')}]}`)
    expect(antigo.walls[0]?.door).toEqual({ open: true, locked: false, kind: 'normal' })
    expect(serializeMap(antigo)).not.toContain('secret')
  })
})
