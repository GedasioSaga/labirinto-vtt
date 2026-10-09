import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * PORTA ANIMADA no disco: `DoorState.animacao` é campo novo e opcional. Só id
 * na forma curta volta do arquivo; o resto volta AUSENTE (sem animação, como
 * sempre), e mapa antigo não ganha o campo. Id bem formado de animação que o
 * app não tem fica: pode ser de um pacote ainda não baixado.
 */
const parede = (door: string): string => `{"id": "w", "x1": 0, "y1": 0, "x2": 50, "y2": 0, "blocksLight": true, "blocksMove": true, "door": ${door}}`

describe('mapFile: porta animada', () => {
  it('id embutido vai e volta do disco', () => {
    const map = {
      ...createEmptyMap('map_a', 'A', 5, 5, 64),
      walls: [{ id: 'w', x1: 0, y1: 0, x2: 50, y2: 0, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' as const, animacao: 'girar' } }],
    }
    expect(deserializeMap(serializeMap(map)).walls[0]?.door).toEqual({ open: false, locked: false, kind: 'normal', animacao: 'girar' })
  })

  it('id bem formado que o app não conhece fica (pacote ainda não baixado)', () => {
    const lido = deserializeMap(`{"id": "p", "walls": [${parede('{"open": true, "locked": false, "kind": "normal", "animacao": "leque-2"}')}]}`)
    expect(lido.walls[0]?.door?.animacao).toBe('leque-2')
  })

  it('valor fora da forma volta AUSENTE', () => {
    for (const valor of ['"Girar"', '"em leque"', '""', `"${'a'.repeat(41)}"`, '1', 'true', 'null', '{}', '["girar"]']) {
      const lido = deserializeMap(`{"id": "torto", "walls": [${parede(`{"open": false, "locked": false, "kind": "normal", "animacao": ${valor}}`)}]}`)
      expect(lido.walls[0]?.door, `animacao: ${valor}`).toEqual({ open: false, locked: false, kind: 'normal' })
      expect(serializeMap(lido), `animacao: ${valor}`).not.toContain('animacao')
    }
  })

  it('porta antiga abre sem o campo e grava sem ele', () => {
    const antigo = deserializeMap(`{"id": "antigo", "walls": [${parede('{"open": true, "locked": false}')}]}`)
    expect(antigo.walls[0]?.door).toEqual({ open: true, locked: false, kind: 'normal' })
    expect(serializeMap(antigo)).not.toContain('animacao')
  })
})
