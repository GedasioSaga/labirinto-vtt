/**
 * ZONA DE PERIGO na ponte do mestre: quando a ficha de um jogador entra no
 * perigo, o mestre lê "Ana entrou no fogo" (uma vez, não a cada snapshot) e o
 * jogador recebe o aviso dele pelo socket.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ficha, torre, zona } from '../lib/__fixtures__/hazardTower'
import { useToastStore } from '../stores/toastStore'
import { createHostBridge } from './hostBridge'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777/player'], qrSvg: '<svg/>' }

function setup() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const map = torre({ hazards: [zona('fogo-1', 'fogo', ['sala-a'])], tokens: [ficha('ana', 250, 200)] })
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove: vi.fn(), applyDoor: vi.fn(), now: () => 0 })
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener para ${name}`)
    handler({ payload })
  }
  const sentTo = (clientId: string) =>
    invoke.mock.calls
      .filter((call) => call[0] === 'net_send')
      .map((call) => call[1])
      .filter((args): args is { clientId: string; msg: unknown } => typeof args === 'object' && args !== null && 'clientId' in args && args.clientId === clientId)
      .map((args) => args.msg)
  return { bridge, emit, sentTo }
}

function textosDosAvisos(): string[] {
  return useToastStore.getState().toasts.map((toast) => toast.text)
}

describe('hostBridge e a zona de perigo', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('Ana recebe a ficha dentro do fogo: o mestre lê uma vez, e ela recebe o aviso', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    const welcome = t.sentTo('c1')[0]
    if (typeof welcome !== 'object' || welcome === null || !('playerId' in welcome) || typeof welcome.playerId !== 'string') {
      throw new Error('esperava welcome')
    }
    t.bridge.assignToken(welcome.playerId, 'ana')
    expect(textosDosAvisos().filter((texto) => texto.includes('fogo'))).toEqual(['Ana entrou no fogo'])
    expect(t.sentTo('c1')).toContainEqual({ type: 'hazard.entered', kind: 'fogo' })

    // Outro snapshot com a ficha parada no mesmo fogo: nada de aviso novo.
    t.bridge.notifyTurnChanged()
    expect(textosDosAvisos().filter((texto) => texto.includes('fogo'))).toEqual(['Ana entrou no fogo'])
  })
})
