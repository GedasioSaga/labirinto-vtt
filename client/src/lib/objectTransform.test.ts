import { describe, expect, it } from 'vitest'
import {
  boxCorners,
  cornerPoint,
  oppositeCorner,
  findBoxCornerAt,
  resizeBox,
  resizeBoxWithModifiers,
  pointsBoundingBox,
  drawingBoundingBox,
  tokenBoundingBox,
  propBoundingBox,
  resizeRectDrawing,
  resizeEllipseDrawing,
  resizePolygonDrawing,
  resizeTokenSize,
  resizePropBox,
  resizeCircleDrawingRadius,
  MIN_TOKEN_SIZE,
  type Box,
  type ResizeModifiers,
} from './objectTransform'
import type { Drawing, Token, Prop } from '../types/map'

const NO_MODIFIERS: ResizeModifiers = { shift: false, alt: false }

const box: Box = { minX: 0, minY: 0, maxX: 100, maxY: 100 }

describe('boxCorners / cornerPoint / oppositeCorner', () => {
  it('ordem 0=topo-esq, 1=topo-dir, 2=baixo-dir, 3=baixo-esq', () => {
    expect(boxCorners(box)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ])
  })

  it('cornerPoint bate com boxCorners por índice', () => {
    expect(cornerPoint(box, 2)).toEqual({ x: 100, y: 100 })
  })

  it('oppositeCorner é sempre o canto diagonal', () => {
    expect(oppositeCorner(0)).toBe(2)
    expect(oppositeCorner(1)).toBe(3)
    expect(oppositeCorner(2)).toBe(0)
    expect(oppositeCorner(3)).toBe(1)
  })
})

describe('findBoxCornerAt', () => {
  it('acerta um canto dentro da tolerância', () => {
    expect(findBoxCornerAt(box, { x: 2, y: 1 })).toBe(0)
  })

  it('não acerta o meio da caixa (longe de todo canto)', () => {
    expect(findBoxCornerAt(box, { x: 50, y: 50 })).toBeNull()
  })
})

describe('resizeBox', () => {
  it('arrasta o canto baixo-direita (2): âncora fica no topo-esquerda (0)', () => {
    const result = resizeBox(box, 2, 150, 200)
    expect(result).toEqual({ minX: 0, minY: 0, maxX: 150, maxY: 200 })
  })

  it('cruzar a âncora espelha o retângulo em vez de degenerar', () => {
    // Arrasta o canto 2 (baixo-direita) pra ANTES da âncora (canto 0, em 0,0)
    const result = resizeBox(box, 2, -50, -50, 1)
    expect(result.minX).toBeLessThan(result.maxX)
    expect(result.minY).toBeLessThan(result.maxY)
    expect(result.maxX).toBeLessThanOrEqual(0)
  })

  it('respeita a dimensão mínima mesmo com arrasto em cima da âncora', () => {
    const result = resizeBox(box, 2, 0, 0, 5)
    expect(result.maxX - result.minX).toBeGreaterThanOrEqual(5)
    expect(result.maxY - result.minY).toBeGreaterThanOrEqual(5)
  })
})

