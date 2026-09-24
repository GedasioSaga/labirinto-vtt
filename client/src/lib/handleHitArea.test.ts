import { describe, expect, it } from 'vitest'
import {
  findBoxCornerHandleAt, findRoomCornerHandleAt, findVertexHandleAt, isOnRadiusHandle, screenToWorldTolerance,
} from './handleHitArea'
import { findBoxCornerAt } from './objectTransform'
import { findRoomCornerAt } from './roomOps'
import { findCurveControlPointAt } from './selectionHitTest'
import { findLightRadiusHandleAt } from '../pixi/drawEditHandles'
import { cornerHandleExtent } from '../pixi/drawRoomHandles'

// Token de 64 px de mundo (o exemplo do defeito): cantos em (0,0)…(64,64).
const token64 = { minX: 0, minY: 0, maxX: 64, maxY: 64 }

describe('screenToWorldTolerance', () => {
  it('px de tela viram px de mundo divididos pelo zoom; zoom inválido vale 1', () => {
    expect(screenToWorldTolerance(10, 0.25)).toBe(40)
    expect(screenToWorldTolerance(10, 4)).toBe(2.5)
    expect(screenToWorldTolerance(10, 0)).toBe(10)
    expect(screenToWorldTolerance(10, Number.NaN)).toBe(10)
  })
})

describe('findBoxCornerHandleAt — o chip desenhado pega o clique em qualquer zoom', () => {
  it('zoom 0,25: o chip tem 5,5 px de tela de meio-lado, que são 22 px de mundo', () => {
    const { radius, keyline } = cornerHandleExtent(64, 64, 0.25)
    expect(radius + keyline).toBe(22)
  })

  it('zoom 0,25: clicar a 4 px de tela do canto, dentro do quadradinho, redimensiona', () => {
    const ponto = { x: 16, y: 16 }
    // O defeito: com a tolerância fixa de 10 px de mundo o clique caía no corpo.
    expect(findBoxCornerAt(token64, ponto)).toBeNull()
    expect(findBoxCornerHandleAt(token64, ponto, 0.25)).toBe(0)
  })

  it('zoom 0,25: a borda do chip (reta e na diagonal) redimensiona; logo fora dela, não', () => {
    expect(findBoxCornerHandleAt(token64, { x: 21.5, y: 1 }, 0.25)).toBe(0)
    expect(findBoxCornerHandleAt(token64, { x: 21.5, y: 21.5 }, 0.25)).toBe(0)
    expect(findBoxCornerHandleAt(token64, { x: 64 - 21.5, y: 64 - 21.5 }, 0.25)).toBe(2)
    expect(findBoxCornerHandleAt(token64, { x: 23, y: 23 }, 0.25)).toBeNull()
  })

  it('zoom 0,25: o centro do Token continua sendo corpo (dá para arrastar)', () => {
    expect(findBoxCornerHandleAt(token64, { x: 32, y: 32 }, 0.25)).toBeNull()
    expect(findBoxCornerHandleAt(token64, { x: 32, y: 0 }, 0.25)).toBeNull()
  })

  it('zoom 0,5: a ponta diagonal do chip (7,3 px de tela) redimensiona', () => {
    const { radius, keyline } = cornerHandleExtent(64, 64, 0.5)
    const meioLado = radius + keyline
    expect(meioLado).toBeCloseTo(14.67, 2)
    expect(meioLado).toBeGreaterThan(14)
    const borda = { x: 14.5, y: 14.5 }
    expect(findBoxCornerAt(token64, borda)).toBeNull()
    expect(findBoxCornerHandleAt(token64, borda, 0.5)).toBe(0)
    expect(findBoxCornerHandleAt(token64, { x: 16, y: 16 }, 0.5)).toBeNull()
  })

  it('zoom 1: o alcance de sempre (10 px) continua valendo', () => {
    expect(findBoxCornerHandleAt(token64, { x: 9.9, y: 0 }, 1)).toBe(0)
    expect(findBoxCornerHandleAt(token64, { x: 12, y: 0 }, 1)).toBeNull()
  })

  it('zoom 4: a área encolhe junto com o chip (10 px de tela = 2,5 px de mundo)', () => {
    expect(findBoxCornerHandleAt(token64, { x: 2.4, y: 0 }, 4)).toBe(0)
    expect(findBoxCornerHandleAt(token64, { x: 3, y: 0 }, 4)).toBeNull()
  })
})

