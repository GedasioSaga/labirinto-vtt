import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawStairs } from './drawStairs'
import { SELECTION_COLOR, STAIR_COLOR, STAIR_PLATE_COLOR } from './constants'
import { stairArcOf } from '../lib/stairCurve'
import type { Stair } from '../types/map'

function escada(overrides: Partial<Stair> = {}): Stair {
  return { id: 's1', shape: 'straight', direction: 'up', segments: [{ x1: 0, y1: 0, x2: 280, y2: 0 }], stepWidth: 70, ...overrides }
}

type Instrucao = Graphics['context']['instructions'][number]
type Pintura = Exclude<Instrucao, { action: 'texture' }>

function pinturas(g: Graphics): Pintura[] {
  return g.context.instructions.filter((i): i is Pintura => i.action === 'fill' || i.action === 'stroke')
}

/** Todos os pontos dos `poly` de uma pintura. */
function pontosDosPoligonos(p: Pintura): { x: number; y: number }[] {
  return p.data.path.instructions.flatMap((passo) => {
    if (passo.action !== 'poly') return []
    const dados = passo.data[0] as readonly number[] | readonly { x: number; y: number }[] // passo 'poly' do Pixi: o 1º dado é a lista de pontos; o tipo dele é a união de todos os passos
    const pontos: { x: number; y: number }[] = []
    for (let i = 0; i < dados.length; i += 1) {
      const dado = dados[i]
      if (typeof dado === 'number') {
        if (i % 2 === 0) pontos.push({ x: dado, y: dados[i + 1] as number }) // lista plana x, y, x, y: o par de um número é número
      } else pontos.push(dado)
    }
    return pontos
  })
}

describe('drawStairs — escada curva', () => {
  it('as mesmas quatro camadas da reta: placa, patamar, degraus e moldura', () => {
    const reta = new Graphics()
    const curva = new Graphics()
    drawStairs(reta, [escada()])
    drawStairs(curva, [escada({ curva: 100 })])
    const forma = (g: Graphics) => pinturas(g).map((p) => `${p.action}:${p.data.style.color}`)
    expect(forma(curva)).toEqual(forma(reta))
    expect(pinturas(curva)[0].data.style.color).toBe(STAIR_PLATE_COLOR)
    expect(pinturas(curva).at(-1)?.data.style.color).toBe(STAIR_COLOR)
  })

  it('a placa pintada é o anel do arco, não o retângulo da corda', () => {
    const g = new Graphics()
    drawStairs(g, [escada({ curva: 100 })])
    const arco = stairArcOf({ x1: 0, y1: 0, x2: 280, y2: 0 }, 100)
    if (arco === null) throw new Error('sem arco')
    const placa = pontosDosPoligonos(pinturas(g)[0])
    expect(placa.length).toBeGreaterThan(8)
    for (const p of placa) {
      const d = Math.hypot(p.x - arco.center.x, p.y - arco.center.y)
      expect(d).toBeGreaterThan(arco.radius - 35 - 1e-6)
      expect(d).toBeLessThan(arco.radius + 35 + 1e-6)
    }
    // O meio do arco desce até y = 100 + meia largura: a reta nunca passaria de 35.
    expect(Math.max(...placa.map((p) => p.y))).toBeCloseTo(135, 6)
  })

  it('selecionada, ganha o anel amarelo por fora, antes de tudo', () => {
    const g = new Graphics()
    drawStairs(g, [escada({ curva: 100 })], 's1')
    expect(pinturas(g)[0].action).toBe('stroke')
    expect(pinturas(g)[0].data.style.color).toBe(SELECTION_COLOR)
  })

  it('espiral com curva guardada continua o círculo de sempre', () => {
    const comCurva = new Graphics()
    const semCurva = new Graphics()
    drawStairs(comCurva, [escada({ shape: 'spiral', curva: 100 })])
    drawStairs(semCurva, [escada({ shape: 'spiral' })])
    expect(comCurva.context.instructions.length).toBe(semCurva.context.instructions.length)
  })
})
