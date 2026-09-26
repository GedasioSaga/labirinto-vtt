import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { Pin, Token } from '../types/map'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * ESCOLHER FICHAS NO PINO do lado do mestre: a linha do pedido diz QUAIS
 * fichas passam ("Bruno quer passar com Rufo por…"). Sem escolha, a frase de
 * sempre. O "Deixar ir" move só as escolhidas.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function mesa() {
  const naCripta = new Set<string>()
  const ficha = (id: string, name: string, x: number, y: number): Token => ({ id, characterId: null, name, x, y, size: 1, image: null })
  const escada = (id: string, x: number, y: number, description: string, sceneId: string, pinId: string): Pin => ({
    id,
    x,
    y,
    kind: 'viagem',
    description,
    image: null,
    destino: { sceneId, pinId },
  })
  // Enzo é a ficha de Bruno mais perto da escada; Rufo, colada a ela, meia casa mais longe.
  const noSalao = (): Token[] => [ficha('ficha-enzo', 'Enzo', 275, 200), ficha('ficha-rufo', 'Rufo', 225, 200)].filter((t) => !naCripta.has(t.id))
  const world = (): HostWorld => ({
    open: {
      sceneId: 'cena-a',
      name: 'Salão',
      map: { ...createEmptyMap('mapa-a', 'A', 40, 10, 50), tokens: noSalao(), pins: [escada('escada-a', 325, 225, 'Escada que desce', 'cena-b', 'escada-b')] },
    },
    background: [
      {
        sceneId: 'cena-b',
        name: 'Cripta',
        map: {
          ...createEmptyMap('mapa-b', 'B', 40, 10, 50),
          tokens: [...naCripta].map((id) => ficha(id, id, 1025, 275)),
          pins: [escada('escada-b', 1000, 250, 'Escada que sobe', 'cena-a', 'escada-a')],
        },
      },
    ],
  })
  const applyTransfer = vi.fn((transfer: AppliedTransfer) => {
    naCripta.add(transfer.tokenId)
    for (const junto of transfer.entourage ?? []) naCripta.add(junto.tokenId)
    return true
  })
  return { world, applyTransfer, naCripta }
}

async function brunoPede(tokenIds?: string[]) {
  const m = mesa()
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => m.world().open.map,
    getWorld: m.world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    applyTransfer: m.applyTransfer,
    onPlayersChange: vi.fn(),
    now: () => 0,
  })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  await bridge.start()
  emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Bruno' } })
  const bruno = bridge.players().find((p) => p.name === 'Bruno')
  if (bruno === undefined) throw new Error('Bruno deveria ter entrado')
  bridge.assignToken(bruno.playerId, 'ficha-enzo')
  bridge.assignToken(bruno.playerId, 'ficha-rufo')
  const msg = tokenIds === undefined ? { type: 'pin.travel.request', pinId: 'escada-a' } : { type: 'pin.travel.request', pinId: 'escada-a', tokenIds }
  emit({ clientId: 'c1', msg })
  return m
}

const linhaDoPedido = () => useToastStore.getState().toasts.find((toast) => toast.text.startsWith('Bruno quer passar'))

describe('hostBridge: a linha do pedido diz quais fichas passam', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('só Rufo escolhido: "Bruno quer passar com Rufo por…", e o "Deixar ir" leva só o Rufo', async () => {
    const m = await brunoPede(['ficha-rufo'])
    const linha = linhaDoPedido()
    expect(linha?.text).toBe('Bruno quer passar com Rufo por Escada que desce → Cripta')
    linha?.actions?.find((a) => a.label === 'Deixar ir')?.run()
    expect(m.applyTransfer).toHaveBeenCalledTimes(1)
    expect([...m.naCripta]).toEqual(['ficha-rufo'])
  })

  it('as duas escolhidas: a linha nomeia as duas, a da frente primeiro', async () => {
    await brunoPede(['ficha-rufo', 'ficha-enzo'])
    expect(linhaDoPedido()?.text).toBe('Bruno quer passar com Enzo e Rufo por Escada que desce → Cripta')
  })

  it('sem escolha, a frase de sempre', async () => {
    await brunoPede()
    expect(linhaDoPedido()?.text).toBe('Bruno quer passar por Escada que desce → Cripta')
  })
})
