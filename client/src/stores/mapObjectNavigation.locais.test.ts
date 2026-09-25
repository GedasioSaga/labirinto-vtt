import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region } from '../types/map'
import { useAdventureStore } from './adventureStore'
import { useFollowStore } from './followStore'
import { useMapStore } from './mapStore'
import { framePlace } from './mapObjectNavigation'

/**
 * "Enquadrar" da árvore de Locais: o clique no prédio seleciona o prédio e
 * pede a câmera do EDITOR com a caixa dele E de tudo que há dentro (o anexo
 * que passa da parede também tem de caber). Vista do mestre só: o mapa não
 * muda e o jogador não recebe nada.
 */

function sala(id: string, nome: string, x1: number, y1: number, x2: number, y2: number, parentId?: string): Region {
  const region: Region = {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#8c1e8c',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
  }
  return parentId === undefined ? region : { ...region, parentId }
}

const BAIRRO: MapData = {
  ...createEmptyMap('map_bairro', 'Bairro', 40, 40, 50),
  regions: [
    sala('q-1', 'Quarteirão 1', 0, 0, 1800, 1800),
    sala('p-farol', 'Prédio do Farol', 100, 100, 700, 700, 'q-1'),
    sala('piso-1', 'Piso 1', 100, 100, 700, 700, 'p-farol'),
    sala('anexo', 'Anexo', 600, 600, 900, 900, 'piso-1'),
    sala('p-banco', 'Banco', 1000, 1000, 1500, 1500, 'q-1'),
  ],
}

beforeEach(() => {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(BAIRRO)
  useMapStore.getState().setActiveTool('select')
  useFollowStore.setState({ playerId: null })
})

describe('framePlace', () => {
  it('enquadra o prédio inteiro: a caixa cobre o prédio e o anexo de dentro, e o prédio fica selecionado', () => {
    framePlace('p-farol')
    expect(useMapStore.getState().selection).toEqual([{ kind: 'region', id: 'p-farol' }])
    expect(useAdventureStore.getState().cameraRequest).toEqual({
      camera: null,
      focus: { x: 500, y: 500 },
      fit: { minX: 100, minY: 100, maxX: 900, maxY: 900 },
    })
  })

  it('desliga o Seguir e passa para Selecionar, como o "Ir até lá" da lista de objetos', () => {
    useFollowStore.setState({ playerId: 'ana' })
    useMapStore.getState().setActiveTool('wall')
    framePlace('p-banco')
    expect(useFollowStore.getState().playerId).toBeNull()
    expect(useMapStore.getState().activeTool).toBe('select')
    expect(useAdventureStore.getState().cameraRequest?.fit).toEqual({ minX: 1000, minY: 1000, maxX: 1500, maxY: 1500 })
  })

  it('local que saiu do mapa: não seleciona nem mexe na câmera, e o mapa não muda', () => {
    const mapa = useMapStore.getState().map
    framePlace('sumiu')
    expect(useMapStore.getState().selection).toEqual([])
    expect(useAdventureStore.getState().cameraRequest).toBeNull()
    expect(useMapStore.getState().map).toBe(mapa)
    expect(useMapStore.getState().past).toEqual([])
  })
})
