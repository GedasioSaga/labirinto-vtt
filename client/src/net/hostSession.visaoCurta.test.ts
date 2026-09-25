/**
 * FUMAÇA E VAPOR QUE ENCURTAM A VISÃO, pela REDE. Bia entra no vapor da sala
 * B: Ana, na sala A olhando pela porta aberta, deixa de receber a ficha dela
 * (nem posição, nem nome) — recebe só a mancha do vapor. Bia, lá dentro,
 * enxerga só as casas do vapor. Saindo, tudo volta sozinho.
 */
import { describe, expect, it } from 'vitest'
import { ficha, torre, zona } from '../lib/__fixtures__/hazardTower'
import type { HazardKind, MapData } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'

const CODE = 'VAPORE'

/** Ana (c1) fica com a ficha `ana`, Bia (c2) com a `bia`. */
function mesa(source: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const jogadores: [clientId: string, name: string, tokenId: string][] = [
    ['c1', 'Ana', 'ana'],
    ['c2', 'Bia', 'bia'],
  ]
  for (const [clientId, name, tokenId] of jogadores) {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, source).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
  }
  return s
}

function snapshotDe(r: HostResult, clientId: string) {
  const msg = r.outbound.find((o) => o.clientId === clientId && (o.msg.type === 'snapshot' || o.msg.type === 'delta'))?.msg
  if (msg?.type !== 'snapshot' && msg?.type !== 'delta') throw new Error(`esperava o snapshot de ${clientId}`)
  return msg
}

function fichasDe(r: HostResult, clientId: string): string[] {
  return snapshotDe(r, clientId).map.tokens.map((t) => t.id).sort()
}

function mapa(kind: HazardKind | null, xDaBia: number): MapData {
  return torre({
    tokens: [ficha('ana', 250, 200), ficha('bia', xDaBia, 200, { name: 'Bia Encapuzada' })],
    hazards: kind === null ? undefined : [zona('z-vapor-segredo', kind, ['sala-b'])],
  })
}

describe('host — fumaça e vapor escondem quem está dentro', () => {
  it('sem vapor, Ana vê Bia pela porta aberta (a cena de controle)', () => {
    const map = mapa(null, 750)
    expect(fichasDe(mesa(map).broadcast(map), 'c1')).toEqual(['ana', 'bia'])
  })

  it.each<HazardKind>(['vapor', 'fumaca'])('Bia no %s: nada da ficha dela chega a Ana, só a mancha', (kind) => {
    const map = mapa(kind, 750)
    const r = mesa(map).broadcast(map)
    expect(fichasDe(r, 'c1')).toEqual(['ana'])
    expect(snapshotDe(r, 'c1').hazards?.map((h) => h.kind)).toEqual([kind])
    const paraAna = JSON.stringify(r.outbound.filter((o) => o.clientId === 'c1'))
    expect(paraAna).not.toContain('Bia Encapuzada')
    expect(paraAna).not.toContain('z-vapor-segredo')
    // Bia, lá dentro, continua com a própria ficha e não enxerga Ana a 500 px.
    expect(fichasDe(r, 'c2')).toEqual(['bia'])
  })

  it('Bia sai do vapor: volta a aparecer para Ana, sem o mestre mexer em nada', () => {
    const dentro = mapa('vapor', 750)
    const s = mesa(dentro)
    expect(fichasDe(s.broadcast(dentro), 'c1')).toEqual(['ana'])
    const fora = mapa('vapor', 400)
    expect(fichasDe(s.broadcast(fora), 'c1')).toEqual(['ana', 'bia'])
  })
})
