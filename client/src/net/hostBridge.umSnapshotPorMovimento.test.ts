/**
 * CUSTO DO MESTRE: um movimento de jogador vira UM snapshot por jogador, não
 * dois. O App liga toda mudança do mapa aberto a `notifyMapChanged` (que agenda
 * um broadcast para daqui a `BROADCAST_THROTTLE_MS`); o movimento aceito já
 * manda o snapshot na hora (`broadcastNow`). Sem cancelar o agendado, a mesma
 * posição saía de novo 50 ms depois — com 7 jogadores, 14 recortes da névoa e
 * 14 envios por passo, o dobro do trabalho na thread do mestre.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { BROADCAST_THROTTLE_MS, createHostBridge, type HostBridge } from './hostBridge'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const PLAYERS = 7
const GRID = 50

function ficha(i: number): Token {
  return { id: `heroi${i}`, characterId: null, name: `Herói ${i}`, x: 125 + i * GRID * 2, y: 125, size: 1, image: null }
}

function setup() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return () => undefined
  })
  let map: MapData = { ...createEmptyMap('praca', 'Praça', 40, 20, GRID), tokens: Array.from({ length: PLAYERS }, (_, i) => ficha(i)) }
  const holder: { bridge: HostBridge | null } = { bridge: null }
  // Como o App: aplicar o passo muda o mapa aberto, e a assinatura do mapa chama `notifyMapChanged`.
  const applyMove = vi.fn((tokenId: string, x: number, y: number) => {
    map = { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) }
    holder.bridge?.notifyMapChanged()
  })
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove, applyDoor: () => undefined, onPlayersChange: () => undefined, now: () => 0 })
  holder.bridge = bridge
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener para ${name}`)
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  /** O mestre arrasta a ficha no editor: o mapa muda sem passar pelo `applyMove` do jogador. */
  const mestreArrasta = (tokenId: string, x: number, y: number) => {
    map = { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) }
  }
  return { bridge, emit, sent, applyMove, mestreArrasta }
}

function snapshotsPorCliente(sent: unknown[]): Map<string, number> {
  const count = new Map<string, number>()
  for (const args of sent) {
    if (typeof args !== 'object' || args === null || !('clientId' in args) || !('msg' in args)) continue
    const { clientId, msg } = args
    if (typeof clientId !== 'string' || typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'snapshot') continue
    count.set(clientId, (count.get(clientId) ?? 0) + 1)
  }
  return count
}

function playerIdOf(sent: unknown[], clientId: string): string {
  for (const args of sent) {
    if (typeof args !== 'object' || args === null || !('clientId' in args) || !('msg' in args) || args.clientId !== clientId) continue
    const msg = args.msg
    if (typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'welcome' && 'playerId' in msg && typeof msg.playerId === 'string') return msg.playerId
  }
  throw new Error(`sem welcome para ${clientId}`)
}

async function mesaDe7() {
  vi.useFakeTimers()
  const t = setup()
  await t.bridge.start()
  for (let i = 0; i < PLAYERS; i += 1) {
    t.emit('net:message', { clientId: `c${i}`, msg: { type: 'join', code: ROOM.code, name: `Jogador ${i}` } })
    t.bridge.assignToken(playerIdOf(t.sent(), `c${i}`), `heroi${i}`)
  }
  // Tudo o que a entrada agendou já saiu: a contagem começa limpa.
  vi.advanceTimersByTime(BROADCAST_THROTTLE_MS * 2)
  return t
}

describe('hostBridge — um snapshot por jogador a cada movimento', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('7 na mesma cena: um passo manda exatamente 1 snapshot a cada um, mesmo depois da janela do agendado', async () => {
    const t = await mesaDe7()
    const before = t.sent().length
    t.emit('net:message', { clientId: 'c0', msg: { type: 'token.move', reqId: 'r1', tokenId: 'heroi0', x: 125, y: 125 + GRID } })
    expect(t.applyMove).toHaveBeenCalledWith('heroi0', 125, 125 + GRID)
    vi.advanceTimersByTime(BROADCAST_THROTTLE_MS * 4)
    const porCliente = snapshotsPorCliente(t.sent().slice(before))
    expect([...porCliente.keys()].sort()).toEqual(Array.from({ length: PLAYERS }, (_, i) => `c${i}`))
    expect([...porCliente.values()]).toEqual(Array.from({ length: PLAYERS }, () => 1))
  })

  it('o snapshot imediato já leva a posição nova (cancelar o agendado não perde o passo)', async () => {
    const t = await mesaDe7()
    const before = t.sent().length
    t.emit('net:message', { clientId: 'c3', msg: { type: 'token.move', reqId: 'r1', tokenId: 'heroi3', x: 725, y: 175 } })
    // Sem avançar o relógio: o que o jogador recebe é o envio imediato.
    const snapshot = t
      .sent()
      .slice(before)
      .find((args) => typeof args === 'object' && args !== null && 'clientId' in args && args.clientId === 'c3' && 'msg' in args && typeof args.msg === 'object' && args.msg !== null && 'type' in args.msg && args.msg.type === 'snapshot')
    expect(JSON.stringify(snapshot)).toContain('"id":"heroi3"')
    expect(JSON.stringify(snapshot)).toContain('"x":725,"y":175')
  })

  it('mudança do mestre sem movimento continua saindo pelo agendado (o throttle não some)', async () => {
    const t = await mesaDe7()
    const before = t.sent().length
    // Uma mudança de verdade: o broadcast só manda a quem a tela mudou, e mapa igual não muda tela nenhuma.
    t.mestreArrasta('heroi0', 125, 125 + GRID)
    t.bridge.notifyMapChanged()
    expect(t.sent().length).toBe(before)
    vi.advanceTimersByTime(BROADCAST_THROTTLE_MS)
    expect([...snapshotsPorCliente(t.sent().slice(before)).values()]).toEqual(Array.from({ length: PLAYERS }, () => 1))
  })
})