// Item 17 do plano (Onda 3, frente B): Shift preserva a proporção
// ORIGINAL de `box` (não força quadrado — `box` aqui não é 1:1), Alt muda a
// âncora pro CENTRO em vez do canto oposto.
describe('resizeBoxWithModifiers', () => {
  const rectBox: Box = { minX: 0, minY: 0, maxX: 100, maxY: 50 } // proporção 2:1

  it('sem modificadores: idêntico a resizeBox', () => {
    expect(resizeBoxWithModifiers(rectBox, 2, 150, 200, NO_MODIFIERS)).toEqual(resizeBox(rectBox, 2, 150, 200))
  })

  it('Shift: preserva a proporção 2:1 original, puxando o lado mais curto até o mais longo', () => {
    // dx=300 → 3x a largura original (100); dy=100 → 2x a altura original
    // (50). O eixo X tem a MAIOR escala relativa (3 > 2), então os dois
    // eixos escalam por 3: largura 100*3=300, altura 50*3=150.
    const result = resizeBoxWithModifiers(rectBox, 2, 300, 100, { shift: true, alt: false })
    expect(result).toEqual({ minX: 0, minY: 0, maxX: 300, maxY: 150 })
    expect((result.maxX - result.minX) / (result.maxY - result.minY)).toBe(2)
  })

  it('Alt: redimensiona a partir do CENTRO — os dois lados de cada eixo se movem, centro não muda', () => {
    const result = resizeBoxWithModifiers(rectBox, 2, 120, 80, { shift: false, alt: true })
    expect(result).toEqual({ minX: -20, minY: -30, maxX: 120, maxY: 80 })
    expect((result.minX + result.maxX) / 2).toBe(50) // centro original de rectBox
    expect((result.minY + result.maxY) / 2).toBe(25)
  })

  it('Shift+Alt combinados: escala simétrica a partir do centro, preservando a proporção 2:1', () => {
    const result = resizeBoxWithModifiers(rectBox, 2, 120, 80, { shift: true, alt: true })
    expect(result).toEqual({ minX: -60, minY: -30, maxX: 160, maxY: 80 })
    expect((result.maxX - result.minX) / (result.maxY - result.minY)).toBe(2)
    expect((result.minX + result.maxX) / 2).toBe(50)
    expect((result.minY + result.maxY) / 2).toBe(25)
  })

  it('box degenerada (largura 0): Shift não divide por zero — cai pro comportamento sem Shift', () => {
    const flat: Box = { minX: 5, minY: 0, maxX: 5, maxY: 100 }
    const result = resizeBoxWithModifiers(flat, 2, 5, 300, { shift: true, alt: false })
    expect(Number.isFinite(result.minX)).toBe(true)
    expect(Number.isFinite(result.minY)).toBe(true)
    expect(Number.isFinite(result.maxX)).toBe(true)
    expect(Number.isFinite(result.maxY)).toBe(true)
  })
})

describe('pointsBoundingBox', () => {
  it('calcula a caixa mínima que contém todos os pontos', () => {
    expect(pointsBoundingBox([{ x: 10, y: 5 }, { x: -3, y: 20 }, { x: 7, y: -1 }])).toEqual({
      minX: -3, minY: -1, maxX: 10, maxY: 20,
    })
  })

  it('lista vazia devolve null', () => {
    expect(pointsBoundingBox([])).toBeNull()
  })
})

// `satisfies Drawing`, não `: Drawing` — anotação explícita widening pro tipo
// união apagaria o literal `kind: 'rect'` e forçaria um `as Extract<...>` em
// cada chamada de resizeRectDrawing/etc. abaixo (regra 2: erro de tipo se
// resolve na origem, não com cast). `satisfies` valida contra `Drawing` sem
// apagar o tipo mais específico inferido do literal.
const rectDrawing = { id: 'd1', kind: 'rect', x: 10, y: 20, w: 30, h: 40, color: '#fff', width: 2, filled: false, fillAlpha: 0.5 } satisfies Drawing
const ellipseDrawing = { id: 'd2', kind: 'ellipse', cx: 100, cy: 100, rx: 20, ry: 10, color: '#fff', width: 2, filled: false, fillAlpha: 0.5 } satisfies Drawing
const polygonDrawing = {
  id: 'd3', kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
  color: '#fff', width: 2, filled: false, fillAlpha: 0.5,
} satisfies Drawing
const circleDrawing = { id: 'd4', kind: 'circle', cx: 0, cy: 0, radius: 10, color: '#fff', width: 2, filled: false, fillAlpha: 0.5 } satisfies Drawing

describe('drawingBoundingBox', () => {
  it('rect: caixa idêntica a x/y/w/h', () => {
    expect(drawingBoundingBox(rectDrawing)).toEqual({ minX: 10, minY: 20, maxX: 40, maxY: 60 })
  })

  it('ellipse: caixa derivada de cx±rx / cy±ry', () => {
    expect(drawingBoundingBox(ellipseDrawing)).toEqual({ minX: 80, minY: 90, maxX: 120, maxY: 110 })
  })

  it('polygon: caixa mínima dos pontos', () => {
    expect(drawingBoundingBox(polygonDrawing)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 })
  })

  it('circle (kind fora de escopo de resize nesta fase): null', () => {
    expect(drawingBoundingBox(circleDrawing)).toBeNull()
  })
})

describe('tokenBoundingBox / propBoundingBox', () => {
  const token: Token = { id: 't1', characterId: null, name: 'H', x: 100, y: 100, size: 1, image: null }

  it('token: quadrado de meio-lado = (grid/2) * size', () => {
    expect(tokenBoundingBox(token, 64)).toEqual({ minX: 68, minY: 68, maxX: 132, maxY: 132 })
  })

  it('token com size 2: dobra o meio-lado', () => {
    expect(tokenBoundingBox({ ...token, size: 2 }, 64)).toEqual({ minX: 36, minY: 36, maxX: 164, maxY: 164 })
  })

  it('prop: retângulo width×height centrado em x,y', () => {
    const prop: Prop = { id: 'p1', src: '/a.png', x: 50, y: 50, width: 20, height: 10, linkedMapPath: null }
    expect(propBoundingBox(prop)).toEqual({ minX: 40, minY: 45, maxX: 60, maxY: 55 })
  })
})

