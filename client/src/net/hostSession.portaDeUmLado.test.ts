import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { DoorState, MapData, Region, Token, Wall } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * PORTA DE UM LADO, pela rede (castelo). A porta do Posto da guarda fica na
 * parede leste (x = 900), descendo de (900,250) a (900,300). Ela só abre por
 * DENTRO do posto (a oeste, x < 900 — o lado 'right' de quem desce a parede).
 * Bruno está dentro, Fábio está fora; os dois encostados na porta.
 */
const CODE = 'PUML01'

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function sala(id: string, nome: string, x1: number, y1: number, x2: number, y2: number): Region {
  return {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#2b2b2b',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
  }
}

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function castelo(porta: Partial<DoorState>, fabio: { x: number; y: number } = { x: 925, y: 275 }): MapData {
  const posto = { regionId: 'r-posto' }
  return {
    ...createEmptyMap('map_posto', 'Castelo', 1400, 700, 50),
    walls: [
      parede('posto-n', 500, 100, 900, 100, posto),
      parede('posto-l1', 900, 100, 900, 250, posto),
      parede('porta', 900, 250, 900, 300, { ...posto, door: { open: false, locked: false, kind: 'normal', opensFrom: 'right', ...porta } }),
      parede('posto-l2', 900, 300, 900, 450, posto),
      parede('posto-s', 900, 450, 500, 450, posto),
      parede('posto-o', 500, 450, 500, 100, posto),
    ],
    regions: [sala('r-posto', 'Posto da guarda', 500, 100, 900, 450)],
    tokens: [ficha('bruno', 'Bruno', 875, 275), ficha('fabio', 'Fabio', fabio.x, fabio.y)],
  }
}

function mesa(map: MapData, visionRadius = 700) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entrar = (clientId: string, nome: string, tokenId: string) => {
    const first = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, map).outbound[0]?.msg
    if (first?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(first.playerId, tokenId)
  }
  entrar('c-bruno', 'Bruno', 'bruno')
  entrar('c-fabio', 'Fabio', 'fabio')
  return s
}

function snapshotPara(clientId: string, mensagens: { clientId: string; msg: HostMessage }[]): Extract<HostMessage, { type: 'snapshot' | 'delta' }> {
  const snap = mensagens.find((m) => m.clientId === clientId && (m.msg.type === 'snapshot' || m.msg.type === 'delta'))?.msg
  if (snap?.type !== 'snapshot' && snap?.type !== 'delta') throw new Error(`esperava mapa para ${clientId}`)
  return snap
}

describe('hostSession: porta que só abre de um lado', () => {
  it('Fábio, de fora, recebe "wrong_side" e a porta não abre', () => {
    const map = castelo({})
    const s = mesa(map)
    s.broadcast(map)
    const r = s.handleMessage('c-fabio', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(r.applyDoor).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c-fabio', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'wrong_side' } }])
  })

  it('Bruno, de dentro, abre', () => {
    const map = castelo({})
    const s = mesa(map)
    s.broadcast(map)
    const r = s.handleMessage('c-bruno', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(r.outbound).toEqual([])
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: true, playerId: 'id-1', playerName: 'Bruno' })
  })

  it('trocar o lado inverte quem abre', () => {
    const map = castelo({ opensFrom: 'left' })
    const s = mesa(map)
    s.broadcast(map)
    expect(s.handleMessage('c-fabio', { type: 'door.toggle', wallId: 'porta' }, map).applyDoor).toEqual({ wallId: 'porta', open: true, playerId: 'id-3', playerName: 'Fabio' })
    const bruno = s.handleMessage('c-bruno', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(bruno.applyDoor).toBeUndefined()
    expect(bruno.outbound).toEqual([{ clientId: 'c-bruno', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'wrong_side' } }])
  })

  it('já aberta, fecha de qualquer lado (a regra é para ABRIR)', () => {
    const map = castelo({ open: true })
    const s = mesa(map)
    s.broadcast(map)
    expect(s.handleMessage('c-fabio', { type: 'door.toggle', wallId: 'porta' }, map).applyDoor).toEqual({ wallId: 'porta', open: false, playerId: 'id-3', playerName: 'Fabio' })
  })

  it('trancada continua dizendo "Trancada" dos dois lados; longe continua "far"', () => {
    const trancada = castelo({ locked: true })
    const s = mesa(trancada)
    s.broadcast(trancada)
    expect(s.handleMessage('c-fabio', { type: 'door.toggle', wallId: 'porta' }, trancada).outbound).toEqual([
      { clientId: 'c-fabio', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'locked' } },
    ])
    const longe = castelo({}, { x: 1100, y: 275 })
    const s2 = mesa(longe)
    s2.broadcast(longe)
    expect(s2.handleMessage('c-fabio', { type: 'door.toggle', wallId: 'porta' }, longe).outbound).toEqual([
      { clientId: 'c-fabio', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'far' } },
    ])
  })

  it('porta sem o campo (mapa salvo antes) abre dos dois lados, como hoje', () => {
    const map = castelo({ opensFrom: undefined })
    const s = mesa(map)
    s.broadcast(map)
    expect(s.handleMessage('c-fabio', { type: 'door.toggle', wallId: 'porta' }, map).applyDoor).toEqual({ wallId: 'porta', open: true, playerId: 'id-3', playerName: 'Fabio' })
  })

  it('SEGURANÇA: o lado que abre é regra do mestre — não chega a nenhum jogador', () => {
    const map = castelo({})
    const s = mesa(map)
    const out = s.broadcast(map).outbound
    for (const clientId of ['c-bruno', 'c-fabio']) {
      const snap = snapshotPara(clientId, out)
      // A porta chega (com o estado dela), só sem o lado.
      expect(snap.map.walls.find((w) => w.id === 'porta')?.door).toEqual({ open: false, locked: false, kind: 'normal' })
      expect(JSON.stringify(snap)).not.toContain('opensFrom')
    }
  })

  it('SEGURANÇA: a porta LEMBRADA (explorada, fora da visão) também chega sem o lado', () => {
    const perto = castelo({})
    const s = mesa(perto, 150)
    s.broadcast(perto)
    // Fábio se afasta: a porta sai da visão dele e passa a vir da memória.
    const longe = castelo({}, { x: 1300, y: 650 })
    const snap = snapshotPara('c-fabio', s.broadcast(longe).outbound)
    const lembrada = snap.map.walls.find((w) => w.id === 'porta')
    expect(lembrada?.door).toEqual({ open: false, locked: false, kind: 'normal' })
    expect(JSON.stringify(snap)).not.toContain('opensFrom')
  })
})
