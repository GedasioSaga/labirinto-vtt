/**
 * ROTA DE PATRULHA — a configuração da patrulha automática (velocidade e modo
 * da ronda) mora na própria rota, é opcional e chega crua do disco: mapa
 * antigo sem ela continua igual, valor torto sai ou volta para a faixa.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token, TokenPatrol } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { applyPatrolOp, readTokenPatrol, setPatrolConfig, VELOCIDADE_MAXIMA, VELOCIDADE_MINIMA } from './npcPatrol'

const PONTOS = [
  { x: 100, y: 100 },
  { x: 300, y: 100 },
]

function mesa(patrulha?: TokenPatrol): MapData {
  const ficha: Token = { id: 'guarda', characterId: null, name: 'Guarda', x: 300, y: 300, size: 1, image: null, ...(patrulha === undefined ? {} : { patrulha }) }
  return { ...createEmptyMap('m', 'M', 1000, 1000, 50), tokens: [ficha] }
}

describe('readTokenPatrol — velocidade e modo', () => {
  it('mapa antigo, sem configuração: a rota fica como era', () => {
    expect(readTokenPatrol({ pontos: PONTOS, atual: 1 })).toEqual({ pontos: PONTOS, atual: 1 })
  })

  it('guarda velocidade e modo válidos', () => {
    expect(readTokenPatrol({ pontos: PONTOS, atual: 0, velocidade: 3, modo: 'vai-e-volta' })).toEqual({ pontos: PONTOS, atual: 0, velocidade: 3, modo: 'vai-e-volta' })
    expect(readTokenPatrol({ pontos: PONTOS, atual: 0, modo: 'circuito' })?.modo).toBe('circuito')
  })

  it('velocidade fora da faixa volta para dentro; torta sai', () => {
    expect(readTokenPatrol({ pontos: PONTOS, atual: 0, velocidade: 100 })?.velocidade).toBe(VELOCIDADE_MAXIMA)
    expect(readTokenPatrol({ pontos: PONTOS, atual: 0, velocidade: 0.01 })?.velocidade).toBe(VELOCIDADE_MINIMA)
    expect(readTokenPatrol({ pontos: PONTOS, atual: 0, velocidade: 'rápido' })).not.toHaveProperty('velocidade')
    expect(readTokenPatrol({ pontos: PONTOS, atual: 0, velocidade: Number.NaN })).not.toHaveProperty('velocidade')
  })

  it('modo desconhecido sai', () => {
    expect(readTokenPatrol({ pontos: PONTOS, atual: 0, modo: 'zigue-zague' })).not.toHaveProperty('modo')
  })
})

describe('setPatrolConfig', () => {
  it('troca velocidade e modo sem mexer nos pontos', () => {
    const depois = setPatrolConfig(mesa({ pontos: PONTOS, atual: 1 }), 'guarda', { velocidade: 4, modo: 'vai-e-volta' })
    expect(depois.tokens[0]?.patrulha).toEqual({ pontos: PONTOS, atual: 1, velocidade: 4, modo: 'vai-e-volta' })
  })

  it('velocidade fora da faixa entra presa a ela', () => {
    expect(setPatrolConfig(mesa({ pontos: PONTOS, atual: 0 }), 'guarda', { velocidade: 50 }).tokens[0]?.patrulha?.velocidade).toBe(VELOCIDADE_MAXIMA)
  })

  it('nada muda (mesmo valor, sem rota, ficha que não existe): o MESMO mapa', () => {
    const comRota = mesa({ pontos: PONTOS, atual: 0, velocidade: 3 })
    expect(setPatrolConfig(comRota, 'guarda', { velocidade: 3 })).toBe(comRota)
    const semRota = mesa()
    expect(setPatrolConfig(semRota, 'guarda', { velocidade: 3 })).toBe(semRota)
    expect(setPatrolConfig(comRota, 'outro', { velocidade: 4 })).toBe(comRota)
  })

  it('marcar e tirar ponto não perdem a configuração', () => {
    const map = mesa({ pontos: PONTOS, atual: 0, velocidade: 4, modo: 'vai-e-volta' })
    const marcado = applyPatrolOp(map, 'guarda', 'marcar')
    expect(marcado.tokens[0]?.patrulha).toMatchObject({ velocidade: 4, modo: 'vai-e-volta' })
    const tirado = applyPatrolOp(marcado, 'guarda', 'desfazer')
    expect(tirado.tokens[0]?.patrulha).toMatchObject({ velocidade: 4, modo: 'vai-e-volta' })
  })
})
