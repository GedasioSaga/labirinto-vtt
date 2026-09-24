import { describe, expect, it } from 'vitest'
import { pointInRing } from '../lib/floorContour'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * CENA ESCURA pela REDE: o snapshot que a Carla recebe no porão escuro traz a
 * casa dela e a caldeira acesa lá no fundo; o rato no corredor escuro entre as
 * duas não chega, nem o campo "dark" do mestre.
 */
const CODE = 'ESCU01'

function porao(dark: boolean): MapData {
  return {
    ...createEmptyMap('map_porao', 'Porão', 1000, 1000, 40),
    dark: dark ? true : undefined,
    lights: [{ id: 'caldeira', x: 700, y: 100, radius: 80, color: '#ffcc66', intensity: 1 }],
    tokens: [
      { id: 'carla', characterId: null, name: 'Carla', x: 100, y: 100, size: 1, image: null },
      { id: 'rato', characterId: null, name: 'Rato', x: 400, y: 100, size: 1, image: null },
      { id: 'foguista', characterId: null, name: 'Foguista', x: 700, y: 130, size: 1, image: null },
    ],
  }
}

function carlaNaMesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const first = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Carla' }, map).outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(first.playerId, 'carla')
  return s
}

function snapshotDe(mensagens: { clientId: string; msg: HostMessage }[]): Extract<HostMessage, { type: 'snapshot' }> {
  const snap = mensagens.find((m) => m.clientId === 'c1' && m.msg.type === 'snapshot')?.msg
  if (snap?.type !== 'snapshot') throw new Error('esperava snapshot para a Carla')
  return snap
}

const inVision = (vision: RegionPoint[][], point: RegionPoint): boolean => vision.some((ring) => ring.length >= 3 && pointInRing(point, ring))

describe('hostSession: cena escura pela rede', () => {
  it('SEGURANÇA: o snapshot traz a Carla e o foguista na luz da caldeira; o rato no escuro não chega', () => {
    const map = porao(true)
    const snap = snapshotDe(carlaNaMesa(map).broadcast(map).outbound)
    const json = JSON.stringify(snap)
    expect(snap.map.tokens.map((t) => t.id).sort()).toEqual(['carla', 'foguista'])
    expect(json).not.toContain('rato')
    expect(json).not.toContain('"dark"')
    expect(inVision(snap.vision, { x: 700, y: 100 })).toBe(true)
    expect(inVision(snap.vision, { x: 400, y: 100 })).toBe(false)
  })

  it('controle: com a cena clara o mesmo snapshot traz o rato', () => {
    const map = porao(false)
    const snap = snapshotDe(carlaNaMesa(map).broadcast(map).outbound)
    expect(snap.map.tokens.map((t) => t.id).sort()).toEqual(['carla', 'foguista', 'rato'])
    expect(inVision(snap.vision, { x: 400, y: 100 })).toBe(true)
  })
})
