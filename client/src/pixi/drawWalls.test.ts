import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawWalls, MIN_SCREEN_STROKE_PX, screenSafeWidth, type WallWithStyle } from './drawWalls'
import { WALL_EXTERIOR_COLOR, WALL_INTERIOR_COLOR, wallWidthFor } from './dungeonStyle'
import { SELECTION_COLOR } from './constants'
import type { Wall } from '../types/map'

/** Instruções `action: 'stroke'` de fato empilhadas no GraphicsContext — mesmo padrão de drawRegions.test.ts/drawDoors.test.ts. */
function strokeInstructions(g: Graphics) {
  return g.context.instructions.filter((instruction) => instruction.action === 'stroke')
}

function hasClosePath(stroke: ReturnType<typeof strokeInstructions>[number]): boolean {
  if (stroke.action !== 'stroke') return false
  return stroke.data.path.instructions.some((i) => i.action === 'closePath')
}

function baseWall(overrides: Partial<WallWithStyle> = {}): WallWithStyle {
  return {
    id: 'w1',
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
    blocksLight: true,
    blocksMove: true,
    door: null,
    ...overrides,
  }
}

/** Um quadrado 100×100 de 4 paredes, `regionEdgeIndex` 0..3 em ordem —
 *  mesma convenção de `buildRoomFromDraft` (types/map.ts, Wall.regionEdgeIndex):
 *  cada parede traça `points[i]` até `points[(i+1)%4]`. */
function squareRoomWalls(overrides: Partial<WallWithStyle> = {}): Wall[] {
  return [
    baseWall({ id: 'top', x1: 0, y1: 0, x2: 100, y2: 0, regionId: 'r1', regionEdgeIndex: 0, ...overrides }),
    baseWall({ id: 'right', x1: 100, y1: 0, x2: 100, y2: 100, regionId: 'r1', regionEdgeIndex: 1, ...overrides }),
    baseWall({ id: 'bottom', x1: 100, y1: 100, x2: 0, y2: 100, regionId: 'r1', regionEdgeIndex: 2, ...overrides }),
    baseWall({ id: 'left', x1: 0, y1: 100, x2: 0, y2: 0, regionId: 'r1', regionEdgeIndex: 3, ...overrides }),
  ]
}

describe('drawWalls — path único por Região (correção geométrica de B1, docs/DOSSIE-FEEDBACK-F4.md)', () => {
  it('4 paredes da mesma Sala, mesmo estilo, formam loop fechado: 1 stroke só, com closePath — o canto fecha pelo JOIN, não por cap', () => {
    const g = new Graphics()
    drawWalls(g, squareRoomWalls(), null)
    const strokes = strokeInstructions(g)
    expect(strokes).toHaveLength(1)
    expect(hasClosePath(strokes[0])).toBe(true)
  })

  it('aresta apagada no meio (regionEdgeIndex com buraco, invariante documentada em Wall.regionEdgeIndex): quebra em 2 runs, nenhuma fecha', () => {
    const g = new Graphics()
    const walls = squareRoomWalls().filter((w) => w.regionEdgeIndex !== 1) // remove 'right' — sobra [0] e [2,3]
    drawWalls(g, walls, null)
    const strokes = strokeInstructions(g)
    expect(strokes).toHaveLength(2)
    for (const stroke of strokes) {
      expect(hasClosePath(stroke)).toBe(false)
    }
  })

  it('parede selecionada dentro da Sala NÃO quebra a run: a seleção é um contorno por baixo, a Sala continua 1 loop com a cor real', () => {
    const g = new Graphics()
    drawWalls(g, squareRoomWalls(), 'right')
    const strokes = strokeInstructions(g)
    // [0] contorno de seleção da parede 'right' (desenhado antes = por baixo), [1] a Sala inteira fechada.
    expect(strokes).toHaveLength(2)
    const [outline, room] = strokes
    expect(outline.action === 'stroke' && outline.data.style.color).toBe(SELECTION_COLOR)
    expect(hasClosePath(outline)).toBe(false)
    expect(room.action === 'stroke' && room.data.style.color).toBe(WALL_EXTERIOR_COLOR)
    expect(hasClosePath(room)).toBe(true)
  })

  it('paredes soltas (sem regionId) continuam 1 stroke por parede, como antes desta fase', () => {
    const g = new Graphics()
    const walls: Wall[] = [baseWall({ id: 'lone' }), baseWall({ id: 'other', x1: 0, y1: 50, x2: 50, y2: 50 })]
    drawWalls(g, walls, null)
    expect(strokeInstructions(g)).toHaveLength(2)
  })
})

