import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { filterMapForPlayer, waitingTokensForPlayer } from './fogFilter'

/**
 * ENCONTRO MARCADO no recorte: a marca "esperando" só vai com a ficha que o
 * jogador já recebe. Ficha no escuro, secreta, oculta ou de outro mapa não
 * ganha marca — a marca diria que ela existe.
 */

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function mapa(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'Salão', 40, 10, 50), tokens }
}

const OWNERSHIP = { caio: ['caio-t'] }

function recorte(map: MapData) {
  return filterMapForPlayer(map, 'caio', OWNERSHIP, 700)
}

describe('waitingTokensForPlayer', () => {
  it('só as fichas que esperam E saíram no recorte deste jogador', () => {
    const map = mapa([token('caio-t', 400, 200), token('ana-t', 200, 200), token('duda-t', 1800, 250)])
    const view = recorte(map)
    expect(view.map.tokens.map((t) => t.id).sort()).toEqual(['ana-t', 'caio-t'])
    expect(waitingTokensForPlayer(view, new Set(['ana-t', 'duda-t']))).toEqual(['ana-t'])
  })

  it('ficha secreta ou oculta pelo mestre, mesmo ao lado, não leva a marca', () => {
    const map = mapa([token('caio-t', 400, 200), token('ana-t', 200, 200, { secret: true }), token('bia-t', 450, 200, { hidden: true })])
    expect(waitingTokensForPlayer(recorte(map), new Set(['ana-t', 'bia-t']))).toEqual([])
  })

  it('ninguém esperando: lista vazia', () => {
    const map = mapa([token('caio-t', 400, 200), token('ana-t', 200, 200)])
    expect(waitingTokensForPlayer(recorte(map), new Set())).toEqual([])
  })
})
