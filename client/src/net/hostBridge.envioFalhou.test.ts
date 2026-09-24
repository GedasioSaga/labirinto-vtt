/**
 * HOST RECALCULA SÓ A CENA QUE MUDOU — o envio que falha numa conexão viva
 * (fila do jogador cheia, `SendError::Backlogged` no Rust) não pode deixar a
 * tela dele velha: o próximo broadcast reenvia o recorte, mesmo sem a cena
 * dele mudar. Antes do "só a cena que mudou", todo broadcast reenviava tudo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData } from '../types/map'
import { BROADCAST_THROTTLE_MS, createHostBridge } from './hostBridge'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function sampleMap(): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [
      { id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null },
      { id: 'guarda', characterId: null, name: 'Guarda', x: 320, y: 200, size: 1, image: null },
    ],
  }
}

/** Deixa rodar as rejeições do `net_send` (e o `.catch` delas). */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve()
}

function setup() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  let backlogged = false
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => {
    if (cmd === 'net_send' && backlogged) throw new Error('backlogged')
    return cmd === 'net_start_room' ? ROOM : undefined
  })
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  let map = sampleMap()
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove: vi.fn(), applyDoor: vi.fn(), now: () => 0 })
  const emit = (name: string, payload: unknown) => handlers.get(name)?.({ payload })
  const snapshotsTo = (clientId: string) =>
    invoke.mock.calls.filter((call) => {
      const args = call[1]
      if (call[0] !== 'net_send' || typeof args !== 'object' || args === null) return false
      const msg: unknown = 'msg' in args ? args.msg : null
      return 'clientId' in args && args.clientId === clientId && typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'snapshot'
    }).length
  const setBacklogged = (value: boolean) => {
    backlogged = value
  }
  const hideGuard = () => {
    map = { ...map, tokens: map.tokens.map((t) => (t.id === 'guarda' ? { ...t, hidden: true } : t)) }
  }
  return { bridge, emit, snapshotsTo, setBacklogged, hideGuard }
}

describe('hostBridge: envio que falhou numa conexão viva', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('o snapshot de Ana não sai: o broadcast seguinte, com o mesmo mapa, manda de novo', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    const ana = t.bridge.players()[0]?.playerId ?? ''
    t.bridge.assignToken(ana, 'heroi')
    // Assenta: o envio seguinte com o mesmo mapa já não repete nada.
    t.bridge.notifyMapChanged()
    vi.advanceTimersByTime(BROADCAST_THROTTLE_MS)
    const assentado = t.snapshotsTo('c1')
    t.bridge.notifyMapChanged()
    vi.advanceTimersByTime(BROADCAST_THROTTLE_MS)
    expect(t.snapshotsTo('c1')).toBe(assentado)

    // A fila de Ana está cheia; o mestre esconde o guarda.
    t.setBacklogged(true)
    t.hideGuard()
    t.bridge.notifyMapChanged()
    vi.advanceTimersByTime(BROADCAST_THROTTLE_MS)
    await flush()
    expect(t.snapshotsTo('c1')).toBe(assentado + 1)
    expect(useToastStore.getState().toasts.map((toast) => toast.text)).toContain('Falha ao enviar para jogador: backlogged')

    // A fila esvaziou. Nada mudou na cena dela, e mesmo assim o recorte volta a sair.
    t.setBacklogged(false)
    t.bridge.notifyMapChanged()
    vi.advanceTimersByTime(BROADCAST_THROTTLE_MS)
    expect(t.snapshotsTo('c1')).toBe(assentado + 2)
  })
})
