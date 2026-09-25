/**
 * CONTORNO LEMBRADO EM MAPA MUITO GRANDE, pela sessão do mestre: o jogador que
 * anda além de 16.383 px recebe a memória com a borda que viu, e não a
 * escadinha da célula. O que a zona oculta esconde continua sem chegar.
 */
import { describe, expect, it } from 'vitest'
import { decodeExploration, isPointExplored, ringTouchesRect, type Exploration } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { ConcealZone, MapData, Token } from '../types/map'
import type { HostMessage } from './protocol'
import { createHostSession, type HostResult } from './hostSession'

const CODE = 'AB12CD'
const RAIO = 300
/** 800 × 40 células de 50 px: 40.000 × 2.000 px de mundo. */
const LARGURA = 800
const ALTURA = 40
const GRADE = 50
const Y = 1_000

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function galpao(tokens: Token[], concealZones: ConcealZone[] = []): MapData {
  return { ...createEmptyMap('m-galpao', 'Galpão', LARGURA, ALTURA, GRADE), tokens, concealZones }
}

function snapshotDe(r: HostResult): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot para c1')
  return msg
}

function exploradoDe(r: HostResult): Exploration {
  const exp = decodeExploration(snapshotDe(r).explored)
  if (exp === null) throw new Error('explorado ilegível')
  return exp
}

function mesa(inicio: MapData) {
  const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => 0, randomId: (() => {
    let n = 0
    return () => `id-${(n += 1)}`
  })() })
  const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Fabi' }, inicio)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'fabi')
  return s
}

describe('contorno lembrado além de 16.383 px, pela sessão', () => {
  it('Fabi passa por x = 30.000 e vai embora: a borda do que viu volta lisa, não em escadinha', () => {
    const s = mesa(galpao([]))
    s.broadcast(galpao([ficha('fabi', 30_000, Y)]))
    const depois = exploradoDe(s.broadcast(galpao([ficha('fabi', 34_000, Y)])))
    expect(depois.rings.length).toBeGreaterThanOrEqual(1)
    // Faixa da borda (a célula dela é cortada pelo anel): só o contorno a guarda.
    expect(isPointExplored(depois, { x: 30_000 + RAIO - 3, y: Y })).toBe(true)
    expect(isPointExplored(depois, { x: 30_000 - RAIO + 3, y: Y })).toBe(true)
    // Entre as duas visões, o que ela nunca viu segue preto.
    expect(isPointExplored(depois, { x: 32_000, y: Y })).toBe(false)
  })

  it('SEGURANÇA: o anel que encosta na zona oculta não chega ao jogador, nem longe da origem', () => {
    const zona: ConcealZone = {
      id: 'zona-cofre',
      name: 'nome-cofre-secreto',
      revealed: false,
      points: [
        { x: 30_000 + RAIO - 60, y: Y - 60 },
        { x: 30_000 + RAIO + 120, y: Y - 60 },
        { x: 30_000 + RAIO + 120, y: Y + 60 },
        { x: 30_000 + RAIO - 60, y: Y + 60 },
      ],
    }
    const s = mesa(galpao([], [zona]))
    s.broadcast(galpao([ficha('fabi', 20_000, Y)], [zona])) // longe da zona: guarda
    s.broadcast(galpao([ficha('fabi', 30_000, Y)], [zona])) // encosta na zona: não guarda
    const r = s.broadcast(galpao([ficha('fabi', 36_000, Y)], [zona]))
    const json = JSON.stringify(snapshotDe(r))
    expect(json).not.toContain('nome-cofre-secreto')
    expect(json).not.toContain('zona-cofre')
    const exp = exploradoDe(r)
    // Anel longe da zona chegou com a borda lisa: a correção vale aqui também.
    expect(isPointExplored(exp, { x: 20_000 + RAIO - 3, y: Y })).toBe(true)
    // Nenhum contorno que chegou toca a zona.
    for (const ring of exp.rings) {
      expect(ringTouchesRect(ring.points, 30_000 + RAIO - 60, Y - 60, 30_000 + RAIO + 120, Y + 60)).toBe(false)
    }
    // Dentro da zona: nada. E o anel que a tocava saiu inteiro: a borda do lado
    // oposto dele volta a ser só a do bitset.
    expect(isPointExplored(exp, { x: 30_000 + RAIO - 10, y: Y })).toBe(false)
    expect(isPointExplored(exp, { x: 30_000 - RAIO + 3, y: Y })).toBe(false)
  })
})
