import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Pin, Token } from '../types/map'
import type { AppliedItems, HostWorld } from './hostSession'
import { createHostBridge, itemRequestLine } from './hostBridge'

/**
 * ITEM PEGÁVEL, do lado do mestre: o "Pegar" do Diego vira uma linha na caixa
 * "Pedidos"; "Deixar" manda o integrador tirar o pino e pôr a chave na
 * mochila — na cena da chave, mesmo com outra aberta no editor.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const GRID = 40

const diego: Token = { id: 'diego', characterId: null, name: 'Diego', x: 180, y: 200, size: 1, image: null }

function mansao(pin: Pin): MapData {
  return { ...createEmptyMap('mapa-mansao', 'Mansão', 1000, 1000, GRID), pins: [pin], tokens: [diego] }
}

async function mesa(options: { pin?: Pin; comMochila?: boolean } = {}) {
  const pin = options.pin ?? { ...buildPin('pino-chave', { x: 200, y: 200 }, 'exclamacao'), item: { nome: 'Chave do Escudo' } }
  const world = (): HostWorld => ({
    open: { sceneId: 'cena-salao', name: 'Salão', map: createEmptyMap('mapa-salao', 'Salão', 1000, 1000, GRID) },
    background: [{ sceneId: 'cena-mansao', name: 'Mansão', map: mansao(pin) }],
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
  emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Diego' } })
  const jogador = bridge.players().find((p) => p.name === 'Diego')
  if (jogador === undefined) throw new Error('Diego deveria ter entrado')
  bridge.assignToken(jogador.playerId, 'diego')
  const pegar = () => emit('net:message', { clientId: 'c1', msg: { type: 'pin.take', pinId: 'pino-chave' } })
  const pedidos = () => useToastStore.getState().toasts.filter((t) => t.grupo === 'Pedidos')
  return { pegar, pedidos, sent, applyItems, emit }
}

function acao(label: string, toast: { actions?: { label: string; run: () => void }[] } | undefined) {
  const found = toast?.actions?.find((a) => a.label === label)
  if (found === undefined) throw new Error(`sem ação ${label}`)
  return found
}

describe('hostBridge: Pegar vira pedido na caixa', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('Diego pega: "Diego quer pegar Chave do Escudo em Mansão", com "Deixar" e "Não", e abre a caixa sozinho', async () => {
    const m = await mesa()
    m.pegar()
    const [linha] = m.pedidos()
    expect(m.pedidos()).toHaveLength(1)
    expect(linha?.text).toBe('Diego quer pegar Chave do Escudo em Mansão')
    expect(linha?.actions?.map((a) => a.label)).toEqual(['Deixar', 'Não'])
    expect(linha?.sempreEmCaixa).toBe(true)
  })

  it('linha sem cena de fundo não repete o nome da cena', () => {
    expect(itemRequestLine({ requestId: 'r', playerId: 'p', playerName: 'Diego', itemName: 'Chave' })).toBe('Diego quer pegar Chave')
  })

  it('"Deixar": o integrador tira o pino e põe a chave na mochila, na cena da chave; Diego recebe "está com você"', async () => {
    const m = await mesa()
    m.pegar()
    const antes = m.sent().length
    acao('Deixar', m.pedidos()[0]).run()
    expect(m.applyItems).toHaveBeenCalledWith({
      sceneId: 'cena-mansao',
      removePinId: 'pino-chave',
      mochilas: [{ tokenId: 'diego', mochila: [{ id: 'pino-chave', nome: 'Chave do Escudo' }] }],
    })
    expect(m.sent().slice(antes)).toContainEqual({ clientId: 'c1', msg: { type: 'pin.take.answer', answer: 'taken', nome: 'Chave do Escudo' } })
    expect(m.pedidos()).toHaveLength(0)
  })

  it('"Não" e o ×: nada muda, e Diego lê que o mestre disse não', async () => {
    const m = await mesa()
    m.pegar()
    m.pedidos()[0]?.onDismiss?.()
    expect(m.applyItems).not.toHaveBeenCalled()
    expect(m.sent()).toContainEqual({ clientId: 'c1', msg: { type: 'pin.take.answer', answer: 'denied' } })
  })

  it('pino livre: vai direto, sem linha na caixa', async () => {
    const m = await mesa({ pin: { ...buildPin('pino-chave', { x: 200, y: 200 }, 'exclamacao'), item: { nome: 'Moeda', livre: true } } })
    m.pegar()
    expect(m.pedidos()).toHaveLength(0)
    expect(m.applyItems).toHaveBeenCalledTimes(1)
  })

  it('jogador que cai: a linha sai da caixa', async () => {
    const m = await mesa()
    m.pegar()
    m.emit('net:peer', { clientId: 'c1', event: 'disconnected' })
    expect(m.pedidos()).toHaveLength(0)
  })

  it('mestre sem mochila no integrador: nem vira linha, e Diego lê "disse não"', async () => {
    const m = await mesa({ comMochila: false })
    m.pegar()
    expect(m.pedidos()).toHaveLength(0)
    expect(m.sent()).toContainEqual({ clientId: 'c1', msg: { type: 'pin.take.answer', answer: 'denied' } })
  })
})
