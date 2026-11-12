import { beforeEach, describe, expect, it } from 'vitest'
import type { MapData, Stair } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import { EMPTY_SELECTION } from './selectionModel'
import * as mapFactory from './mapFactory'
import { ROOM_ROTATE_HANDLE } from './roomRotation'
import { stairSpiralCircle } from './stairs'
import { buildStairPin, stairPinOf } from './stairTravel'
import { isOnStairRotateHandle, rotateStairBy, stairRotateFrame, stairRotateHandle, stairRotationOf } from './stairRotation'

/**
 * GIRAR ESCADA (pedido de 12/11/2026: "uma vez que eu coloco a escada não da
 * para colocar trocar para vertical e horizontal faz a opção de colocar a
 * rotação"). A escada deitada do print: 4 casas de 64 px, da esquerda para a
 * direita, com o centro em (256, 256).
 */

const DEITADA: Stair = { id: 'e', shape: 'straight', direction: 'up', segments: [{ x1: 128, y1: 256, x2: 384, y2: 256 }], stepWidth: 64 }

function mapaComEscadaLigada(): MapData {
  const pino = buildStairPin('pino', DEITADA, 'livre')
  if (pino === null) throw new Error('escada sem boca')
  const map = mapFactory.addStair(mapFactory.createEmptyMap('m', 'M', 30, 20, 64), DEITADA)
  return { ...map, pins: [pino] }
}

const escada = (): Stair => {
  const stair = useMapStore.getState().map.stairs.find((s) => s.id === 'e')
  if (!stair) throw new Error('a escada sumiu')
  return stair
}

describe('girar escada pela ficha', () => {
  let antes: MapData

  beforeEach(() => {
    antes = mapaComEscadaLigada()
    useMapStore.setState({ map: antes, selection: EMPTY_SELECTION, past: [], future: [] })
  })

  it('Girar 90° põe em pé a escada deitada, em volta do centro, com UM Ctrl+Z; a ligação vai junto com a boca', () => {
    expect(stairRotationOf(DEITADA)).toBe(0)
    useMapStore.getState().rotateStair('e', 90)
    expect(escada().segments).toEqual([{ x1: 256, y1: 128, x2: 256, y2: 384 }])
    expect(stairRotationOf(escada())).toBe(90)
    // O pino invisível da escada que leva a outro andar mora na boca (x1, y1): quem chega aparece ao pé dela.
    expect(stairPinOf(useMapStore.getState().map, 'e')).toMatchObject({ x: 256, y: 128 })
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
    // Girar 0° não deixa passo de desfazer vazio.
    useMapStore.getState().rotateStair('e', 0)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('quatro quartos de volta devolvem a escada igual; a curva e a espiral giram sem mudar de forma nem de centro', () => {
    let volta = DEITADA
    for (let i = 0; i < 4; i += 1) volta = rotateStairBy(volta, 90)
    expect(volta.segments).toEqual(DEITADA.segments)

    const curva: Stair = { ...DEITADA, curva: 40 }
    const antesDoGiro = stairRotateFrame(curva)
    const girada = rotateStairBy(curva, 37)
    const depoisDoGiro = stairRotateFrame(girada)
    expect(girada.curva).toBe(40)
    expect(depoisDoGiro?.rotation).toBeCloseTo(37, 6)
    expect(depoisDoGiro?.pivot.x).toBeCloseTo(antesDoGiro?.pivot.x ?? NaN, 6)
    expect(depoisDoGiro?.pivot.y).toBeCloseTo(antesDoGiro?.pivot.y ?? NaN, 6)
    expect(depoisDoGiro?.height).toBeCloseTo(antesDoGiro?.height ?? NaN, 6)

    const espiral: Stair = { ...DEITADA, shape: 'spiral' }
    expect(stairSpiralCircle(rotateStairBy(espiral, 90))).toEqual(stairSpiralCircle(espiral))
  })

  it('a bolinha de girar fica acima da escada deitada, a offsetPx de tela da borda de cima', () => {
    // Centro (256, 256), meia largura 32: a borda de cima em y = 224.
    const bolinha = { x: 256, y: 224 - ROOM_ROTATE_HANDLE.offsetPx }
    expect(stairRotateHandle(DEITADA, 1)?.knob).toEqual(bolinha)
    expect(isOnStairRotateHandle(DEITADA, bolinha, 1)).toBe(true)
    expect(isOnStairRotateHandle(DEITADA, { x: 256, y: 256 }, 1)).toBe(false)
  })
})
