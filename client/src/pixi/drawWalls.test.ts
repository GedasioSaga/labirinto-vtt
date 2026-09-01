import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawWalls, type WallWithStyle } from './drawWalls'
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

  it('parede selecionada dentro da Sala quebra a run mesmo com regionEdgeIndex consecutivo — Pixi só aceita 1 estilo por stroke()', () => {
    const g = new Graphics()
    drawWalls(g, squareRoomWalls(), 'right')
    const strokes = strokeInstructions(g)
    // [top] sozinha, [right] sozinha (selecionada), [bottom,left] juntas — 3 runs, nenhuma fecha (open chains)
    expect(strokes).toHaveLength(3)
    for (const stroke of strokes) {
      expect(hasClosePath(stroke)).toBe(false)
    }
    const selectedStroke = strokes.find((s) => s.action === 'stroke' && s.data.style.color === 0xffdd55)
    expect(selectedStroke).toBeDefined()
  })

  it('paredes soltas (sem regionId) continuam 1 stroke por parede, como antes desta fase', () => {
    const g = new Graphics()
    const walls: Wall[] = [baseWall({ id: 'lone' }), baseWall({ id: 'other', x1: 0, y1: 50, x2: 50, y2: 50 })]
    drawWalls(g, walls, null)
    expect(strokeInstructions(g)).toHaveLength(2)
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

describe('drawWalls — espessura extremamente fina + preset thin/medium/thick (F6)', () => {
  // Casos explícitos (sem it.each) para preservar o literal exato de cada
  // combinação sem depender de inferência de tupla do it.each — wallKind/
  // thickness precisam continuar como os literais de union (não `string`
  // largo) pra `baseWall({ wallKind, thickness })` tipar sem `as`.
  function widthFor(wallKind: Wall['wallKind'], thickness: WallWithStyle['thickness']): number {
    const g = new Graphics()
    drawWalls(g, [baseWall({ wallKind, thickness })], null)
    const [stroke] = strokeInstructions(g)
    return stroke.action === 'stroke' ? stroke.data.style.width : NaN
  }

  it('exterior, thickness indefinido (medium): 1.5 — 62.5% mais fina que o hardcoded de antes desta fase (4)', () => {
    expect(widthFor('exterior', undefined)).toBe(1.5)
  })
  it('exterior thin: 0.75 (metade do medium, mesma razão 0.5 de STAIR_SIZE_PRESET_RATIO)', () => {
    expect(widthFor('exterior', 'thin')).toBe(0.75)
  })
  it('exterior thick: 3 (dobro do medium)', () => {
    expect(widthFor('exterior', 'thick')).toBe(3)
  })
  it('interior, thickness indefinido (medium): 1 — 60% mais fina que o hardcoded de antes desta fase (2.5)', () => {
    expect(widthFor('interior', undefined)).toBe(1)
  })
  it('interior thin: 0.5', () => {
    expect(widthFor('interior', 'thin')).toBe(0.5)
  })
  it('interior thick: 2', () => {
    expect(widthFor('interior', 'thick')).toBe(2)
  })
})

describe('drawWalls — realce de seleção com piso mínimo', () => {
  it('parede exterior/medium selecionada: width = base × 1.6 (2.4), acima do piso', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ wallKind: 'exterior' })], 'w1')
    const [stroke] = strokeInstructions(g)
    expect(stroke.action === 'stroke' && stroke.data.style.width).toBeCloseTo(2.4)
    expect(stroke.action === 'stroke' && stroke.data.style.color).toBe(0xffdd55)
  })

  it('parede interior/thin selecionada: base×1.6 (0.8) fica ABAIXO do piso — usa o piso (2), nunca mais fina que uma parede thick comum não selecionada', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ wallKind: 'interior', thickness: 'thin' })], 'w1')
    const [stroke] = strokeInstructions(g)
    expect(stroke.action === 'stroke' && stroke.data.style.width).toBe(2)
  })
})

describe('drawWalls — cameraScale opcional (F6: espessura constante em pixel de tela)', () => {
  it('sem cameraScale (default 1): comportamento idêntico a não passar o parâmetro', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ wallKind: 'exterior' })], null)
    const [stroke] = strokeInstructions(g)
    expect(stroke.action === 'stroke' && stroke.data.style.width).toBe(1.5)
  })

  it('cameraScale=2: width final = width_base / cameraScale (1.5 / 2 = 0.75)', () => {
    const g = new Graphics()
    drawWalls(g, [baseWall({ wallKind: 'exterior' })], null, 2)
    const [stroke] = strokeInstructions(g)
    expect(stroke.action === 'stroke' && stroke.data.style.width).toBeCloseTo(0.75)
  })
})
