import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawWalls, WALL_COLOR, wallColorFor, type WallWithStyle } from './drawWalls'

/** Cor da parede e a passagem tracejada que só o editor do mestre mostra. */
function strokes(g: Graphics) {
  return g.context.instructions.filter((instruction) => instruction.action === 'stroke')
}

function parede(overrides: Partial<WallWithStyle> = {}): WallWithStyle {
  return { id: 'w', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, ...overrides }
}

describe('drawWalls — cor e passagem', () => {
  it('a parede sai na cor escolhida; texto inválido cai na padrão', () => {
    const g = new Graphics()
    drawWalls(g, [parede({ color: '#ff0000' })], null)
    const [traco] = strokes(g)
    if (traco?.action !== 'stroke') throw new Error('stroke ausente')
    expect(traco.data.style.color).toBe(0xff0000)
    expect(wallColorFor({ color: 'vermelho' })).toBe(WALL_COLOR)
    expect(wallColorFor({})).toBe(WALL_COLOR)
  })

  it('cores diferentes quebram o traço contínuo', () => {
    const g = new Graphics()
    drawWalls(g, [parede({ color: '#ff0000' }), parede({ id: 'b', x1: 100, x2: 200 })], null)
    expect(strokes(g)).toHaveLength(2)
  })

  it('no editor a parede que deixa passar sai tracejada; no jogador, linha inteira', () => {
    const passagem = parede({ blocksMove: false })
    const editor = new Graphics()
    drawWalls(editor, [passagem], null, 1, 1, null, true)
    const [tracejado] = strokes(editor)
    if (tracejado?.action !== 'stroke') throw new Error('stroke ausente')
    const pedacos = tracejado.data.path.instructions.filter((i) => i.action === 'moveTo')
    expect(pedacos.length).toBeGreaterThan(5)

    const jogador = new Graphics()
    drawWalls(jogador, [passagem], null)
    const [linha] = strokes(jogador)
    if (linha?.action !== 'stroke') throw new Error('stroke ausente')
    expect(linha.data.path.instructions.filter((i) => i.action === 'moveTo')).toHaveLength(1)
  })
})
