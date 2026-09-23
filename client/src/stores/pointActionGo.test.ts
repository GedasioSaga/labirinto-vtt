import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createHostBridge } from '../net/hostBridge'
import type { HostWorld, PointActionRequest } from '../net/hostSession'
import type { Token } from '../types/map'
import { useAdventureStore } from './adventureStore'
import { goToPointAction } from './pointActionGo'
import { useSignalStore } from './signalStore'
import { useToastStore } from './toastStore'

/**
 * "Ir lá" da AÇÃO NO PONTO no editor, com as stores de verdade: a câmera
 * centra no ponto e o anel do jogador marca o lugar. É o que o App passa à
 * ponte como `onPointActionGo`.
 */

const pedido = (sceneId: string | null): PointActionRequest => ({
  requestId: 'r1',
  playerId: 'p-fabi',
  playerName: 'Fabi',
  color: '#e11d48',
  action: 'procurar',
  x: 120,
  y: 130,
  roomName: 'Ferreiro',
  sceneId,
  sceneName: 'Vila',
  background: false,
})

describe('goToPointAction ("Ir lá" da ação no ponto)', () => {
  const inicial = useAdventureStore.getState()

  beforeEach(() => {
    useSignalStore.getState().clear()
    useToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    useSignalStore.getState().clear()
    useAdventureStore.setState({ activeSceneId: inicial.activeSceneId, cameraRequest: inicial.cameraRequest })
  })

  it('cena aberta: centra no ponto e marca com o anel de Fabi', () => {
    useAdventureStore.setState({ activeSceneId: 'cena-vila', cameraRequest: null })
    goToPointAction(pedido('cena-vila'))
    expect(useAdventureStore.getState().cameraRequest).toEqual({ camera: null, focus: { x: 120, y: 130 } })
    expect(useSignalStore.getState().signals).toEqual([expect.objectContaining({ playerId: 'p-fabi', name: 'Fabi', color: '#e11d48', x: 120, y: 130 })])
  })

  it('mapa solto (sem cena): centra e marca no mapa aberto', () => {
    useAdventureStore.setState({ activeSceneId: null, cameraRequest: null })
    goToPointAction(pedido(null))
    expect(useAdventureStore.getState().cameraRequest).toEqual({ camera: null, focus: { x: 120, y: 130 } })
    expect(useSignalStore.getState().signals).toHaveLength(1)
  })

  it('cena que não abre: nem câmera nem anel no mapa errado', () => {
    useAdventureStore.setState({ activeSceneId: 'cena-vila', cameraRequest: null })
    goToPointAction(pedido('cena-que-nao-existe'))
    expect(useAdventureStore.getState().cameraRequest).toBeNull()
    expect(useSignalStore.getState().signals).toEqual([])
  })

  it('pela ponte: o "Ir lá" da linha "Fabi quer Procurar" centra e marca o ponto', async () => {
    useAdventureStore.setState({ activeSceneId: 'cena-vila', cameraRequest: null })
    const ficha: Token = { id: 'ficha-fabi', characterId: null, name: 'Fabi', x: 100, y: 100, size: 1, image: null }
    const world = (): HostWorld => ({
      open: { sceneId: 'cena-vila', name: 'Vila', map: { ...createEmptyMap('mapa-vila', 'Vila', 30, 10, 50), tokens: [ficha] } },
      background: [],
    })
    const handlers = new Map<string, (event: { payload: unknown }) => void>()
    const room = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
    const bridge = createHostBridge({
      invoke: vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? room : undefined)),
      listen: vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
        handlers.set(name, handler)
        return vi.fn()
      }),
      getMap: () => world().open.map,
      getWorld: world,
      applyMove: vi.fn(),
      applyDoor: vi.fn(),
      onPointActionGo: goToPointAction,
      now: () => 0,
    })
    await bridge.start()
    const emit = (payload: unknown) => handlers.get('net:message')?.({ payload })
    emit({ clientId: 'c1', msg: { type: 'join', code: room.code, name: 'Fabi' } })
    const fabi = bridge.players().find((p) => p.name === 'Fabi')
    if (fabi === undefined) throw new Error('Fabi deveria ter entrado')
    bridge.assignToken(fabi.playerId, 'ficha-fabi')
    emit({ clientId: 'c1', msg: { type: 'point.action', action: 'procurar', x: 120, y: 130 } })

    const irLa = useToastStore
      .getState()
      .toasts.find((t) => t.text.startsWith('Fabi quer Procurar'))
      ?.actions?.find((a) => a.label === 'Ir lá')
    if (irLa === undefined) throw new Error('a linha do pedido deveria ter "Ir lá"')
    irLa.run()

    expect(useAdventureStore.getState().cameraRequest).toEqual({ camera: null, focus: { x: 120, y: 130 } })
    expect(useSignalStore.getState().signals).toEqual([expect.objectContaining({ playerId: fabi.playerId, name: 'Fabi', x: 120, y: 130 })])
  })
})
