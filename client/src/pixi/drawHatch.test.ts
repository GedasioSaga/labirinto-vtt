import { describe, expect, it, vi } from 'vitest'
import { FillPattern, Graphics, Texture } from 'pixi.js'
import { createHatchRenderer, drawHatch, hatchWallChains } from './drawHatch'
import { HATCH_FLAT_COLOR } from './dungeonStyle'
import type { FloorPolygon } from '../lib/floorContour'
import type { Region, Wall } from '../types/map'

function strokes(g: Graphics) {
  return g.context.instructions.filter((instruction) => instruction.action === 'stroke')
}

function styleOf(instruction: ReturnType<typeof strokes>[number]) {
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

describe('drawHatch — geometria da faixa (passo 3, F2)', () => {
  it('sala de 4 paredes externas: 1 stroke fechado, fill = padrão, largura = parede (16) + 2 × faixa (32)', () => {
    const g = new Graphics()
    drawHatch(g, roomWalls(), [], 64, pattern)
    const list = strokes(g)
    expect(list).toHaveLength(1)
    expect(styleOf(list[0]).fill).toBe(pattern)
    expect(styleOf(list[0]).width).toBe(16 + 2 * 32)
    expect(styleOf(list[0]).join).toBe('round')
  })

  it('N runs externos → N strokes: 2 paredes soltas dão 2 faixas', () => {
    const g = new Graphics()
    drawHatch(g, [wall({ id: 'a' }), wall({ id: 'b', y1: 200, y2: 200 })], [], 64, pattern)
    expect(strokes(g)).toHaveLength(2)
  })

  it('parede interna não gera faixa', () => {
    const g = new Graphics()
    drawHatch(g, [wall({ wallKind: 'interior' })], [], 64, pattern)
    expect(strokes(g)).toHaveLength(0)
  })

  it('porta NÃO quebra a faixa (o vão fica coberto pelo chão do corredor): sala com porta continua 1 loop', () => {
    const walls = roomWalls().map((w) => (w.id === 'r' ? { ...w, door: { open: false, locked: false, kind: 'normal' as const } } : w))
    expect(hatchWallChains(walls, 64)).toHaveLength(1)
  })

  it('espessura diferente quebra a faixa (medida da face de cada parede)', () => {
    const walls = roomWalls().map((w) => (w.id === 'b' ? { ...w, thickness: 'thick' as const } : w))
    expect(hatchWallChains(walls, 64).length).toBeGreaterThan(1)
  })

  it('anel de chão por peças: stroke de 2 × faixa, sem parede', () => {
    const g = new Graphics()
    drawHatch(g, [], corridor, 64, pattern)
    const list = strokes(g)
    expect(list).toHaveLength(1)
    expect(styleOf(list[0]).width).toBe(64)
  })

  it('escala com a grade: grid 128 → parede 32 + 2 × 64', () => {
    const g = new Graphics()
    drawHatch(g, roomWalls(), [], 128, pattern)
    expect(styleOf(strokes(g)[0]).width).toBe(32 + 128)
  })

  it('zoom abaixo de 35% (grid 64): faixa lisa #8c857a, sem padrão', () => {
    const g = new Graphics()
    drawHatch(g, roomWalls(), [], 64, pattern, 0.3)
    const style = styleOf(strokes(g)[0])
    expect(style.color).toBe(HATCH_FLAT_COLOR)
    expect(style.fill).not.toBe(pattern)
  })

  it('no limite do LOD (35%) ainda usa o padrão; grid 32 a 50% já é lisa (escala efetiva 0,25)', () => {
    const at35 = new Graphics()
    drawHatch(at35, roomWalls(), [], 64, pattern, 0.35)
    expect(styleOf(strokes(at35)[0]).fill).toBe(pattern)
    const small = new Graphics()
    drawHatch(small, roomWalls(), [], 32, pattern, 0.5)
    expect(styleOf(strokes(small)[0]).color).toBe(HATCH_FLAT_COLOR)
  })

  it('sem padrão (null, sem canvas 2D): cai em cor lisa', () => {
    const g = new Graphics()
    drawHatch(g, roomWalls(), [], 64, null)
    expect(styleOf(strokes(g)[0]).color).toBe(HATCH_FLAT_COLOR)
  })

  it('screenSafeWidth: a zoom 1% a faixa (80 de mundo = 0,8 px) engorda para 1 px de tela', () => {
    const g = new Graphics()
    drawHatch(g, roomWalls(), [], 64, pattern, 0.01)
    expect(styleOf(strokes(g)[0]).width * 0.01).toBeCloseTo(1)
  })
})

describe('createHatchRenderer — cache e máscara inversa', () => {
  it('mesma chave não repinta; chave nova repinta', () => {
    const renderer = createHatchRenderer(() => pattern)
    const hatch = new Graphics()
    const mask = new Graphics()
    const clear = vi.spyOn(hatch, 'clear')
    const input = { walls: roomWalls(), regions: [room], floorPolygons: [], grid: 64, cameraScale: 1 }
    const key = [input.walls, input.regions]
    renderer.draw(hatch, mask, input, key)
    renderer.draw(hatch, mask, input, [...key])
    expect(clear).toHaveBeenCalledTimes(1)
    renderer.draw(hatch, mask, { ...input, walls: roomWalls() }, [roomWalls(), input.regions])
    expect(clear).toHaveBeenCalledTimes(2)
  })

  it('cruzar o LOD repinta mesmo com a mesma chave', () => {
    const renderer = createHatchRenderer(() => pattern)
    const hatch = new Graphics()
    const clear = vi.spyOn(hatch, 'clear')
    const input = { walls: roomWalls(), regions: [room], floorPolygons: [], grid: 64, cameraScale: 1 }
    const key = ['k']
    renderer.draw(hatch, new Graphics(), input, key)
    renderer.draw(hatch, new Graphics(), { ...input, cameraScale: 0.8 }, key)
    expect(clear).toHaveBeenCalledTimes(1)
    renderer.draw(hatch, new Graphics(), { ...input, cameraScale: 0.2 }, key)
    expect(clear).toHaveBeenCalledTimes(2)
  })

  it('com piso: máscara inversa aplicada; sem piso: máscara removida', () => {
    const renderer = createHatchRenderer(() => pattern)
    const hatch = new Graphics()
    const mask = new Graphics()
    const setMask = vi.spyOn(hatch, 'setMask')
    renderer.draw(hatch, mask, { walls: roomWalls(), regions: [room], floorPolygons: [], grid: 64, cameraScale: 1 }, ['a'])
    expect(setMask).toHaveBeenCalledWith({ mask, inverse: true })
    renderer.draw(hatch, mask, { walls: [wall({})], regions: [], floorPolygons: [], grid: 64, cameraScale: 1 }, ['b'])
    // Pixi 8 devolve `undefined` depois de `mask = null`: o que importa é não ter máscara.
    expect(hatch.mask ?? null).toBeNull()
  })
})
