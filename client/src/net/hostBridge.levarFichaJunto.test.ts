/**
 * LEVAR FICHA JUNTO na ponte do mestre: quando a Ana atravessa o pino, a ponte
 * move a ficha dela e, DEPOIS, cada ficha que ela leva, para a mesma cena.
 * Se a dela não passou, ninguém passa.
 */
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostBridge } from './hostBridge'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { useToastStore } from '../stores/toastStore'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777/player'], qrSvg: '<svg/>' }
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino']): Pin {
  return { id, x, y, kind: 'viagem', description: '', image: null, destino, passagem: 'livre' }
}

function mundo(): HostWorld {
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Salão', 40, 10, 50),
    tokens: [ficha('ana', 225, 225), ficha('ferido', 275, 225, { levadoPor: 'ana' })],
    pins: [
      // A escada encostada na Ana (pino só atravessa de perto); o ferido não a alcança sozinho.
      viagem('escada', 175, 225, { sceneId: CRIPTA, pinId: 'escada-b' }),
      // A porta que pede passagem ao mestre, do lado do ferido.
      { ...viagem('porta', 325, 275, { sceneId: CRIPTA, pinId: 'porta-b' }), passagem: 'pede' },
    ],
  }
  const cripta: MapData = { ...createEmptyMap('mapa-cripta', 'Cripta', 40, 10, 50), pins: [viagem('escada-b', 1025, 275, { sceneId: SALAO, pinId: 'escada' }), viagem('porta-b', 1025, 375, { sceneId: SALAO, pinId: 'porta' })] }
  return { open: { sceneId: SALAO, name: 'Salão', map: salao }, background: [{ sceneId: CRIPTA, name: 'Cripta', map: cripta }] }
}

function setup(applyTransfer: (transfer: AppliedTransfer) => boolean) {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const w = mundo()
  const bridge = createHostBridge({ invoke, listen, getMap: () => w.open.map, getWorld: () => w, applyMove: vi.fn(), applyDoor: vi.fn(), applyTransfer, now: () => 0 })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de mensagem')
    handler({ payload })
  }
  const sentTo = (clientId: string): unknown[] =>
    invoke.mock.calls
      .filter((call) => call[0] === 'net_send')
      .map((call) => call[1])
      .filter((args): args is { clientId: string; msg: unknown } => typeof args === 'object' && args !== null && 'clientId' in args && args.clientId === clientId)
      .map((args) => args.msg)
  const playerId = (clientId: string): string => {
    const msg = sentTo(clientId)[0]
    if (typeof msg !== 'object' || msg === null || !('playerId' in msg) || typeof msg.playerId !== 'string') throw new Error('esperava welcome')
    return msg.playerId
  }
  return { bridge, emit, playerId, sentTo }
}

