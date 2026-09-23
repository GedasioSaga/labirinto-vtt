import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { DOOR_COLOR, DOOR_LENGTH_RATIO, DOOR_LOCKED_COLOR, DOOR_OPEN_OUTLINE_SCREEN_PX, DOOR_THICKNESS_SCREEN_PX, drawDoors } from './drawDoors'
import { drawWalls } from './drawWalls'
import { SELECTION_COLOR } from './constants'
import type { DoorState, Wall } from '../types/map'

function baseWall(overrides: Partial<Wall> = {}): Wall {
  return {
    id: 'w1',
    x1: 0,
    y1: 0,
    x2: 40,
    y2: 0,
    blocksLight: true,
    blocksMove: true,
    door: null,
    ...overrides,
  }
}

function doorWall(door: Partial<DoorState>, overrides: Partial<Wall> = {}): Wall {
  return baseWall({ door: { open: false, locked: false, kind: 'normal', ...door }, ...overrides })
}

function strokeInstructions(g: Graphics) {
  return g.context.instructions.filter((instruction) => instruction.action === 'stroke')
}

function fillInstructions(g: Graphics) {
  return g.context.instructions.filter((instruction) => instruction.action === 'fill')
}

/** Pontos do primeiro `poly` do path de uma instrução (fill ou stroke). */
function polyPoints(instruction: ReturnType<Graphics['context']['instructions']['filter']>[number]): { x: number; y: number }[] {
  if (instruction.action !== 'fill' && instruction.action !== 'stroke') throw new Error('instrução sem path')
  const poly = instruction.data.path.instructions.find((i) => i.action === 'poly')
  const flat = (poly?.data[0] ?? []) as number[]
  const points: { x: number; y: number }[] = []
  for (let i = 0; i < flat.length; i += 2) points.push({ x: flat[i], y: flat[i + 1] })
  return points
}

function extent(points: { x: number; y: number }[]) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2 }
}

describe('drawDoors + drawWalls — distinguibilidade visual', () => {
  it('parede COM porta desenha o retângulo na camada de portas; parede SEM porta não produz nada', () => {
    const wallsGraphics = new Graphics()
    const doorsGraphics = new Graphics()
    const walls: Wall[] = [baseWall({ id: 'solid' }), doorWall({}, { id: 'withDoor', x1: 100, y1: 0, x2: 140, y2: 0 })]

    drawWalls(wallsGraphics, walls, null)
    drawDoors(doorsGraphics, walls, null)

    // A parede com porta não vira linha (o vão é da porta): só a sólida tem stroke.
    expect(strokeInstructions(wallsGraphics)).toHaveLength(1)
    expect(fillInstructions(doorsGraphics)).toHaveLength(1)
  })

  it('parede sem porta: drawDoors não desenha nada (graphics fica limpo)', () => {
    const g = new Graphics()
    drawDoors(g, [baseWall()], null)
    expect(g.context.instructions).toHaveLength(0)
  })
})

