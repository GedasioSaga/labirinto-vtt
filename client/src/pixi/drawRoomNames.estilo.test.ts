import { describe, expect, it } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import { createRoomNamesRenderer, roomLabelBounds, roomLabelFontSize, roomLabelFontSizeFor } from './drawRoomNames'
import type { Region, RegionPoint, RoomMeta } from '../types/map'

/**
 * ESTILO DO TÍTULO no desenho: sem fundo, menor, colorido e em pé. Sem estilo
 * nenhum a sala continua desenhada como antes.
 */

const SQUARE: RegionPoint[] = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 400 },
  { x: 0, y: 400 },
]

function buildRoom(id: string, style: Partial<RoomMeta> = {}): Region {
  return {
    id,
    points: SQUARE,
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Âncora Prateada', ...style },
  }
}

function textOf(container: Container): Text {
  const text = container.children.find((child): child is Text => child instanceof Text)
  if (!text) throw new Error('sem texto')
  return text
}

function plateOf(container: Container): Graphics {
  const plate = container.children.find((child): child is Graphics => child instanceof Graphics)
  if (!plate) throw new Error('sem plaquinha')
  return plate
}

function drawOne(region: Region, grid = 70): Container {
  const container = new Container()
  createRoomNamesRenderer().draw(container, [region], grid)
  return container
}

describe('drawRoomNames — estilo do título', () => {
  it('sem estilo: plaquinha visível, fonte do grid, horizontal', () => {
    const container = drawOne(buildRoom('a'))
    expect(plateOf(container).visible).toBe(true)
    expect(textOf(container).style.fontSize).toBe(roomLabelFontSize(70))
    expect(textOf(container).rotation).toBe(0)
  })

  it('sem fundo: a plaquinha some e o nome continua', () => {
    const container = drawOne(buildRoom('a', { labelPlate: false }))
    expect(plateOf(container).visible).toBe(false)
    expect(textOf(container).visible).toBe(true)
  })

  it('tamanho: 50% desenha com metade da fonte', () => {
    const region = buildRoom('a', { labelScale: 0.5 })
    expect(roomLabelFontSizeFor(region, 70)).toBeCloseTo(roomLabelFontSize(70) / 2)
    expect(textOf(drawOne(region)).style.fontSize).toBeCloseTo(roomLabelFontSize(70) / 2)
  })

  it('cor escolhida vira o preenchimento do texto', () => {
    const container = drawOne(buildRoom('a', { labelColor: '#ffcc00' }))
    expect(textOf(container).style.fill).toBe('#ffcc00')
  })

  it('vertical: texto e plaquinha giram um quarto de volta', () => {
    const container = drawOne(buildRoom('a', { labelVertical: true }))
    expect(textOf(container).rotation).toBeCloseTo(-Math.PI / 2)
    expect(plateOf(container).rotation).toBeCloseTo(-Math.PI / 2)
  })

  it('redesenhar sem estilo devolve a plaquinha e endireita o nome', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()
    renderer.draw(container, [buildRoom('a', { labelPlate: false, labelVertical: true })], 70)
    renderer.draw(container, [buildRoom('a')], 70)
    expect(plateOf(container).visible).toBe(true)
    expect(textOf(container).rotation).toBe(0)
  })
})

describe('roomLabelBounds — o alvo acompanha o estilo', () => {
  function size(region: Region): { width: number; height: number } {
    const bounds = roomLabelBounds(region, 70)
    if (!bounds) throw new Error('sem caixa')
    return { width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY }
  }

  it('vertical troca largura por altura', () => {
    const deitado = size(buildRoom('a'))
    const empe = size(buildRoom('a', { labelVertical: true }))
    expect(deitado.width).toBeGreaterThan(deitado.height)
    expect(empe.width).toBeCloseTo(deitado.height)
    expect(empe.height).toBeCloseTo(deitado.width)
  })

  it('fonte menor, caixa menor', () => {
    const normal = size(buildRoom('a'))
    const menor = size(buildRoom('a', { labelScale: 0.5 }))
    expect(menor.width).toBeLessThan(normal.width)
    expect(menor.height).toBeLessThan(normal.height)
  })

  it('sem fundo o alvo continua do tamanho da plaquinha', () => {
    expect(size(buildRoom('a', { labelPlate: false }))).toEqual(size(buildRoom('a')))
  })
})