describe('drawWalls — porta abre vão (passo 3, F2)', () => {
  it('parede com porta não vira linha: a Sala com porta na direita quebra em 2 runs abertas', () => {
    const g = new Graphics()
    const walls = squareRoomWalls().map((w) => (w.id === 'right' ? { ...w, door: { open: false, locked: false, kind: 'normal' as const } } : w))
    drawWalls(g, walls, null)
    const strokes = strokeInstructions(g)
    expect(strokes).toHaveLength(2)
    for (const stroke of strokes) expect(hasClosePath(stroke)).toBe(false)
  })

  it('parede solta com porta: nenhum stroke de linha', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ door: { open: true, locked: true, kind: 'gate' } })], null)
    expect(strokeInstructions(g)).toHaveLength(0)
  })
})

describe('drawWalls — ponta e canto por escolha (lineStyle, F6: "quero a opcao de colocar reta ou redondo")', () => {
  it('parede solta sem lineStyle definido: cap "round" (default, comportamento de antes desta fase)', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall()], null)
    const [stroke] = strokeInstructions(g)
    expect(stroke.action === 'stroke' && stroke.data.style.cap).toBe('round')
  })

  it('parede solta com lineStyle "straight": cap "butt"', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ lineStyle: 'straight' })], null)
    const [stroke] = strokeInstructions(g)
    expect(stroke.action === 'stroke' && stroke.data.style.cap).toBe('butt')
  })

  it('Sala fechada sem lineStyle definido: join "round" (mesma escolha visual do cap, herdada pro canto fechado)', () => {
    const g = new Graphics()
    drawWalls(g, squareRoomWalls(), null)
    const [stroke] = strokeInstructions(g)
    expect(stroke.action === 'stroke' && stroke.data.style.join).toBe('round')
  })

  it('Sala fechada com lineStyle "straight": join "miter" — canto de 90° fica nítido, sem sobra arredondada', () => {
    const g = new Graphics()
    drawWalls(g, squareRoomWalls({ lineStyle: 'straight' }), null)
    const [stroke] = strokeInstructions(g)
    expect(stroke.action === 'stroke' && stroke.data.style.join).toBe('miter')
  })
})

describe('drawWalls — espessura em fração de célula + preset thin/medium/thick (passo 3, F2)', () => {
  function widthFor(wallKind: Wall['wallKind'], thickness: WallWithStyle['thickness'], grid = 64): number {
    const g = new Graphics()
    drawWalls(g, [baseWall({ wallKind, thickness })], null, 4, grid)
    const [stroke] = strokeInstructions(g)
    return stroke.action === 'stroke' ? stroke.data.style.width : NaN
  }

  it('exterior medium, grid 64: 0,25 célula = 16', () => {
    expect(widthFor('exterior', undefined)).toBe(16)
  })
  it('exterior thin 8 e thick 32 (preset 0,5/1/2)', () => {
    expect(widthFor('exterior', 'thin')).toBe(8)
    expect(widthFor('exterior', 'thick')).toBe(32)
  })
  it('interior medium, grid 64: 0,125 célula = 8 — metade da exterior', () => {
    expect(widthFor('interior', undefined)).toBe(8)
  })
  it('interior thin 4 e thick 16', () => {
    expect(widthFor('interior', 'thin')).toBe(4)
    expect(widthFor('interior', 'thick')).toBe(16)
  })
  it('escala com a grade: grid 128 dá 32, grid 32 dá 8 (exterior medium)', () => {
    expect(widthFor('exterior', undefined, 128)).toBe(32)
    expect(widthFor('exterior', undefined, 32)).toBe(8)
  })
  it('wallWidthFor bate com o que drawWalls desenha', () => {
    expect(wallWidthFor({ wallKind: 'interior', thickness: 'thick' }, 64)).toBe(widthFor('interior', 'thick'))
  })
  it('cor: exterior #1f1b16, interior #3a342c', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ id: 'e', wallKind: 'exterior' }), baseWall({ id: 'i', wallKind: 'interior', y1: 50, y2: 50 })], null)
    const colors = strokeInstructions(g).map((s) => (s.action === 'stroke' ? s.data.style.color : NaN))
    expect(colors).toEqual([WALL_EXTERIOR_COLOR, WALL_INTERIOR_COLOR])
  })
})

