import { describe, expect, it } from 'vitest'
import type { DoorState, Wall } from '../types/map'
import { isDoorPassable } from './collision'
import { addWall, createEmptyMap, setDoorLocked } from './mapFactory'
import { deserializeMap } from './mapFile'

/**
 * PORTA ABERTA E TRANCADA num mapa salvo antes da regra "aberta+trancada não
 * existe". O host sempre a tratou como fechada (`isDoorPassable`: trancada
 * barra mesmo com `open: true`), mas o recorte do jogador tira só o cadeado e
 * mantém o `open`: o jogador via a porta aberta, a visão cortava no vão e o
 * toque voltava recusado. Ele deduzia o cadeado sem tentar.
 *
 * A carga resolve o conflito como `setDoorLocked`: trancada vence e a porta
 * volta fechada. Nada muda para o mestre (ele já a via trancada) nem para o
 * host (ela já barrava); só o jogador deixa de ver aberta uma porta que não passa.
 */
const parede = (door: string): string => `{"id": "w", "x1": 0, "y1": 0, "x2": 50, "y2": 0, "blocksLight": true, "blocksMove": true, "door": ${door}}`

function portaLida(door: string): DoorState {
  const lida = deserializeMap(`{"id": "antigo", "walls": [${parede(door)}]}`).walls[0]?.door
  if (!lida) throw new Error(`a carga perdeu a porta: ${door}`)
  return lida
}

describe('mapFile: porta salva aberta e trancada', () => {
  it('volta do disco fechada e trancada', () => {
    expect(portaLida('{"open": true, "locked": true, "kind": "normal"}')).toEqual({ open: false, locked: true, kind: 'normal' })
  })

  it('sai igual ao que o mapFactory faz ao trancar uma porta aberta', () => {
    const aberta: Wall = { id: 'w', x1: 0, y1: 0, x2: 50, y2: 0, blocksLight: true, blocksMove: true, door: { open: true, locked: false, kind: 'normal' } }
    const trancadaNoEditor = setDoorLocked(addWall(createEmptyMap('m', 'x', 5, 5, 64), aberta), 'w', true).walls[0]?.door

    expect(portaLida('{"open": true, "locked": true, "kind": "normal"}')).toEqual(trancadaNoEditor)
  })

  it('porta antiga sem kind e sem nenhum campo opcional também volta fechada', () => {
    expect(portaLida('{"open": true, "locked": true}')).toEqual({ open: false, locked: true, kind: 'normal' })
  })

  it('os campos opcionais da porta atravessam a correção', () => {
    expect(portaLida('{"open": true, "locked": true, "kind": "double", "secret": true, "semEspiar": true, "opensFrom": "left"}')).toEqual({
      open: false,
      locked: true,
      kind: 'double',
      secret: true,
      semEspiar: true,
      opensFrom: 'left',
    })
  })

  it('porta coerente volta como foi salva', () => {
    expect(portaLida('{"open": true, "locked": false, "kind": "normal"}')).toEqual({ open: true, locked: false, kind: 'normal' })
    expect(portaLida('{"open": false, "locked": true, "kind": "normal"}')).toEqual({ open: false, locked: true, kind: 'normal' })
    expect(portaLida('{"open": false, "locked": false, "kind": "normal"}')).toEqual({ open: false, locked: false, kind: 'normal' })
  })

  it('o jogador vê aberta só a porta que o host deixa passar', () => {
    for (const open of [true, false]) {
      for (const locked of [true, false]) {
        const porta = portaLida(`{"open": ${open}, "locked": ${locked}, "kind": "normal"}`)
        expect(porta.open, `salva open: ${open}, locked: ${locked}`).toBe(isDoorPassable(porta))
      }
    }
  })
})
