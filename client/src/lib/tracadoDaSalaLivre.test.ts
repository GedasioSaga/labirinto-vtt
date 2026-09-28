import { describe, expect, it } from 'vitest'
import type { Point } from '../pixi/world'
import { arredondarTracado } from './arredondarTracado'
import { normalizeDraftPolygonPoints } from './drawingFactory'
import { tracadoDaSalaLivre } from './tracadoDaSalaLivre'

const A: Point = { x: 0, y: 0 }
const B: Point = { x: 200, y: 0 }
const C: Point = { x: 200, y: 100 }
const D: Point = { x: 0, y: 100 }

describe('tracadoDaSalaLivre', () => {
  describe('Sala', () => {
    it('limpa o clique repetido e o clique de volta no primeiro, e fecha com 3 cantos ou mais', () => {
      const cliques = [A, B, C, C, D, A]
      expect(tracadoDaSalaLivre(cliques, 'sala', false)).toEqual({
        pontos: normalizeDraftPolygonPoints(cliques),
        fechado: true,
      })
    })

    it('com menos de 3 cantos fica aberta: ainda não é sala', () => {
      expect(tracadoDaSalaLivre([A, B], 'sala', false)).toEqual({ pontos: [A, B], fechado: false })
    })

    it('com Arredondar é a MESMA curva que arredondarTracado dá para o contorno fechado', () => {
      const cliques = [A, B, C, D]
      const { pontos, fechado } = tracadoDaSalaLivre(cliques, 'sala', true)
      expect(fechado).toBe(true)
      expect(pontos).toEqual(arredondarTracado(normalizeDraftPolygonPoints(cliques), true))
    })

    it('com Arredondar e só 2 cantos, a linha continua reta', () => {
      expect(tracadoDaSalaLivre([A, B], 'sala', true)).toEqual({ pontos: [A, B], fechado: false })
    })
  })

  describe('Parede', () => {
    it('fica aberta quando o último clique não volta ao primeiro', () => {
      expect(tracadoDaSalaLivre([A, B, C], 'parede', false)).toEqual({ pontos: [A, B, C], fechado: false })
    })

    it('fecha quando o último clique cai no primeiro, sem repetir o canto', () => {
      expect(tracadoDaSalaLivre([A, B, C, A], 'parede', false)).toEqual({ pontos: [A, B, C], fechado: true })
    })

    it('duas pontas no mesmo lugar não fecham uma parede de um trecho só', () => {
      expect(tracadoDaSalaLivre([A, B, A], 'parede', false).fechado).toBe(false)
    })

    it('com Arredondar, aberta: as pontas ficam onde a pessoa clicou', () => {
      const { pontos, fechado } = tracadoDaSalaLivre([A, B, C], 'parede', true)
      expect(fechado).toBe(false)
      expect(pontos).toEqual(arredondarTracado([A, B, C], false))
      expect(pontos[0]).toEqual(A)
      expect(pontos[pontos.length - 1]).toEqual(C)
    })

    it('com Arredondar, fechada: o canto do primeiro clique também vira curva', () => {
      const { pontos, fechado } = tracadoDaSalaLivre([A, B, C, A], 'parede', true)
      expect(fechado).toBe(true)
      expect(pontos).toEqual(arredondarTracado([A, B, C], true))
      expect(pontos).not.toContainEqual(A)
    })
  })
})
