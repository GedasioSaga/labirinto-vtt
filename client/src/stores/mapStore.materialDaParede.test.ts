import { afterEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import type { Wall } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * PAREDE COM TEXTURA, O PADRÃO (regra do usuário de 07/11/2026: "eu quero que a
 * padrão seja a linha atual, só paredes específicas que eu vou querer isso"): o
 * "Com textura" da ferramenta Parede vale só para o traço dela. A Sala, a Sala
 * livre e o "Criar paredes" da região (a ilha, a costa) nascem Só linhas mesmo
 * com ele ligado.
 */

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

afterEach(() => {
  useMapStore.getState().setWallAcabamento('linhas')
})

describe('material da parede na store', () => {
  it('com "Com textura" ligado, só a ferramenta Parede grava o material; Sala, Sala livre e Criar paredes nascem Só linhas', () => {
    const store = useMapStore.getState()
    store.loadMap(createEmptyMap('m_textura', 'Textura', 30, 30, 64))
    store.setWallAcabamento('textura')
    store.setWallMaterial('ferro')

    const sala = buildRoomFromDraft('sala', ['s0', 's1', 's2', 's3'], { x: 0, y: 0 }, { x: 320, y: 256 })
    useMapStore.getState().addRoom(sala.region, sala.walls)
    // A Sala livre no modo Parede (`addWalls`), longe da Sala.
    useMapStore.getState().addWalls([parede('livre-1', 640, 0, 700, 40), parede('livre-2', 700, 40, 760, 0)])
    // A ilha: uma região comum, com as paredes criadas pelo "Criar paredes".
    const ilha = [{ x: 0, y: 640 }, { x: 400, y: 600 }, { x: 460, y: 900 }, { x: 60, y: 960 }]
    useMapStore.getState().addRegion({ id: 'ilha', points: ilha, tag: 'region', fillColor: '#8cbf80', fillPattern: 'solid', data: {} })
    useMapStore.getState().linkRegionWalls('ilha')
    useMapStore.getState().addWall(parede('riscada', 1200, 0, 1456, 0))

    const walls = useMapStore.getState().map.walls
    expect(walls.filter((w) => w.regionId === 'ilha')).toHaveLength(4)
    expect(walls.find((w) => w.id === 'riscada')?.material).toBe('ferro')
    const outras = walls.filter((w) => w.id !== 'riscada')
    expect(outras).toHaveLength(4 + 2 + 4)
    for (const w of outras) expect(w).not.toHaveProperty('material')
  })
})