describe('drawDoors — retângulo chapado no vão (minimapa RE, 15/09/2026)', () => {
  it('fechada: 1 retângulo preenchido laranja, 60% do vão, 5 px de tela de espessura, centrado', () => {
    const g = new Graphics()
    drawDoors(g, [doorWall({}, { x1: 100, y1: 200, x2: 200, y2: 200 })], null)
    const fills = fillInstructions(g)
    expect(fills).toHaveLength(1)
    expect(strokeInstructions(g)).toHaveLength(0)
    expect((fills[0].data.style as { color: number }).color).toBe(DOOR_COLOR)
    const box = extent(polyPoints(fills[0]))
    expect(box.w).toBeCloseTo(100 * DOOR_LENGTH_RATIO, 9)
    expect(box.h).toBeCloseTo(DOOR_THICKNESS_SCREEN_PX, 9)
    // Centro alinhado ao meio do pixel físico (5 px é ímpar): no máximo meio pixel do meio do vão.
    expect(Math.abs(box.cx - 150)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(box.cy - 200)).toBeLessThanOrEqual(0.5)
  })

  it('trancada: preenchida em vermelho', () => {
    const g = new Graphics()
    drawDoors(g, [doorWall({ locked: true })], null)
    const fills = fillInstructions(g)
    expect(fills).toHaveLength(1)
    expect((fills[0].data.style as { color: number }).color).toBe(DOOR_LOCKED_COLOR)
  })

  it('aberta: só contorno laranja de 1,5 px de tela, sem preenchimento, dentro da mesma caixa', () => {
    const g = new Graphics()
    drawDoors(g, [doorWall({ open: true })], null)
    expect(fillInstructions(g)).toHaveLength(0)
    const [stroke] = strokeInstructions(g)
    expect(stroke.data.style.color).toBe(DOOR_COLOR)
    expect(stroke.data.style.width).toBeCloseTo(2 / 1, 9) // 1,5 px de tela arredonda para 2 px físicos a resolução 1
    const box = extent(polyPoints(stroke))
    expect(box.h + stroke.data.style.width).toBeCloseTo(DOOR_THICKNESS_SCREEN_PX, 9)
    expect(DOOR_OPEN_OUTLINE_SCREEN_PX).toBe(1.5)
  })

  it('todos os tipos (normal, dupla, portão) desenham o mesmo retângulo', () => {
    const shapes = (['normal', 'double', 'gate'] as const).map((kind) => {
      const g = new Graphics()
      drawDoors(g, [doorWall({ kind })], null)
      return polyPoints(fillInstructions(g)[0])
    })
    expect(shapes[1]).toEqual(shapes[0])
    expect(shapes[2]).toEqual(shapes[0])
  })

  it('espessura fixa na TELA: a 300% o retângulo tem 5/3 de mundo; o comprimento segue o vão', () => {
    const g = new Graphics()
    drawDoors(g, [doorWall({})], null, 3)
    const box = extent(polyPoints(fillInstructions(g)[0]))
    expect(box.h * 3).toBeCloseTo(DOOR_THICKNESS_SCREEN_PX, 9)
    expect(box.w).toBeCloseTo(40 * DOOR_LENGTH_RATIO, 9)
  })

  it('porta vertical: o retângulo gira com a parede', () => {
    const g = new Graphics()
    drawDoors(g, [doorWall({}, { x1: 0, y1: 0, x2: 0, y2: 40 })], null)
    const box = extent(polyPoints(fillInstructions(g)[0]))
    expect(box.h).toBeCloseTo(40 * DOOR_LENGTH_RATIO, 9)
    expect(box.w).toBeCloseTo(DOOR_THICKNESS_SCREEN_PX, 9)
  })
})

describe('drawDoors — seleção', () => {
  it('porta trancada selecionada: moldura SELECTION_COLOR por baixo, e o vermelho continua por cima', () => {
    const g = new Graphics()
    drawDoors(g, [doorWall({ locked: true }, { id: 'sel' })], 'sel')
    const [first, second] = g.context.instructions
    expect(first.action).toBe('stroke')
    expect((first.data.style as { color: number }).color).toBe(SELECTION_COLOR)
    expect(second.action).toBe('fill')
    expect((second.data.style as { color: number }).color).toBe(DOOR_LOCKED_COLOR)
    // Nada da porta real é pintado de amarelo.
    expect(fillInstructions(g).map((f) => (f.data.style as { color: number }).color)).toEqual([DOOR_LOCKED_COLOR])
  })

  it('moldura fica POR FORA do retângulo e tem 2 px de tela em qualquer zoom', () => {
    for (const scale of [1, 0.5]) {
      const g = new Graphics()
      drawDoors(g, [doorWall({}, { id: 'sel' })], 'sel', scale)
      const [outline] = strokeInstructions(g)
      const door = extent(polyPoints(fillInstructions(g)[0]))
      const ring = extent(polyPoints(outline))
      const width = outline.data.style.width
      expect(width * scale).toBeCloseTo(2, 9)
      // Borda interna da moldura = borda do retângulo: centro do traço a meia largura para fora.
      expect(ring.h - width).toBeCloseTo(door.h, 9)
      expect(ring.w - width).toBeCloseTo(door.w, 9)
    }
  })
})
