import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { DoorState, MapData, Pin, Token, Wall } from '../types/map'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * FERROLHO do lado do mestre: quem trancou vira um aviso curto; quem tenta do
 * outro lado vira DISPUTA na Caixa de Pedidos, com "Arrombar" (a porta abre)
 * e "Aguenta" (fica como está). O × vale "Aguenta".
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: DoorState | null = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

async function mesa() {
  let porta: DoorState = { open: false, locked: false, kind: 'normal' }
  const mapa = (): MapData => ({
    ...createEmptyMap('mapa-corredor', 'Corredor', 20, 10, 50),
    walls: [parede('norte', 500, 0, 500, 200), parede('porta', 500, 200, 500, 300, porta), parede('sul', 500, 300, 500, 500)],
    tokens: [ficha('ficha-ana', 'Heroina', 450, 250), ficha('ficha-bruno', 'Guarda', 550, 250)],
  })
  const world = (): HostWorld => ({ open: { sceneId: 'cena-a', name: 'Porão', map: mapa() }, background: [] })
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const applyDoor = vi.fn((_wallId: string, open: boolean) => {
    porta = { ...porta, open }
  })
  // Cada leitura do relógio anda 1 s: o limite de um pedido de porta por 250 ms não segura o passo seguinte.
  let t = 0
  const bridge = createHostBridge({ invoke, listen, getMap: () => mapa(), getWorld: world, applyMove: vi.fn(), applyDoor, onPlayersChange: vi.fn(), now: () => (t += 1000) })
  const emit = (channel: string, payload: unknown) => {
    const handler = handlers.get(channel)
    if (handler === undefined) throw new Error(`sem listener de ${channel}`)
    handler({ payload })
  }
  await bridge.start()
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
  }
  entra('c1', 'Ana', 'ficha-ana')
  entra('c2', 'Bruno', 'ficha-bruno')
  bridge.notifyMapChanged()
  vi.runAllTimers()
  return { emit, applyDoor }
}

const pedidos = () => useToastStore.getState().toasts.filter((t) => t.grupo === 'Pedidos')

