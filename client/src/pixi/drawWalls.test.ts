import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawWalls, WALL_COLOR, WALL_EXTERIOR_ALPHA, WALL_INTERIOR_ALPHA, type WallWithStyle } from './drawWalls'
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

function styleOf(stroke: ReturnType<typeof strokeInstructions>[number] | undefined) {
  if (!stroke || stroke.action !== 'stroke') throw new Error('stroke ausente')
  return stroke.data.style
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
    expect(styleOf(outline).color).toBe(SELECTION_COLOR)
    expect(hasClosePath(outline)).toBe(false)
    expect(styleOf(room).color).toBe(WALL_COLOR)
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
    expect(styleOf(strokeInstructions(g)[0]).cap).toBe('round')
  })

  it('parede solta com lineStyle "straight": cap "butt"', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ lineStyle: 'straight' })], null)
    expect(styleOf(strokeInstructions(g)[0]).cap).toBe('butt')
  })

  it('Sala fechada sem lineStyle definido: join "round" (mesma escolha visual do cap, herdada pro canto fechado)', () => {
    const g = new Graphics()
    drawWalls(g, squareRoomWalls(), null)
    expect(styleOf(strokeInstructions(g)[0]).join).toBe('round')
  })

  it('Sala fechada com lineStyle "straight": join "miter" — canto de 90° fica nítido, sem sobra arredondada', () => {
    const g = new Graphics()
    drawWalls(g, squareRoomWalls({ lineStyle: 'straight' }), null)
    expect(styleOf(strokeInstructions(g)[0]).join).toBe('miter')
  })
})

describe('drawWalls — linha clara em px de TELA (minimapa RE, 15/09/2026)', () => {
  function screenWidthFor(overrides: Partial<WallWithStyle>, cameraScale = 1, resolution = 1): number {
    const g = new Graphics()
    drawWalls(g, [baseWall(overrides)], null, cameraScale, resolution)
    return styleOf(strokeInstructions(g)[0]).width * cameraScale
  }

  it('fina 1, média 2 (padrão) e grossa 3 px de tela a 100%', () => {
    expect(screenWidthFor({ thickness: 'thin' })).toBe(1)
    expect(screenWidthFor({})).toBe(2)
    expect(screenWidthFor({ thickness: 'medium' })).toBe(2)
    expect(screenWidthFor({ thickness: 'thick' })).toBe(3)
  })

  it('a largura na tela NÃO muda com o zoom (38%, 100%, 300%)', () => {
    for (const scale of [0.38, 1, 3]) {
      expect(screenWidthFor({}, scale)).toBeCloseTo(2, 9)
      expect(screenWidthFor({ thickness: 'thick' }, scale)).toBeCloseTo(3, 9)
    }
  })

  it('interior tem a mesma largura da exterior (a diferença é só a opacidade)', () => {
    expect(screenWidthFor({ wallKind: 'interior' })).toBe(screenWidthFor({ wallKind: 'exterior' }))
  })

  it('resolução 1,25: largura inteira em px físicos (2 × 1,25 = 2,5 → 3 físicos)', () => {
    const physical = screenWidthFor({}, 1, 1.25) * 1.25
    expect(physical).toBeCloseTo(3, 9)
  })

  it('cor clara #d8d2c4 nas duas; interior com alpha menor', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ id: 'e', wallKind: 'exterior' }), baseWall({ id: 'i', wallKind: 'interior', y1: 50, y2: 50 })], null)
    const styles = strokeInstructions(g).map(styleOf)
    expect(styles.map((s) => s.color)).toEqual([WALL_COLOR, WALL_COLOR])
    expect(styles.map((s) => s.alpha)).toEqual([WALL_EXTERIOR_ALPHA, WALL_INTERIOR_ALPHA])
    expect(WALL_COLOR).toBe(0xd8d2c4)
    expect(WALL_INTERIOR_ALPHA).toBeLessThan(WALL_EXTERIOR_ALPHA)
  })

  it('parede horizontal: y no meio do pixel para largura ímpar e na fronteira para par', () => {
    const yOf = (thickness: WallWithStyle['thickness']) => {
      const g = new Graphics()
      drawWalls(g, [baseWall({ y1: 10, y2: 10, thickness })], null)
      const stroke = strokeInstructions(g)[0]
      if (stroke.action !== 'stroke') throw new Error('stroke ausente')
      const move = stroke.data.path.instructions.find((i) => i.action === 'moveTo')
      return (move?.data as number[] | undefined)?.[1]
    }
    expect(yOf('thin')).toBe(10.5)
    expect(yOf('medium')).toBe(10)
    expect(yOf('thick')).toBe(10.5)
  })
})

describe('drawWalls — seleção como contorno por fora', () => {
  it('parede selecionada: traço real intacto (cor e largura) + contorno por baixo 2 px de tela maior de cada lado', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ wallKind: 'exterior' })], 'w1', 1)
    const [outline, real] = strokeInstructions(g)
    expect(styleOf(outline)).toMatchObject({ color: SELECTION_COLOR, width: 2 + 2 * 2 })
    expect(styleOf(real)).toMatchObject({ color: WALL_COLOR, width: 2 })
  })

  it('a largura da parede NÃO muda com a seleção (contrato com o agente de seleção)', () => {
    const plain = new Graphics()
    const selected = new Graphics()
    drawWalls(plain, squareRoomWalls(), null, 1, 1)
    drawWalls(selected, squareRoomWalls(), 'top', 1, 1, 'r1')
    const lastStyle = (g: Graphics) => styleOf(strokeInstructions(g).at(-1))
    expect(lastStyle(selected)).toMatchObject({ width: lastStyle(plain).width, color: lastStyle(plain).color })
  })

  it('Sala selecionada (highlightedRegionId): contorno fechado por baixo das paredes, 2 px de tela de cada lado', () => {
    const g = new Graphics()
    drawWalls(g, squareRoomWalls(), null, 1, 1, 'r1')
    const [outline, room] = strokeInstructions(g)
    expect(styleOf(outline)).toMatchObject({ color: SELECTION_COLOR, width: 2 + 4 })
    expect(hasClosePath(outline)).toBe(true)
    expect(styleOf(room).color).toBe(WALL_COLOR)
  })

  it('parede com porta selecionada: sem contorno de seleção no vão (a moldura vem de drawDoors)', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ door: { open: false, locked: false, kind: 'normal' } })], 'w1', 1)
    expect(strokeInstructions(g).map(styleOf).some((style) => style.color === SELECTION_COLOR)).toBe(false)
  })

  it('parede com ponta reta (butt): contorno usa ponta quadrada para cercar também as pontas', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ lineStyle: 'straight' })], 'w1', 1)
    expect(styleOf(strokeInstructions(g)[0]).cap).toBe('square')
  })

  it('contorno e parede em px de TELA: a zoom 400% o contorno inteiro mede 6 px de tela', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ wallKind: 'exterior' })], 'w1', 4)
    const [outline, real] = strokeInstructions(g)
    expect(styleOf(outline).width * 4).toBeCloseTo(6, 9)
    expect(styleOf(real).width * 4).toBeCloseTo(2, 9)
  })
})
