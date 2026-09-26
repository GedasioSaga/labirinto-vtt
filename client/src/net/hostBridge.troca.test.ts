import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Token } from '../types/map'
import type { AppliedItems, HostWorld } from './hostSession'
import { createHostBridge, tradeUpdateLine } from './hostBridge'

/**
 * MOEDAS E TROCA, do lado do mestre: "Propor troca…" manda a oferta só ao
 * Bruno e deixa uma linha na caixa "Pedidos" com "Desfazer". A contraproposta
 * do Bruno vira linha com "Aceitar" e "Recusar"; "Aceitar" manda o integrador
 * gravar mochila e bolsa juntas, na cena da ficha.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const GRID = 40

const bruno: Token = {
  id: 'bruno',
  characterId: null,
  name: 'Bruno',
  x: 180,
  y: 200,
  size: 1,
  image: null,
  moedas: 5,
  mochila: [
    { id: 'faca', nome: 'Faca de rede' },
    { id: 'vela', nome: 'Vela' },
  ],
}

function mercado(): MapData {
  return { ...createEmptyMap('mapa-mercado', 'Mercado', 1000, 1000, GRID), tokens: [bruno] }
}

const OFERTA = { de: 'Zulmira', dou: { itens: ['Xarope'], moedas: 0 }, peco: { itemIds: ['faca'], moedas: 3 } }

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
  emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Bruno' } })
  const jogador = bridge.players().find((p) => p.name === 'Bruno')
  if (jogador === undefined) throw new Error('Bruno deveria ter entrado')
  bridge.assignToken(jogador.playerId, 'bruno')
  const pedidos = () => useToastStore.getState().toasts.filter((t) => t.grupo === 'Pedidos')
  const ofertaEnviada = (): string => {
    const msg = sent()
      .map((s) => (typeof s === 'object' && s !== null && 'msg' in s ? s.msg : undefined))
      .find((m): m is { type: 'trade.offer'; offerId: string } => typeof m === 'object' && m !== null && 'type' in m && m.type === 'trade.offer')
    if (msg === undefined) throw new Error('a oferta não saiu')
    return msg.offerId
  }
  return { bridge, playerId: jogador.playerId, pedidos, sent, applyItems, emit, ofertaEnviada }
}

function acao(label: string, toast: { actions?: { label: string; run: () => void }[] } | undefined) {
  const found = toast?.actions?.find((a) => a.label === label)
  if (found === undefined) throw new Error(`sem ação ${label}`)
  return found
}

describe('hostBridge: oferta de troca do mestre', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('a oferta sai só ao Bruno e fica na caixa com "Desfazer"', async () => {
    const m = await mesa()
    expect(m.bridge.proposeTrade(m.playerId, 'bruno', OFERTA)).toBe('sent')
    const offerId = m.ofertaEnviada()
    expect(m.sent()).toContainEqual({
      clientId: 'c1',
      msg: { type: 'trade.offer', offerId, tokenId: 'bruno', de: 'Zulmira', dou: { itens: ['Xarope'], moedas: 0 }, peco: { itens: [{ id: 'faca', nome: 'Faca de rede' }], moedas: 3 } },
    })
    const [linha] = m.pedidos()
    expect(linha?.text).toBe('Oferta a Bruno (Zulmira): Xarope por Faca de rede e 3 moedas')
    expect(linha?.actions?.map((a) => a.label)).toEqual(['Desfazer'])
  })

  it('"Desfazer": Bruno lê que a oferta acabou e a linha sai', async () => {
    const m = await mesa()
    m.bridge.proposeTrade(m.playerId, 'bruno', OFERTA)
    const offerId = m.ofertaEnviada()
    acao('Desfazer', m.pedidos()[0]).run()
    expect(m.sent()).toContainEqual({ clientId: 'c1', msg: { type: 'trade.closed', offerId, result: 'cancelled' } })
    expect(m.pedidos()).toHaveLength(0)
  })

  it('contraproposta: a linha pede "Aceitar"/"Recusar"; "Aceitar" grava mochila e bolsa juntas na cena do Bruno', async () => {
    const m = await mesa()
    m.bridge.proposeTrade(m.playerId, 'bruno', OFERTA)
    const offerId = m.ofertaEnviada()
    m.emit('net:message', { clientId: 'c1', msg: { type: 'trade.counter', offerId, itemIds: ['vela'], moedas: 1 } })
    expect(m.pedidos()).toHaveLength(1)
    const [linha] = m.pedidos()
    expect(linha?.text).toBe('Bruno contrapropõe a Zulmira: Vela e 1 moeda por Xarope')
    expect(linha?.actions?.map((a) => a.label)).toEqual(['Aceitar', 'Recusar'])
    acao('Aceitar', linha).run()
    expect(m.applyItems).toHaveBeenCalledWith({
      sceneId: 'cena-mercado',
      mochilas: [{ tokenId: 'bruno', mochila: [{ id: 'faca', nome: 'Faca de rede' }, { id: expect.any(String), nome: 'Xarope' }] }],
      bolsas: [{ tokenId: 'bruno', moedas: 4 }],
    })
    expect(m.sent()).toContainEqual({ clientId: 'c1', msg: { type: 'trade.closed', offerId, result: 'done' } })
    expect(m.pedidos()).toHaveLength(0)
  })

  it('o × da contraproposta vale "Recusar": nada grava', async () => {
    const m = await mesa()
    m.bridge.proposeTrade(m.playerId, 'bruno', OFERTA)
    const offerId = m.ofertaEnviada()
    m.emit('net:message', { clientId: 'c1', msg: { type: 'trade.counter', offerId, itemIds: [], moedas: 2 } })
    m.pedidos()[0]?.onDismiss?.()
    expect(m.applyItems).not.toHaveBeenCalled()
    expect(m.sent()).toContainEqual({ clientId: 'c1', msg: { type: 'trade.closed', offerId, result: 'refused' } })
  })

  it('Bruno aceita: grava na hora e o mestre lê o aviso', async () => {
    const m = await mesa()
    m.bridge.proposeTrade(m.playerId, 'bruno', OFERTA)
    const offerId = m.ofertaEnviada()
    m.emit('net:message', { clientId: 'c1', msg: { type: 'trade.answer', offerId, answer: 'accept' } })
    expect(m.applyItems).toHaveBeenCalledTimes(1)
    expect(m.pedidos()).toHaveLength(0)
    const aviso = useToastStore.getState().toasts.find((t) => t.text.startsWith('Bruno aceitou'))
    expect(aviso?.text).toBe('Bruno aceitou a troca com Zulmira: deu Faca de rede e 3 moedas por Xarope')
  })

  it('o jogador que cai leva a oferta junto: a linha sai', async () => {
    const m = await mesa()
    m.bridge.proposeTrade(m.playerId, 'bruno', OFERTA)
    expect(m.pedidos()).toHaveLength(1)
    m.emit('net:peer', { clientId: 'c1', event: 'disconnected' })
    expect(m.pedidos()).toHaveLength(0)
  })

  it('sem quem grave a mochila, a oferta nem sai', async () => {
    const m = await mesa({ comMochila: false })
    expect(m.bridge.proposeTrade(m.playerId, 'bruno', OFERTA)).toBe('unavailable')
    expect(m.pedidos()).toHaveLength(0)
  })

  it('a linha da recusa e da falha dizem quem e com quem', () => {
    const base = { offerId: 'o', playerName: 'Bruno', de: 'Zulmira', oferta: 'Xarope', pedido: 'Faca' }
    expect(tradeUpdateLine({ ...base, kind: 'refused' })).toBe('Bruno recusou a troca com Zulmira')
    expect(tradeUpdateLine({ ...base, kind: 'failed' })).toBe('A troca de Bruno com Zulmira não deu: faltou o que pagar')
  })
})