describe('findRoomCornerHandleAt — Sala retangular', () => {
  const sala400 = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }]
  const sala64 = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }, { x: 0, y: 64 }]

  it('zoom 0,25: canto de sala grande pega o clique a 7,5 px de tela', () => {
    const ponto = { x: 30, y: 30 }
    expect(findRoomCornerAt(sala400, ponto)).toBeNull()
    expect(findRoomCornerHandleAt(sala400, ponto, 0.25)).toBe(0)
  })

  it('zoom 0,25: sala pequena — a borda do chip pega mesmo além de 1/3 do lado', () => {
    // Alcance circular: 1/3 de 64 = 21,33 px de mundo; o chip vai até 22.
    const borda = { x: 21.8, y: 1 }
    expect(findRoomCornerAt(sala64, borda)).toBeNull()
    expect(findRoomCornerHandleAt(sala64, borda, 0.25)).toBe(0)
    expect(findRoomCornerHandleAt(sala64, { x: 32, y: 32 }, 0.25)).toBeNull()
  })

  it('zoom 0,5: os 24 px de tela de alcance da Sala valem 48 px de mundo', () => {
    // Chip de 8 px de tela = 16 px de mundo; a ponta diagonal dele fica dentro.
    expect(findRoomCornerHandleAt(sala400, { x: 15.5, y: 15.5 }, 0.5)).toBe(0)
    const ponto = { x: 30, y: 30 }
    expect(findRoomCornerAt(sala400, ponto)).toBeNull()
    expect(findRoomCornerHandleAt(sala400, ponto, 0.5)).toBe(0)
    expect(findRoomCornerHandleAt(sala400, { x: 60, y: 0 }, 0.5)).toBeNull()
  })

  it('não é retângulo de 4 vértices: sem canto', () => {
    expect(findRoomCornerHandleAt(sala400.slice(0, 3), { x: 0, y: 0 }, 1)).toBeNull()
  })
})

describe('findVertexHandleAt — vértice, ponto médio e ponta de parede', () => {
  const pontos = [{ x: 0, y: 0 }, { x: 200, y: 0 }]

  it('zoom 0,25: clicar dentro da bolinha (3,5 px de tela = 14 px de mundo) pega o vértice', () => {
    const ponto = { x: 12, y: 0 }
    expect(findCurveControlPointAt(pontos, ponto)).toBeNull()
    expect(findVertexHandleAt(pontos, ponto, 0.25)).toBe(0)
    expect(findVertexHandleAt(pontos, { x: 34, y: 0 }, 0.25)).toBeNull()
  })

  it('zoom 0,5: 8 px de tela de alcance (16 px de mundo)', () => {
    expect(findCurveControlPointAt(pontos, { x: 15, y: 0 })).toBeNull()
    expect(findVertexHandleAt(pontos, { x: 15, y: 0 }, 0.5)).toBe(0)
    expect(findVertexHandleAt(pontos, { x: 17, y: 0 }, 0.5)).toBeNull()
  })

  it('zoom 4: o alcance encolhe para 2 px de mundo', () => {
    expect(findVertexHandleAt(pontos, { x: 198.5, y: 0 }, 4)).toBe(1)
    expect(findVertexHandleAt(pontos, { x: 197, y: 0 }, 4)).toBeNull()
  })
})

describe('isOnRadiusHandle — alça de raio da Luz e do círculo', () => {
  const luz = { x: 100, y: 100, radius: 50 }

  it('zoom 0,25: clicar dentro da bolinha (14 px de mundo) pega a alça', () => {
    const ponto = { x: 163, y: 100 }
    expect(findLightRadiusHandleAt(luz, ponto)).toBe(false)
    expect(isOnRadiusHandle(luz, ponto, 0.25)).toBe(true)
  })

  it('zoom 0,5: 10 px de tela de alcance (20 px de mundo)', () => {
    expect(isOnRadiusHandle(luz, { x: 168, y: 100 }, 0.5)).toBe(true)
    expect(isOnRadiusHandle(luz, { x: 172, y: 100 }, 0.5)).toBe(false)
  })
})
