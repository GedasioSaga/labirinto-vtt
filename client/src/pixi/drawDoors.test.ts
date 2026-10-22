import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { DOOR_COLOR, DOOR_EDGE_COLOR, DOOR_EDGE_SCREEN_PX, DOOR_LENGTH_RATIO, DOOR_LOCKED_COLOR, DOOR_OPEN_OUTLINE_SCREEN_PX, DOOR_THICKNESS_SCREEN_PX, drawDoors } from './drawDoors'
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

function fillColors(g: Graphics): number[] {
  return fillInstructions(g).map((f) => (f.data.style as { color: number }).color)
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
  it('parede COM porta desenha a folha na camada de portas; parede SEM porta não produz nada', () => {
    const wallsGraphics = new Graphics()
    const doorsGraphics = new Graphics()
    const walls: Wall[] = [baseWall({ id: 'solid' }), doorWall({}, { id: 'withDoor', x1: 100, y1: 0, x2: 140, y2: 0 })]

    drawWalls(wallsGraphics, walls, null)
    drawDoors(doorsGraphics, walls, null)

    // A parede com porta não vira linha (o vão é da porta): só a sólida tem stroke.
    expect(strokeInstructions(wallsGraphics)).toHaveLength(1)
    // A folha: o contorno escuro por baixo e a cor por cima, nada mais.
    expect(fillColors(doorsGraphics)).toEqual([DOOR_EDGE_COLOR, DOOR_COLOR])
  })

  it('parede sem porta: drawDoors não desenha nada (graphics fica limpo)', () => {
    const g = new Graphics()
    drawDoors(g, [baseWall()], null)
    expect(g.context.instructions).toHaveLength(0)
  })
})

/*
 * Valores de ouro conferidos à mão contra o protótipo consolidado
 * (`docs/design/consolidado/prototipo/css/consolidado.css`, `.mapa .porta-folha`:
 * fill #d9d2c0, stroke #15181a, stroke-width 1; `portaSVG` em js/app.js: o rect
 * tem o comprimento INTEIRO do vão e 4 de altura). O stroke do SVG é centrado
 * na borda: por fora, 4 + 1 = 5 px de espessura e o vão + 1 de comprimento; a
 * cor por dentro, 4 - 1 = 3 px e o vão - 1.
 */
