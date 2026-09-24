/**
 * LUGARES no host convivendo com a marca "vamos para cá" (marca-olhem-aqui) e
 * o dado da mesa (dado-na-sala), já integrados em auto/int-jogador. O
 * snapshot de cada jogador leva o lugar DELE; a marca e a rolagem seguem com o
 * mesmo recorte de antes e não levam lugar, id nem nome de cena.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const SEGREDOS = ['s-salao', 's-cripta', 'm-salao', 'm-cripta', 'Salao Norte', 'Cripta Rubra']

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

/** Salão (aberto): Elisa e Caio. Cripta (de fundo): Bruno. */
const mundo: HostWorld = {
  open: { sceneId: 's-salao', name: 'Salao Norte', map: mapa('m-salao', 'Salao Norte', [ficha('lanterna', 100, 100), ficha('adaga', 300, 100)]) },
  background: [{ sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 200, 100)]) }],
}

function mesa() {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 5000, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string, token: string): void => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, token)
  }
  entra('c1', 'Elisa', 'lanterna')
  entra('c2', 'Bruno', 'machado')
  entra('c3', 'Caio', 'adaga')
  return { s, primeiro: s.broadcast(mundo) }
}

type Snapshot = Extract<HostMessage, { type: 'snapshot' }>

function snapshotDe(r: HostResult, clientId: string): Snapshot {
  const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error(`sem snapshot para ${clientId}`)
  return msg
}

const para = (r: HostResult, clientId: string) => r.outbound.filter((o) => o.clientId === clientId)

describe('Lugares no host com a marca e o dado', () => {
  it('cada um dos três recebe o próprio lugar no snapshot, sem nada da cena', () => {
    const { primeiro } = mesa()
    for (const clientId of ['c1', 'c2', 'c3']) {
      const snap = snapshotDe(primeiro, clientId)
      expect(snap.place).toBe('l1')
      expect(snap.places).toEqual(['l1'])
      for (const segredo of SEGREDOS) expect(JSON.stringify({ place: snap.place, places: snap.places })).not.toContain(segredo)
    }
  })

  it('a marca de Elisa chega a Caio sem lugar e não chega a Bruno; o snapshot seguinte ainda leva o lugar', () => {
    const { s } = mesa()
    const r = s.handleMessage('c1', { type: 'destination', x: 200, y: 300 }, mundo)
    const marcaCaio = para(r, 'c3').find((o) => o.msg.type === 'destinations')?.msg
    expect(marcaCaio).toEqual({ type: 'destinations', marks: [{ x: 200, y: 300, from: 'Elisa', color: expect.any(String), mine: false }] })
    expect(JSON.stringify(marcaCaio)).not.toContain('place')
    expect(para(r, 'c2')).toEqual([])

    // A ficha de Elisa anda: o recorte novo é do mesmo lugar dela.
    const andou: HostWorld = { ...mundo, open: { ...mundo.open, map: mapa('m-salao', 'Salao Norte', [ficha('lanterna', 150, 100), ficha('adaga', 300, 100)]) } }
    const depois = s.broadcast(andou)
    expect(snapshotDe(depois, 'c1').place).toBe('l1')
  })

  it('a rolagem de Bruno chega à mesa inteira sem lugar e sem nada da cena dele', () => {
    const { s } = mesa()
    const r = s.handleMessage('c2', { type: 'dice.roll', count: 1, sides: 20, modifier: 0 }, mundo)
    const rolagens = r.outbound.filter((o) => o.msg.type === 'dice.rolled')
    expect(rolagens.map((o) => o.clientId).sort()).toEqual(['c1', 'c2', 'c3'])
    for (const o of rolagens) {
      const texto = JSON.stringify(o.msg)
      expect(texto).not.toContain('place')
      for (const segredo of SEGREDOS) expect(texto).not.toContain(segredo)
    }
  })
})
