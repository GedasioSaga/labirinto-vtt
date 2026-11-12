import { beforeEach, describe, expect, it } from 'vitest'
import type { MapData, Prop, Region, Stair } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import * as mapFactory from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { ROOM_ROTATE_HANDLE, roomRotationOf } from '../lib/roomRotation'
import { createRoomRotateGesture } from './roomRotateGesture'

/**
 * O gesto da alça de girar, como a mão o faz: pega a bolinha acima da sala,
 * anda em arco em volta do centro e solta. Sem Pixi — o PixiCanvas só repassa
 * os eventos para este módulo.
 */

const CENTRO = { x: 640, y: 448 }
/** Bolinha da sala 2x6 em pé (topo em y = 256), com zoom 1. */
const ALCA = { x: 640, y: 256 - ROOM_ROTATE_HANDLE.offsetPx }
const RAIO = CENTRO.y - ALCA.y

/** Ponto no arco da alça, `graus` no sentido horário a partir de "em cima". */
const noArco = (graus: number) => {
  const a = (graus * Math.PI) / 180
  return { x: CENTRO.x + RAIO * Math.sin(a), y: CENTRO.y - RAIO * Math.cos(a) }
}

function salaEmPe(): MapData {
  const { region, walls } = buildRoomFromDraft('sala', ['w0', 'w1', 'w2', 'w3'], { x: 576, y: 256 }, { x: 704, y: 640 })
  return mapFactory.addRoom(mapFactory.createEmptyMap('m', 'M', 30, 20, 64), region, walls)
}

const sala = (): Region => {
  const region = useMapStore.getState().map.regions.find((r) => r.id === 'sala')
  if (!region) throw new Error('a sala sumiu')
  return region
}

