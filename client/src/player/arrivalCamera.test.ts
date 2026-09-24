import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { fitCamera, MIN_SCALE, type Camera } from '../pixi/world'
import type { MapData, Token } from '../types/map'
import { ARRIVAL_SCALE, arrivalCamera } from './arrivalCamera'

const VIEWPORT = { width: 800, height: 600 }
const MARGIN = 24

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

function mapWith(width: number, height: number, tokens: Token[]): MapData {
  return { ...createEmptyMap('andar-2', 'Andar 2', width, height, 70), tokens }
}

/** Onde o ponto de mundo cai na tela com esta câmera. */
function onScreen(camera: Camera, x: number, y: number): { x: number; y: number } {
  return { x: x * camera.scale + camera.x, y: y * camera.scale + camera.y }
}

describe('arrivalCamera (chegada num andar novo)', () => {
  it('andar enorme: a ficha nasce no centro da tela, legível, e não no canto fora dela', () => {
    // 400 × 400 células de 70 px: nem a 10% o andar cabe — o enquadramento trava em MIN_SCALE.
    const map = mapWith(400, 400, [token('eu', 2 * 70 + 35, 3 * 70 + 35)])
    const bounds = { minX: 0, minY: 0, maxX: 400 * 70, maxY: 400 * 70 }
    const fit = fitCamera(bounds, VIEWPORT, MARGIN)
    expect(fit.scale).toBe(MIN_SCALE)
    // Antes do conserto: com o enquadramento a ficha fica fora da tela (a tela fica preta).
    expect(onScreen(fit, 175, 245).x).toBeLessThan(0)

    const camera = arrivalCamera(map, ['eu'], VIEWPORT, MARGIN)
    expect(camera.scale).toBe(ARRIVAL_SCALE)
    expect(onScreen(camera, 175, 245)).toEqual({ x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 })
  })

  it('andar enorme com a ficha no meio: mesmo assim aproxima, porque a 10% a ficha vira um ponto', () => {
    const map = mapWith(400, 400, [token('eu', 14000, 14000)])
    const camera = arrivalCamera(map, ['eu'], VIEWPORT, MARGIN)
    expect(camera.scale).toBe(ARRIVAL_SCALE)
    expect(camera.scale).toBeGreaterThan(MIN_SCALE)
    expect(onScreen(camera, 14000, 14000)).toEqual({ x: 400, y: 300 })
  })

  it('andar que cabe na tela com a ficha dentro: enquadra o andar inteiro, como antes', () => {
    const map = mapWith(10, 8, [token('eu', 105, 105)])
    const bounds = { minX: 0, minY: 0, maxX: 700, maxY: 560 }
    expect(arrivalCamera(map, ['eu'], VIEWPORT, MARGIN)).toEqual(fitCamera(bounds, VIEWPORT, MARGIN))
  })

  it('andar que cabe, mas a ficha ficou fora do desenho: centraliza nela sem mudar o zoom do enquadramento', () => {
    const map = mapWith(10, 8, [token('eu', 3000, 105)])
    const fit = fitCamera({ minX: 0, minY: 0, maxX: 700, maxY: 560 }, VIEWPORT, MARGIN)
    const camera = arrivalCamera(map, ['eu'], VIEWPORT, MARGIN)
    expect(camera.scale).toBe(fit.scale)
    expect(onScreen(camera, 3000, 105)).toEqual({ x: 400, y: 300 })
  })

  it('só a PRÓPRIA ficha conta: a de outro jogador neste andar não move a câmera', () => {
    const map = mapWith(400, 400, [token('outro', 175, 245), token('eu', 27000, 27000)])
    const camera = arrivalCamera(map, ['eu'], VIEWPORT, MARGIN)
    expect(onScreen(camera, 27000, 27000)).toEqual({ x: 400, y: 300 })
    expect(onScreen(camera, 175, 245).x).toBeLessThan(0)
  })

  it('sem ficha própria neste andar (ou sem ficha nenhuma): enquadra o andar, como antes', () => {
    const bounds = { minX: 0, minY: 0, maxX: 400 * 70, maxY: 400 * 70 }
    const fit = fitCamera(bounds, VIEWPORT, MARGIN)
    expect(arrivalCamera(mapWith(400, 400, [token('outro', 175, 245)]), ['eu'], VIEWPORT, MARGIN)).toEqual(fit)
    expect(arrivalCamera(mapWith(400, 400, []), [], VIEWPORT, MARGIN)).toEqual(fit)
  })

  it('várias fichas próprias: a primeira da lista que está neste andar', () => {
    const map = mapWith(400, 400, [token('b', 20000, 20000), token('a', 5000, 5000)])
    const camera = arrivalCamera(map, ['fora-daqui', 'a', 'b'], VIEWPORT, MARGIN)
    expect(onScreen(camera, 5000, 5000)).toEqual({ x: 400, y: 300 })
  })
})