describe('resizeRectDrawing', () => {
  it('arrasta o canto baixo-direita: x/y (âncora) mantêm, w/h crescem', () => {
    const result = resizeRectDrawing(rectDrawing, 2, 200, 300)
    expect(result.x).toBe(10)
    expect(result.y).toBe(20)
    expect(result.w).toBe(190)
    expect(result.h).toBe(280)
  })

  it('preserva os demais campos (color/width/filled/fillAlpha)', () => {
    const result = resizeRectDrawing(rectDrawing, 2, 200, 300)
    expect(result.color).toBe('#fff')
    expect(result.filled).toBe(false)
  })
})

describe('resizeRectDrawing — modificadores (item 17)', () => {
  it('Shift: preserva a proporção 30:40 original em vez de deformar', () => {
    // rectDrawing: w=30, h=40. Arrasto pede dx=190 (6.33x a largura) e
    // dy=280 (7x a altura) — o eixo y manda (7 > 6.33): a largura também
    // escala 7x, w = 30*7 = 210 (em vez dos 190 sem Shift).
    const result = resizeRectDrawing(rectDrawing, 2, 200, 300, { shift: true, alt: false })
    expect(result.x).toBe(10)
    expect(result.y).toBe(20)
    expect(result.w).toBe(210)
    expect(result.h).toBe(280)
    expect(result.w / result.h).toBeCloseTo(30 / 40)
  })

  it('Alt: redimensiona a partir do centro — x/y (âncora) TAMBÉM mudam, ao contrário do canto oposto fixo', () => {
    const result = resizeRectDrawing(rectDrawing, 2, 85, 100, { shift: false, alt: true })
    expect(result.x).toBe(-35)
    expect(result.y).toBe(-20)
    expect(result.w).toBe(120)
    expect(result.h).toBe(120)
  })

  it('modifiers omitido continua idêntico ao resultado de antes deste item (default sem efeito)', () => {
    expect(resizeRectDrawing(rectDrawing, 2, 200, 300)).toEqual(resizeRectDrawing(rectDrawing, 2, 200, 300, NO_MODIFIERS))
  })
})

describe('resizeEllipseDrawing', () => {
  it('arrasta o canto baixo-direita: recalcula cx/cy/rx/ry a partir da caixa nova', () => {
    // Caixa original: 80..120 (x), 90..110 (y). Âncora (canto oposto ao 2) = canto 0 = (80, 90).
    const result = resizeEllipseDrawing(ellipseDrawing, 2, 180, 130)
    expect(result.cx).toBe(130) // (80+180)/2
    expect(result.cy).toBe(110) // (90+130)/2
    expect(result.rx).toBe(50) // (180-80)/2
    expect(result.ry).toBe(20) // (130-90)/2
  })
})

describe('resizeEllipseDrawing — modificadores (item 17)', () => {
  it('Shift: ajusta o eixo que moveu menos pra manter rx:ry na proporção original (2:1)', () => {
    // ellipseDrawing: rx=20, ry=10 → caixa 40×20 (2:1). Arrasto pede y=100
    // (só 10px de dy a partir de 90), mas Shift usa o MESMO fator de escala
    // do eixo x (que pediu 120px) — cy/ry saem do y AJUSTADO (150), não do
    // y bruto do arrasto (100).
    const result = resizeEllipseDrawing(ellipseDrawing, 2, 200, 100, { shift: true, alt: false })
    expect(result.cx).toBe(140)
    expect(result.cy).toBe(120)
    expect(result.rx).toBe(60)
    expect(result.ry).toBe(30)
    expect(result.rx / result.ry).toBe(2)
  })
})

describe('resizePolygonDrawing', () => {
  it('escala todos os pontos em torno da âncora (canto oposto)', () => {
    // Caixa 0..100/0..100. Arrasta canto 2 (baixo-direita) pra (200,50): âncora = canto 0 = (0,0).
    const result = resizePolygonDrawing(polygonDrawing, 2, 200, 50)
    expect(result.points).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 50 },
      { x: 0, y: 50 },
    ])
  })

  it('polígono achatado numa linha (largura 0) não divide por zero', () => {
    const flat = { id: 'd5', kind: 'polygon', points: [{ x: 5, y: 0 }, { x: 5, y: 100 }], color: '#fff', width: 2, filled: false, fillAlpha: 0.5 } satisfies Drawing
    const result = resizePolygonDrawing(flat, 2, 5, 300)
    expect(Number.isFinite(result.points[0].x)).toBe(true)
    expect(Number.isFinite(result.points[0].y)).toBe(true)
  })
})

