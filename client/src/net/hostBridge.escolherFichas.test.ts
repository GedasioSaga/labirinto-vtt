import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { Pin, Token } from '../types/map'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * ESCOLHER FICHAS NO PINO do lado do mestre: a linha da Caixa de Pedidos diz
 * QUAIS fichas querem passar, e o "Deixar ir" move todas as escolhidas.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function escada(id: string, x: number, y: number, description: string, sceneId: string, pinId: string): Pin {
  return { id, x, y, kind: 'viagem', description, image: null, destino: { sceneId, pinId } }
}

const world = (): HostWorld => ({
  open: {
    sceneId: 'cena-a',
    name: 'Porão',
    map: {
      ...createEmptyMap('mapa-a', 'A', 40, 10, 50),
      tokens: [ficha('enzo', 'Enzo', 240, 200), ficha('rufo', 'Rufo', 270, 200)],
      pins: [escada('escotilha', 300, 200, 'Escotilha', 'cena-b', 'chegada')],
    },
  },
  background: [
    {
      sceneId: 'cena-b',
      name: 'Beiral',
      map: { ...createEmptyMap('mapa-b', 'B', 40, 10, 50), pins: [escada('chegada', 1000, 250, 'Topo', 'cena-a', 'escotilha')] },
    },
  ],
})

async function mesa() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const applyTransfer = vi.fn((_transfer: AppliedTransfer) => true)
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    applyTransfer,
    now: () => 0,
  })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  await bridge.start()
  emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Enzo' } })
  const enzo = bridge.players().find((p) => p.name === 'Enzo')
  if (enzo === undefined) throw new Error('Enzo deveria ter entrado')
  bridge.assignToken(enzo.playerId, 'enzo')
  bridge.assignToken(enzo.playerId, 'rufo')
  useToastStore.setState({ toasts: [] })
  return { emit, applyTransfer }
}

const pedidos = () => useToastStore.getState().toasts.filter((t) => t.grupo === 'Pedidos')

describe('hostBridge: escolher quais fichas passam pelo pino', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('a linha diz quais fichas vão, e o "Deixar ir" move as duas, a mais perto primeiro', async () => {
    const { emit, applyTransfer } = await mesa()
    emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escotilha', tokenIds: ['enzo', 'rufo'] } })
    const linha = pedidos()
    expect(linha.map((t) => t.text)).toEqual(['Enzo quer levar Rufo e Enzo por Escotilha → Beiral'])
    const deixar = linha[0]?.actions?.find((a) => a.label === 'Deixar ir')
    if (deixar === undefined) throw new Error('faltou o "Deixar ir"')
    deixar.run()
    expect(applyTransfer.mock.calls.map(([t]) => [t.tokenId, t.toSceneId])).toEqual([
      ['rufo', 'cena-b'],
      ['enzo', 'cena-b'],
    ])
    const [lider, outra] = applyTransfer.mock.calls.map(([t]) => t)
    expect(outra?.x === lider?.x && outra?.y === lider?.y).toBe(false)
  })

  it('só a ficha com o nome do jogador: a linha é a de sempre', async () => {
    const { emit } = await mesa()
    emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escotilha', tokenIds: ['enzo'] } })
    expect(pedidos().map((t) => t.text)).toEqual(['Enzo quer passar por Escotilha → Beiral'])
  })
})
