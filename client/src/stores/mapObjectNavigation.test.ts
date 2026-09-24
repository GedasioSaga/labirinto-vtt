import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { mapObjectOf } from '../lib/mapObjects'
import type { MapData, Region } from '../types/map'
import { useAdventureStore } from './adventureStore'
import { useFollowStore } from './followStore'
import { useMapStore } from './mapStore'
import { goToMapObject } from './mapObjectNavigation'

/**
 * O "Ir até lá" da lista Objetos do mapa, do lado das stores: seleciona como o
 * clique da ferramenta Selecionar, pede a câmera do EDITOR no objeto e não
 * mexe em mais nada — nem no mapa (o jogador não recebe nada disto).
 */

function sala(id: string, nome: string, x1: number, y1: number, x2: number, y2: number): Region {
  return {
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
}

const SALAO: MapData = {
  ...createEmptyMap('map_salao', 'Salão', 40, 16, 50),
  regions: [sala('r-entrada', 'Salão de Entrada', 100, 150, 600, 650), sala('r-cripta', 'Cripta', 1500, 200, 1850, 600)],
  walls: [{ id: 'w-porta', x1: 1500, y1: 350, x2: 1500, y2: 450, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }],
  pins: [{ id: 'p-bau', x: 1650, y: 250, kind: 'exclamacao', description: 'Baú do tesouro', image: null }],
  drawings: [{ id: 't-aviso', kind: 'text', x: 900, y: 100, text: 'Cuidado com o chão', color: '#ffffff', fontSize: 24 }],
  tokens: [
    { id: 'k-lanterna', characterId: null, name: 'Lanterna', x: 1250, y: 700, size: 1, image: null, color: '#ff5a00' },
    { id: 'k-heroi', characterId: null, name: 'Heroi', x: 250, y: 300, size: 1, image: null },
  ],
}

function entrada(map: MapData, key: string) {
  const achada = mapObjectOf(map, key)
  if (achada === null) throw new Error(`o mapa do teste não tem ${key}`)
  return achada
}

beforeEach(() => {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(SALAO)
  useMapStore.getState().setActiveTool('select')
  useFollowStore.setState({ playerId: null })
})

describe('goToMapObject', () => {
  it('sala: seleciona e pede a câmera no meio dela, com a caixa inteira para caber na tela', () => {
    goToMapObject(entrada(SALAO, 'room:r-cripta'))
    expect(useMapStore.getState().selection).toEqual([{ kind: 'region', id: 'r-cripta' }])
    expect(useAdventureStore.getState().cameraRequest).toEqual({
      camera: null,
      focus: { x: 1675, y: 400 },
      fit: { minX: 1500, minY: 200, maxX: 1850, maxY: 600 },
    })
  })

  it('com outra ferramenta na mão, passa para Selecionar: seleção é da Selecionar, e a de criar a apagaria', () => {
    useMapStore.getState().setActiveTool('wall')
    goToMapObject(entrada(SALAO, 'token:k-lanterna'))
    expect(useMapStore.getState().activeTool).toBe('select')
    expect(useMapStore.getState().selection).toEqual([{ kind: 'token', id: 'k-lanterna' }])
  })

  it('porta seleciona a parede dela; texto seleciona o desenho', () => {
    goToMapObject(entrada(SALAO, 'door:w-porta'))
    expect(useMapStore.getState().selection).toEqual([{ kind: 'wall', id: 'w-porta' }])
    goToMapObject(entrada(SALAO, 'text:t-aviso'))
    expect(useMapStore.getState().selection).toEqual([{ kind: 'drawing', id: 't-aviso' }])
  })

  it('pino: abre o pino no painel (ele não mora na seleção)', () => {
    useMapStore.getState().setSelection([{ kind: 'token', id: 'k-heroi' }])
    goToMapObject(entrada(SALAO, 'pin:p-bau'))
    expect(useMapStore.getState().selectedPinId).toBe('p-bau')
    expect(useMapStore.getState().selection).toEqual([])
  })

  it('com o Seguir ligado, desliga: o mestre escolheu outra vista (mesma regra do "Ir lá" do Grupo)', () => {
    useFollowStore.setState({ playerId: 'ana' })
    goToMapObject(entrada(SALAO, 'room:r-entrada'))
    expect(useFollowStore.getState().playerId).toBeNull()
  })

  it('camada travada: leva até lá, mas não seleciona, e larga a seleção de antes', () => {
    const travada: MapData = { ...SALAO, lockedLayers: ['salas'] }
    useMapStore.getState().loadMap(travada)
    useMapStore.getState().setSelection([{ kind: 'token', id: 'k-heroi' }])
    goToMapObject(entrada(travada, 'room:r-cripta'))
    expect(useMapStore.getState().selection).toEqual([])
    expect(useMapStore.getState().selectedPinId).toBeNull()
    expect(useAdventureStore.getState().cameraRequest?.focus).toEqual({ x: 1675, y: 400 })
  })

  it('usa o mapa de agora: o token que andou depois da lista desenhada é achado onde está', () => {
    const antes = entrada(SALAO, 'token:k-lanterna')
    // Como a ficha chega andada pela rede (o jogador arrastou): o mapa troca por inteiro.
    const { map } = useMapStore.getState()
    useMapStore.setState({ map: { ...map, tokens: map.tokens.map((t) => (t.id === 'k-lanterna' ? { ...t, x: 400, y: 420 } : t)) } })
    goToMapObject(antes)
    expect(useAdventureStore.getState().cameraRequest?.focus).toEqual({ x: 400, y: 420 })
  })

  it('objeto que saiu do mapa: não seleciona nem mexe na câmera', () => {
    const antes = entrada(SALAO, 'token:k-lanterna')
    useMapStore.getState().loadMap({ ...SALAO, tokens: [] })
    goToMapObject(antes)
    expect(useMapStore.getState().selection).toEqual([])
    expect(useAdventureStore.getState().cameraRequest).toBeNull()
  })

  it('não toca no mapa: nada para desfazer e nada que a rede mande ao jogador', () => {
    const mapa = useMapStore.getState().map
    goToMapObject(entrada(SALAO, 'room:r-cripta'))
    expect(useMapStore.getState().map).toBe(mapa)
    expect(useMapStore.getState().past).toEqual([])
  })
})
