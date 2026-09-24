import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { Pin, Token } from '../types/map'
import type { HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * DESISTIR DO PEDIDO do lado do mestre: quando o pedido sai da sessão (o
 * jogador desistiu, ou a ficha se afastou do pino), a linha dele some da Caixa
 * de Pedidos e o mestre lê um aviso curto no lugar, que some sozinho.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function mesa() {
  // Ana e Bruno encostados na escada (300, 200): pino só atravessa de perto.
  const posicao = { x: 350, y: 200 }
  const ficha = (id: string, name: string, x: number, y: number): Token => ({ id, characterId: null, name, x, y, size: 1, image: null })
  const escada = (id: string, x: number, y: number, description: string, sceneId: string, pinId: string): Pin => ({
    id,
    x,
    y,
    kind: 'viagem',
    description,
    image: null,
    destino: { sceneId, pinId },
  })
  const world = (): HostWorld => ({
    open: {
      sceneId: 'cena-a',
      name: 'Salão',
      map: {
        ...createEmptyMap('mapa-a', 'A', 40, 10, 50),
        tokens: [ficha('ficha-ana', 'Ana', posicao.x, posicao.y), ficha('ficha-bruno', 'Bruno', 250, 200)],
        pins: [escada('escada-a', 300, 200, 'Escada que desce', 'cena-b', 'escada-b')],
      },
    },
    background: [
      {
        sceneId: 'cena-b',
        name: 'Cripta',
        map: { ...createEmptyMap('mapa-b', 'B', 40, 10, 50), pins: [escada('escada-b', 1000, 250, 'Escada que sobe', 'cena-a', 'escada-a')] },
      },
    ],
  })
  return { posicao, world }
}

async function mesaComPedidos() {
  const m = mesa()
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const onPlayersChange = vi.fn()
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => m.world().open.map,
    getWorld: m.world,
    // O mestre aplica o movimento na store; aqui, na posição que o mundo lê.
    applyMove: vi.fn((tokenId: string, x: number, y: number) => {
      if (tokenId !== 'ficha-ana') return
      m.posicao.x = x
      m.posicao.y = y
    }),
    applyDoor: vi.fn(),
    applyTransfer: vi.fn(() => true),
    onPlayersChange,
    now: () => 0,
  })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  await bridge.start()
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
  }
  entra('c1', 'Ana', 'ficha-ana')
  entra('c2', 'Bruno', 'ficha-bruno')
  // Os avisos de entrada não são o assunto: a tela começa só com os pedidos.
  useToastStore.setState({ toasts: [] })
  emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escada-a' } })
  emit({ clientId: 'c2', msg: { type: 'pin.travel.request', pinId: 'escada-a' } })
  return { emit, sent, bridge, onPlayersChange }
}

const textos = () => useToastStore.getState().toasts.map((t) => t.text)

describe('hostBridge: desistir do pedido de passagem', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('Ana desiste: a linha dela some da Caixa, a de Bruno fica, e o mestre lê "Ana desistiu" por pouco tempo', async () => {
    const { emit, sent, bridge } = await mesaComPedidos()
    expect(textos()).toEqual(['Ana quer passar por Escada que desce → Cripta', 'Bruno quer passar por Escada que desce → Cripta'])
    expect(bridge.players().find((p) => p.name === 'Ana')?.travelPending).toBe(true)

    emit({ clientId: 'c1', msg: { type: 'pin.travel.cancel' } })

    expect(textos()).toEqual(['Bruno quer passar por Escada que desce → Cripta', 'Ana desistiu de passar'])
    const aviso = useToastStore.getState().toasts.find((t) => t.text === 'Ana desistiu de passar')
    // Não é pergunta: sem botões, e some sozinho.
    expect(aviso?.kind).toBe('info')
    expect(aviso?.actions).toBeUndefined()
    expect(sent()).toContainEqual({ clientId: 'c1', msg: { type: 'pin.travel.cancelled', reason: 'player' } })
    // O selo "pedido" da lista Cenas sai com a linha.
    expect(bridge.players().find((p) => p.name === 'Ana')?.travelPending).toBeUndefined()
    vi.advanceTimersByTime(10_000)
    expect(textos()).toEqual(['Bruno quer passar por Escada que desce → Cripta'])
  })

  it('a ficha de Ana se afasta do pino: o pedido cai sozinho e o mestre lê que ela saiu de perto', async () => {
    const { emit, sent } = await mesaComPedidos()
    emit({ clientId: 'c1', msg: { type: 'token.move', reqId: 'r1', tokenId: 'ficha-ana', x: 25, y: 200 } })
    expect(textos()).toEqual(['Bruno quer passar por Escada que desce → Cripta', 'Ana se afastou da passagem'])
    expect(sent()).toContainEqual({ clientId: 'c1', msg: { type: 'pin.travel.cancelled', reason: 'far' } })
  })
})
