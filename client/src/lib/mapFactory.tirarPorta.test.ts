import { describe, expect, it } from 'vitest'
import type { MapData, Wall } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import { selectionOfItem } from './selectionModel'
import { buildRoomFromDraft } from './drawingFactory'
import { addDoorOnWall, addRoom, addWall, createEmptyMap, tirarPorta } from './mapFactory'

/**
 * TIRAR A PORTA DEIXA A PAREDE INTEIRA DE VERDADE (prova de 11/11/2026: depois
 * de tirar a porta, a parede solta ficava em 3 pedaços e o clique onde estava a
 * porta pegava só o pedaço de 32 px). Os vizinhos encostados na mesma reta, com
 * as mesmas propriedades e o mesmo dono, viram UM pedaço só.
 */

const PAREDE: Wall = { id: 'parede', x1: 0, y1: 0, x2: 256, y2: 0, blocksLight: true, blocksMove: true, door: null, thickness: 'thick', color: '#704214' }

function paredeComPorta(): MapData {
  return addDoorOnWall(addWall(createEmptyMap('m', 'M', 10, 10, 64), PAREDE), 'parede', { x: 128, y: 0 }, 32, 'normal')
}

const portaDe = (map: MapData): Wall => {
  const porta = map.walls.find((w) => w.door !== null)
  if (porta === undefined) throw new Error('a porta não nasceu')
  return porta
}

describe('tirarPorta', () => {
  it('parede solta: os 3 pedaços viram UMA parede de 0 a 256, com as propriedades dela; o Ctrl+Z volta a porta e os pedaços', () => {
    const antes = paredeComPorta()
    const porta = portaDe(antes)
    useMapStore.setState({ map: antes, selection: selectionOfItem({ kind: 'wall', id: porta.id }), past: [], future: [] })

    useMapStore.getState().removeSelected()

    const { walls } = useMapStore.getState().map
    expect(walls).toHaveLength(1)
    expect(walls[0]).toMatchObject({ door: null, thickness: 'thick', color: '#704214', blocksMove: true })
    expect([Math.min(walls[0].x1, walls[0].x2), Math.max(walls[0].x1, walls[0].x2)]).toEqual([0, 256])
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('parede de sala: a aresta vira um pedaço só, presa à mesma aresta; vizinho diferente não junta', () => {
    const { region, walls } = buildRoomFromDraft('sala', ['w0', 'w1', 'w2', 'w3'], { x: 0, y: 0 }, { x: 256, y: 192 })
    const comPorta = addDoorOnWall(addRoom(createEmptyMap('m', 'M', 10, 10, 64), region, walls), 'w0', { x: 128, y: 0 }, 32, 'normal')
    const doTopo = (map: MapData) => map.walls.filter((w) => w.regionId === 'sala' && w.regionEdgeIndex === 0)
    const juntou = doTopo(tirarPorta(comPorta, portaDe(comPorta).id))
    expect(juntou).toHaveLength(1)
    expect([Math.min(juntou[0].x1, juntou[0].x2), Math.max(juntou[0].x1, juntou[0].x2)]).toEqual([0, 256])

    // O pedaço da direita ganhou outra cor: ele fica separado, e só a esquerda junta com o trecho da porta.
    const porta = portaDe(comPorta)
    const direita = doTopo(comPorta).find((w) => w.door === null && Math.min(w.x1, w.x2) >= 144 - 1e-6)
    if (direita === undefined) throw new Error('montagem')
    const pintada = { ...comPorta, walls: comPorta.walls.map((w) => (w.id === direita.id ? { ...w, color: '#ff0000' } : w)) }
    const separado = doTopo(tirarPorta(pintada, porta.id))
    expect(separado).toHaveLength(2)
    expect(separado.find((w) => w.id === direita.id)).toEqual({ ...direita, color: '#ff0000' })
  })
})
