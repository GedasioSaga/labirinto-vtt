import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { mapChangeCause, useMapStore } from '../stores/mapStore'
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

/**
 * CARAVANA x DESFAZER, com a store DE VERDADE e a mesma ligação do App
 * (`applyMove` com histórico, seguidores sem, e o aviso de desfazer pela
 * `mapChangeCause`). O Ctrl+Z do mestre anda para trás passo a passo e o
 * refazer continua de pé: a caravana não briga com ele.
 */
async function mesaNaStore(fichas: Token[]) {
  useMapStore.getState().loadMap({ ...createEmptyMap('m-mundo', 'Continente', 30, 10, 50), worldMap: true, tokens: fichas })
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => useMapStore.getState().map,
    applyMove: (tokenId, x, y) => useMapStore.getState().setTokenPosition(tokenId, x, y),
    applyCaravanMoves: (moves) => useMapStore.getState().setTokenPositionsLive(moves.map(({ tokenId, x, y }) => ({ id: tokenId, x, y }))),
    applyDoor: vi.fn(),
    onPlayersChange: vi.fn(),
    now: () => 0,
  })
  const unsubscribe = useMapStore.subscribe((state, previous) => {
    const cause = mapChangeCause(state, previous)
    if (cause !== null) bridge.notifyMapChanged(cause)
  })
  await bridge.start()
  const entra = (clientId: string, nome: string, tokenId: string) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload: { clientId, msg: { type: 'join', code: ROOM.code, name: nome } } })
    const jogador = bridge.players().find((p) => p.name === nome)
    if (jogador === undefined) throw new Error(`${nome} deveria ter entrado`)
    bridge.assignToken(jogador.playerId, tokenId)
  }
  const retrato = () => {
    const { map, past, future } = useMapStore.getState()
    return `${map.tokens.map((t) => `${t.id}@${t.x}`).join(',')} past=${past.length} future=${future.length}`
  }
  const encerra = async () => {
    unsubscribe()
    await bridge.stop()
  }
  return { bridge, entra, retrato, encerra }
}

describe('hostBridge: o desfazer do mestre com a caravana no mapa-mundi', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('arrastar a caravana é UM passo: Ctrl+Z volta o grupo inteiro, depois o npc, e o refazer continua de pé', async () => {
    const m = await mesaNaStore([ficha('a', 100, 100), ficha('b', 100, 100), ficha('npc', 400, 100)])
    m.entra('c1', 'Ana', 'a')
    m.entra('c2', 'Bia', 'b')
    const store = () => useMapStore.getState()
    store().setTokenPosition('npc', 450, 100)
    store().setTokenPosition('a', 300, 100)
    m.bridge.notifyTurnChanged()
    expect(m.retrato()).toBe('a@300,b@300,npc@450 past=2 future=0')

    store().undo()
    m.bridge.notifyTurnChanged()
    expect(m.retrato()).toBe('a@100,b@100,npc@450 past=1 future=1')
    store().undo()
    m.bridge.notifyTurnChanged()
    expect(m.retrato()).toBe('a@100,b@100,npc@400 past=0 future=2')
    // Mais Ctrl+Z não faz a caravana pular sozinha.
    store().undo()
    m.bridge.notifyTurnChanged()
    expect(m.retrato()).toBe('a@100,b@100,npc@400 past=0 future=2')

    store().redo()
    m.bridge.notifyTurnChanged()
    expect(m.retrato()).toBe('a@100,b@100,npc@450 past=1 future=1')
    store().redo()
    m.bridge.notifyTurnChanged()
    expect(m.retrato()).toBe('a@300,b@300,npc@450 past=2 future=0')
    await m.encerra()
  })

  it('Ctrl+Z para antes de uma ficha entrar no grupo: a caravana NÃO corre atrás dela, é ela que volta ao grupo, sem apagar o refazer', async () => {
    const m = await mesaNaStore([ficha('a', 100, 100), ficha('c', 500, 100), ficha('npc', 400, 100)])
    m.entra('c1', 'Ana', 'a')
    const store = () => useMapStore.getState()
    store().setTokenPosition('npc', 450, 100)
    // A Bia recebe a ficha c: ela vai até a caravana (sem passo no desfazer).
    m.entra('c2', 'Bia', 'c')
    expect(m.retrato()).toBe('a@100,c@100,npc@450 past=1 future=0')
    store().setTokenPosition('npc', 460, 100)

    store().undo()
    store().undo()
    m.bridge.notifyTurnChanged()
    // O retrato antigo tem a c longe: ela volta à caravana; a Ana não vai até ela.
    expect(m.retrato()).toBe('a@100,c@100,npc@400 past=0 future=2')

    store().redo()
    store().redo()
    m.bridge.notifyTurnChanged()
    expect(m.retrato()).toBe('a@100,c@100,npc@460 past=2 future=0')
    await m.encerra()
  })
})

describe('mapChangeCause: de onde veio o mapa novo', () => {
  it('desfazer e refazer são "history"; ação nova é "edit"; mudança fora do mapa é null', () => {
    useMapStore.getState().loadMap({ ...createEmptyMap('m', 'M', 10, 10, 50), tokens: [ficha('a', 100, 100)] })
    const causas: ('edit' | 'history' | null)[] = []
    const unsubscribe = useMapStore.subscribe((state, previous) => causas.push(mapChangeCause(state, previous)))
    useMapStore.getState().setTokenPosition('a', 200, 100)
    useMapStore.getState().undo()
    useMapStore.getState().redo()
    useMapStore.getState().setTokenPositionsLive([{ id: 'a', x: 300, y: 100 }])
    useMapStore.getState().setCamera({ x: 5, y: 5, scale: 1 })
    unsubscribe()
    expect(causas).toEqual(['edit', 'history', 'history', 'edit', null])
  })
})
