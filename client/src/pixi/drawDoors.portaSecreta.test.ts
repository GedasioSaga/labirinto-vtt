import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { DOOR_COLOR, DOOR_LENGTH_RATIO, DOOR_LOCKED_COLOR, SECRET_DOOR_DASHES, drawDoors } from './drawDoors'
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

describe('drawDoors: porta secreta tracejada', () => {
  it('secreta: SECRET_DOOR_DASHES pedaços separados por vão, dentro do retângulo da porta', () => {
    const g = new Graphics()
    drawDoors(g, [porta({ secret: true })])
    const dashes = fills(g).map(spanX).sort((a, b) => a.min - b.min)
    expect(SECRET_DOOR_DASHES).toBeGreaterThanOrEqual(3)
    expect(dashes).toHaveLength(SECRET_DOOR_DASHES)
    const half = (100 * DOOR_LENGTH_RATIO) / 2
    const first = dashes[0].min
    const last = dashes[dashes.length - 1].max
    // Mesmo comprimento do retângulo da porta comum; o centro só se alinha ao pixel (até meio px).
    expect(last - first).toBeCloseTo(2 * half, 5)
    expect(Math.abs((first + last) / 2 - 50)).toBeLessThanOrEqual(0.5)
    for (let i = 1; i < dashes.length; i += 1) {
      const gap = dashes[i].min - dashes[i - 1].max
      expect(gap).toBeGreaterThan(1)
    }
  })

  it('a cor continua dizendo o estado: trancada vermelha, destrancada laranja, aberta também tracejada', () => {
    const trancada = new Graphics()
    drawDoors(trancada, [porta({ secret: true, locked: true })])
    expect(fills(trancada).map(colorOf)).toEqual(Array.from({ length: SECRET_DOOR_DASHES }, () => DOOR_LOCKED_COLOR))
    const livre = new Graphics()
    drawDoors(livre, [porta({ secret: true })])
    expect(fills(livre).map(colorOf)).toEqual(Array.from({ length: SECRET_DOOR_DASHES }, () => DOOR_COLOR))
    const aberta = new Graphics()
    drawDoors(aberta, [porta({ secret: true, open: true })])
    expect(fills(aberta)).toHaveLength(SECRET_DOOR_DASHES)
  })

  it('porta comum continua um retângulo só', () => {
    const g = new Graphics()
    drawDoors(g, [porta({})])
    expect(fills(g)).toHaveLength(1)
  })
})
