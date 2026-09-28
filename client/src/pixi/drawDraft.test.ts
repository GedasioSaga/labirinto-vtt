import { Graphics } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { tracadoDaSalaLivre } from '../lib/tracadoDaSalaLivre'
import { drawRegionDraft } from './drawDraft'
import type { Point } from './world'

const A: Point = { x: 0, y: 0 }
const B: Point = { x: 200, y: 0 }
const C: Point = { x: 200, y: 100 }
const CURSOR: Point = { x: 0, y: 100 }

/** A linha da prévia: os pontos por onde ela passa e se ela volta ao começo. */
function linhaDaPrevia(g: Graphics): { pontos: Point[]; fechada: boolean } {
  const stroke = g.context.instructions.find((instruction) => instruction.action === 'stroke')
  if (!stroke || stroke.action !== 'stroke') throw new Error('a prévia deveria desenhar uma linha')
  const pontos = stroke.data.path.instructions.flatMap((i) => {
    if (i.action !== 'moveTo' && i.action !== 'lineTo') return []
    const [x, y] = i.data
    return typeof x === 'number' && typeof y === 'number' ? [{ x, y }] : []
  })
  const fechada = stroke.data.path.instructions.some((i) => i.action === 'closePath')
  return { pontos, fechada }
}

/** Centro de cada bolinha que marca um clique. */
function centrosDasBolinhas(g: Graphics): Point[] {
  return g.context.instructions.flatMap((instruction) => {
    if (instruction.action !== 'fill') return []
    return instruction.data.path.instructions
      .filter((p) => p.action === 'circle')
      .map((p) => {
        const [x, y] = p.data as number[]
        return { x, y }
      })
  })
}

describe('drawRegionDraft', () => {
  it('Região: linha aberta pelos cliques até o cursor', () => {
    const g = new Graphics()
    drawRegionDraft(g, [A, B, C], CURSOR)
    expect(linhaDaPrevia(g)).toEqual({ pontos: [A, B, C, CURSOR], fechada: false })
  })

  it('sem clique nenhum não desenha nada', () => {
    const g = new Graphics()
    drawRegionDraft(g, [], CURSOR, { modo: 'sala', arredondar: true })
    expect(g.context.instructions).toHaveLength(0)
  })

  describe('Sala livre com Arredondar', () => {
    it('Sala: mostra a MESMA curva fechada que vai ser gravada, com o cursor como próximo canto', () => {
      const g = new Graphics()
      drawRegionDraft(g, [A, B, C], CURSOR, { modo: 'sala', arredondar: true })
      const gravada = tracadoDaSalaLivre([A, B, C, CURSOR], 'sala', true)
      expect(gravada.fechado).toBe(true)
      expect(linhaDaPrevia(g)).toEqual({ pontos: gravada.pontos, fechada: true })
    })

    it('Sala: logo depois do clique, sem cursor, a curva fechada é a dos cliques', () => {
      const g = new Graphics()
      drawRegionDraft(g, [A, B, C], null, { modo: 'sala', arredondar: true })
      expect(linhaDaPrevia(g)).toEqual({ pontos: tracadoDaSalaLivre([A, B, C], 'sala', true).pontos, fechada: true })
    })

    it('Sala com um clique só: ainda é uma linha reta até o cursor', () => {
      const g = new Graphics()
      drawRegionDraft(g, [A], B, { modo: 'sala', arredondar: true })
      expect(linhaDaPrevia(g)).toEqual({ pontos: [A, B], fechada: false })
    })

    it('Parede aberta: a curva que vai ser gravada, com as pontas no primeiro clique e no cursor', () => {
      const g = new Graphics()
      drawRegionDraft(g, [A, B, C], CURSOR, { modo: 'parede', arredondar: true })
      const gravada = tracadoDaSalaLivre([A, B, C, CURSOR], 'parede', true)
      expect(gravada.fechado).toBe(false)
      expect(linhaDaPrevia(g)).toEqual({ pontos: gravada.pontos, fechada: false })
    })

    it('Parede com o cursor no primeiro clique: mostra o contorno fechado, arredondado também ali', () => {
      const g = new Graphics()
      drawRegionDraft(g, [A, B, C], A, { modo: 'parede', arredondar: true })
      const gravada = tracadoDaSalaLivre([A, B, C, A], 'parede', true)
      expect(gravada.fechado).toBe(true)
      expect(linhaDaPrevia(g)).toEqual({ pontos: gravada.pontos, fechada: true })
    })

    it('as bolinhas continuam nos cliques, que é onde a pessoa mira o próximo', () => {
      const g = new Graphics()
      drawRegionDraft(g, [A, B, C], CURSOR, { modo: 'sala', arredondar: true })
      expect(centrosDasBolinhas(g)).toEqual([A, B, C])
    })
  })

  it('Sala livre com Arredondar desligado: a linha aberta de sempre', () => {
    const g = new Graphics()
    drawRegionDraft(g, [A, B, C], CURSOR, { modo: 'sala', arredondar: false })
    expect(linhaDaPrevia(g)).toEqual({ pontos: [A, B, C, CURSOR], fechada: false })
  })
})
