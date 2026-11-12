import { beforeEach, describe, expect, it } from 'vitest'
import type { MapData, Wall } from '../types/map'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { selectionOfItem } from '../lib/selectionModel'

/**
 * TIRAR A PORTA (pedido de 12/11/2026: "uma vez que eu coloco uma porta eu não
 * consigo tirar ou expandir"). Com a porta selecionada sozinha, o Delete (e o
 * Backspace, que dá no mesmo `removeSelected`) TIRA a porta: o trecho volta a
 * ser parede e a parede fica inteira. Antes ele apagava o pedaço da porta e
 * deixava um buraco na parede.
 */

const PAREDE: Wall = { id: 'parede', x1: 0, y1: 0, x2: 256, y2: 0, blocksLight: true, blocksMove: true, door: null }

/** O trecho 0..256 do eixo x está todo coberto por parede sólida (sem buraco e sem porta)? */
function paredeInteira(walls: readonly Wall[]): boolean {
  const trechos = walls.filter((w) => w.door === null && w.y1 === 0 && w.y2 === 0).map((w) => [Math.min(w.x1, w.x2), Math.max(w.x1, w.x2)] as const)
  trechos.sort((a, b) => a[0] - b[0])
  let ate = 0
  for (const [de, para] of trechos) {
    if (de > ate + 1e-6) return false
    ate = Math.max(ate, para)
  }
  return ate >= 256 - 1e-6 && walls.every((w) => w.door === null)
}

function selecionarAPorta(map: MapData): void {
  const porta = map.walls.find((w) => w.door !== null)
  if (porta === undefined) throw new Error('a porta não nasceu')
  useMapStore.setState({ map, selection: selectionOfItem({ kind: 'wall', id: porta.id }), past: [], future: [] })
}

describe('Delete com a porta selecionada sozinha', () => {
  beforeEach(() => {
    useMapStore.setState({ selection: [], past: [], future: [] })
  })

  it('parede solta: a porta sai, a parede fica inteira, e o Ctrl+Z devolve a porta', () => {
    const comPorta = mapFactory.addDoorOnWall(mapFactory.addWall(mapFactory.createEmptyMap('m', 'M', 10, 10, 64), PAREDE), 'parede', { x: 128, y: 0 }, 32, 'normal')
    selecionarAPorta(comPorta)

    useMapStore.getState().removeSelected()

    expect(paredeInteira(useMapStore.getState().map.walls)).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(comPorta)
  })

  it('parede de sala: a porta sai e a aresta continua fechada, presa à sala', () => {
    const { region, walls } = buildRoomFromDraft('sala', ['w0', 'w1', 'w2', 'w3'], { x: 0, y: 0 }, { x: 256, y: 192 })
    const comPorta = mapFactory.addDoorOnWall(mapFactory.addRoom(mapFactory.createEmptyMap('m', 'M', 10, 10, 64), region, walls), 'w0', { x: 128, y: 0 }, 32, 'normal')
    selecionarAPorta(comPorta)

    useMapStore.getState().removeSelected()

    const doTopo = useMapStore.getState().map.walls.filter((w) => w.regionId === 'sala' && w.regionEdgeIndex === 0)
    expect(paredeInteira(doTopo)).toBe(true)
  })
})
