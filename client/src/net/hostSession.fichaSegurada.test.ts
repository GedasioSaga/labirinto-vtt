// @vitest-environment node
/**
 * FICHA SEGURADA PELO MESTRE, pela REDE. O mestre trava a ficha de Ana
 * (`Token.locked`): o arrasto dela volta com o motivo `locked`, e o snapshot
 * leva a trava SÓ na ficha dela — é o que acende o cadeado na tela dela. A
 * trava de qualquer outra ficha (colega, NPC que o mestre segura) não sai da
 * máquina do mestre: diria quem ele está segurando.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'

const CODE = 'TRAVA1'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function sala(tokens: Token[]): MapData {
  return { ...createEmptyMap('m-cela', 'Cela', 30, 12, 50), tokens }
}

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, tokenId: string, map: MapData): void {
  const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, map)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, tokenId)
}

/** Ana segura a Lanterna; Bia, a Brasa. */
function mesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  entra(s, 'c1', 'Ana', 'lanterna', map)
  entra(s, 'c2', 'Bia', 'brasa', map)
  return s
}

function mapaDe(r: HostResult, clientId: string): MapData {
  const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava o snapshot de ${clientId}`)
  return msg.map
}

describe('ficha segurada pelo mestre — o que chega a quem joga', () => {
  it('Ana arrasta a própria ficha travada: volta com o motivo "locked" e a ficha não anda', () => {
    const map = sala([ficha('lanterna', 125, 125, { locked: true }), ficha('brasa', 225, 125)])
    const s = mesa(map)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'lanterna', x: 325, y: 125 }, map)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.rejected', reqId: 'r1', reason: 'locked' } }])
    expect(r.applyMove).toBeUndefined()
  })

  it('o snapshot leva a trava na ficha de Ana, e soltar tira', () => {
    const presa = sala([ficha('lanterna', 125, 125, { locked: true }), ficha('brasa', 225, 125)])
    const s = mesa(presa)
    expect(mapaDe(s.broadcast(presa), 'c1').tokens.find((t) => t.id === 'lanterna')?.locked).toBe(true)

    const solta = sala([ficha('lanterna', 125, 125, { locked: false }), ficha('brasa', 225, 125)])
    const lanterna = mapaDe(s.broadcast(solta), 'c1').tokens.find((t) => t.id === 'lanterna')
    expect(lanterna).toBeDefined()
    expect(lanterna?.locked === true).toBe(false)
  })

  it('a trava da ficha de Bia e a do NPC seguro não chegam a Ana (as fichas chegam, a trava não)', () => {
    const map = sala([ficha('lanterna', 125, 125), ficha('brasa', 225, 125, { locked: true }), ficha('carcereiro', 325, 125, { locked: true })])
    const s = mesa(map)
    const r = s.broadcast(map)
    const deAna = mapaDe(r, 'c1')
    expect(deAna.tokens.map((t) => t.id).sort()).toEqual(['brasa', 'carcereiro', 'lanterna'])
    for (const t of deAna.tokens) expect('locked' in t).toBe(false)
    // Bia, que segura a Brasa, recebe a trava dela — e só dela.
    const deBia = mapaDe(r, 'c2')
    expect(deBia.tokens.find((t) => t.id === 'brasa')?.locked).toBe(true)
    expect('locked' in (deBia.tokens.find((t) => t.id === 'carcereiro') ?? {})).toBe(false)
  })
})
