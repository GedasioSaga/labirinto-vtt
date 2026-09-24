import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * REVELAR PARA OS ESCOLHIDOS no host: quem descobriu a sentinela ou o alçapão
 * mora na sessão. O snapshot de quem está na lista leva a ficha (ou o que a
 * zona escondia); o de quem está ao lado, não. Desmarcar tira no próximo
 * pacote, sem o jogador recarregar.
 */

const CODE = 'AB12CD'
const RADIUS = 700

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function castelo(): MapData {
  return {
    ...createEmptyMap('mapa-castelo', 'Castelo', 40, 10, 50),
    tokens: [ficha('ficha-ana', 200, 200), ficha('ficha-duda', 250, 200), ficha('sentinela', 350, 200, { secret: true })],
    stairs: [{ id: 'alcapao', shape: 'straight', direction: 'down', stepWidth: 50, segments: [{ x1: 580, y1: 250, x2: 620, y2: 250 }] }],
    concealZones: [
      {
        id: 'zona-tapete',
        name: 'Tapete',
        revealed: false,
        points: [
          { x: 520, y: 150 },
          { x: 680, y: 150 },
          { x: 680, y: 350 },
          { x: 520, y: 350 },
        ],
      },
    ],
  }
}

function mundo(): HostWorld {
  return { open: { sceneId: 'cena-castelo', name: 'Castelo', map: castelo() }, background: [] }
}

function welcomeOf(result: HostResult): string {
  const first = result.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

function snapshotDe(result: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = result.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

const fichasDe = (result: HostResult, clientId: string): string[] => snapshotDe(result, clientId).map.tokens.map((t) => t.id)

function mesa() {
  let n = 0
  const w = mundo()
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => 1_000_000,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const ana = welcomeOf(s.handleMessage('c-ana', { type: 'join', code: CODE, name: 'Ana' }, w))
  const duda = welcomeOf(s.handleMessage('c-duda', { type: 'join', code: CODE, name: 'Duda' }, w))
  s.assignToken(ana, 'ficha-ana')
  s.assignToken(duda, 'ficha-duda')
  return { s, w, ana, duda }
}

describe('hostSession: revelar ficha e zona oculta só para quem descobriu', () => {
  it('sentinela para Ana: aparece nela; o pacote do Duda, ao lado, não tem nem o id', () => {
    const { s, w, ana } = mesa()
    expect(fichasDe(s.broadcast(w), 'c-ana')).not.toContain('sentinela')
    s.setSecretReveal('sentinela', [ana])
    const r = s.broadcast(w)
    expect(fichasDe(r, 'c-ana')).toContain('sentinela')
    expect(fichasDe(r, 'c-duda')).not.toContain('sentinela')
    expect(JSON.stringify(r.outbound.filter((o) => o.clientId === 'c-duda'))).not.toContain('sentinela')
  })

  it('zona "Tapete" para Ana: o alçapão só nela; o Duda segue com o preto e sem o alçapão', () => {
    const { s, w, ana } = mesa()
    s.setSecretReveal('zona-tapete', [ana])
    const r = s.broadcast(w)
    expect(snapshotDe(r, 'c-ana').map.stairs.map((st) => st.id)).toEqual(['alcapao'])
    expect(snapshotDe(r, 'c-ana').concealed).toEqual([])
    expect(snapshotDe(r, 'c-duda').map.stairs).toEqual([])
    expect(snapshotDe(r, 'c-duda').concealed.length).toBeGreaterThan(0)
    expect(JSON.stringify(r.outbound.filter((o) => o.clientId === 'c-duda'))).not.toContain('alcapao')
  })

  it('desmarcar: some no próximo pacote', () => {
    const { s, w, ana } = mesa()
    s.setSecretReveal('sentinela', [ana])
    s.setSecretReveal('zona-tapete', [ana])
    expect(fichasDe(s.broadcast(w), 'c-ana')).toContain('sentinela')
    s.setSecretReveal('sentinela', null)
    s.setSecretReveal('zona-tapete', [])
    const r = s.broadcast(w)
    expect(fichasDe(r, 'c-ana')).not.toContain('sentinela')
    expect(snapshotDe(r, 'c-ana').map.stairs).toEqual([])
    expect(snapshotDe(r, 'c-ana').concealed.length).toBeGreaterThan(0)
  })

  it('a lista é lida de volta para o painel; vazia ou null apaga', () => {
    const { s, ana, duda } = mesa()
    expect(s.secretReveal('sentinela')).toEqual([])
    s.setSecretReveal('sentinela', [duda, ana])
    // Na ordem da sala (a do painel Grupo), não na ordem dos cliques.
    expect(s.secretReveal('sentinela')).toEqual([ana, duda])
    expect(s.secretReveals()).toEqual({ sentinela: [ana, duda] })
    s.setSecretReveal('sentinela', [])
    expect(s.secretReveals()).toEqual({})
  })

  it('id de jogador que não está na sala não entra; expulsar tira da lista', () => {
    const { s, ana, duda } = mesa()
    s.setSecretReveal('sentinela', [ana, duda, 'inventado'])
    expect(s.secretReveal('sentinela')).toEqual([ana, duda])
    s.kick('c-ana')
    expect(s.secretReveal('sentinela')).toEqual([duda])
  })
})
