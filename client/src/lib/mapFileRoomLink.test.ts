import { describe, expect, it } from 'vitest'
import { deserializeMap } from './mapFile'
import { moveRegion, removeRegion } from './mapFactory'
import legacyRoomDoorJson from './__fixtures__/legacy-room-door.json'

describe('deserializeMap — porta de mapa antigo volta a ser da Sala', () => {
  const map = deserializeMap(JSON.stringify(legacyRoomDoorJson))
  const byId = (id: string) => map.walls.find((w) => w.id === id)

  it('pedaços soltos sobre a aresta de cima da Casa (com a porta) passam a ser da Casa, aresta 0', () => {
    for (const id of ['topo-antes', 'topo-porta', 'topo-depois']) {
      expect(byId(id)).toMatchObject({ regionId: 'casa', regionEdgeIndex: 0 })
    }
    expect(byId('topo-porta')?.door).toEqual({ open: false, locked: false, kind: 'normal' })
  })

  it('parede na divisa de duas Salas e parede solta no meio continuam soltas; vínculo existente não muda', () => {
    expect(byId('direita')?.regionId).toBeUndefined()
    expect(byId('solta-no-meio')?.regionId).toBeUndefined()
    expect(byId('baixo')).toMatchObject({ regionId: 'casa', regionEdgeIndex: 2 })
  })

  it('depois de migrar, mover a Casa leva a porta e apagar não deixa pedaço solto', () => {
    const moved = moveRegion(map, 'casa', 64, 0)
    expect(moved.walls.find((w) => w.id === 'topo-porta')).toMatchObject({ x1: 432, x2: 464 })
    const removed = removeRegion(map, 'casa')
    expect(removed.walls.map((w) => w.id).sort()).toEqual(['direita', 'solta-no-meio'])
  })
})
