import { beforeEach, describe, expect, it } from 'vitest'
import type { MapData } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import * as mapFactory from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { ROOM_ROTATE_HANDLE } from '../lib/roomRotation'
import { createRoomRotateGesture } from './roomRotateGesture'

/**
 * GRUDA SOZINHO no giro da sala (pedido de 17/11/2026): a alça gruda no quarto
 * de volta e o Ctrl solta. A mesma sala e o mesmo arco de `roomRotateGesture.test.ts`.
 */

const CENTRO = { x: 640, y: 448 }
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

describe('alça de girar sala: gruda no quarto de volta', () => {
  beforeEach(() => {
    useMapStore.setState({ map: salaEmPe(), selection: EMPTY_SELECTION, past: [], future: [] })
  })

  it('a menos de 5° de 90° (ou de 0°) a sala vai para lá; fora disso anda de grau em grau', () => {
    const gesto = createRoomRotateGesture()
    gesto.begin('sala', ALCA, 1)
    expect(gesto.move(noArco(84), false)?.rotation).toBe(84)
    expect(gesto.move(noArco(87), false)).toEqual({ rotation: 90, label: '90°' })
    expect(gesto.move(noArco(93), false)?.rotation).toBe(90)
    expect(gesto.move(noArco(3), false)?.rotation).toBe(0)
  })

  it('o Ctrl solta o grude — segurado no movimento, ou apertado e solto com o ponteiro parado', () => {
    const gesto = createRoomRotateGesture()
    gesto.begin('sala', ALCA, 1)
    expect(gesto.move(noArco(87), false, true)?.rotation).toBe(87)
    expect(gesto.setLivre(false)?.rotation).toBe(90)
    expect(gesto.setLivre(true)?.rotation).toBe(87)
    // O Shift não esquece o Ctrl: de 15 em 15 com ou sem ele, e de volta ao grau solto.
    expect(gesto.setShift(true)?.rotation).toBe(90)
    expect(gesto.setShift(false)?.rotation).toBe(87)
  })
})
