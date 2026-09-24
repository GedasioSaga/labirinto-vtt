/**
 * PASSAR O MAPA na ponte do mestre: o botão do painel e o "Mostrar meu mapa
 * a…" do jogador mandam o aviso a quem recebeu e, logo atrás, o snapshot com o
 * trecho novo — sem esperar o próximo movimento de alguém.
 */
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { createHostBridge } from './hostBridge'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function mapa(): MapData {
  return {
    ...createEmptyMap('m', 'M', 50, 10, 40),
    tokens: [
      { id: 'heroi', characterId: null, name: 'Herói', x: 100, y: 200, size: 1, image: null },
      { id: 'bruxa', characterId: null, name: 'Bruxa', x: 1800, y: 200, size: 1, image: null },
    ],
  }
}

function setup() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const map = mapa()
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove: vi.fn(), applyDoor: vi.fn(), now: () => 0 })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de mensagem')
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  return { bridge, emit, sent }
}

function welcomeId(sent: unknown[], clientId: string): string {
  for (const args of sent) {
    if (typeof args !== 'object' || args === null || !('clientId' in args) || args.clientId !== clientId || !('msg' in args)) continue
    const msg = args.msg
    if (typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'welcome' && 'playerId' in msg && typeof msg.playerId === 'string') return msg.playerId
  }
  throw new Error(`sem welcome para ${clientId}`)
}

const tipos = (sent: unknown[], clientId: string): string[] =>
  sent.flatMap((args) => {
    if (typeof args !== 'object' || args === null || !('clientId' in args) || args.clientId !== clientId || !('msg' in args)) return []
    const msg = args.msg
    return typeof msg === 'object' && msg !== null && 'type' in msg && typeof msg.type === 'string' ? [msg.type] : []
  })

async function mesa() {
  const t = setup()
  await t.bridge.start()
  t.emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  t.emit({ clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Bruno' } })
  const ana = welcomeId(t.sent(), 'c1')
  const bruno = welcomeId(t.sent(), 'c2')
  t.bridge.assignToken(ana, 'heroi')
  t.bridge.assignToken(bruno, 'bruxa')
  return { ...t, ana, bruno }
}

describe('hostBridge — passar o mapa', () => {
  it('pelo mestre: devolve true, o Bruno recebe o aviso e o snapshot logo atrás', async () => {
    const t = await mesa()
    const antes = t.sent().length
    expect(t.bridge.shareMap(t.ana, t.bruno)).toBe(true)
    expect(tipos(t.sent().slice(antes), 'c2')).toEqual(['map.shared', 'snapshot'])
    // A Ana não é avisada de nada; só ganha o snapshot comum do broadcast.
    expect(tipos(t.sent().slice(antes), 'c1')).toEqual(['snapshot'])
  })

  it('pelo mestre, sem nada a passar ou sem sala: false e nada sai', async () => {
    const t = await mesa()
    const antes = t.sent().length
    expect(t.bridge.shareMap(t.ana, t.ana)).toBe(false)
    expect(t.sent().slice(antes)).toEqual([])
    const semSala = setup()
    expect(semSala.bridge.shareMap('p1', 'p2')).toBe(false)
    expect(semSala.sent()).toEqual([])
  })

  it('pela Ana: o "mostrar" aceito sai com a resposta, o aviso e o snapshot na hora', async () => {
    const t = await mesa()
    const antes = t.sent().length
    t.emit({ clientId: 'c1', msg: { type: 'map.share', to: 'Bruno' } })
    expect(tipos(t.sent().slice(antes), 'c2')).toEqual(['map.shared', 'snapshot'])
    expect(tipos(t.sent().slice(antes), 'c1')).toEqual(['map.share.result', 'snapshot'])
  })
})
