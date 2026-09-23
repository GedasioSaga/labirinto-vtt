import { beforeEach, describe, expect, it } from 'vitest'
import type { MapData, Region } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import * as mapFactory from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { ROOM_ROTATE_HANDLE } from '../lib/roomRotation'
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