describe('resizePolygonDrawing — modificadores (item 17)', () => {
  it('Alt: escala todos os pontos em torno do CENTRO da caixa original, não do canto oposto', () => {
    const result = resizePolygonDrawing(polygonDrawing, 2, 150, 150, { shift: false, alt: true })
    expect(result.points).toEqual([
      { x: -50, y: -50 },
      { x: 150, y: -50 },
      { x: 150, y: 150 },
      { x: -50, y: 150 },
    ])
  })
})

describe('resizeTokenSize', () => {
  const token: Token = { id: 't1', characterId: null, name: 'H', x: 100, y: 100, size: 1, image: null }

  it('arrastar até 2x a distância do raio original dobra o size', () => {
    // baseRadius = 32 (grid 64). Arrasto até 64px do centro (eixo x) → size = 64/32 = 2.
    expect(resizeTokenSize(token, 64, 164, 100)).toBe(2)
  })

  it('distância de Chebyshev: o maior eixo manda, não a diagonal euclidiana', () => {
    // dx=64, dy=10 → half = max(64,10) = 64 → size = 64/32 = 2, ignora dy.
    expect(resizeTokenSize(token, 64, 164, 110)).toBe(2)
  })

  it('nunca fica abaixo de MIN_TOKEN_SIZE', () => {
    expect(resizeTokenSize(token, 64, 100, 100)).toBe(MIN_TOKEN_SIZE)
  })

  it('gridSize inválido (<=0) devolve o size atual, sem dividir por zero', () => {
    expect(resizeTokenSize(token, 0, 500, 500)).toBe(1)
  })
})

describe('resizePropBox', () => {
  const prop: Prop = { id: 'p1', src: '/a.png', x: 50, y: 50, width: 20, height: 10, linkedMapPath: null }

  it('arrasta o canto baixo-direita: width/height crescem, centro recalculado', () => {
    // Caixa original 40..60 (x) / 45..55 (y). Âncora (canto 0) = (40, 45).
    const result = resizePropBox(prop, 2, 140, 145)
    expect(result.width).toBe(100)
    expect(result.height).toBe(100)
    expect(result.x).toBe(90) // (40+140)/2
    expect(result.y).toBe(95) // (45+145)/2
  })

  it('respeita a dimensão mínima (não degenera a zero/negativo)', () => {
    const result = resizePropBox(prop, 2, 40, 45)
    expect(result.width).toBeGreaterThan(0)
    expect(result.height).toBeGreaterThan(0)
  })
})

describe('resizePropBox — modificadores (item 17)', () => {
  const prop: Prop = { id: 'p1', src: '/a.png', x: 50, y: 50, width: 20, height: 10, linkedMapPath: null }

  it('Alt: redimensiona a partir do centro — x/y (centro do Prop) não mudam', () => {
    const result = resizePropBox(prop, 2, 100, 100, { shift: false, alt: true })
    expect(result.x).toBe(50)
    expect(result.y).toBe(50)
    expect(result.width).toBe(100)
    expect(result.height).toBe(100)
  })

  it('Shift: preserva a proporção 20:10 (2:1) original', () => {
    // Caixa original 40..60 (x) / 45..55 (y). dx=110 (5.5x a largura 20),
    // dy=15 (1.5x a altura 10) — o eixo x manda: altura também escala 5.5x,
    // height = 10*5.5 = 55.
    const result = resizePropBox(prop, 2, 150, 60, { shift: true, alt: false })
    expect(result.width).toBe(110)
    expect(result.height).toBe(55)
    expect(result.width / result.height).toBe(2)
  })
})

describe('resizeCircleDrawingRadius', () => {
  it('novo raio = distância euclidiana do centro (cx,cy) até o ponto arrastado', () => {
    expect(resizeCircleDrawingRadius(circleDrawing, 3, 4)).toBe(5) // 3-4-5, cx=cy=0
  })

  it('arrastar de volta pro próprio centro dá raio 0, sem clamp de mínimo (mesmo comportamento de hoje pra Luz)', () => {
    expect(resizeCircleDrawingRadius(circleDrawing, 0, 0)).toBe(0)
  })
})
