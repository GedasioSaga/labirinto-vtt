/**
 * TELA DA MESA na ponte do mestre: a TV que entra avisa o mestre e conta no
 * painel; escolher a cena manda o snapshot na hora; lixo mandado pela TV não
 * a derruba como join recusado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData } from '../types/map'
import { createHostBridge } from './hostBridge'
import { MAX_TABLE_SCREENS } from './hostSession'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777/player'], qrSvg: '<svg/>' }

function mapa(): MapData {
  return { ...createEmptyMap('m-solto', 'Porao Secreto', 20, 10, 50), tokens: [{ id: 'heroi', characterId: null, name: 'Heroi', x: 100, y: 100, size: 1, image: null }] }
}

function setup() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const onTableScreensChange = vi.fn()
  const map = mapa()
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove: vi.fn(), applyDoor: vi.fn(), onTableScreensChange, now: () => 0 })
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
  const kicked = () => invoke.mock.calls.filter((call) => call[0] === 'net_kick')
  return { bridge, emit, sentTo, kicked, onTableScreensChange }
}

/** O join da TV com a chave que a ponte gerou para esta sala (vai só no link da aba Jogo). */
function tela(bridge: { tableKey(): string | null }) {
  const tableKey = bridge.tableKey()
  if (tableKey === null) throw new Error('sala sem chave da tela')
  return { type: 'join', code: ROOM.code, name: 'Tela da mesa', role: 'table', tableKey }
}

describe('hostBridge e a tela da mesa', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('a TV entra: espera, o mestre é avisado de onde escolher a cena e a contagem sobe', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'tv', msg: tela(t.bridge) })
    expect(t.sentTo('tv')).toEqual([{ type: 'lobby.waiting' }])
    expect(t.onTableScreensChange).toHaveBeenLastCalledWith(1)
    expect(useToastStore.getState().toasts.map((toast) => toast.text)).toEqual(['A tela da mesa conectou. Escolha a cena dela na aba Jogo.'])
  })

  it('escolher a cena manda o recorte na hora, sem o nome do mapa', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'tv', msg: tela(t.bridge) })
    t.bridge.setTableScene('m-solto')
    const ultimo = t.sentTo('tv').at(-1)
    expect(ultimo).toMatchObject({ type: 'snapshot', ownTokens: [] })
    expect(JSON.stringify(ultimo)).not.toContain('Porao Secreto')
  })

  it('lixo mandado pela TV depois de entrar não a derruba', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'tv', msg: tela(t.bridge) })
    t.emit('net:message', { clientId: 'tv', msg: { type: 'qualquer' } })
    expect(t.kicked()).toEqual([])
  })

  it('a chave da tela existe só com a sala aberta, e a próxima sala tem outra', async () => {
    const t = setup()
    expect(t.bridge.tableKey()).toBeNull()
    await t.bridge.start()
    const primeira = t.bridge.tableKey()
    expect(primeira).not.toBeNull()
    await t.bridge.stop()
    expect(t.bridge.tableKey()).toBeNull()
    await t.bridge.start()
    expect(t.bridge.tableKey()).not.toBe(primeira)
  })

  it('só o código da sala (sem a chave do link da TV): recusa, derruba o socket e não avisa TV conectada', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'intruso', msg: { type: 'join', code: ROOM.code, name: 'Caio', role: 'table' } })
    await vi.waitFor(() => expect(t.kicked()).toEqual([['net_kick', { clientId: 'intruso' }]]))
    expect(t.sentTo('intruso')).toEqual([{ type: 'error', reason: 'bad_table_key' }])
    expect(useToastStore.getState().toasts.map((toast) => toast.text)).not.toContain('A tela da mesa conectou.')
    expect(t.onTableScreensChange).not.toHaveBeenCalledWith(1)
  })

  it('TV recusada por table_full é derrubada: não segura vaga de jogador no servidor', async () => {
    const t = setup()
    await t.bridge.start()
    for (let i = 0; i < MAX_TABLE_SCREENS; i += 1) t.emit('net:message', { clientId: `tv${i}`, msg: tela(t.bridge) })
    t.emit('net:message', { clientId: 'tv-extra', msg: tela(t.bridge) })
    await vi.waitFor(() => expect(t.kicked()).toEqual([['net_kick', { clientId: 'tv-extra' }]]))
    expect(t.sentTo('tv-extra')).toEqual([{ type: 'error', reason: 'table_full' }])
  })

  it('a TV que cai sai da contagem', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'tv', msg: tela(t.bridge) })
    t.emit('net:peer', { clientId: 'tv', event: 'disconnected' })
    expect(t.onTableScreensChange).toHaveBeenLastCalledWith(0)
  })
})
