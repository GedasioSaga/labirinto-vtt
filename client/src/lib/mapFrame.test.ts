import { describe, expect, it } from 'vitest'
import { layoutMapFrame, type PixelRect } from './mapFrame'

/** Pinta os retângulos numa grade e devolve a cor do pixel (ou null). */
function colorAt(rects: PixelRect[], x: number, y: number): string | null {
  let color: string | null = null
  for (const r of rects) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) color = r.color
  }
  return color
}

describe('layoutMapFrame', () => {
  it('reproduz a janela medida de Objetivo/Mapa1.png (836×866, conteúdo 798×862 em x=36, y=1)', () => {
    const layout = layoutMapFrame(798, 862, 'Village Lake')
    expect(layout.width).toBe(836)
    expect(layout.height).toBe(866)
    expect(layout.content).toEqual({ x: 36, y: 1, w: 798, h: 862 })

    // Pixels medidos no objetivo.
    expect(colorAt(layout.rects, 400, 0)).toBe('#505050')
    expect(colorAt(layout.rects, 400, 863)).toBe('#505050')
    expect(colorAt(layout.rects, 35, 400)).toBe('#505050')
    expect(colorAt(layout.rects, 834, 300)).toBe('#505050')
    expect(colorAt(layout.rects, 2, 400)).toBe('#4b4b4b')
    expect(colorAt(layout.rects, 31, 400)).toBe('#4b4b4b')
    expect(colorAt(layout.rects, 3, 400)).toBeNull()
    expect(colorAt(layout.rects, 30, 400)).toBeNull()
    expect(colorAt(layout.rects, 4, 2)).toBe('#0d0d0d')
    expect(colorAt(layout.rects, 29, 861)).toBe('#0d0d0d')
    expect(colorAt(layout.rects, 10, 862)).toBeNull()
    expect(colorAt(layout.rects, 10, 1)).toBeNull()
    expect(colorAt(layout.rects, 33, 400)).toBeNull()
    expect(colorAt(layout.rects, 400, 400)).toBeNull()

    // Texto medido: x=12..25, y=776..857.
    expect(layout.title).toMatchObject({ text: 'Village Lake', cx: 19, bottom: 858, length: 82 })
  })

  it('sem título não tem barra: o painel começa na margem', () => {
    const layout = layoutMapFrame(100, 50, '   ')
    expect(layout.title).toBeNull()
    expect(layout.content).toEqual({ x: 3, y: 1, w: 100, h: 50 })
    expect(layout.rects).toHaveLength(4)
  })
})
