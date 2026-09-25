import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { DOOR_COLOR, DOOR_TO_CROSS_COLOR, DOOR_TO_CROSS_DOT_SCREEN_PX, drawDoors } from './drawDoors'
import type { Wall } from '../types/map'

/**
 * PORTAS POR ATRAVESSAR na tela do jogador: a porta marcada ganha um ponto
 * claro pequeno no meio do retângulo — estilo minimapa, sem ícone nem halo. A
 * porta sem marca desenha exatamente como sempre.
 */

function porta(id: string, x: number, open = false): Wall {
  return { id, x1: x, y1: 0, x2: x + 40, y2: 0, blocksLight: true, blocksMove: true, door: { open, locked: false, kind: 'normal' } }
}

function fills(g: Graphics) {
  return g.context.instructions.filter((i) => i.action === 'fill')
}

function circulos(g: Graphics) {
  return fills(g).flatMap((i) => {
    if (i.action !== 'fill') return []
    return i.data.path.instructions.filter((p) => p.action === 'circle').map((p) => ({ data: p.data as number[], color: i.data.style.color }))
  })
}

describe('drawDoors: marca de porta por atravessar', () => {
  it('sem marca, nenhum ponto: o desenho de sempre', () => {
    const g = new Graphics()
    drawDoors(g, [porta('pa', 0), porta('pb', 100)], null)
    expect(circulos(g)).toEqual([])
    expect(fills(g)).toHaveLength(2)
  })

  it('porta marcada ganha UM ponto claro no meio do vão; a outra fica igual', () => {
    const g = new Graphics()
    drawDoors(g, [porta('pa', 0), porta('pb', 100)], null, 1, 1, new Set(['pb']))
    const pontos = circulos(g)
    expect(pontos).toHaveLength(1)
    const [cx, cy, raio] = pontos[0].data
    // Centro alinhado ao pixel físico, como o retângulo da porta: até meio pixel do meio exato.
    expect(Math.abs(cx - 120)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(cy)).toBeLessThanOrEqual(0.5)
    expect(raio).toBeGreaterThan(0)
    expect(raio).toBeLessThanOrEqual(DOOR_TO_CROSS_DOT_SCREEN_PX)
    expect(pontos[0].color).toBe(DOOR_TO_CROSS_COLOR)
    expect(DOOR_TO_CROSS_COLOR).not.toBe(DOOR_COLOR)
  })

  it('porta aberta marcada também leva o ponto (a folha aberta é só contorno)', () => {
    const g = new Graphics()
    drawDoors(g, [porta('pa', 0, true)], null, 2, 1, new Set(['pa']))
    expect(circulos(g)).toHaveLength(1)
  })

  it('parede sem porta com o id na lista não ganha ponto', () => {
    const g = new Graphics()
    const muro: Wall = { ...porta('muro', 0), door: null }
    drawDoors(g, [muro], null, 1, 1, new Set(['muro']))
    expect(circulos(g)).toEqual([])
  })
})
