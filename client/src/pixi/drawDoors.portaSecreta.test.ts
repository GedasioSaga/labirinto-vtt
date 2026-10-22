import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { DOOR_COLOR, DOOR_EDGE_COLOR, DOOR_EDGE_SCREEN_PX, DOOR_LENGTH_RATIO, DOOR_LOCKED_COLOR, SECRET_DOOR_DASHES, drawDoors } from './drawDoors'
import type { DoorState, Wall } from '../types/map'

/** Porta secreta no editor do mestre: o mesmo retângulo, TRACEJADO (pedaços com vão entre eles). */
function porta(door: Partial<DoorState>): Wall {
  return { id: 'p', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal', ...door } }
}

type Instruction = Graphics['context']['instructions'][number]

function fills(g: Graphics): Instruction[] {
  return g.context.instructions.filter((i) => i.action === 'fill')
}

/** Faixa em x do primeiro `poly` do path da instrução. */
function spanX(instruction: Instruction): { min: number; max: number } {
  if (instruction.action !== 'fill' && instruction.action !== 'stroke') throw new Error('instrução sem path')
  const poly = instruction.data.path.instructions.find((i) => i.action === 'poly')
  const flat = (poly?.data[0] ?? []) as number[]
  const xs = flat.filter((_, i) => i % 2 === 0)
  return { min: Math.min(...xs), max: Math.max(...xs) }
}

function colorOf(instruction: Instruction): number {
  if (instruction.action !== 'fill') throw new Error('não é fill')
  return instruction.data.style.color
}

/** Os traços com a cor da porta (o contorno escuro de cada um vai antes, em `DOOR_EDGE_COLOR`). */
function coloridos(g: Graphics): Instruction[] {
  return fills(g).filter((i) => colorOf(i) !== DOOR_EDGE_COLOR)
}

describe('drawDoors: porta secreta tracejada', () => {
  it('secreta: SECRET_DOOR_DASHES pedaços separados por vão, cobrindo o vão inteiro como a porta comum', () => {
    const g = new Graphics()
    drawDoors(g, [porta({ secret: true })])
    const contornos = fills(g).filter((i) => colorOf(i) === DOOR_EDGE_COLOR).map(spanX).sort((a, b) => a.min - b.min)
    expect(SECRET_DOOR_DASHES).toBeGreaterThanOrEqual(3)
    expect(contornos).toHaveLength(SECRET_DOOR_DASHES)
    expect(coloridos(g)).toHaveLength(SECRET_DOOR_DASHES)
    const half = (100 * DOOR_LENGTH_RATIO) / 2
    const first = contornos[0].min
    const last = contornos[contornos.length - 1].max
    // O vão inteiro mais meio contorno de cada ponta (1 px de tela a 100%); o centro só se alinha ao pixel.
    expect(last - first).toBeCloseTo(2 * half + DOOR_EDGE_SCREEN_PX, 5)
    expect(Math.abs((first + last) / 2 - 50)).toBeLessThanOrEqual(0.5)
    for (let i = 1; i < contornos.length; i += 1) {
      const gap = contornos[i].min - contornos[i - 1].max
      expect(gap).toBeGreaterThan(1)
    }
  })

  it('a cor continua dizendo o estado: trancada vermelha, destrancada creme, aberta também tracejada', () => {
    const trancada = new Graphics()
    drawDoors(trancada, [porta({ secret: true, locked: true })])
    expect(coloridos(trancada).map(colorOf)).toEqual(Array.from({ length: SECRET_DOOR_DASHES }, () => DOOR_LOCKED_COLOR))
    const livre = new Graphics()
    drawDoors(livre, [porta({ secret: true })])
    expect(coloridos(livre).map(colorOf)).toEqual(Array.from({ length: SECRET_DOOR_DASHES }, () => DOOR_COLOR))
    const aberta = new Graphics()
    drawDoors(aberta, [porta({ secret: true, open: true })])
    expect(fills(aberta).map(colorOf)).toEqual(fills(livre).map(colorOf))
  })

  it('porta comum continua uma folha só: o contorno e a cor', () => {
    const g = new Graphics()
    drawDoors(g, [porta({})])
    expect(fills(g).map(colorOf)).toEqual([DOOR_EDGE_COLOR, DOOR_COLOR])
  })
})
