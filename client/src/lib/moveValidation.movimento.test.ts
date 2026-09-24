/**
 * MOVIMENTO CONTADO no veredito do host: passo máximo da cena corta o
 * movimento do jogador no último ponto válido, e com "Fichas ocupam espaço"
 * soltar sobre outra ficha volta com 'occupied'. O mestre anda sem limite.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { validateTokenMove } from './moveValidation'

const GRID = 50

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function docas(patch: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('docas', 'Docas', 60, 20, GRID),
    tokens: [token('heroi', 125, 125), token('guarda', 325, 125)],
    ...patch,
  }
}

const ownership = { p1: ['heroi'] }

describe('validateTokenMove — passo máximo', () => {
  it('jogador que pede 30 casas com passo 6 anda 6', () => {
    const map = docas({ movement: { maxStepCells: 6 } })
    const result = validateTokenMove(map, { playerId: 'p1', tokenId: 'heroi', x: 125 + 30 * GRID, y: 175 }, ownership)
    expect(result).toEqual({ ok: true, x: 125 + 6 * GRID, y: 135 })
  })

  it('sem passo máximo (Mercado) o jogador anda as 30', () => {
    const result = validateTokenMove(docas(), { playerId: 'p1', tokenId: 'heroi', x: 125 + 30 * GRID, y: 125 }, ownership)
    expect(result).toEqual({ ok: true, x: 125 + 30 * GRID, y: 125 })
  })

  it('mestre não tem limite', () => {
    const map = docas({ movement: { maxStepCells: 6 } })
    const result = validateTokenMove(map, { playerId: 'h', tokenId: 'heroi', x: 125 + 30 * GRID, y: 125 }, {}, { isHost: true })
    expect(result).toEqual({ ok: true, x: 125 + 30 * GRID, y: 125 })
  })

  it('a parede vale no trecho que a ficha anda de fato: parede além do alcance não recusa', () => {
    const map = docas({
      movement: { maxStepCells: 6 },
      walls: [{ id: 'w', x1: 1000, y1: 0, x2: 1000, y2: 1000, blocksLight: true, blocksMove: true, door: null }],
    })
    const result = validateTokenMove(map, { playerId: 'p1', tokenId: 'heroi', x: 125 + 30 * GRID, y: 125 }, ownership)
    expect(result).toEqual({ ok: true, x: 425, y: 125 })
  })
})

describe('validateTokenMove — fichas ocupam espaço', () => {
  it('soltar sobre o guarda volta com occupied', () => {
    const map = docas({ movement: { tokensOccupy: true } })
    const result = validateTokenMove(map, { playerId: 'p1', tokenId: 'heroi', x: 325, y: 125 }, ownership)
    expect(result).toEqual({ ok: false, reason: 'occupied' })
  })

  it('casa ao lado do guarda está livre', () => {
    const map = docas({ movement: { tokensOccupy: true } })
    expect(validateTokenMove(map, { playerId: 'p1', tokenId: 'heroi', x: 275, y: 125 }, ownership)).toEqual({ ok: true, x: 275, y: 125 })
  })

  it('sem a regra, parar sobre o guarda é permitido como sempre', () => {
    expect(validateTokenMove(docas(), { playerId: 'p1', tokenId: 'heroi', x: 325, y: 125 }, ownership)).toEqual({ ok: true, x: 325, y: 125 })
  })

  it('só conta quem o host diz que o jogador enxerga: ficha escondida não ocupa (não vaza)', () => {
    const map = docas({ movement: { tokensOccupy: true } })
    const visiveis = map.tokens.filter((t) => t.id !== 'guarda')
    const result = validateTokenMove(map, { playerId: 'p1', tokenId: 'heroi', x: 325, y: 125 }, ownership, { occupants: visiveis })
    expect(result).toEqual({ ok: true, x: 325, y: 125 })
  })

  it('o ponto cortado pelo passo máximo é o que conta para ocupação', () => {
    const map = docas({ movement: { maxStepCells: 4, tokensOccupy: true } })
    // Pede 30 casas: o corte para em 125 + 4*50 = 325, exatamente onde está o guarda.
    const result = validateTokenMove(map, { playerId: 'p1', tokenId: 'heroi', x: 125 + 30 * GRID, y: 125 }, ownership)
    expect(result).toEqual({ ok: false, reason: 'occupied' })
  })

  it('mestre pode parar sobre qualquer ficha', () => {
    const map = docas({ movement: { tokensOccupy: true } })
    expect(validateTokenMove(map, { playerId: 'h', tokenId: 'heroi', x: 325, y: 125 }, {}, { isHost: true })).toEqual({ ok: true, x: 325, y: 125 })
  })
})
