import { describe, expect, it } from 'vitest'
import type { ConcealZone, MapData, Stair, Token } from '../types/map'
import { filterMapForPlayer, type SecretReveals } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * REVELAR PARA OS ESCOLHIDOS no recorte do jogador: a ficha secreta, a escada
 * secreta e a zona oculta ganham uma lista de quem descobriu. Só quem está na
 * lista recebe — a ficha ainda exige visão —, e quem está ao lado, fora dela,
 * não recebe nem o id.
 */

const RAIO = 300
const POSSE = { ana: ['ficha-ana'], duda: ['ficha-duda'] }

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function escada(id: string, x1: number, x2: number, y: number, extra: Partial<Stair> = {}): Stair {
  return { id, shape: 'straight', direction: 'down', stepWidth: 40, segments: [{ x1, y1: y, x2, y2: y }], ...extra }
}

/** Zona "Tapete" em volta do alçapão (uma escada comum dentro dela). */
const TAPETE: ConcealZone = {
  id: 'zona-tapete',
  name: 'Tapete',
  revealed: false,
  points: [
    { x: 340, y: 160 },
    { x: 460, y: 160 },
    { x: 460, y: 280 },
    { x: 340, y: 280 },
  ],
}

/** Ana e Duda lado a lado; sentinela, escada secreta e o tapete dentro da visão dos dois. */
function salao(): MapData {
  return {
    ...createEmptyMap('m', 'Castelo', 1000, 1000, 40),
    tokens: [ficha('ficha-ana', 200, 200), ficha('ficha-duda', 200, 240), ficha('sentinela', 280, 200, { secret: true })],
    stairs: [escada('escada-secreta', 150, 250, 300, { secret: true }), escada('alcapao', 380, 420, 220)],
    concealZones: [TAPETE],
  }
}

const vistaDe = (playerId: string, reveals?: SecretReveals, map: MapData = salao()) =>
  filterMapForPlayer(map, playerId, POSSE, RAIO, undefined, undefined, undefined, undefined, undefined, reveals)

const idsDasFichas = (playerId: string, reveals?: SecretReveals, map?: MapData): string[] =>
  vistaDe(playerId, reveals, map).map.tokens.map((t) => t.id)
const idsDasEscadas = (playerId: string, reveals?: SecretReveals): string[] =>
  vistaDe(playerId, reveals).map.stairs.map((s) => s.id)

describe('fogFilter: revelar ficha, escada e zona oculta só para quem descobriu', () => {
  it('controle: sem lista, a sentinela, a escada secreta e o alçapão não saem para ninguém', () => {
    for (const quem of ['ana', 'duda']) {
      expect(idsDasFichas(quem)).toEqual(['ficha-ana', 'ficha-duda'])
      expect(idsDasEscadas(quem)).toEqual([])
      expect(vistaDe(quem).concealed.length).toBeGreaterThan(0)
    }
  })

  it('sentinela revelada para Ana: aparece nela e NÃO no Duda ao lado, nem o id', () => {
    const reveals: SecretReveals = new Map([['sentinela', new Set(['ana'])]])
    expect(idsDasFichas('ana', reveals)).toEqual(['ficha-ana', 'ficha-duda', 'sentinela'])
    const doDuda = vistaDe('duda', reveals)
    expect(doDuda.map.tokens.map((t) => t.id)).toEqual(['ficha-ana', 'ficha-duda'])
    expect(JSON.stringify(doDuda)).not.toContain('sentinela')
  })

  it('a lista não fura a névoa: sentinela revelada para Ana, mas longe, não sai', () => {
    const longe: MapData = { ...salao(), tokens: [ficha('ficha-ana', 200, 200), ficha('ficha-duda', 200, 240), ficha('sentinela', 900, 900, { secret: true })] }
    const reveals: SecretReveals = new Map([['sentinela', new Set(['ana'])]])
    expect(idsDasFichas('ana', reveals, longe)).toEqual(['ficha-ana', 'ficha-duda'])
  })

  it('escada secreta revelada para Ana: sai para ela e não para o Duda', () => {
    const reveals: SecretReveals = new Map([['escada-secreta', new Set(['ana'])]])
    expect(idsDasEscadas('ana', reveals)).toEqual(['escada-secreta'])
    expect(idsDasEscadas('duda', reveals)).toEqual([])
    expect(JSON.stringify(vistaDe('duda', reveals))).not.toContain('escada-secreta')
  })

  it('zona "Tapete" revelada para Ana: o alçapão aparece só nela; no Duda o preto continua', () => {
    const reveals: SecretReveals = new Map([['zona-tapete', new Set(['ana'])]])
    const daAna = vistaDe('ana', reveals)
    expect(daAna.map.stairs.map((s) => s.id)).toEqual(['alcapao'])
    expect(daAna.concealed).toEqual([])
    const doDuda = vistaDe('duda', reveals)
    expect(doDuda.map.stairs).toEqual([])
    expect(doDuda.concealed.length).toBeGreaterThan(0)
    expect(JSON.stringify(doDuda)).not.toContain('alcapao')
  })

  it('lista vazia (desmarcou todo mundo) vale como sem lista: some para Ana também', () => {
    const reveals: SecretReveals = new Map([
      ['sentinela', new Set<string>()],
      ['zona-tapete', new Set<string>()],
    ])
    expect(idsDasFichas('ana', reveals)).toEqual(['ficha-ana', 'ficha-duda'])
    expect(idsDasEscadas('ana', reveals)).toEqual([])
    expect(vistaDe('ana', reveals).concealed.length).toBeGreaterThan(0)
  })

  it('"Oculto no editor" continua vencendo: ficha escondida no editor não sai nem revelada', () => {
    const escondida: MapData = { ...salao(), tokens: [ficha('ficha-ana', 200, 200), ficha('sentinela', 280, 200, { secret: true, hidden: true })] }
    const reveals: SecretReveals = new Map([['sentinela', new Set(['ana'])]])
    expect(idsDasFichas('ana', reveals, escondida)).toEqual(['ficha-ana'])
  })
})