describe('drawWalls — seleção como contorno por fora', () => {
  it('parede exterior/medium selecionada: traço real intacto (cor e largura) + contorno por baixo 2 px de tela maior de cada lado', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ wallKind: 'exterior' })], 'w1', 1)
    const [outline, real] = strokeInstructions(g)
    expect(outline.action === 'stroke' && outline.data.style).toMatchObject({ color: SELECTION_COLOR, width: 16 + 2 * 2 })
    expect(real.action === 'stroke' && real.data.style).toMatchObject({ color: WALL_EXTERIOR_COLOR, width: 16 })
  })

  it('a largura da parede NÃO muda com a seleção (contrato com o agente de seleção)', () => {
    const plain = new Graphics()
    const selected = new Graphics()
    drawWalls(plain, squareRoomWalls(), null, 1, 64)
    drawWalls(selected, squareRoomWalls(), 'top', 1, 64, 'r1')
    const widthOf = (g: Graphics) => {
      const strokes = strokeInstructions(g)
      const last = strokes[strokes.length - 1]
      return last.action === 'stroke' ? last.data.style : null
    }
    expect(widthOf(selected)).toMatchObject({ width: widthOf(plain)?.width, color: widthOf(plain)?.color })
  })

  it('Sala selecionada (highlightedRegionId): contorno fechado por baixo das paredes, 2 px de tela de cada lado', () => {
    const g = new Graphics()
    drawWalls(g, squareRoomWalls(), null, 1, 64, 'r1')
    const [outline, room] = strokeInstructions(g)
    expect(outline.action === 'stroke' && outline.data.style).toMatchObject({ color: SELECTION_COLOR, width: 16 + 4 })
    expect(hasClosePath(outline)).toBe(true)
    expect(room.action === 'stroke' && room.data.style.color).toBe(WALL_EXTERIOR_COLOR)
  })

  it('parede com ponta reta (butt): contorno usa ponta quadrada para cercar também as pontas', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ lineStyle: 'straight' })], 'w1', 1)
    const [outline] = strokeInstructions(g)
    expect(outline.action === 'stroke' && outline.data.style.cap).toBe('square')
  })

  it('contorno tem 2 px de TELA: a zoom 400% cresce só 0.5 de mundo de cada lado', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ wallKind: 'exterior' })], 'w1', 4)
    const [outline] = strokeInstructions(g)
    expect(outline.action === 'stroke' && outline.data.style.width).toBe(16 + 2 * 0.5)
  })
})

describe('drawWalls — piso de 1 px de tela (screenSafeWidth)', () => {
  function widthAt(cameraScale: number, overrides: Partial<WallWithStyle> = {}, grid = 64): number {
    const g = new Graphics()
    drawWalls(g, [baseWall({ wallKind: 'exterior', ...overrides })], null, cameraScale, grid)
    const [stroke] = strokeInstructions(g)
    return stroke.action === 'stroke' ? stroke.data.style.width : NaN
  }

  it('screenSafeWidth: acima do piso devolve a largura de mundo; abaixo, 1 / escala', () => {
    expect(screenSafeWidth(1.5, 1)).toBe(1.5)
    expect(screenSafeWidth(1.5, 2)).toBe(1.5)
    expect(screenSafeWidth(1.5, 0.5)).toBe(2)
    expect(screenSafeWidth(0.5, 1)).toBe(1)
  })

  it('grade pequena (8) e zoom 50%: parede exterior fina (1 de mundo = 0.5 px de tela) engorda para 2 de mundo = 1 px de tela', () => {
    const width = widthAt(0.5, { thickness: 'thin' }, 8)
    expect(width).toBe(2)
    expect(width * 0.5).toBeGreaterThanOrEqual(MIN_SCREEN_STROKE_PX)
  })

  it('zoom 5% com grid 64: 16 de mundo = 0,8 px de tela engorda para 1 px de tela', () => {
    expect(widthAt(0.05) * 0.05).toBeCloseTo(MIN_SCREEN_STROKE_PX)
  })

  it('zoom 200%: largura de mundo intacta (16), cresce com o zoom como o resto do mapa', () => {
    expect(widthAt(2)).toBe(16)
  })

  it('sem cameraScale nem grid (default 1 e 64): exterior medium continua 16', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ wallKind: 'exterior' })], null)
    const [stroke] = strokeInstructions(g)
    expect(stroke.action === 'stroke' && stroke.data.style.width).toBe(16)
  })
})
