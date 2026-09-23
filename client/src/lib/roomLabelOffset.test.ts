// A4 — posição do nome da Sala (RoomMeta.labelOffset): fábrica, gesto na
// store (vivo + um Ctrl+Z) e o recorte enviado ao jogador.
import { beforeEach, describe, expect, it } from 'vitest'
import type { MapData, Region, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { addRoom, createEmptyMap, setRoomLabelOffset } from './mapFactory'
import { useMapStore } from '../stores/mapStore'

const ROOM: Region = {
  id: 'cripta',
  points: [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 400 }, { x: 100, y: 400 }],
  tag: '',
  fillColor: '#333333',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Cripta' },
}

const COMMON_REGION: Region = { ...ROOM, id: 'comum', room: undefined }

function mapWithRoom(): MapData {
  return { ...addRoom(createEmptyMap('m', 'M', 1000, 1000, 40), ROOM, []), regions: [ROOM, COMMON_REGION] }
}

describe('setRoomLabelOffset', () => {
  it('grava o offset só na Sala pedida', () => {
    const next = setRoomLabelOffset(mapWithRoom(), 'cripta', { x: 12, y: -8 })
    expect(next.regions.find((r) => r.id === 'cripta')?.room?.labelOffset).toEqual({ x: 12, y: -8 })
  })

  it('região comum, id inexistente e offset igual devolvem o mesmo map', () => {
    const map = mapWithRoom()
    expect(setRoomLabelOffset(map, 'comum', { x: 5, y: 5 })).toBe(map)
    expect(setRoomLabelOffset(map, 'nao-existe', { x: 5, y: 5 })).toBe(map)
    // Sem offset equivale a (0,0): clique parado no nome não muda o mapa.
    expect(setRoomLabelOffset(map, 'cripta', { x: 0, y: 0 })).toBe(map)
  })
})

describe('mapStore setRoomLabelOffsetLive', () => {
  beforeEach(() => {
    useMapStore.getState().loadMap(mapWithRoom())
  })

  it('arrasto inteiro vira um Ctrl+Z só com commitDragHistory', () => {
    const before = useMapStore.getState().map
    const pastBefore = useMapStore.getState().past.length
    for (let i = 1; i <= 20; i++) useMapStore.getState().setRoomLabelOffsetLive('cripta', { x: i, y: i * 2 })
    expect(useMapStore.getState().past.length).toBe(pastBefore)

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastBefore + 1)
    expect(useMapStore.getState().map.regions[0].room?.labelOffset).toEqual({ x: 20, y: 40 })

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.regions[0].room?.labelOffset).toBeUndefined()
  })
})

describe('labelOffset no payload do jogador', () => {
  it('filterMapForPlayer mantém o offset da Sala que o jogador vê', () => {
    const hero: Token = { id: 'heroi', characterId: null, name: 'Herói', x: 250, y: 250, size: 1, image: null }
    const map: MapData = { ...setRoomLabelOffset(mapWithRoom(), 'cripta', { x: 40, y: -30 }), tokens: [hero] }

    const { map: payload } = filterMapForPlayer(map, 'p1', { p1: ['heroi'] }, 700)

    const sent = JSON.parse(JSON.stringify(payload)) as MapData
    expect(sent.regions.find((r) => r.id === 'cripta')?.room?.labelOffset).toEqual({ x: 40, y: -30 })
  })
})