describe('alça de girar sala', () => {
  let antes: MapData

  beforeEach(() => {
    antes = salaEmPe()
    useMapStore.setState({ map: antes, selection: EMPTY_SELECTION, past: [], future: [] })
  })

  it('só pega na bolinha: um clique no topo da sala ou longe dela não começa giro nenhum', () => {
    const gesto = createRoomRotateGesture()
    expect(gesto.begin('sala', { x: 640, y: 256 }, 1)).toBe(false)
    expect(gesto.begin('sala', { x: 900, y: 100 }, 1)).toBe(false)
    expect(gesto.isActive()).toBe(false)
    expect(gesto.begin('sala', ALCA, 1)).toBe(true)
    expect(gesto.isActive()).toBe(true)
  })

  it('arrastar 90° em arco deita a sala ao vivo, com a etiqueta do ângulo, e solta com UM Ctrl+Z', () => {
    const gesto = createRoomRotateGesture()
    gesto.begin('sala', ALCA, 1)
    let ultimo = null
    for (let g = 10; g <= 90; g += 10) ultimo = gesto.move(noArco(g), false)
    expect(ultimo).toEqual({ rotation: 90, label: '90°' })
    // Ao vivo, antes de soltar: já deitada, e ainda sem histórico.
    expect(sala().room?.rotation).toBe(90)
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(gesto.finish()).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(sala().points[0]).toEqual({ x: 448, y: 384 })
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('com Shift, o ângulo anda de 15 em 15 — e soltar o Shift volta ao grau inteiro na hora', () => {
    const gesto = createRoomRotateGesture()
    gesto.begin('sala', ALCA, 1)
    expect(gesto.move(noArco(37), true)?.rotation).toBe(30)
    expect(gesto.move(noArco(38), true)?.rotation).toBe(45)
    expect(gesto.setShift(false)?.rotation).toBe(38)
    expect(gesto.setShift(true)?.rotation).toBe(45)
    expect(sala().room?.rotation).toBe(45)
  })

  it('Esc no meio devolve a sala ao ângulo do começo e não grava nada', () => {
    const gesto = createRoomRotateGesture()
    gesto.begin('sala', ALCA, 1)
    gesto.move(noArco(63), false)
    expect(gesto.cancel()).toBe(true)
    expect(gesto.isActive()).toBe(false)
    expect(sala().points).toEqual(antes.regions[0].points)
    expect(Object.keys(sala().room ?? {})).not.toContain('rotation')
    // O pointerup que vem depois do Esc não fecha nada.
    expect(gesto.finish()).toBe(false)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('perto do centro o ângulo não quer dizer nada: a sala fica parada', () => {
    const gesto = createRoomRotateGesture()
    gesto.begin('sala', ALCA, 1)
    expect(gesto.move({ x: CENTRO.x + 3, y: CENTRO.y + 2 }, false)).toBeNull()
    expect(sala()).toBe(antes.regions[0])
  })

  it('ir e voltar ao mesmo ângulo (ou só clicar) não deixa um Ctrl+Z que não faz nada', () => {
    const gesto = createRoomRotateGesture()
    gesto.begin('sala', ALCA, 1)
    gesto.move(noArco(40), false)
    gesto.move(noArco(0), false)
    gesto.finish()
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('sala travada não tem alça', () => {
    useMapStore.getState().setRegionLocked('sala', true)
    expect(createRoomRotateGesture().begin('sala', ALCA, 1)).toBe(false)
  })

  it('zoom 2: a bolinha está a offsetPx de TELA do topo, então a metade disso em px de mundo', () => {
    const gesto = createRoomRotateGesture()
    expect(gesto.begin('sala', ALCA, 2)).toBe(false)
    expect(gesto.begin('sala', { x: 640, y: 256 - ROOM_ROTATE_HANDLE.offsetPx / 2 }, 2)).toBe(true)
  })
})

describe('alça de girar numa sala 3 x 4 (lado ímpar): o quarto de volta pelo arrasto fica na grade', () => {
  const CENTRO_3X4 = { x: 672, y: 384 }
  const ALCA_3X4 = { x: 672, y: 256 - ROOM_ROTATE_HANDLE.offsetPx }
  const RAIO_3X4 = CENTRO_3X4.y - ALCA_3X4.y
  const noArco3x4 = (graus: number) => {
    const a = (graus * Math.PI) / 180
    return { x: CENTRO_3X4.x + RAIO_3X4 * Math.sin(a), y: CENTRO_3X4.y - RAIO_3X4 * Math.cos(a) }
  }
  const CANTOS_DE_PARTIDA = [
    { x: 576, y: 256 },
    { x: 768, y: 256 },
    { x: 768, y: 512 },
    { x: 576, y: 512 },
  ]
  /** Onde o botão +90° põe a mesma sala. */
  const PELO_BOTAO = [
    { x: 512, y: 256 },
    { x: 768, y: 256 },
    { x: 768, y: 448 },
    { x: 512, y: 448 },
  ]
  let antes: MapData

  beforeEach(() => {
    const { region, walls } = buildRoomFromDraft('sala', ['w0', 'w1', 'w2', 'w3'], { x: 576, y: 256 }, { x: 768, y: 512 })
    antes = mapFactory.addRoom(mapFactory.createEmptyMap('m', 'M', 30, 20, 64), region, walls)
    useMapStore.setState({ map: antes, selection: EMPTY_SELECTION, past: [], future: [] })
  })

  it('um pointermove só, com Shift, até 90°: solta onde o botão +90° poria, com UM Ctrl+Z', () => {
    const gesto = createRoomRotateGesture()
    expect(gesto.begin('sala', ALCA_3X4, 1)).toBe(true)
    expect(gesto.move(noArco3x4(89), true)?.rotation).toBe(90)
    expect(gesto.finish()).toBe(true)
    expect(sala().points).toEqual(PELO_BOTAO)
    expect(useMapStore.getState().past).toHaveLength(1)
  })

  it('dois arrastos, até 30° e depois até 90°: a segunda soltura põe a sala na grade', () => {
    const primeiro = createRoomRotateGesture()
    expect(primeiro.begin('sala', ALCA_3X4, 1)).toBe(true)
    expect(primeiro.move(noArco3x4(30), true)?.rotation).toBe(30)
    expect(primeiro.finish()).toBe(true)
    const segundo = createRoomRotateGesture()
    expect(segundo.begin('sala', noArco3x4(30), 1)).toBe(true)
    expect(segundo.move(noArco3x4(90), true)?.rotation).toBe(90)
    expect(segundo.finish()).toBe(true)
    expect(sala().points).toEqual(PELO_BOTAO)
    expect(useMapStore.getState().past).toHaveLength(2)
  })

  it('Esc depois de chegar a 90° de 15 em 15: a sala volta exatamente aonde estava, sem histórico', () => {
    const gesto = createRoomRotateGesture()
    gesto.begin('sala', ALCA_3X4, 1)
    for (let g = 15; g <= 90; g += 15) gesto.move(noArco3x4(g), true)
    expect(sala().room?.rotation).toBe(90)
    expect(gesto.cancel()).toBe(true)
    expect(roomRotationOf(sala().room)).toBe(0)
    expect(sala().points).toEqual(CANTOS_DE_PARTIDA)
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})

/**
 * OBJETO GIRADO PELA ALÇA (pedido de 11/11/2026: "seria legal se os objetos
 * pudessem ficar se inclinando que nem as casas"): a mesma bolinha e a mesma
 * conta da sala, em volta do centro do objeto.
 */
describe('alça de girar objeto', () => {
  // Barraca 128 x 64 com o centro em (640, 448): o topo fica em y = 416.
  const BARRACA: Prop = { id: 'barraca', src: '', x: 640, y: 448, width: 128, height: 64, linkedMapPath: null }
  const ALCA_DO_OBJETO = { x: 640, y: 416 - ROOM_ROTATE_HANDLE.offsetPx }
  const RAIO_DO_OBJETO = BARRACA.y - ALCA_DO_OBJETO.y
  const noArcoDoObjeto = (graus: number) => {
    const a = (graus * Math.PI) / 180
    return { x: BARRACA.x + RAIO_DO_OBJETO * Math.sin(a), y: BARRACA.y - RAIO_DO_OBJETO * Math.cos(a) }
  }
  const objeto = (): Prop => {
    const prop = useMapStore.getState().map.props.find((p) => p.id === 'barraca')
    if (!prop) throw new Error('o objeto sumiu')
    return prop
  }
  let antes: MapData

  beforeEach(() => {
    antes = mapFactory.addProp(mapFactory.createEmptyMap('m', 'M', 30, 20, 64), BARRACA)
    useMapStore.setState({ map: antes, selection: EMPTY_SELECTION, past: [], future: [] })
  })

  it('arrastar a bolinha em arco inclina o objeto ao vivo, em volta do centro, e soltar grava UM Ctrl+Z', () => {
    const gesto = createRoomRotateGesture()
    expect(gesto.beginProp('barraca', { x: 640, y: 448 }, 1)).toBe(false)
    expect(gesto.beginProp('barraca', ALCA_DO_OBJETO, 1)).toBe(true)
    let ultimo = null
    for (let g = 5; g <= 35; g += 5) ultimo = gesto.move(noArcoDoObjeto(g), false)
    expect(ultimo).toEqual({ rotation: 35, label: '35°' })
    expect(objeto()).toMatchObject({ rotation: 35, x: 640, y: 448, width: 128, height: 64 })
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(gesto.finish()).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('Esc no meio devolve o objeto como estava, sem histórico; travado não tem alça', () => {
    const gesto = createRoomRotateGesture()
    gesto.beginProp('barraca', ALCA_DO_OBJETO, 1)
    gesto.move(noArcoDoObjeto(50), false)
    expect(gesto.cancel()).toBe(true)
    expect(objeto()).toEqual(BARRACA)
    expect(useMapStore.getState().past).toHaveLength(0)
    useMapStore.setState({ map: mapFactory.addProp(mapFactory.createEmptyMap('m', 'M', 30, 20, 64), { ...BARRACA, locked: true }) })
    expect(createRoomRotateGesture().beginProp('barraca', ALCA_DO_OBJETO, 1)).toBe(false)
  })
})

/**
 * ESCADA GIRADA PELA ALÇA (pedido de 12/11/2026: "uma vez que eu coloco a
 * escada não da para colocar trocar para vertical e horizontal"): a mesma
 * bolinha, acima da escada deitada, e o giro vai para os lances.
 */
describe('alça de girar escada', () => {
  // A escada deitada do print: 4 casas, centro em (256, 256), borda de cima em y = 224.
  const DEITADA: Stair = { id: 'e', shape: 'straight', direction: 'up', segments: [{ x1: 128, y1: 256, x2: 384, y2: 256 }], stepWidth: 64 }
  const CENTRO_DA_ESCADA = { x: 256, y: 256 }
  const ALCA_DA_ESCADA = { x: 256, y: 224 - ROOM_ROTATE_HANDLE.offsetPx }
  const RAIO_DA_ESCADA = CENTRO_DA_ESCADA.y - ALCA_DA_ESCADA.y
  const noArcoDaEscada = (graus: number) => {
    const a = (graus * Math.PI) / 180
    return { x: CENTRO_DA_ESCADA.x + RAIO_DA_ESCADA * Math.sin(a), y: CENTRO_DA_ESCADA.y - RAIO_DA_ESCADA * Math.cos(a) }
  }
  const escada = (): Stair => {
    const stair = useMapStore.getState().map.stairs.find((s) => s.id === 'e')
    if (!stair) throw new Error('a escada sumiu')
    return stair
  }
  let antes: MapData

  beforeEach(() => {
    antes = mapFactory.addStair(mapFactory.createEmptyMap('m', 'M', 30, 20, 64), DEITADA)
    useMapStore.setState({ map: antes, selection: EMPTY_SELECTION, past: [], future: [] })
  })

  it('arrastar a bolinha até 90° põe a escada em pé ao vivo, em volta do centro, e soltar grava UM Ctrl+Z', () => {
    const gesto = createRoomRotateGesture()
    expect(gesto.beginStair('e', CENTRO_DA_ESCADA, 1)).toBe(false)
    expect(gesto.beginStair('e', ALCA_DA_ESCADA, 1)).toBe(true)
    let ultimo = null
    for (let g = 15; g <= 90; g += 15) ultimo = gesto.move(noArcoDaEscada(g), true)
    expect(ultimo).toEqual({ rotation: 90, label: '90°' })
    expect(escada().segments).toEqual([{ x1: 256, y1: 128, x2: 256, y2: 384 }])
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(gesto.finish()).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('Esc no meio devolve a escada como estava, sem histórico; travada não tem alça', () => {
    const gesto = createRoomRotateGesture()
    gesto.beginStair('e', ALCA_DA_ESCADA, 1)
    gesto.move(noArcoDaEscada(50), false)
    expect(escada().segments).not.toEqual(DEITADA.segments)
    expect(gesto.cancel()).toBe(true)
    expect(escada()).toEqual(DEITADA)
    expect(useMapStore.getState().past).toHaveLength(0)
    useMapStore.setState({ map: mapFactory.addStair(mapFactory.createEmptyMap('m', 'M', 30, 20, 64), { ...DEITADA, locked: true }) })
    expect(createRoomRotateGesture().beginStair('e', ALCA_DA_ESCADA, 1)).toBe(false)
  })
})