describe('drawDoors — a folha creme com contorno escuro, no vão inteiro (22/10/2026)', () => {
  it('os números do desenho: creme #d9d2c0, contorno #15181a de 1 px, trancada #e2645a, vão inteiro, 4 px de espessura', () => {
    expect(DOOR_COLOR).toBe(0xd9d2c0)
    expect(DOOR_EDGE_COLOR).toBe(0x15181a)
    expect(DOOR_EDGE_SCREEN_PX).toBe(1)
    expect(DOOR_LOCKED_COLOR).toBe(0xe2645a)
    expect(DOOR_LENGTH_RATIO).toBe(1)
    expect(DOOR_THICKNESS_SCREEN_PX).toBe(4)
    expect(DOOR_OPEN_OUTLINE_SCREEN_PX).toBe(1)
  })

  it('fechada: o escuro de 101 x 5 por fora e o creme de 99 x 3 por dentro, num vão de 100, centrados', () => {
    const g = new Graphics()
    drawDoors(g, [doorWall({}, { x1: 100, y1: 200, x2: 200, y2: 200 })], null)
    expect(strokeInstructions(g)).toHaveLength(0)
    const [fora, dentro] = fillInstructions(g)
    expect(fillColors(g)).toEqual([DOOR_EDGE_COLOR, DOOR_COLOR])
    const caixaFora = extent(polyPoints(fora))
    const caixaDentro = extent(polyPoints(dentro))
    expect(caixaFora.w).toBeCloseTo(101, 9)
    expect(caixaFora.h).toBeCloseTo(5, 9)
    expect(caixaDentro.w).toBeCloseTo(99, 9)
    expect(caixaDentro.h).toBeCloseTo(3, 9)
    // Centro no meio do pixel físico (a caixa de fora tem 5 px, ímpar): no máximo meio pixel do meio do vão.
    expect(Math.abs(caixaFora.cx - 150)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(caixaFora.cy - 200)).toBeLessThanOrEqual(0.5)
    expect(caixaDentro.cx).toBeCloseTo(caixaFora.cx, 9)
    expect(caixaDentro.cy).toBeCloseTo(caixaFora.cy, 9)
    // As duas bordas da espessura caem em pixel físico inteiro: nítidas, sem meio pixel borrado.
    for (const caixa of [caixaFora, caixaDentro]) {
      const topo = caixa.cy - caixa.h / 2
      expect(topo - Math.round(topo)).toBeCloseTo(0, 9)
    }
  })

  it('trancada: a mesma folha em vermelho, com o contorno escuro', () => {
    const g = new Graphics()
    drawDoors(g, [doorWall({ locked: true })], null)
    expect(fillColors(g)).toEqual([DOOR_EDGE_COLOR, DOOR_LOCKED_COLOR])
  })

  it('aberta: a mesma caixa, com o miolo vazado em escuro; sobra 1 px creme de cada lado', () => {
    const g = new Graphics()
    drawDoors(g, [doorWall({ open: true }, { x1: 100, y1: 200, x2: 200, y2: 200 })], null)
    expect(strokeInstructions(g)).toHaveLength(0)
    expect(fillColors(g)).toEqual([DOOR_EDGE_COLOR, DOOR_COLOR, DOOR_EDGE_COLOR])
    const [fora, cor, miolo] = fillInstructions(g).map((f) => extent(polyPoints(f)))
    expect(fora.h).toBeCloseTo(5, 9)
    expect(cor.h).toBeCloseTo(3, 9)
    // 3 px de cor menos 1 px de cada lado = 1 px de miolo; no comprimento, 99 - 2.
    expect(miolo.h).toBeCloseTo(1, 9)
    expect(miolo.w).toBeCloseTo(97, 9)
  })

  it('todos os tipos (normal, dupla, portão) desenham a mesma folha', () => {
    const shapes = (['normal', 'double', 'gate'] as const).map((kind) => {
      const g = new Graphics()
      drawDoors(g, [doorWall({ kind })], null)
      return fillInstructions(g).map(polyPoints)
    })
    expect(shapes[1]).toEqual(shapes[0])
    expect(shapes[2]).toEqual(shapes[0])
  })

  it('espessura fixa na TELA: a 300% a folha tem 4/3 de mundo e o contorno 1/3; o comprimento segue o vão', () => {
    const g = new Graphics()
    drawDoors(g, [doorWall({})], null, 3)
    const [fora, dentro] = fillInstructions(g).map((f) => extent(polyPoints(f)))
    expect(fora.h * 3).toBeCloseTo(DOOR_THICKNESS_SCREEN_PX + DOOR_EDGE_SCREEN_PX, 9)
    expect(dentro.h * 3).toBeCloseTo(DOOR_THICKNESS_SCREEN_PX - DOOR_EDGE_SCREEN_PX, 9)
    expect(fora.w).toBeCloseTo(40 + 1 / 3, 9)
  })

  it('resolução 2: a folha tem 8 px físicos e o contorno 2, ainda 4 e 1 px de tela', () => {
    const g = new Graphics()
    drawDoors(g, [doorWall({})], null, 1, 2)
    const [fora, dentro] = fillInstructions(g).map((f) => extent(polyPoints(f)))
    expect(fora.h * 2).toBeCloseTo(10, 9)
    expect(dentro.h * 2).toBeCloseTo(6, 9)
  })

  it('porta vertical: a folha gira com a parede', () => {
    const g = new Graphics()
    drawDoors(g, [doorWall({}, { x1: 0, y1: 0, x2: 0, y2: 40 })], null)
    const [fora] = fillInstructions(g).map((f) => extent(polyPoints(f)))
    expect(fora.h).toBeCloseTo(41, 9)
    expect(fora.w).toBeCloseTo(5, 9)
  })
})

describe('drawDoors — seleção', () => {
  it('porta trancada selecionada: moldura SELECTION_COLOR por baixo, e a folha vermelha continua por cima', () => {
    const g = new Graphics()
    drawDoors(g, [doorWall({ locked: true }, { id: 'sel' })], 'sel')
    const [first] = g.context.instructions
    expect(first.action).toBe('stroke')
    expect((first.data.style as { color: number }).color).toBe(SELECTION_COLOR)
    // Nada da porta real é pintado de amarelo.
    expect(fillColors(g)).toEqual([DOOR_EDGE_COLOR, DOOR_LOCKED_COLOR])
  })

  it('moldura fica POR FORA do contorno escuro e tem 2 px de tela em qualquer zoom', () => {
    for (const scale of [1, 0.5]) {
      const g = new Graphics()
      drawDoors(g, [doorWall({}, { id: 'sel' })], 'sel', scale)
      const [outline] = strokeInstructions(g)
      const door = extent(polyPoints(fillInstructions(g)[0]))
      const ring = extent(polyPoints(outline))
      const width = outline.data.style.width
      expect(width * scale).toBeCloseTo(2, 9)
      // Borda interna da moldura = borda de fora da porta: centro do traço a meia largura para fora.
      expect(ring.h - width).toBeCloseTo(door.h, 9)
      expect(ring.w - width).toBeCloseTo(door.w, 9)
    }
  })
})
