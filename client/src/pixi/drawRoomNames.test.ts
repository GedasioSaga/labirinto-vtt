import { afterEach, describe, expect, it, vi } from 'vitest'
import { Container, Text } from 'pixi.js'
import { createRoomNamesRenderer, roomLabelAnchor, roomLabelFontSize } from './drawRoomNames'
import type { Region, RegionPoint } from '../types/map'

function buildRoom(id: string, name: string | null, points: RegionPoint[]): Region {
  return {
    id,
    points,
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    ...(name === null ? {} : { room: { shape: 'rect' as const, name } }),
  }
}

const SQUARE: RegionPoint[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
]

function textChildren(container: Container): Text[] {
  return container.children.filter((child): child is Text => child instanceof Text)
}

describe('roomLabelAnchor', () => {
  it('retângulo: centro geométrico', () => {
    const anchor = roomLabelAnchor([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 60 },
      { x: 10, y: 60 },
    ])
    expect(anchor.x).toBeCloseTo(60)
    expect(anchor.y).toBeCloseTo(40)
  })

  it('triângulo: média dos três vértices (centróide de área coincide)', () => {
    const anchor = roomLabelAnchor([
      { x: 0, y: 0 },
      { x: 90, y: 0 },
      { x: 0, y: 60 },
    ])
    expect(anchor.x).toBeCloseTo(30)
    expect(anchor.y).toBeCloseTo(20)
  })

  it('sentido horário e anti-horário dão o mesmo ponto', () => {
    const reversed = [...SQUARE].reverse()
    expect(roomLabelAnchor(reversed).x).toBeCloseTo(50)
    expect(roomLabelAnchor(reversed).y).toBeCloseTo(50)
  })

  it('polígono côncavo em L: centróide de área, não média dos vértices', () => {
    // L = quadrado 0..20 x 0..10 (área 200, centro 10,5) + 0..10 x 10..20 (área 100, centro 5,15).
    const lShape: RegionPoint[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 20 },
      { x: 0, y: 20 },
    ]
    const anchor = roomLabelAnchor(lShape)
    expect(anchor.x).toBeCloseTo((200 * 10 + 100 * 5) / 300)
    expect(anchor.y).toBeCloseTo((200 * 5 + 100 * 15) / 300)
    // A média dos vértices daria (10, 10): prova que não é esse o caminho.
    expect(anchor.x).not.toBeCloseTo(10)
  })

  it('pontos colineares (área zero) caem na média dos pontos', () => {
    const anchor = roomLabelAnchor([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 50, y: 0 },
    ])
    expect(anchor.x).toBeCloseTo(20)
    expect(anchor.y).toBeCloseTo(0)
    expect(Number.isFinite(anchor.x)).toBe(true)
  })

  it('ponto único e lista vazia não produzem NaN', () => {
    expect(roomLabelAnchor([{ x: 7, y: 9 }])).toEqual({ x: 7, y: 9 })
    expect(roomLabelAnchor([])).toEqual({ x: 0, y: 0 })
  })
})

describe('roomLabelFontSize', () => {
  it('proporcional ao grid, limitado entre 12 e 28', () => {
    expect(roomLabelFontSize(70)).toBeCloseTo(21)
    expect(roomLabelFontSize(10)).toBe(12)
    expect(roomLabelFontSize(500)).toBe(28)
  })
})

describe('createRoomNamesRenderer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('só desenha regiões com room.name não vazio, centradas no centróide', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()

    renderer.draw(
      container,
      [
        buildRoom('sala', 'Cripta', SQUARE),
        buildRoom('sem-nome', '   ', SQUARE),
        buildRoom('regiao-comum', null, SQUARE),
      ],
      70,
    )

    const texts = textChildren(container)
    expect(texts).toHaveLength(1)
    expect(texts[0].text).toBe('Cripta')
    expect(texts[0].position.x).toBeCloseTo(50)
    expect(texts[0].position.y).toBeCloseTo(50)
    expect(texts[0].anchor.x).toBe(0.5)
    expect(texts[0].anchor.y).toBe(0.5)
    expect(texts[0].style.fontSize).toBeCloseTo(21)
  })

  it('região que some fica invisível, sem destruir o Text; volta reaproveitando o mesmo objeto', () => {
    const destroySpy = vi.spyOn(Text.prototype, 'destroy')
    const container = new Container()
    const renderer = createRoomNamesRenderer()

    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], 50)
    const first = textChildren(container)[0]

    renderer.draw(container, [], 50)
    expect(destroySpy).not.toHaveBeenCalled()
    expect(first.destroyed).toBe(false)
    expect(first.visible).toBe(false)

    renderer.draw(container, [buildRoom('sala', 'Salão', SQUARE)], 50)
    const texts = textChildren(container)
    expect(texts).toHaveLength(1)
    expect(texts[0]).toBe(first)
    expect(first.visible).toBe(true)
    expect(first.text).toBe('Salão')
    expect(destroySpy).not.toHaveBeenCalled()
  })

  it('sala que perde o nome também só fica invisível', () => {
    const destroySpy = vi.spyOn(Text.prototype, 'destroy')
    const container = new Container()
    const renderer = createRoomNamesRenderer()

    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], 50)
    renderer.draw(container, [buildRoom('sala', '', SQUARE)], 50)

    expect(textChildren(container)[0].visible).toBe(false)
    expect(destroySpy).not.toHaveBeenCalled()
  })

  it('mudança de grid atualiza o tamanho da fonte', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()

    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], 50)
    expect(textChildren(container)[0].style.fontSize).toBe(15)
    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], 90)
    expect(textChildren(container)[0].style.fontSize).toBeCloseTo(27)
  })
})
