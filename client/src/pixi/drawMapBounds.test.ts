import { describe, expect, it } from 'vitest'
import { Graphics, type StrokeInstruction } from 'pixi.js'
import { drawMapBounds, mapBoundsRect, outsideShadeRects } from './drawMapBounds'
import type { Viewport } from './grid'

/** Conta instruções `action: 'fill'` realmente empilhadas no GraphicsContext da instância. */
function countFillInstructions(g: Graphics): number {
  return g.context.instructions.filter((instruction) => instruction.action === 'fill').length
}

/** Conta instruções `action: 'stroke'` realmente empilhadas no GraphicsContext da instância. */
function countStrokeInstructions(g: Graphics): number {
  return g.context.instructions.filter((instruction) => instruction.action === 'stroke').length
}

/** A n-ésima instrução `stroke` de fato empilhada — mesmo helper de `drawRegions.test.ts`. */
function strokeStyleAt(g: Graphics, at = 0): StrokeInstruction['data']['style'] {
  const strokes = g.context.instructions.filter(
    (instruction): instruction is StrokeInstruction => instruction.action === 'stroke',
  )
  const stroke = strokes[at]
  if (!stroke) throw new Error(`esperava pelo menos ${at + 1} instrução(ões) de stroke, achei ${strokes.length}`)
  return stroke.data.style
}

const MAP = { width: 20, height: 10, grid: 50 } // bounds: 0,0 a 1000,500

describe('mapBoundsRect', () => {
  it('dimensões válidas: retângulo em px de mundo = width*grid x height*grid', () => {
    expect(mapBoundsRect(MAP)).toEqual({ minX: 0, minY: 0, maxX: 1000, maxY: 500 })
  })

  it('width, height ou grid zero: null (não fabrica retângulo 0x0)', () => {
    expect(mapBoundsRect({ width: 0, height: 10, grid: 50 })).toBeNull()
    expect(mapBoundsRect({ width: 20, height: 0, grid: 50 })).toBeNull()
    expect(mapBoundsRect({ width: 20, height: 10, grid: 0 })).toBeNull()
  })

  it('valor negativo ou não-finito: null', () => {
    expect(mapBoundsRect({ width: -5, height: 10, grid: 50 })).toBeNull()
    expect(mapBoundsRect({ width: 20, height: 10, grid: Number.NaN })).toBeNull()
    expect(mapBoundsRect({ width: Number.POSITIVE_INFINITY, height: 10, grid: 50 })).toBeNull()
  })
})

describe('outsideShadeRects', () => {
  const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 500 }

  it('viewport inteiro DENTRO do mapa: nenhuma faixa', () => {
    const viewport: Viewport = { left: 100, top: 100, right: 900, bottom: 400 }
    expect(outsideShadeRects(bounds, viewport)).toEqual([])
  })

  it('viewport igual ao mapa (bordas coincidem): nenhuma faixa (nada sobra pra sombrear)', () => {
    const viewport: Viewport = { left: 0, top: 0, right: 1000, bottom: 500 }
    expect(outsideShadeRects(bounds, viewport)).toEqual([])
  })

  it('viewport maior que o mapa nos 4 lados: 4 faixas, área total = área do viewport - área do mapa', () => {
    const viewport: Viewport = { left: -100, top: -100, right: 1100, bottom: 600 }
    const rects = outsideShadeRects(bounds, viewport)
    expect(rects).toHaveLength(4)

    const viewportArea = (viewport.right - viewport.left) * (viewport.bottom - viewport.top)
    const mapArea = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
    const shadeArea = rects.reduce((sum, r) => sum + r.w * r.h, 0)
    expect(shadeArea).toBeCloseTo(viewportArea - mapArea)

    // Nenhuma faixa se sobrepõe a outra (soma das áreas == área da união,
    // testada indiretamente por amostragem de pontos que só podem pertencer
    // a UMA faixa por construção: canto de cada lado).
    const corners = [
      { x: -50, y: -50 }, // fora, canto superior-esquerdo
      { x: 1050, y: -50 }, // fora, canto superior-direito
      { x: -50, y: 550 }, // fora, canto inferior-esquerdo
      { x: 1050, y: 550 }, // fora, canto inferior-direito
    ]
    for (const corner of corners) {
      const containing = rects.filter((r) => corner.x >= r.x && corner.x <= r.x + r.w && corner.y >= r.y && corner.y <= r.y + r.h)
      expect(containing).toHaveLength(1)
    }
  })

  it('viewport inteiramente ACIMA do mapa (câmera afastada pra fora): 1 faixa cobrindo o viewport inteiro', () => {
    const viewport: Viewport = { left: 0, top: -300, right: 1000, bottom: -50 }
    const rects = outsideShadeRects(bounds, viewport)
    expect(rects).toEqual([{ x: 0, y: -300, w: 1000, h: 250 }])
  })

  it('viewport inteiramente à DIREITA do mapa: 1 faixa cobrindo o viewport inteiro', () => {
    const viewport: Viewport = { left: 1200, top: 0, right: 1500, bottom: 500 }
    const rects = outsideShadeRects(bounds, viewport)
    expect(rects).toEqual([{ x: 1200, y: 0, w: 300, h: 500 }])
  })

  it('viewport cruza só a borda de cima: 1 faixa fina no topo, nada nos outros 3 lados', () => {
    const viewport: Viewport = { left: 200, top: -20, right: 800, bottom: 300 }
    const rects = outsideShadeRects(bounds, viewport)
    expect(rects).toEqual([{ x: 200, y: -20, w: 600, h: 20 }])
  })
})

describe('drawMapBounds', () => {
  it('mapa com dimensão inválida: limpa o graphics e não desenha nada (nem sombra, nem contorno)', () => {
    const g = new Graphics()
    drawMapBounds(g, { width: 0, height: 10, grid: 50 }, { left: -100, top: -100, right: 1100, bottom: 600 })
    expect(countFillInstructions(g)).toBe(0)
    expect(countStrokeInstructions(g)).toBe(0)
  })

  it('viewport inteiro dentro do mapa: sem sombra (0 fill), contorno sempre desenhado (1 stroke)', () => {
    const g = new Graphics()
    drawMapBounds(g, MAP, { left: 100, top: 100, right: 900, bottom: 400 })
    expect(countFillInstructions(g)).toBe(0)
    expect(countStrokeInstructions(g)).toBe(1)
  })

  it('viewport passa da borda: 1 fill (todas as faixas num único fill()) + 1 stroke do contorno', () => {
    const g = new Graphics()
    drawMapBounds(g, MAP, { left: -100, top: -100, right: 1100, bottom: 600 })
    expect(countFillInstructions(g)).toBe(1)
    expect(countStrokeInstructions(g)).toBe(1)
  })

  it('contorno: espessura hairline (1), cor neutra, alpha baixo — discreto, não confunde com parede/seleção', () => {
    const g = new Graphics()
    drawMapBounds(g, MAP, { left: 100, top: 100, right: 900, bottom: 400 })
    const style = strokeStyleAt(g)
    expect(style.width).toBe(1)
    expect(style.color).toBe(0xd8d8d8)
    expect(style.alpha).toBe(0.4)
  })

  it('redesenho: chamar de novo com viewport diferente não acumula instruções (clear() no início)', () => {
    const g = new Graphics()
    drawMapBounds(g, MAP, { left: -100, top: -100, right: 1100, bottom: 600 })
    drawMapBounds(g, MAP, { left: 100, top: 100, right: 900, bottom: 400 })
    expect(countFillInstructions(g)).toBe(0)
    expect(countStrokeInstructions(g)).toBe(1)
  })
})
