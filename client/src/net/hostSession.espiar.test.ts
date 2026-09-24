import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { DoorState, MapData, Region, Token, Wall } from '../types/map'
import { createHostSession, PEEK_DURATION_MS, peekNoticeText } from './hostSession'
import { parsePlayerMessage, type HostMessage } from './protocol'

/**
 * ESPIAR, pela rede. Escritório com teto (500..900 x 100..500), porta
 * trancada na parede oeste (y 250..350). Ana encostada na porta, Bia também
 * encostada (mas não espia), Caio longe. Dentro, o escrivão bem na frente da
 * porta. 'Espiar': cone de 5 s só para a Ana, a porta segue fechada para
 * todos, e o mestre fica sabendo.
 */
const CODE = 'ESPI01'

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

const PORTA: DoorState = { open: false, locked: true, kind: 'normal' }

function escritorio(porta: DoorState = PORTA): MapData {
  const predio: Region = {
    id: 'escritorio',
    points: [
      { x: 500, y: 100 },
      { x: 900, y: 100 },
      { x: 900, y: 500 },
      { x: 500, y: 500 },
    ],
    tag: '',
    fillColor: '#222',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Escritorio do capitao', roof: true },
  }
  return {
    ...createEmptyMap('m-esc', 'Porto', 20, 12, 50),
    regions: [predio],
    walls: [
      parede('n', 500, 100, 900, 100),
      parede('l', 900, 100, 900, 500),
      parede('s', 900, 500, 500, 500),
      parede('o1', 500, 100, 500, 250),
      parede('porta', 500, 250, 500, 350, { door: porta }),
      parede('o2', 500, 350, 500, 500),
    ],
    tokens: [ficha('ana', 460, 300), ficha('bia', 460, 330), ficha('caio', 100, 300), ficha('escrivao', 600, 300)],
  }
}

function mesa(map: MapData, relogio: { agora: number }) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 900, now: () => relogio.agora, randomId: () => `id-${(n += 1)}` })
  const ids: Record<string, string> = {}
  for (const [clientId, nome, token] of [
    ['c-ana', 'Ana', 'ana'],
    ['c-bia', 'Bia', 'bia'],
    ['c-caio', 'Caio', 'caio'],
  ] as const) {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, map).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    ids[token] = welcome.playerId
    s.assignToken(welcome.playerId, token)
  }
  return { s, ids }
}

function snapshotDe(saida: { clientId: string; msg: HostMessage }[], clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const snap = saida.find((m) => m.clientId === clientId && m.msg.type === 'snapshot')?.msg
  if (snap?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return snap
}

const fichasDe = (snap: Extract<HostMessage, { type: 'snapshot' }>): string[] => snap.map.tokens.map((t) => t.id).sort()

describe("hostSession: 'Espiar' pela porta fechada", () => {
  it('o protocolo aceita door.peek com o id da parede e recusa lixo', () => {
    expect(parsePlayerMessage({ type: 'door.peek', wallId: 'porta' })).toEqual({ type: 'door.peek', wallId: 'porta' })
    expect(parsePlayerMessage({ type: 'door.peek', wallId: '' })).toBeNull()
    expect(parsePlayerMessage({ type: 'door.peek' })).toBeNull()
  })

  it('Ana espia: cone só para ela por 5 s, porta fechada para todos, mestre avisado', () => {
    const relogio = { agora: 1_000 }
    const map = escritorio()
    const { s, ids } = mesa(map, relogio)
    const antes = s.broadcast(map).outbound
    expect(fichasDe(snapshotDe(antes, 'c-ana'))).toEqual(['ana', 'bia', 'caio'])

    const pedido = s.handleMessage('c-ana', { type: 'door.peek', wallId: 'porta' }, map)
    expect(pedido.peek).toEqual({ playerId: ids.ana, playerName: 'Ana', wallId: 'porta' })
    expect(peekNoticeText(pedido.peek ?? { playerId: '', playerName: 'Ana', wallId: '' })).toBe('Ana espiou')
    // Espiar não mexe na porta do mestre.
    expect(pedido.applyDoor).toBeUndefined()

    relogio.agora += 100
    const espiando = s.broadcast(map).outbound
    const daAna = snapshotDe(espiando, 'c-ana')
    expect(fichasDe(daAna)).toEqual(['ana', 'bia', 'caio', 'escrivao'])
    expect(daAna.map.walls.find((w) => w.id === 'porta')?.door).toEqual(PORTA)
    expect(daAna.glimpses?.length ?? 0).toBeGreaterThan(0)
    // Bia, colada na mesma porta, não espiou: nada de dentro.
    const daBia = snapshotDe(espiando, 'c-bia')
    expect(fichasDe(daBia)).toEqual(['ana', 'bia', 'caio'])
    expect(JSON.stringify(daBia)).not.toContain('escrivao')
    expect(daBia.map.walls.find((w) => w.id === 'porta')?.door).toEqual(PORTA)

    // Passados os 5 s, o cone fecha.
    relogio.agora += PEEK_DURATION_MS
    const depois = snapshotDe(s.broadcast(map).outbound, 'c-ana')
    expect(fichasDe(depois)).toEqual(['ana', 'bia', 'caio'])
    expect(JSON.stringify(depois)).not.toContain('escrivao')
  })

  it('SEGURANÇA: longe da porta não espia, e a recusa diz para chegar perto', () => {
    const relogio = { agora: 1_000 }
    const map = escritorio()
    const { s } = mesa(map, relogio)
    s.broadcast(map)
    const pedido = s.handleMessage('c-caio', { type: 'door.peek', wallId: 'porta' }, map)
    expect(pedido.peek).toBeUndefined()
    expect(pedido.outbound).toEqual([{ clientId: 'c-caio', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'far' } }])
    expect(JSON.stringify(snapshotDe(s.broadcast(map).outbound, 'c-caio'))).not.toContain('escrivao')
  })

  it('SEGURANÇA: porta secreta não se espia, e a recusa não diz que é porta', () => {
    const relogio = { agora: 1_000 }
    const map = escritorio({ ...PORTA, secret: true })
    const { s } = mesa(map, relogio)
    s.broadcast(map)
    const pedido = s.handleMessage('c-ana', { type: 'door.peek', wallId: 'porta' }, map)
    expect(pedido.peek).toBeUndefined()
    expect(pedido.outbound).toEqual([{ clientId: 'c-ana', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'not_visible' } }])
    expect(JSON.stringify(snapshotDe(s.broadcast(map).outbound, 'c-ana'))).not.toContain('escrivao')
  })

  it('parede sem porta ou id inventado: not_visible, sem aviso ao mestre', () => {
    const relogio = { agora: 1_000 }
    const map = escritorio()
    const { s } = mesa(map, relogio)
    for (const wallId of ['o1', 'nao-existe']) {
      const pedido = s.handleMessage('c-ana', { type: 'door.peek', wallId }, map)
      relogio.agora += 1_000
      expect(pedido.peek).toBeUndefined()
      expect(pedido.outbound).toEqual([{ clientId: 'c-ana', msg: { type: 'door.toggle.rejected', wallId, reason: 'not_visible' } }])
    }
  })
})
