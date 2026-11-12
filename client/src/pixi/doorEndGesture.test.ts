import { beforeEach, describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { MapData, Wall } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import * as mapFactory from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { selectionOfItem } from '../lib/selectionModel'
import { createDoorEndGesture } from './doorEndGesture'
import { drawEditHandles } from './drawEditHandles'
import { SELECTION_COLOR } from './constants'

/**
 * ALARGAR OU ESTREITAR A PORTA pela alça de uma ponta (pedido de 12/11/2026:
 * "uma vez que eu coloco uma porta eu não consigo tirar ou expandir"). A ponta
 * anda AO LONGO da parede, a outra fica parada, o vizinho sólido acompanha, e o
 * arrasto inteiro é um Ctrl+Z. Esc no meio devolve tudo.
 */

const PAREDE: Wall = { id: 'parede', x1: 0, y1: 0, x2: 256, y2: 0, blocksLight: true, blocksMove: true, door: null }

function mapaComPorta(): MapData {
  // Porta Normal de 32 px no meio: vão de 112 a 144.
  return mapFactory.addDoorOnWall(mapFactory.addWall(mapFactory.createEmptyMap('m', 'M', 10, 10, 64), PAREDE), 'parede', { x: 128, y: 0 }, 32, 'normal')
}

const porta = (): Wall => {
  const wall = useMapStore.getState().map.walls.find((w) => w.door !== null)
  if (wall === undefined) throw new Error('a porta sumiu')
  return wall
}

/** As pontas da porta, em ordem de x. */
const vao = (): [number, number] => {
  const p = porta()
  return [Math.min(p.x1, p.x2), Math.max(p.x1, p.x2)]
}

/** A ponta da porta que fica em `x` (0 ou 1, a ordem de `Wall`). */
const pontaEm = (x: number): { x: number; y: number } => {
  const p = porta()
  return Math.abs(p.x1 - x) < 1e-6 ? { x: p.x1, y: p.y1 } : { x: p.x2, y: p.y2 }
}

/** Sem buraco: as paredes cobrem 0..256 inteiro. */
function semBuraco(): boolean {
  const trechos = useMapStore.getState().map.walls.map((w) => [Math.min(w.x1, w.x2), Math.max(w.x1, w.x2)] as const).sort((a, b) => a[0] - b[0])
  let ate = 0
  for (const [de, para] of trechos) {
    if (de > ate + 1e-6) return false
    ate = Math.max(ate, para)
  }
  return ate >= 256 - 1e-6
}

describe('alça de ponta da porta', () => {
  let antes: MapData

  beforeEach(() => {
    antes = mapaComPorta()
    useMapStore.setState({ map: antes, past: [], future: [] })
    useMapStore.setState({ selection: selectionOfItem({ kind: 'wall', id: porta().id }) })
  })

  it('arrastar a ponta da direita alarga só daquele lado, ao longo da parede; soltar grava UM Ctrl+Z', () => {
    const gesto = createDoorEndGesture()
    expect(gesto.begin(porta().id, { x: 128, y: 0 }, 1)).toBe(false)
    expect(gesto.begin(porta().id, pontaEm(144), 1)).toBe(true)
    // O ponteiro sai da reta da parede: só a projeção conta.
    gesto.move({ x: 200, y: 30 }, null)
    expect(vao()).toEqual([112, 200])
    expect(porta().y1).toBe(0)
    expect(porta().y2).toBe(0)
    expect(semBuraco()).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(gesto.finish()).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('não passa do fim da parede nem fica menor que o mínimo; Esc no meio devolve a porta sem histórico', () => {
    const gesto = createDoorEndGesture()
    gesto.begin(porta().id, pontaEm(112), 1)
    gesto.move({ x: -500, y: 0 }, null)
    expect(vao()).toEqual([0, 144])
    gesto.move({ x: 400, y: 0 }, null)
    expect(vao()).toEqual([144 - mapFactory.MIN_DOOR_LENGTH, 144])
    expect(semBuraco()).toBe(true)
    expect(gesto.cancel()).toBe(true)
    expect(useMapStore.getState().map.walls).toEqual(antes.walls)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('casa girada 37°: a ponta anda na parede inclinada e a porta não passa da quina', () => {
    const { region, walls } = buildRoomFromDraft('sala', ['w0', 'w1', 'w2', 'w3'], { x: 0, y: 0 }, { x: 256, y: 192 })
    const girada = mapFactory.rotateRegion(mapFactory.addDoorOnWall(mapFactory.addRoom(mapFactory.createEmptyMap('m', 'M', 10, 10, 64), region, walls), 'w0', { x: 128, y: 0 }, 32, 'normal'), 'sala', 37)
    const portaGirada = girada.walls.find((w) => w.door !== null)
    const sala = girada.regions.find((r) => r.id === 'sala')
    if (portaGirada === undefined || sala === undefined) throw new Error('montagem')
    useMapStore.setState({ map: girada, selection: selectionOfItem({ kind: 'wall', id: portaGirada.id }), past: [], future: [] })
    const [a, b] = [sala.points[0], sala.points[1]]
    const gesto = createDoorEndGesture()
    // A ponta mais perto do canto 1 da aresta, puxada muito além dele.
    const perto = Math.hypot(portaGirada.x2 - b.x, portaGirada.y2 - b.y) < Math.hypot(portaGirada.x1 - b.x, portaGirada.y1 - b.y)
    expect(gesto.begin(portaGirada.id, perto ? { x: portaGirada.x2, y: portaGirada.y2 } : { x: portaGirada.x1, y: portaGirada.y1 }, 1)).toBe(true)
    gesto.move({ x: b.x + (b.x - a.x), y: b.y + (b.y - a.y) }, null)
    const depois = porta()
    const pontaMovida = perto ? { x: depois.x2, y: depois.y2 } : { x: depois.x1, y: depois.y1 }
    expect(pontaMovida.x).toBeCloseTo(b.x, 6)
    expect(pontaMovida.y).toBeCloseTo(b.y, 6)
  })
})

describe('drawEditHandles — porta selecionada', () => {
  it('as duas pontas da porta ganham o chip de canto da casa', () => {
    const map = mapaComPorta()
    const p = map.walls.find((w) => w.door !== null)
    if (p === undefined) throw new Error('montagem')
    const g = new Graphics()
    drawEditHandles(g, map, { kind: 'wall', id: p.id }, 'select')
    const chips = g.context.instructions.flatMap((i) => {
      if (i.action !== 'fill' || i.data.style.color !== SELECTION_COLOR) return []
      return i.data.path.instructions.flatMap((passo) => {
        if (passo.action !== 'rect') return []
        const [x, y, w, h]: unknown[] = passo.data
        return typeof x === 'number' && typeof y === 'number' && typeof w === 'number' && typeof h === 'number' ? [{ x: x + w / 2, y: y + h / 2 }] : []
      })
    })
    expect(chips).toEqual([{ x: p.x1, y: p.y1 }, { x: p.x2, y: p.y2 }])
  })
})
