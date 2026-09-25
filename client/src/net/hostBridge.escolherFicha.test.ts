import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Token } from '../types/map'
import { createHostBridge } from './hostBridge'

/**
 * QUEM CHEGA ESCOLHE A PRÓPRIA FICHA, do lado do mestre: o pedido vira uma
 * linha na caixa "Pedidos" ("Hugo quer jogar com Kael"), com "Aceitar" e
 * "Não". Aceitar dá a ficha e manda o mapa a quem pediu; Não avisa só a ele.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function ficha(id: string, name: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x: 125, y: 125, size: 1, image: null, ...extra }
}

async function sala() {
  const map: MapData = { ...createEmptyMap('m1', 'Taverna', 10, 10, 50), tokens: [ficha('t-kael', 'Kael', { playerCharacter: true }), ficha('t-orc', 'Orc')] }
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => map,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: vi.fn(),
    now: () => 0,
  })
  await bridge.start()
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  return { bridge, emit, sent }
}

function linhaDoPedido() {
  return useToastStore.getState().toasts.find((t) => t.text === 'Hugo quer jogar com Kael')
}

function acao(label: string) {
  const run = linhaDoPedido()?.actions?.find((a) => a.label === label)?.run
  if (run === undefined) throw new Error(`a linha do pedido deveria ter "${label}"`)
  return run
}

describe('hostBridge: pedido de ficha de quem chegou', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('quem entra recebe a lista; o pedido vira linha em "Pedidos"; "Aceitar" dá a ficha e o mapa chega', async () => {
    const { bridge, emit, sent } = await sala()
    emit({ clientId: 'c-hugo', msg: { type: 'join', code: ROOM.code, name: 'Hugo' } })
    expect(sent()).toContainEqual({ clientId: 'c-hugo', msg: { type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }] } })
    emit({ clientId: 'c-hugo', msg: { type: 'seat.claim', tokenId: 't-kael' } })
    expect(sent()).toContainEqual({ clientId: 'c-hugo', msg: { type: 'seat.claim.state', state: 'pending' } })
    expect(linhaDoPedido()?.grupo).toBe('Pedidos')
    expect(linhaDoPedido()?.actions?.map((a) => a.label)).toEqual(['Aceitar', 'Não'])

    const antes = sent().length
    acao('Aceitar')()
    const depois = sent().slice(antes)
    const snapshot = depois.find((args) => JSON.stringify(args).includes('"snapshot"'))
    expect(JSON.stringify(snapshot)).toContain('"ownTokens":["t-kael"]')
    expect(bridge.players().find((p) => p.name === 'Hugo')?.tokenIds).toEqual(['t-kael'])
    expect(linhaDoPedido()).toBeUndefined()
  })

  it('"Não" avisa só quem pediu, e ele continua sem ficha', async () => {
    const { bridge, emit, sent } = await sala()
    emit({ clientId: 'c-hugo', msg: { type: 'join', code: ROOM.code, name: 'Hugo' } })
    emit({ clientId: 'c-hugo', msg: { type: 'seat.claim', tokenId: 't-kael' } })
    acao('Não')()
    expect(sent()).toContainEqual({ clientId: 'c-hugo', msg: { type: 'seat.claim.state', state: 'denied' } })
    expect(bridge.players().find((p) => p.name === 'Hugo')?.tokenIds).toEqual([])
    expect(linhaDoPedido()).toBeUndefined()
  })

  it('o mestre deu a ficha pelo painel antes de responder: a linha do pedido sai sozinha', async () => {
    const { bridge, emit } = await sala()
    emit({ clientId: 'c-hugo', msg: { type: 'join', code: ROOM.code, name: 'Hugo' } })
    emit({ clientId: 'c-hugo', msg: { type: 'seat.claim', tokenId: 't-kael' } })
    const hugo = bridge.players().find((p) => p.name === 'Hugo')
    if (hugo === undefined) throw new Error('Hugo deveria estar na sala')
    bridge.assignToken(hugo.playerId, 't-kael')
    expect(linhaDoPedido()).toBeUndefined()
  })
})
