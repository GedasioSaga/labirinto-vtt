import { describe, expect, it } from 'vitest'
import type { ConcealZone, MapData } from '../types/map'
import { concealZoneLabel, findConcealZoneAt } from './concealZones'
import {
  addConcealZone,
  addToken,
  buildConcealZoneFromDraft,
  createEmptyMap,
  removeConcealZone,
  setItemSecret,
  setRoomNameHiddenFromPlayers,
  updateConcealZone,
} from './mapFactory'

function baseMap(): MapData {
  return createEmptyMap('m', 'M', 20, 20, 50)
}

describe('buildConcealZoneFromDraft', () => {
  it('normaliza os cantos do arrasto em retângulo horário, ativo e com nome padrão', () => {
    const zone = buildConcealZoneFromDraft('z1', { x: 200, y: 150 }, { x: 100, y: 50 })
    expect(zone).toEqual({
      id: 'z1',
      name: 'Zona oculta',
      revealed: false,
      points: [
        { x: 100, y: 50 },
        { x: 200, y: 50 },
        { x: 200, y: 150 },
        { x: 100, y: 150 },
      ],
    })
  })
})

describe('findConcealZoneAt / concealZoneLabel', () => {
  const a: ConcealZone = buildConcealZoneFromDraft('a', { x: 0, y: 0 }, { x: 100, y: 100 }, 'A')
  const b: ConcealZone = buildConcealZoneFromDraft('b', { x: 50, y: 50 }, { x: 150, y: 150 }, 'B')

  it('devolve a de cima (última) quando se sobrepõem, e null fora', () => {
    expect(findConcealZoneAt([a, b], { x: 75, y: 75 })?.id).toBe('b')
    expect(findConcealZoneAt([a, b], { x: 25, y: 25 })?.id).toBe('a')
    expect(findConcealZoneAt([a, b], { x: 300, y: 300 })).toBeNull()
  })

  it('rótulo usa o padrão quando o nome está vazio e marca a revelada', () => {
    expect(concealZoneLabel({ ...a, name: '  ' })).toBe('Zona oculta')
    expect(concealZoneLabel({ ...a, revealed: true })).toBe('A (revelada)')
  })
})

describe('fábricas de A5', () => {
  it('add / update / remove de zona; nada mudando devolve o mesmo mapa', () => {
    const zone = buildConcealZoneFromDraft('z1', { x: 0, y: 0 }, { x: 100, y: 100 })
    const withZone = addConcealZone(baseMap(), zone)
    expect(withZone.concealZones).toEqual([zone])
    const revealed = updateConcealZone(withZone, 'z1', { revealed: true, name: 'Cripta' })
    expect(revealed.concealZones[0]).toMatchObject({ revealed: true, name: 'Cripta' })
    expect(updateConcealZone(revealed, 'z1', { revealed: true })).toBe(revealed)
    expect(updateConcealZone(revealed, 'nao-existe', { revealed: false })).toBe(revealed)
    expect(removeConcealZone(revealed, 'z1').concealZones).toEqual([])
    expect(removeConcealZone(revealed, 'nao-existe')).toBe(revealed)
  })

  it('setItemSecret liga e desliga só o item alvo; valor igual devolve o mesmo mapa', () => {
    const map = addToken(baseMap(), { id: 't1', characterId: null, name: 'T', x: 0, y: 0, size: 1, image: null })
    const secret = setItemSecret(map, 'token', 't1', true)
    expect(secret.tokens[0].secret).toBe(true)
    expect(setItemSecret(secret, 'token', 't1', true)).toBe(secret)
    expect(setItemSecret(map, 'token', 't1', false)).toBe(map) // undefined === false
    expect(setItemSecret(secret, 'token', 't1', false).tokens[0].secret).toBe(false)
    expect(setItemSecret(map, 'prop', 't1', true)).toBe(map)
  })

  it('setRoomNameHiddenFromPlayers só vale para Sala', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
    const map: MapData = {
      ...baseMap(),
      regions: [
        { id: 'sala', points, tag: '', fillColor: '#000', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'S' } },
        { id: 'comum', points, tag: '', fillColor: '#000', fillPattern: 'solid', data: {} },
      ],
    }
    const hidden = setRoomNameHiddenFromPlayers(map, 'sala', true)
    expect(hidden.regions[0].room?.nameHiddenFromPlayers).toBe(true)
    expect(setRoomNameHiddenFromPlayers(hidden, 'sala', true)).toBe(hidden)
    expect(setRoomNameHiddenFromPlayers(map, 'comum', true)).toBe(map)
  })
})
