/**
 * MOVIMENTO CONTADO na sessão do mestre: o passo máximo da cena corta o
 * movimento do jogador, e "Fichas ocupam espaço" recusa com 'occupied' — mas
 * só por ficha que o JOGADOR enxerga. Ficha escondida (oculta pelo mestre, na
 * névoa, secreta) nunca recusa: a recusa diria que existe alguém ali.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const GRID = 50

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function docas(patch: Partial<MapData> = {}, guarda: Partial<Token> = {}): MapData {
  return {
    ...createEmptyMap('docas', 'Docas', 60, 20, GRID),
    tokens: [ficha('heroi', 125, 125), ficha('guarda', 325, 125, guarda)],
    ...patch,
  }
}

function mesa(map: MapData, visionRadius = 700) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'heroi')
  return s
}

function snapshotMap(msg: HostMessage | undefined): MapData {
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot')
  return msg.map
}

describe('hostSession — passo máximo', () => {
  it('Docas com passo 6: pedir 30 casas anda 6, e o integrador aplica o ponto cortado', () => {
    const map = docas({ movement: { maxStepCells: 6 } })
    const s = mesa(map)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 125 + 30 * GRID, y: 125 }, map)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.accepted', reqId: 'r1', x: 425, y: 125 } }])
    expect(r.applyMove).toEqual({ tokenId: 'heroi', x: 425, y: 125 })
  })

  it('Mercado livre: as 30 casas passam', () => {
    const map = docas()
    const s = mesa(map)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 125 + 30 * GRID, y: 125 }, map)
    expect(r.applyMove).toEqual({ tokenId: 'heroi', x: 125 + 30 * GRID, y: 125 })
  })

  it('a regra da cena chega ao jogador no snapshot (a tela dele para no alcance)', () => {
    const map = docas({ movement: { maxStepCells: 6, tokensOccupy: true } })
    const s = mesa(map)
    expect(snapshotMap(s.broadcast(map).outbound[0]?.msg).movement).toEqual({ maxStepCells: 6, tokensOccupy: true })
  })
})

describe('hostSession — fichas ocupam espaço', () => {
  it('soltar sobre o guarda à vista volta com occupied, sem dizer quem está lá', () => {
    const map = docas({ movement: { tokensOccupy: true } })
    const s = mesa(map)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 325, y: 125 }, map)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.rejected', reqId: 'r1', reason: 'occupied' } }])
    expect(r.applyMove).toBeUndefined()
    expect(JSON.stringify(r.outbound)).not.toContain('guarda')
  })

  it('guarda oculto pelo mestre não recusa: a recusa vazaria que ele existe', () => {
    const map = docas({ movement: { tokensOccupy: true } }, { hidden: true })
    const s = mesa(map)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 325, y: 125 }, map)
    expect(r.outbound[0]?.msg).toEqual({ type: 'token.move.accepted', reqId: 'r1', x: 325, y: 125 })
    // E o snapshot continua sem ele.
    expect(snapshotMap(s.broadcast(map).outbound[0]?.msg).tokens.map((t) => t.id)).toEqual(['heroi'])
  })

  it('guarda secreto também não recusa', () => {
    const map = docas({ movement: { tokensOccupy: true } }, { secret: true })
    const s = mesa(map)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 325, y: 125 }, map)
    expect(r.outbound[0]?.msg.type).toBe('token.move.accepted')
  })

  it('guarda fora da visão (na névoa) não recusa', () => {
    const map = docas({ movement: { tokensOccupy: true } })
    // Visão de 100 px: o guarda, a 200 px, está na névoa para o jogador.
    const s = mesa(map, 100)
    expect(snapshotMap(s.broadcast(map).outbound[0]?.msg).tokens.map((t) => t.id)).toEqual(['heroi'])
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 325, y: 125 }, map)
    expect(r.outbound[0]?.msg.type).toBe('token.move.accepted')
  })
})
