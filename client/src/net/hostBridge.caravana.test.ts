import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Pin, Token } from '../types/map'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * CARAVANA, do lado do mestre: arrastar UMA ficha do grupo no mapa-mundi leva
 * as outras junto; parada no porto, o aviso "A caravana chegou a…" oferece
 * "Desembarcar", que leva cada ficha para a cidade e avisa cada jogador.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

function pino(id: string, x: number, y: number, destino: { sceneId: string; pinId: string }): Pin {
  return { id, x, y, kind: 'viagem', description: '', image: null, destino }
}

async function mesa() {
  const cenas: Record<string, MapData> = {
    's-mundo': { ...createEmptyMap('m-mundo', 'Continente', 30, 10, 50), worldMap: true, tokens: [ficha('ficha-ana', 100, 100), ficha('ficha-bia', 150, 100)], pins: [pino('porto', 700, 250, { sceneId: 's-vila', pinId: 'cais' })] },
    's-vila': { ...createEmptyMap('m-vila', 'Vila do Porto', 20, 10, 50), pins: [pino('cais', 300, 200, { sceneId: 's-mundo', pinId: 'porto' })] },
  }
  const world = (): HostWorld => ({
    open: { sceneId: 's-mundo', name: 'Continente', map: cenas['s-mundo'] },
    background: [{ sceneId: 's-vila', name: 'Vila do Porto', map: cenas['s-vila'] }],
  })
  const mover = (sceneId: string, tokenId: string, x: number, y: number) => {
    const cena = cenas[sceneId]
    cenas[sceneId] = { ...cena, tokens: cena.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) }
  }
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const applyMove = vi.fn((tokenId: string, x: number, y: number, sceneId?: string) => mover(sceneId ?? 's-mundo', tokenId, x, y))
  const applyTransfer = vi.fn((t: AppliedTransfer) => {
    const token = cenas[t.fromSceneId].tokens.find((k) => k.id === t.tokenId)
    if (token === undefined) return false
    cenas[t.fromSceneId] = { ...cenas[t.fromSceneId], tokens: cenas[t.fromSceneId].tokens.filter((k) => k.id !== t.tokenId) }
    cenas[t.toSceneId] = { ...cenas[t.toSceneId], tokens: [...cenas[t.toSceneId].tokens, { ...token, x: t.x, y: t.y }] }
    return true
  })
  const bridge = createHostBridge({ invoke, listen, getMap: () => world().open.map, getWorld: world, applyMove, applyDoor: vi.fn(), applyTransfer, onPlayersChange: vi.fn(), now: () => 0 })
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener de ${name}`)
    handler({ payload })
  }
  await bridge.start()
  for (const [clientId, nome, tokenId] of [['c1', 'Ana', 'ficha-ana'], ['c2', 'Bia', 'ficha-bia']]) {
    emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name: nome } })
    const jogador = bridge.players().find((p) => p.name === nome)
    if (jogador === undefined) throw new Error(`${nome} deveria ter entrado`)
    bridge.assignToken(jogador.playerId, tokenId)
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  const oferta = () => useToastStore.getState().toasts.find((t) => t.text.startsWith('A caravana chegou'))
  return { bridge, cenas, mover, applyMove, applyTransfer, sent, oferta }
}

describe('hostBridge: caravana no mapa-mundi', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('a caravana se forma: a segunda ficha vai para a primeira, sem oferta fora da cidade', async () => {
    const m = await mesa()
    expect(m.applyMove).toHaveBeenCalledWith('ficha-bia', 100, 100)
    expect(m.cenas['s-mundo'].tokens.map((t) => [t.x, t.y])).toEqual([[100, 100], [100, 100]])
    expect(m.oferta()).toBeUndefined()
  })

  it('arrastar a Ana até o porto leva a Bia junto e oferece "Desembarcar"; o botão leva as duas à Vila', async () => {
    const m = await mesa()
    m.mover('s-mundo', 'ficha-ana', 700, 250)
    m.bridge.notifyTurnChanged()
    expect(m.applyMove).toHaveBeenLastCalledWith('ficha-bia', 700, 250)
    const oferta = m.oferta()
    expect(oferta?.text).toBe('A caravana chegou a Vila do Porto')
    const desembarcar = oferta?.actions?.find((a) => a.label === 'Desembarcar')
    expect(desembarcar).toBeDefined()

    const antes = m.sent().length
    desembarcar?.run()
    expect(m.applyTransfer.mock.calls.map(([t]) => [t.tokenId, t.toSceneId])).toEqual([
      ['ficha-ana', 's-vila'],
      ['ficha-bia', 's-vila'],
    ])
    expect(m.cenas['s-mundo'].tokens).toEqual([])
    expect(m.cenas['s-vila'].tokens.map((t) => t.id)).toEqual(['ficha-ana', 'ficha-bia'])
    const depois = m.sent().slice(antes)
    expect(depois).toContainEqual({ clientId: 'c1', msg: { type: 'scene.changed', by: 'master' } })
    expect(depois).toContainEqual({ clientId: 'c2', msg: { type: 'scene.changed', by: 'master' } })
    expect(m.oferta()).toBeUndefined()
  })

  it('a caravana sai do porto: a oferta some sozinha', async () => {
    const m = await mesa()
    m.mover('s-mundo', 'ficha-ana', 700, 250)
    m.bridge.notifyTurnChanged()
    expect(m.oferta()).toBeDefined()
    m.mover('s-mundo', 'ficha-bia', 200, 100)
    m.bridge.notifyTurnChanged()
    expect(m.oferta()).toBeUndefined()
    expect(m.applyTransfer).not.toHaveBeenCalled()
  })
})
