import { describe, expect, it, vi } from 'vitest'
import { FillPattern, Graphics, Texture } from 'pixi.js'
import { createHatchRenderer, drawHatch, hatchWallChains } from './drawHatch'
import { HATCH_FLAT_COLOR, HATCH_INK_COLOR, PARCHMENT_COLOR, hatchStrokeWidth } from './dungeonStyle'
import type { FloorPolygon } from '../lib/floorContour'
import type { Region, Wall } from '../types/map'

function byAction(g: Graphics, action: 'fill' | 'stroke') {
  return g.context.instructions.filter((instruction) => instruction.action === action)
}

function fillStyleOf(instruction: ReturnType<typeof byAction>[number]) {
  if (instruction.action !== 'fill') throw new Error('não é fill')
  return instruction.data.style
}

function strokeStyleOf(instruction: ReturnType<typeof byAction>[number]) {
  if (instruction.action !== 'stroke') throw new Error('não é stroke')
  return instruction.data.style
}

function wall(overrides: Partial<Wall>): Wall {
  return { id: 'w', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null, ...overrides }
}

/** Sala 4×4 células (grid 64) com as 4 paredes em ordem de aresta. */
function roomWalls(overrides: Partial<Wall> = {}): Wall[] {
  const s = 256
  return [
    wall({ id: 't', x1: 0, y1: 0, x2: s, y2: 0, regionId: 'r1', regionEdgeIndex: 0, ...overrides }),
    wall({ id: 'r', x1: s, y1: 0, x2: s, y2: s, regionId: 'r1', regionEdgeIndex: 1, ...overrides }),
    wall({ id: 'b', x1: s, y1: s, x2: 0, y2: s, regionId: 'r1', regionEdgeIndex: 2, ...overrides }),
    wall({ id: 'l', x1: 0, y1: s, x2: 0, y2: 0, regionId: 'r1', regionEdgeIndex: 3, ...overrides }),
  ]
}

const room: Region = {
  id: 'r1',
  points: [{ x: 0, y: 0 }, { x: 256, y: 0 }, { x: 256, y: 256 }, { x: 0, y: 256 }],
  tag: '',
  fillColor: '#e9e1cf',
  fillPattern: 'solid',
  data: {},
}

const corridor: FloorPolygon[] = [{ outer: [{ x: 300, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 64 }, { x: 300, y: 64 }], holes: [] }]

/** Sem `repetition`: não mexe no estilo do Texture.WHITE compartilhado. */
const pattern = new FillPattern({ texture: Texture.WHITE })

describe('drawHatch — pintura vetorial (cachos + papel)', () => {
  it('sala: 1 fill de papel pergaminho e 1 stroke de tinta com ponta reta, sem textura', () => {
    const g = new Graphics()
    drawHatch(g, roomWalls(), [], 64, pattern, 1, [room])
    const fills = byAction(g, 'fill')
    const strokes = byAction(g, 'stroke')
    expect(fills).toHaveLength(1)
    expect(strokes).toHaveLength(1)
    expect(fillStyleOf(fills[0]).color).toBe(PARCHMENT_COLOR)
    expect(strokeStyleOf(strokes[0]).color).toBe(HATCH_INK_COLOR)
    expect(strokeStyleOf(strokes[0]).cap).toBe('butt')
    expect(strokeStyleOf(strokes[0]).fill).not.toBe(pattern)
    expect(strokeStyleOf(strokes[0]).texture).toBe(Texture.WHITE)
  })

  it('largura do traço: 0,036 célula (2,304 px a grid 64); grid 128 dobra', () => {
    const g = new Graphics()
    drawHatch(g, roomWalls(), [], 64, null)
    expect(strokeStyleOf(byAction(g, 'stroke')[0]).width).toBeCloseTo(2.304)
    expect(hatchStrokeWidth(128, 1).width).toBeCloseTo(4.608)
  })

  it('parede interna sozinha: nada desenhado', () => {
    const g = new Graphics()
    drawHatch(g, [wall({ wallKind: 'interior' })], [], 64, pattern)
    expect(g.context.instructions).toHaveLength(0)
  })

  it('mapa vazio: nada desenhado', () => {
    const g = new Graphics()
    drawHatch(g, [], [], 64, pattern)
    expect(g.context.instructions).toHaveLength(0)
  })

  it('só chão por peças: papel e traços em volta do polígono', () => {
    const g = new Graphics()
    drawHatch(g, [], corridor, 64, pattern)
    expect(byAction(g, 'fill')).toHaveLength(1)
    expect(byAction(g, 'stroke')).toHaveLength(1)
  })

  it('LOD abaixo de 35% (grid 64): só papel em cor lisa, nenhum traço', () => {
    const g = new Graphics()
    drawHatch(g, roomWalls(), [], 64, pattern, 0.3)
    expect(byAction(g, 'stroke')).toHaveLength(0)
    expect(fillStyleOf(byAction(g, 'fill')[0]).color).toBe(HATCH_FLAT_COLOR)
  })

  it('no limite do LOD (35%) ainda tem traço, com pelo menos 1 px de tela; grid 32 a 50% já é lisa', () => {
    const at35 = new Graphics()
    drawHatch(at35, roomWalls(), [], 64, null, 0.35)
    const strokes = byAction(at35, 'stroke')
    expect(strokes).toHaveLength(1)
    expect(strokeStyleOf(strokes[0]).width * 0.35).toBeGreaterThanOrEqual(1)
    const small = new Graphics()
    drawHatch(small, roomWalls(), [], 32, null, 0.5)
    expect(byAction(small, 'stroke')).toHaveLength(0)
  })

  it('hatchStrokeWidth: acima de 1 px de tela não muda com o zoom; abaixo, degraus com tela em [1; 1,25)', () => {
    for (const scale of [1, 0.6]) {
      expect(hatchStrokeWidth(64, scale).tier).toBe(0)
      expect(hatchStrokeWidth(64, scale).width).toBeCloseTo(2.304)
    }
    for (const scale of [0.4, 0.36, 0.35]) {
      const { width, tier } = hatchStrokeWidth(64, scale)
      expect(tier).toBeGreaterThan(0)
      expect(width * scale).toBeGreaterThanOrEqual(1 - 1e-9)
      expect(width * scale).toBeLessThan(1.25)
    }
  })

  it('porta NÃO quebra a cadeia de parede externa (compatibilidade de hatchWallChains)', () => {
    const walls = roomWalls().map((w) => (w.id === 'r' ? { ...w, door: { open: false, locked: false, kind: 'normal' as const } } : w))
    expect(hatchWallChains(walls, 64)).toHaveLength(1)
  })

  it('espessura diferente quebra a cadeia (compatibilidade de hatchWallChains)', () => {
    const walls = roomWalls().map((w) => (w.id === 'b' ? { ...w, thickness: 'thick' as const } : w))
    expect(hatchWallChains(walls, 64).length).toBeGreaterThan(1)
  })
})

