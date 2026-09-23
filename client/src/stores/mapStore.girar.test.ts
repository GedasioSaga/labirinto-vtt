import { beforeEach, describe, expect, it } from 'vitest'
import type { MapData, Region } from '../types/map'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { placeNewRoom } from '../lib/roomNesting'
import { EMPTY_SELECTION } from '../lib/selectionModel'

/**
 * GIRAR SALA, lado do HISTÓRICO e da sala de fora. Um giro é UMA decisão do
 * mestre: um Ctrl+Z desfaz o giro inteiro — pelos botões, pelo campo ou pelo
 * arrasto da alça, que passa por dezenas de quadros sem histórico.
 */

function salaEmPe(): MapData {
  const { region, walls } = buildRoomFromDraft('sala', ['w0', 'w1', 'w2', 'w3'], { x: 576, y: 256 }, { x: 704, y: 640 })
  return mapFactory.addRoom(mapFactory.createEmptyMap('m', 'M', 30, 20, 64), region, walls)
}

/** Casa 0..640 com um quarto encostado no canto de cima à esquerda (topo e esquerda sobre a parede da casa). */
function casaComQuarto(): MapData {
  let map = mapFactory.createEmptyMap('m', 'M', 30, 20, 64)
  const casa = buildRoomFromDraft('casa', ['c0', 'c1', 'c2', 'c3'], { x: 0, y: 0 }, { x: 640, y: 640 })
  map = mapFactory.addRoom(map, casa.region, casa.walls)
  const quarto = placeNewRoom(map.regions, map.walls, buildRoomFromDraft('quarto', ['q0', 'q1', 'q2', 'q3'], { x: 0, y: 0 }, { x: 320, y: 128 }), null)
  return mapFactory.addRoom(map, quarto.region, quarto.walls)
}

function carregar(map: MapData): void {
  useMapStore.setState({ map, selection: EMPTY_SELECTION, past: [], future: [] })
}

const sala = (id = 'sala'): Region => {
  const region = useMapStore.getState().map.regions.find((r) => r.id === id)
  if (!region) throw new Error(`sala ${id} não existe`)
  return region
}

describe('mapStore — girar sala pelo painel', () => {
  beforeEach(() => carregar(salaEmPe()))

  it('+90° gira com UMA entrada de histórico, e o Ctrl+Z devolve o mapa exato', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().rotateRoom('sala', 90)
    expect(sala().room?.rotation).toBe(90)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('depois de 90° a sala deitada volta à ordem de cantos padrão (canto 0 em cima à esquerda)', () => {
    useMapStore.getState().rotateRoom('sala', 90)
    expect(sala().points[0]).toEqual({ x: 448, y: 384 })
  })

  it('o campo gira pela DIFERENÇA: de 30° para 90° é mais 60°, não mais 90°', () => {
    useMapStore.getState().setRoomRotation('sala', 30)
    useMapStore.getState().setRoomRotation('sala', 90)
    expect(sala().room?.rotation).toBe(90)
    // Mesmo resultado de um 90° direto: a sala está deitada, exata.
    expect(sala().points[0]).toEqual({ x: 448, y: 384 })
    expect(useMapStore.getState().past).toHaveLength(2)
  })

  it('digitar o ângulo em que a sala já está não gasta entrada de histórico', () => {
    useMapStore.getState().setRoomRotation('sala', 0)
    useMapStore.getState().setRoomRotation('sala', 360)
    useMapStore.getState().rotateRoom('sala', 0)
    useMapStore.getState().setRoomRotation('sala', Number.NaN)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('sala travada não gira, nem pelo painel', () => {
    useMapStore.getState().setRegionLocked('sala', true)
    const travada = useMapStore.getState().map
    useMapStore.getState().rotateRoom('sala', 90)
    useMapStore.getState().setRoomRotation('sala', 45)
    expect(useMapStore.getState().map).toBe(travada)
  })
})

describe('mapStore — girar sala pela alça (arrasto)', () => {
  beforeEach(() => carregar(salaEmPe()))

  it('dezenas de quadros ao vivo viram UM Ctrl+Z, que devolve a sala em pé', () => {
    const antes = useMapStore.getState().map
    for (let i = 0; i < 18; i += 1) useMapStore.getState().rotateRoomLive('sala', 5)
    expect(useMapStore.getState().past).toHaveLength(0)
    useMapStore.getState().finishRoomRotationLive(antes, 'sala')
    useMapStore.getState().commitDragHistory(antes)
    expect(sala().room?.rotation).toBe(90)
    // 18 giros de 5° somam 90° sem erro de conta sobrando: cantos inteiros, na ordem padrão.
    expect(sala().points).toEqual([
      { x: 448, y: 384 },
      { x: 832, y: 384 },
      { x: 832, y: 512 },
      { x: 448, y: 512 },
    ])
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('a ficha que o jogador anda no meio do arrasto (rede) não é apagada pelo quadro seguinte', () => {
    const antes = useMapStore.getState().map
    useMapStore.setState({ map: { ...antes, tokens: [{ id: 't', characterId: null, name: 'Aliada', x: 100, y: 100, size: 1, image: null }] } })
    useMapStore.getState().rotateRoomLive('sala', 10)
    useMapStore.getState().setTokenPosition('t', 164, 100)
    useMapStore.getState().rotateRoomLive('sala', 10)
    expect(useMapStore.getState().map.tokens[0]).toMatchObject({ x: 164, y: 100 })
    expect(sala().room?.rotation).toBe(20)
  })
})

describe('mapStore — a sala de fora depois do giro', () => {
  beforeEach(() => carregar(casaComQuarto()))

  it('girar a casa leva o quarto junto e ele continua filho dela, sem parede nova', () => {
    const paredes = useMapStore.getState().map.walls.length
    useMapStore.getState().rotateRoom('casa', 90)
    expect(sala('quarto').parentId).toBe('casa')
    expect(useMapStore.getState().map.walls).toHaveLength(paredes)
  })

  it('o quarto girado que sai da casa deixa de ser filho dela, e as arestas que estavam na parede da casa ganham parede', () => {
    // Quarto 320 x 128 no canto (0,0): girado 90° em volta do próprio centro (160,64) ele fica
    // 128 x 320 com o topo em y = −96 — fura o topo da casa.
    const paredesDoQuarto = useMapStore.getState().map.walls.filter((w) => w.regionId === 'quarto').length
    useMapStore.getState().rotateRoom('quarto', 90)
    expect(sala('quarto').parentId).toBeUndefined()
    expect(useMapStore.getState().map.walls.filter((w) => w.regionId === 'quarto').length).toBeGreaterThan(paredesDoQuarto)
    // Um Ctrl+Z desfaz tudo: o giro, a troca de mãe e as paredes novas.
    useMapStore.getState().undo()
    expect(sala('quarto').parentId).toBe('casa')
    expect(useMapStore.getState().map.walls.filter((w) => w.regionId === 'quarto')).toHaveLength(paredesDoQuarto)
  })
})
