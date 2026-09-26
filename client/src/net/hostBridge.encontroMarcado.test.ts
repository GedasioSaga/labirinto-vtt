import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { PING_INTERVAL_MS } from '../player/playerConnection'
import { useToastStore } from '../stores/toastStore'
import type { MapData } from '../types/map'
import { createHostBridge } from './hostBridge'

/**
 * ENCONTRO MARCADO na ponte do mestre: o prazo vence SEM ninguém mexer em
 * nada (a mesa pode estar parada), então é a ponte que acorda na hora certa,
 * avisa quem esperava e refaz o recorte (a marca sai da ficha).
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const T0 = 10_000_000
const MINUTO = 60_000

function sampleMap(): MapData {
  return {
    ...createEmptyMap('m', 'M', 40, 10, 50),
    tokens: [
      { id: 'ana-t', characterId: null, name: 'Ana', x: 200, y: 200, size: 1, image: null },
      { id: 'caio-t', characterId: null, name: 'Caio', x: 400, y: 200, size: 1, image: null },
    ],
  }
}

interface Sent {
  clientId: string
  msg: { type: string; waiting?: string[]; reason?: string }
}

function setup() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const sent: Sent[] = []
  const invoke = vi.fn(async (cmd: string, args?: unknown) => {
    if (cmd === 'net_send') sent.push(args as Sent) // o teste só lê o que ele mesmo montou acima
    return cmd === 'net_start_room' ? ROOM : undefined
  })
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const map = sampleMap()
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove: vi.fn(), applyDoor: vi.fn(), now: () => Date.now() })
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener para ${name}`)
    handler({ payload })
  }
  const mensagem = (clientId: string, msg: unknown) => emit('net:message', { clientId, msg })
  return { bridge, sent, mensagem }
}

describe('hostBridge: encontro marcado', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    vi.useFakeTimers()
    vi.setSystemTime(T0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function mesaComAnaEsperando() {
    const t = setup()
    await t.bridge.start()
    t.mensagem('c1', { type: 'join', code: ROOM.code, name: 'Ana' })
    t.mensagem('c2', { type: 'join', code: ROOM.code, name: 'Caio' })
    const [ana, caio] = t.bridge.players()
    if (ana === undefined || caio === undefined) throw new Error('esperava dois jogadores')
    t.bridge.assignToken(ana.playerId, 'ana-t')
    t.bridge.assignToken(caio.playerId, 'caio-t')
    t.mensagem('c1', { type: 'wait.set', minutes: 5, who: 'Bia' })
    return t
  }

  it('marcou a espera: o Caio recebe a ficha da Ana com a marca, sem esperar o mestre mexer', async () => {
    const t = await mesaComAnaEsperando()
    await vi.advanceTimersByTimeAsync(1000)
    const doCaio = t.sent.filter((s) => s.clientId === 'c2' && (s.msg.type === 'snapshot' || s.msg.type === 'delta'))
    expect(doCaio.at(-1)?.msg.waiting).toEqual(['ana-t'])
    expect(t.bridge.players().find((p) => p.name === 'Ana')?.waiting).toEqual({ who: 'Bia', until: T0 + 5 * MINUTO })
  })

  /**
   * A mesa parada, mas Ana e Caio conectados: o cliente vivo manda o ping de
   * sempre, e a varredura de silêncio da reconexão não os derruba no meio.
   */
  async function passaComPing(t: ReturnType<typeof setup>, ms: number) {
    for (let feito = 0; feito < ms; feito += PING_INTERVAL_MS) {
      await vi.advanceTimersByTimeAsync(Math.min(PING_INTERVAL_MS, ms - feito))
      t.mensagem('c1', { type: 'ping' })
      t.mensagem('c2', { type: 'ping' })
    }
  }

  it('o prazo vence com a mesa parada: a Ana lê o aviso e a marca sai da ficha do Caio', async () => {
    const t = await mesaComAnaEsperando()
    await passaComPing(t, 5 * MINUTO - 1000)
    expect(t.sent.some((s) => s.msg.type === 'wait.ended')).toBe(false)
    await passaComPing(t, 1000)
    expect(t.sent.filter((s) => s.msg.type === 'wait.ended')).toEqual([{ clientId: 'c1', msg: { type: 'wait.ended', reason: 'expired', who: 'Bia' } }])
    const doCaio = t.sent.filter((s) => s.clientId === 'c2' && (s.msg.type === 'snapshot' || s.msg.type === 'delta'))
    expect(doCaio.at(-1)?.msg.waiting).toBeUndefined()
    expect(t.bridge.players().find((p) => p.name === 'Ana')?.waiting).toBeUndefined()
  })

  it('sala fechada: o relógio da espera para junto', async () => {
    const t = await mesaComAnaEsperando()
    await t.bridge.stop()
    const antes = t.sent.length
    await vi.advanceTimersByTimeAsync(10 * MINUTO)
    expect(t.sent.length).toBe(antes)
  })
})
