import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawWalls, JANELA_GAP_SCREEN_PX, WALL_COLOR, type WallWithStyle } from './drawWalls'

/**
 * JANELA no desenho: traço DUPLO e FINO na mesma cor clara da parede — o
 * símbolo de janela de planta, dentro do visual de minimapa (nunca hachura,
 * nunca preenchimento).
 */
function strokes(g: Graphics) {
  return g.context.instructions.filter((instruction) => instruction.action === 'stroke')
}

/** Pontos (x, y) dos moveTo/lineTo do caminho de um stroke. */
function pathPoints(stroke: ReturnType<typeof strokes>[number]): { x: number; y: number }[] {
  if (stroke.action !== 'stroke') return []
  return stroke.data.path.instructions.flatMap((i) => {
    if (i.action !== 'moveTo' && i.action !== 'lineTo') return []
    const [x, y] = i.data
    return typeof x === 'number' && typeof y === 'number' ? [{ x, y }] : []
  })
}

function janela(overrides: Partial<WallWithStyle> = {}): WallWithStyle {
  return { id: 'j', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, janela: true, ...overrides }
}

describe('drawWalls — janela', () => {
  it('parede Janela vira dois traços paralelos finos, um de cada lado da linha, na cor da parede', () => {
    const g = new Graphics()
    drawWalls(g, [janela()], null)
    const all = strokes(g)
    expect(all).toHaveLength(2)
    const ys = all.map((s) => pathPoints(s).map((p) => p.y))
    // Cada traço corre reto (mesmo y nas duas pontas) e os dois ficam em lados opostos.
    for (const line of ys) {
      expect(line.length).toBe(2)
      expect(line[0]).toBe(line[1])
    }
    const [a, b] = ys.map((line) => line[0])
    expect(Math.sign(a) * Math.sign(b)).toBe(-1)
    expect(Math.abs(a - b)).toBeCloseTo(JANELA_GAP_SCREEN_PX, 0)
    for (const s of all) {
      if (s.action !== 'stroke') throw new Error('stroke ausente')
      expect(s.data.style.color).toBe(WALL_COLOR)
      expect(s.data.style.width).toBeLessThanOrEqual(1)
      expect(s.data.style.width).toBeGreaterThan(0)
    }
  })

  it('a janela não entra no traço contínuo da parede vizinha', () => {
    const g = new Graphics()
    const vizinha: WallWithStyle = { id: 'w', x1: 100, y1: 0, x2: 200, y2: 0, blocksLight: true, blocksMove: true, door: null }
    drawWalls(g, [janela(), vizinha], null)
    // 2 da janela + 1 da parede comum.
    expect(strokes(g)).toHaveLength(3)
  })

  it('parede comum continua um traço só (controle)', () => {
    const g = new Graphics()
    drawWalls(g, [janela({ janela: undefined })], null)
    expect(strokes(g)).toHaveLength(1)
  })
})
