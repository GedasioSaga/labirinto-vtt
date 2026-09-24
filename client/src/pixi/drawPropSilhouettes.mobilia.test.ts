import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { Prop } from '../types/map'
import { drawPropSilhouettes, PROP_SILHOUETTE_EDGE_ALPHA, PROP_SILHOUETTE_EDGE_COLOR } from './drawPropSilhouettes'
import { tracosDoGlifo } from '../lib/mobilia'

/**
 * MOBÍLIA DESENHADA na tela do jogador: o móvel com tipo ganha, por cima da
 * silhueta chapada, os traços finos do glifo (travesseiro do catre, tampo da
 * mesa, tampa e fecho do baú) — no mesmo fio claro e fino do contorno, nunca
 * preenchimento, hachura ou imagem.
 */

type Instruction = Graphics['context']['instructions'][number]

function strokes(g: Graphics): Instruction[] {
  return g.context.instructions.filter((i) => i.action === 'stroke')
}

function fills(g: Graphics): Instruction[] {
  return g.context.instructions.filter((i) => i.action === 'fill')
}

/** Pontos de cada `moveTo`/`lineTo` do path de um traço, na ordem. */
function pathPoints(instruction: Instruction | undefined, action: 'moveTo' | 'lineTo'): { x: number; y: number }[] {
  if (instruction === undefined || instruction.action !== 'stroke') throw new Error('esperava stroke')
  return instruction.data.path.instructions
    .filter((i) => i.action === action)
    .map((i) => {
      // `PathInstruction.data` é `any[]` no Pixi: conferido aqui em vez de confiado.
      const [x, y]: unknown[] = i.data
      if (typeof x !== 'number' || typeof y !== 'number') throw new Error(`${action} sem ponto`)
      return { x, y }
    })
}

function movel(extra: Partial<Prop> = {}): Prop {
  return { id: 'catre', src: '', x: 250, y: 200, width: 40, height: 80, linkedMapPath: null, mobilia: 'catre', ...extra }
}

describe('drawPropSilhouettes — glifo da mobília', () => {
  it('catre: silhueta de sempre e mais UM traço fino com o desenho do catre', () => {
    const g = new Graphics()
    expect(drawPropSilhouettes(g, [movel()], 1, 1)).toBe(1)

    expect(fills(g)).toHaveLength(1)
    const tracos = strokes(g)
    expect(tracos).toHaveLength(2)
    const glifo = tracos[1]
    if (glifo?.action !== 'stroke') throw new Error('esperava stroke')
    expect(glifo.data.style.color).toBe(PROP_SILHOUETTE_EDGE_COLOR)
    expect(glifo.data.style.alpha).toBe(PROP_SILHOUETTE_EDGE_ALPHA)
    expect(glifo.data.style.width).toBeCloseTo(1, 6)

    // Um segmento por traço do glifo, no lugar do móvel (centro 250,200).
    const esperado = tracosDoGlifo('catre', 40, 80)
    const inicios = pathPoints(glifo, 'moveTo')
    expect(inicios).toHaveLength(esperado.length)
    inicios.forEach((p, i) => {
      expect(p.x).toBeCloseTo(250 + esperado[i].x1, 6)
      expect(p.y).toBeCloseTo(200 + esperado[i].y1, 6)
    })
  })

  it('girado 90°, o glifo gira junto no sentido horário', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ rotation: 90 })], 1, 1)
    const esperado = tracosDoGlifo('catre', 40, 80)
    const inicios = pathPoints(strokes(g)[1], 'moveTo')
    expect(inicios.length).toBe(esperado.length)
    expect(inicios.length).toBeGreaterThan(0)
    // Horário na tela (y para baixo): (u, v) vira (−v, u).
    inicios.forEach((p, i) => {
      expect(p.x).toBeCloseTo(250 - esperado[i].y1, 6)
      expect(p.y).toBeCloseTo(200 + esperado[i].x1, 6)
    })
  })

  it('mesa e baú têm desenhos diferentes do catre', () => {
    const contar = (mobilia: Prop['mobilia']): number => {
      const g = new Graphics()
      drawPropSilhouettes(g, [movel({ mobilia, width: 60, height: 60 })], 1, 1)
      return pathPoints(strokes(g)[1], 'moveTo').length
    }
    expect(contar('mesa')).toBe(tracosDoGlifo('mesa', 60, 60).length)
    expect(contar('bau')).toBe(tracosDoGlifo('bau', 60, 60).length)
    expect(tracosDoGlifo('mesa', 60, 60)).not.toEqual(tracosDoGlifo('catre', 60, 60))
  })

  it('objeto comum (sem tipo) continua só com o contorno', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ mobilia: undefined })], 1, 1)
    expect(strokes(g)).toHaveLength(1)
  })
})
