import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Pin, Token } from '../types/map'
import type { AppliedItems, HostWorld } from './hostSession'
import { createHostBridge, purchaseRequestLine } from './hostBridge'

/**
 * LOJA COM PREÇOS, do lado do mestre: o "Quero" da Ana vira uma linha na
 * caixa "Pedidos" com "Vender" e "Não". "Vender" manda o integrador baixar o
 * estoque e pôr a mercadoria na mochila — na cena da banca, mesmo com outra
 * aberta no editor. "Não" (ou o ×) só responde.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const GRID = 40

const ana: Token = { id: 'ana', characterId: null, name: 'Ana', x: 180, y: 200, size: 1, image: null }

const BOTICA: Pin = {
  id: 'botica',
  x: 200,
  y: 200,
  kind: 'exclamacao',
  description: 'Botica de Zulmira',
  image: null,
  loja: [
    { id: 'xarope', nome: 'Xarope de tosse', preco: '1 moeda', estoque: 3 },
    { id: 'chave', nome: 'Chave-mestra', preco: '' },
  ],
}

function mercado(): MapData {
  return { ...createEmptyMap('mapa-mercado', 'Mercado', 1000, 1000, GRID), pins: [BOTICA], tokens: [ana] }
}

async function mesa(options: { comMochila?: boolean } = {}) {
  const world = (): HostWorld => ({
    open: { sceneId: 'cena-salao', name: 'Salão', map: createEmptyMap('mapa-salao', 'Salão', 1000, 1000, GRID) },
    background: [{ sceneId: 'cena-mercado', name: 'Mercado', map: mercado() }],
  })
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const applyItems = vi.fn((_change: AppliedItems) => undefined)
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    ...(options.comMochila === false ? {} : { applyItems }),
    onPlayersChange: vi.fn(),
    now: () => 0,
  })
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener de ${name}`)
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  await bridge.start()
  emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  const jogador = bridge.players().find((p) => p.name === 'Ana')
  if (jogador === undefined) throw new Error('Ana deveria ter entrado')
  bridge.assignToken(jogador.playerId, 'ana')
  const quero = (itemId: string) => emit('net:message', { clientId: 'c1', msg: { type: 'pin.buy', pinId: 'botica', itemId } })
  const pedidos = () => useToastStore.getState().toasts.filter((t) => t.grupo === 'Pedidos')
  return { quero, pedidos, sent, applyItems, emit }
}

function acao(label: string, toast: { actions?: { label: string; run: () => void }[] } | undefined) {
  const found = toast?.actions?.find((a) => a.label === label)
  if (found === undefined) throw new Error(`sem ação ${label}`)
  return found
}

describe('hostBridge: o "Quero" vira pedido na caixa', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('"Ana quer Xarope de tosse (1 moeda) em Botica de Zulmira, Mercado", com "Vender" e "Não", sozinho já em caixa', async () => {
    const m = await mesa()
    m.quero('xarope')
    expect(m.pedidos()).toHaveLength(1)
    const [linha] = m.pedidos()
    expect(linha?.text).toBe('Ana quer Xarope de tosse (1 moeda) em Botica de Zulmira, Mercado')
    expect(linha?.actions?.map((a) => a.label)).toEqual(['Vender', 'Não'])
    expect(linha?.sempreEmCaixa).toBe(true)
    // Vender é uma mercadoria por vez: nada de "Deixar todos" respondendo em lote.
    expect(linha?.actions?.some((a) => a.emLote === true)).toBe(false)
  })

  it('a linha sem preço e sem cena de fundo não inventa parênteses nem vírgula', () => {
    expect(purchaseRequestLine({ requestId: 'r', playerId: 'p', playerName: 'Ana', pinLabel: 'Botica', itemName: 'Chave', preco: '' })).toBe('Ana quer Chave em Botica')
  })

  it('"Vender": o integrador baixa o estoque e põe o xarope na mochila, na cena da banca; Ana lê que comprou', async () => {
    const m = await mesa()
    m.quero('xarope')
    const antes = m.sent().length
    acao('Vender', m.pedidos()[0]).run()
    expect(m.applyItems).toHaveBeenCalledWith({
      sceneId: 'cena-mercado',
      venda: { pinId: 'botica', itemId: 'xarope' },
      mochilas: [{ tokenId: 'ana', mochila: [{ id: expect.any(String), nome: 'Xarope de tosse' }] }],
    })
    expect(m.sent().slice(antes)).toContainEqual({ clientId: 'c1', msg: { type: 'pin.buy.answer', answer: 'sold', nome: 'Xarope de tosse' } })
    expect(m.pedidos()).toHaveLength(0)
  })

  it('"Não" e o ×: nada muda, e Ana lê que o mestre não vendeu', async () => {
    const m = await mesa()
    m.quero('xarope')
    m.pedidos()[0]?.onDismiss?.()
    expect(m.applyItems).not.toHaveBeenCalled()
    expect(m.sent()).toContainEqual({ clientId: 'c1', msg: { type: 'pin.buy.answer', answer: 'denied' } })
  })

  it('jogador que cai: a linha sai da caixa', async () => {
    const m = await mesa()
    m.quero('xarope')
    expect(m.pedidos()).toHaveLength(1)
    m.emit('net:peer', { clientId: 'c1', event: 'disconnected' })
    expect(m.pedidos()).toHaveLength(0)
  })

  it('mestre sem mochila no integrador: nem vira linha, e Ana lê que o mestre não vendeu', async () => {
    const m = await mesa({ comMochila: false })
    m.quero('xarope')
    expect(m.pedidos()).toHaveLength(0)
    expect(m.sent()).toContainEqual({ clientId: 'c1', msg: { type: 'pin.buy.answer', answer: 'denied' } })
  })
})