describe('hostBridge e a ficha levada junto', () => {
  it('a Ana passa pelo pino livre: a ficha dela e depois o ferido mudam de cena', async () => {
    const applyTransfer = vi.fn((_t: AppliedTransfer) => true)
    const t = setup(applyTransfer)
    await t.bridge.start()
    t.emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(t.playerId('c1'), 'ana')
    t.emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escada' } })
    expect(applyTransfer.mock.calls.map(([tr]) => [tr.tokenId, tr.fromSceneId, tr.toSceneId])).toEqual([
      ['ana', SALAO, CRIPTA],
      ['ferido', SALAO, CRIPTA],
    ])
  })

  it('a ficha da Ana não passou: o ferido também fica, e só quem pediu lê a recusa', async () => {
    const applyTransfer = vi.fn((_t: AppliedTransfer) => false)
    const t = setup(applyTransfer)
    await t.bridge.start()
    t.emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(t.playerId('c1'), 'ana')
    // O ferido é a ficha da Bia.
    t.emit({ clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Bia' } })
    t.bridge.assignToken(t.playerId('c2'), 'ferido')
    t.emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escada' } })
    expect(applyTransfer.mock.calls.map(([tr]) => tr.tokenId)).toEqual(['ana'])
    // `dispatch` manda em sequência, sem esperar a volta: deixa a fila andar.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(t.sentTo('c1')).toContainEqual({ type: 'pin.travel.rejected', reason: 'unavailable' })
    expect(t.sentTo('c2').some((m) => typeof m === 'object' && m !== null && 'type' in m && (m.type === 'pin.travel.rejected' || m.type === 'scene.changed'))).toBe(false)
  })

  it('o ferido (Bia) pediu passagem e a Ana o levou pelo pino livre: o aviso do pedido dela sai da tela', async () => {
    useToastStore.setState({ toasts: [] })
    const applyTransfer = vi.fn((_t: AppliedTransfer) => true)
    const t = setup(applyTransfer)
    await t.bridge.start()
    t.emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(t.playerId('c1'), 'ana')
    t.emit({ clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Bia' } })
    t.bridge.assignToken(t.playerId('c2'), 'ferido')
    t.emit({ clientId: 'c2', msg: { type: 'pin.travel.request', pinId: 'porta' } })
    const pedidoDaBia = () => useToastStore.getState().toasts.filter((toast) => toast.text.startsWith('Bia quer passar'))
    expect(pedidoDaBia()).toHaveLength(1)
    t.emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escada' } })
    expect(applyTransfer.mock.calls.map(([tr]) => tr.tokenId)).toEqual(['ana', 'ferido'])
    expect(pedidoDaBia()).toEqual([])
  })

  it('a Bia esperava o mestre e a ficha da Ana não passou pelo pino livre: a Bia lê a recusa do pedido que perdeu', async () => {
    useToastStore.setState({ toasts: [] })
    const applyTransfer = vi.fn((_t: AppliedTransfer) => false)
    const t = setup(applyTransfer)
    await t.bridge.start()
    t.emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(t.playerId('c1'), 'ana')
    t.emit({ clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Bia' } })
    t.bridge.assignToken(t.playerId('c2'), 'ferido')
    t.emit({ clientId: 'c2', msg: { type: 'pin.travel.request', pinId: 'porta' } })
    t.emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escada' } })
    expect(applyTransfer.mock.calls.map(([tr]) => tr.tokenId)).toEqual(['ana'])
    await new Promise((resolve) => setTimeout(resolve, 0))
    // O aviso do mestre sumiu (o pedido morreu na sessão): a Bia não pode ficar "Aguardando o mestre" para sempre.
    expect(useToastStore.getState().toasts.filter((toast) => toast.text.startsWith('Bia quer passar'))).toEqual([])
    expect(t.sentTo('c2')).toContainEqual({ type: 'pin.travel.rejected', reason: 'unavailable' })
    // E ela não lê que foi levada: a ficha dela não saiu do lugar.
    expect(t.sentTo('c2').some((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === 'scene.changed')).toBe(false)
  })

  it('a Bia esperava o mestre e o "Mandar para…" da Ana falhou: a Bia lê a recusa do pedido que perdeu', async () => {
    useToastStore.setState({ toasts: [] })
    const applyTransfer = vi.fn((_t: AppliedTransfer) => false)
    const t = setup(applyTransfer)
    await t.bridge.start()
    t.emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    const ana = t.playerId('c1')
    t.bridge.assignToken(ana, 'ana')
    t.emit({ clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Bia' } })
    t.bridge.assignToken(t.playerId('c2'), 'ferido')
    t.emit({ clientId: 'c2', msg: { type: 'pin.travel.request', pinId: 'porta' } })
    expect(t.bridge.sendPlayer(ana, CRIPTA, null)).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(t.sentTo('c2')).toContainEqual({ type: 'pin.travel.rejected', reason: 'unavailable' })
    expect(t.sentTo('c2').some((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === 'scene.changed')).toBe(false)
  })

  it('a Bia esperava o mestre e a Ana a levou de verdade: ela lê que foi levada, sem recusa nenhuma', async () => {
    const applyTransfer = vi.fn((_t: AppliedTransfer) => true)
    const t = setup(applyTransfer)
    await t.bridge.start()
    t.emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(t.playerId('c1'), 'ana')
    t.emit({ clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Bia' } })
    t.bridge.assignToken(t.playerId('c2'), 'ferido')
    t.emit({ clientId: 'c2', msg: { type: 'pin.travel.request', pinId: 'porta' } })
    t.emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escada' } })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(t.sentTo('c2')).toContainEqual({ type: 'scene.changed', by: 'master' })
    expect(t.sentTo('c2').some((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === 'pin.travel.rejected')).toBe(false)
  })
})
