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

const TELA = { type: 'join', code: ROOM.code, name: 'Tela da mesa', role: 'table' }

describe('hostBridge e a tela da mesa', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('a TV entra: espera, o mestre é avisado de onde escolher a cena e a contagem sobe', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'tv', msg: TELA })
    expect(t.sentTo('tv')).toEqual([{ type: 'lobby.waiting' }])
    expect(t.onTableScreensChange).toHaveBeenLastCalledWith(1)
    expect(useToastStore.getState().toasts.map((toast) => toast.text)).toEqual(['A tela da mesa conectou. Escolha a cena dela na aba Jogo.'])
  })

  it('escolher a cena manda o recorte na hora, sem o nome do mapa', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'tv', msg: TELA })
    t.bridge.setTableScene('m-solto')
    const ultimo = t.sentTo('tv').at(-1)
    expect(ultimo).toMatchObject({ type: 'snapshot', ownTokens: [] })
    expect(JSON.stringify(ultimo)).not.toContain('Porao Secreto')
  })

  it('lixo mandado pela TV depois de entrar não a derruba', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'tv', msg: TELA })
    t.emit('net:message', { clientId: 'tv', msg: { type: 'qualquer' } })
    expect(t.kicked()).toEqual([])
  })

  it('a TV que cai sai da contagem', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'tv', msg: TELA })
    t.emit('net:peer', { clientId: 'tv', event: 'disconnected' })
    expect(t.onTableScreensChange).toHaveBeenLastCalledWith(0)
  })
})
