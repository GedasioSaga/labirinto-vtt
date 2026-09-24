import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { DOOR_COLOR, drawDoors } from './drawDoors'
import type { DoorState, Wall } from '../types/map'

/**
 * Porta de um lado no editor do mestre: além do retângulo, uma seta no lado que
 * abre, apontando para a porta. Porta horizontal (0,0)->(100,0): 'right' é
 * embaixo (y > 0), 'left' é em cima.
 */
function porta(door: Partial<DoorState>): Wall {
  return { id: 'p', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal', ...door } }
}

type Instruction = Graphics['context']['instructions'][number]

function fills(g: Graphics): Instruction[] {
  return g.context.instructions.filter((i) => i.action === 'fill')
}

function ysOf(instruction: Instruction): number[] {
  if (instruction.action !== 'fill') throw new Error('não é fill')
  const poly = instruction.data.path.instructions.find((i) => i.action === 'poly')
  const flat = (poly?.data[0] ?? []) as number[]
  return flat.filter((_, i) => i % 2 === 1)
}

function colorOf(instruction: Instruction): number {
  if (instruction.action !== 'fill') throw new Error('não é fill')
  return instruction.data.style.color
}

describe('drawDoors: seta da porta de um lado', () => {
  it("'right': a seta fica embaixo, toda fora do retângulo da porta, na cor da porta", () => {
    const g = new Graphics()
    drawDoors(g, [porta({ opensFrom: 'right' })])
    const todos = fills(g)
    expect(todos).toHaveLength(2)
    const seta = todos[1]
    const ys = ysOf(seta)
    expect(ys.length).toBe(3)
    expect(ys.every((y) => y > 0)).toBe(true)
    expect(colorOf(seta)).toBe(DOOR_COLOR)
  })

  it("'left': a seta fica em cima", () => {
    const g = new Graphics()
    drawDoors(g, [porta({ opensFrom: 'left' })])
    const todos = fills(g)
    expect(todos).toHaveLength(2)
    expect(ysOf(todos[1]).every((y) => y < 0)).toBe(true)
  })

  it('a ponta da seta aponta para a porta (é o vértice mais perto da linha)', () => {
    const g = new Graphics()
    drawDoors(g, [porta({ opensFrom: 'right' })])
    const ys = ysOf(fills(g)[1])
    const ponta = Math.min(...ys)
    // Um vértice só na ponta; os dois da base ficam mais longe da porta, lado a lado.
    expect(ys.filter((y) => y === ponta)).toHaveLength(1)
    expect(ys.filter((y) => y > ponta)).toHaveLength(2)
  })

  it('porta dos dois lados continua sem seta', () => {
    const g = new Graphics()
    drawDoors(g, [porta({})])
    expect(fills(g)).toHaveLength(1)
  })
})