describe('hostBridge: ferrolho do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })

  it('Ana passa o ferrolho: o mestre lê um aviso curto', async () => {
    const { emit } = await mesa()
    emit('net:message', { clientId: 'c1', msg: { type: 'door.bar', wallId: 'porta', on: true } })
    expect(useToastStore.getState().toasts.map((t) => t.text)).toContain('Ana passou o ferrolho numa porta')
    expect(pedidos()).toEqual([])
  })

  it('Bruno força do outro lado: disputa na Caixa, e "Arrombar" abre a porta', async () => {
    const { emit, applyDoor } = await mesa()
    emit('net:message', { clientId: 'c1', msg: { type: 'door.bar', wallId: 'porta', on: true } })
    emit('net:message', { clientId: 'c2', msg: { type: 'door.toggle', wallId: 'porta' } })
    const [disputa] = pedidos()
    if (disputa === undefined) throw new Error('esperava a disputa na caixa')
    expect(disputa.text).toBe('Bruno tenta abrir a porta que Ana trancou com o ferrolho')
    expect(disputa.actions?.map((a) => a.label)).toEqual(['Arrombar', 'Aguenta'])
    expect(applyDoor).not.toHaveBeenCalled()
    disputa.actions?.find((a) => a.label === 'Arrombar')?.run()
    expect(applyDoor).toHaveBeenCalledWith('porta', true)
    expect(pedidos()).toEqual([])
  })

  it('passagem barrada do outro lado: o pedido diz quem barrou, e "Passa (quebra a barra)" leva a ficha', async () => {
    const naCripta = new Set<string>(['ficha-ana'])
    const escada = (id: string, x: number, description: string, sceneId: string, pinId: string): Pin => ({
      id,
      x,
      y: 200,
      kind: 'viagem',
      description,
      image: null,
      destino: { sceneId, pinId },
      passagem: 'livre',
    })
    const world = (): HostWorld => ({
      open: {
        sceneId: 'cena-a',
        name: 'Salão',
        map: {
          ...createEmptyMap('mapa-a', 'A', 40, 10, 50),
          tokens: naCripta.has('ficha-bruno') ? [] : [ficha('ficha-bruno', 'Guarda', 250, 200)],
          pins: [escada('escada-a', 300, 'Escada que desce', 'cena-b', 'escada-b')],
        },
      },
      background: [
        {
          sceneId: 'cena-b',
          name: 'Cripta',
          map: {
            ...createEmptyMap('mapa-b', 'B', 40, 10, 50),
            tokens: [...naCripta].map((id) => ficha(id, id, id === 'ficha-ana' ? 950 : 1050, 200)),
            pins: [escada('escada-b', 1000, 'Escada que sobe', 'cena-a', 'escada-a')],
          },
        },
      ],
    })
    const handlers = new Map<string, (event: { payload: unknown }) => void>()
    const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
    const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
      handlers.set(name, handler)
      return vi.fn()
    })
    const applyTransfer = vi.fn((transfer: AppliedTransfer) => {
      naCripta.add(transfer.tokenId)
      return true
    })
    let t = 0
    const bridge = createHostBridge({ invoke, listen, getMap: () => world().open.map, getWorld: world, applyMove: vi.fn(), applyDoor: vi.fn(), applyTransfer, now: () => (t += 1000) })
    await bridge.start()
    const emit = (payload: unknown) => handlers.get('net:message')?.({ payload })
    for (const { clientId, name, tokenId } of [
      { clientId: 'c1', name: 'Ana', tokenId: 'ficha-ana' },
      { clientId: 'c2', name: 'Bruno', tokenId: 'ficha-bruno' },
    ]) {
      emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
      const player = bridge.players().find((p) => p.name === name)
      if (player === undefined) throw new Error(`${name} deveria ter entrado`)
      bridge.assignToken(player.playerId, tokenId)
    }
    bridge.notifyMapChanged()
    vi.runAllTimers()

    emit({ clientId: 'c1', msg: { type: 'pin.bar', pinId: 'escada-b', on: true } })
    expect(useToastStore.getState().toasts.map((toast) => toast.text)).toContain('Ana barrou Escada que sobe em Cripta')
    emit({ clientId: 'c2', msg: { type: 'pin.travel.request', pinId: 'escada-a' } })
    expect(applyTransfer).not.toHaveBeenCalled()
    const [pedido] = pedidos()
    if (pedido === undefined) throw new Error('esperava o pedido na caixa')
    expect(pedido.text).toBe('Bruno quer passar por Escada que desce → Cripta (barrada do outro lado por Ana)')
    expect(pedido.actions?.map((a) => a.label)).toEqual(['Passa (quebra a barra)', 'A barra aguenta'])
    expect(pedido.actions?.some((a) => a.emLote === true)).toBe(false)
    pedido.actions?.find((a) => a.label === 'Passa (quebra a barra)')?.run()
    expect(applyTransfer).toHaveBeenCalledWith(expect.objectContaining({ tokenId: 'ficha-bruno', toSceneId: 'cena-b' }))
  })

  it('barra posta com o pedido já na Caixa: "Deixar ir" não leva a ficha e o pedido volta como disputa dizendo quem barrou', async () => {
    const naCripta = new Set<string>(['ficha-ana'])
    // Pino que PEDE passagem: o pedido de Bruno sai com o "Deixar ir" comum, do "Deixar todos".
    const escada = (id: string, x: number, description: string, sceneId: string, pinId: string): Pin => ({
      id,
      x,
      y: 200,
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
          tokens: naCripta.has('ficha-bruno') ? [] : [ficha('ficha-bruno', 'Guarda', 250, 200)],
          pins: [escada('escada-a', 300, 'Escada que desce', 'cena-b', 'escada-b')],
        },
      },
      background: [
        {
          sceneId: 'cena-b',
          name: 'Cripta',
          map: {
            ...createEmptyMap('mapa-b', 'B', 40, 10, 50),
            tokens: [...naCripta].map((id) => ficha(id, id, id === 'ficha-ana' ? 950 : 1050, 200)),
            pins: [escada('escada-b', 1000, 'Escada que sobe', 'cena-a', 'escada-a')],
          },
        },
      ],
    })
    const handlers = new Map<string, (event: { payload: unknown }) => void>()
    const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
    const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
      handlers.set(name, handler)
      return vi.fn()
    })
    const applyTransfer = vi.fn((transfer: AppliedTransfer) => {
      naCripta.add(transfer.tokenId)
      return true
    })
    let t = 0
    const bridge = createHostBridge({ invoke, listen, getMap: () => world().open.map, getWorld: world, applyMove: vi.fn(), applyDoor: vi.fn(), applyTransfer, now: () => (t += 1000) })
    await bridge.start()
    const emit = (payload: unknown) => handlers.get('net:message')?.({ payload })
    for (const { clientId, name, tokenId } of [
      { clientId: 'c1', name: 'Ana', tokenId: 'ficha-ana' },
      { clientId: 'c2', name: 'Bruno', tokenId: 'ficha-bruno' },
    ]) {
      emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
      const player = bridge.players().find((p) => p.name === name)
      if (player === undefined) throw new Error(`${name} deveria ter entrado`)
      bridge.assignToken(player.playerId, tokenId)
    }
    bridge.notifyMapChanged()
    vi.runAllTimers()

    emit({ clientId: 'c2', msg: { type: 'pin.travel.request', pinId: 'escada-a' } })
    const [pedido] = pedidos()
    if (pedido === undefined) throw new Error('esperava o pedido na caixa')
    expect(pedido.text).toBe('Bruno quer passar por Escada que desce → Cripta')
    emit({ clientId: 'c1', msg: { type: 'pin.bar', pinId: 'escada-b', on: true } })
    pedido.actions?.find((a) => a.label === 'Deixar ir')?.run()
    expect(applyTransfer).not.toHaveBeenCalled()
    const [disputa] = pedidos()
    if (disputa === undefined) throw new Error('esperava a disputa na caixa')
    expect(disputa.id).not.toBe(pedido.id)
    expect(disputa.text).toBe('Bruno quer passar por Escada que desce → Cripta (barrada do outro lado por Ana)')
    expect(disputa.actions?.map((a) => a.label)).toEqual(['Passa (quebra a barra)', 'A barra aguenta'])
    expect(disputa.actions?.some((a) => a.emLote === true)).toBe(false)
    disputa.actions?.find((a) => a.label === 'Passa (quebra a barra)')?.run()
    expect(applyTransfer).toHaveBeenCalledWith(expect.objectContaining({ tokenId: 'ficha-bruno', toSceneId: 'cena-b' }))
  })

  it('o × vale "Aguenta": a porta fica fechada', async () => {
    const { emit, applyDoor } = await mesa()
    emit('net:message', { clientId: 'c1', msg: { type: 'door.bar', wallId: 'porta', on: true } })
    emit('net:message', { clientId: 'c2', msg: { type: 'door.toggle', wallId: 'porta' } })
    const [disputa] = pedidos()
    if (disputa === undefined) throw new Error('esperava a disputa na caixa')
    disputa.onDismiss?.()
    expect(applyDoor).not.toHaveBeenCalled()
    expect(pedidos()).toEqual([])
  })
})