describe('createHatchRenderer — cache e máscara inversa', () => {
  const input = () => ({ walls: roomWalls(), regions: [room], floorPolygons: [], grid: 64, cameraScale: 1 })

  it('mesma chave não repinta; chave nova repinta', () => {
    const renderer = createHatchRenderer(() => pattern)
    const hatch = new Graphics()
    const mask = new Graphics()
    const clear = vi.spyOn(hatch, 'clear')
    const first = input()
    const key = [first.walls, first.regions]
    renderer.draw(hatch, mask, first, key)
    renderer.draw(hatch, mask, first, [...key])
    expect(clear).toHaveBeenCalledTimes(1)
    renderer.draw(hatch, mask, { ...first, walls: roomWalls() }, [roomWalls(), first.regions])
    expect(clear).toHaveBeenCalledTimes(2)
  })

  it('zoom sem cruzar LOD nem degrau do traço não repinta; cruzar o LOD repinta', () => {
    const renderer = createHatchRenderer()
    const hatch = new Graphics()
    const clear = vi.spyOn(hatch, 'clear')
    const key = ['k']
    renderer.draw(hatch, new Graphics(), input(), key)
    renderer.draw(hatch, new Graphics(), { ...input(), cameraScale: 0.8 }, key)
    renderer.draw(hatch, new Graphics(), { ...input(), cameraScale: 3 }, key)
    expect(clear).toHaveBeenCalledTimes(1)
    renderer.draw(hatch, new Graphics(), { ...input(), cameraScale: 0.2 }, key)
    expect(clear).toHaveBeenCalledTimes(2)
    expect(byAction(hatch, 'stroke')).toHaveLength(0)
  })

  it('degrau da largura (zoom 45% → 36%) repinta o traço sem refazer a máscara', () => {
    const renderer = createHatchRenderer()
    const hatch = new Graphics()
    const mask = new Graphics()
    const maskClear = vi.spyOn(mask, 'clear')
    const key = ['k']
    renderer.draw(hatch, mask, { ...input(), cameraScale: 0.45 }, key)
    renderer.draw(hatch, mask, { ...input(), cameraScale: 0.36 }, key)
    expect(maskClear).toHaveBeenCalledTimes(1)
    expect(strokeStyleOf(byAction(hatch, 'stroke')[0]).width * 0.36).toBeGreaterThanOrEqual(1)
  })

  it('com piso: máscara inversa aplicada; sem piso: máscara removida', () => {
    const renderer = createHatchRenderer(() => pattern)
    const hatch = new Graphics()
    const mask = new Graphics()
    const setMask = vi.spyOn(hatch, 'setMask')
    renderer.draw(hatch, mask, input(), ['a'])
    expect(setMask).toHaveBeenCalledWith({ mask, inverse: true })
    renderer.draw(hatch, mask, { walls: [wall({})], regions: [], floorPolygons: [], grid: 64, cameraScale: 1 }, ['b'])
    // Pixi 8 devolve `undefined` depois de `mask = null`: o que importa é não ter máscara.
    expect(hatch.mask ?? null).toBeNull()
  })
})
