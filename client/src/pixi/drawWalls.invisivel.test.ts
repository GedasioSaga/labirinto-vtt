import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawWalls, PAREDE_INVISIVEL_ALPHA, WALL_COLOR, type WallWithStyle } from './drawWalls'

/**
 * PAREDE INVISÍVEL (`Wall.hidden`): o jogador não vê nada mas bate nela; o
 * mestre a vê tracejada, fina e fraca, na cor da parede — distinguível da
 * passagem tracejada (que é a parede inteira, só que em traços).
 */
function strokes(g: Graphics) {
  return g.context.instructions.filter((instruction) => instruction.action === 'stroke')
}

function estilo(stroke: ReturnType<typeof strokes>[number] | undefined) {
  if (stroke?.action !== 'stroke') throw new Error('stroke ausente')
  return stroke.data.style
}

function pedacos(stroke: ReturnType<typeof strokes>[number] | undefined): number {
  if (stroke?.action !== 'stroke') throw new Error('stroke ausente')
  return stroke.data.path.instructions.filter((i) => i.action === 'moveTo').length
}

function parede(overrides: Partial<WallWithStyle> = {}): WallWithStyle {
  return { id: 'w', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, ...overrides }
}

describe('drawWalls — parede invisível', () => {
  it('o mestre vê tracejada, fina e fraca, na cor escolhida', () => {
    const g = new Graphics()
    drawWalls(g, [parede({ hidden: true, color: '#ff0000', thickness: 'thick' })], null, 1, 1, null, true)
    const todos = strokes(g)
    expect(todos).toHaveLength(1)
    expect(pedacos(todos[0])).toBeGreaterThan(5)
    const { color, alpha, width } = estilo(todos[0])
    expect(color).toBe(0xff0000)
    expect(alpha).toBe(PAREDE_INVISIVEL_ALPHA)
    expect(alpha).toBeLessThan(1)
    expect(width).toBeLessThanOrEqual(1)
  })

  it('é distinguível da passagem: mais fina, mais fraca e com traços mais curtos', () => {
    const invisivel = new Graphics()
    drawWalls(invisivel, [parede({ hidden: true })], null, 1, 1, null, true)
    const passagem = new Graphics()
    drawWalls(passagem, [parede({ blocksMove: false })], null, 1, 1, null, true)
    const [traco] = strokes(invisivel)
    const [tracoDaPassagem] = strokes(passagem)
    expect(estilo(traco).width).toBeLessThan(estilo(tracoDaPassagem).width)
    expect(estilo(traco).alpha).toBeLessThan(estilo(tracoDaPassagem).alpha)
    expect(pedacos(traco)).toBeGreaterThan(pedacos(tracoDaPassagem))
  })

  it('na tela do jogador não sai nada (nem se a parede chegasse até lá)', () => {
    const g = new Graphics()
    drawWalls(g, [parede({ hidden: true }), parede({ id: 'j', hidden: true, janela: true })], null)
    expect(strokes(g)).toHaveLength(0)
  })

  it('não entra no traço contínuo da vizinha visível, que segue um traço inteiro só', () => {
    const g = new Graphics()
    drawWalls(g, [parede({ hidden: true }), parede({ id: 'v', x1: 100, x2: 200 })], null, 1, 1, null, true)
    const todos = strokes(g)
    expect(todos).toHaveLength(2)
    const inteiro = todos.find((s) => pedacos(s) === 1)
    expect(estilo(inteiro).color).toBe(WALL_COLOR)
    expect(estilo(inteiro).alpha).toBe(1)
  })

  it('janela invisível sai como parede invisível, não como janela', () => {
    const g = new Graphics()
    drawWalls(g, [parede({ hidden: true, janela: true })], null, 1, 1, null, true)
    const todos = strokes(g)
    expect(todos).toHaveLength(1)
    expect(estilo(todos[0]).alpha).toBe(PAREDE_INVISIVEL_ALPHA)
  })
})
