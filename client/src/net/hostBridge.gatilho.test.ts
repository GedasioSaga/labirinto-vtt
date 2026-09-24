import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ficha, torre } from '../lib/__fixtures__/hazardTower'
import { useToastStore } from '../stores/toastStore'
import type { MapData } from '../types/map'
import type { HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * GATILHO DE ÁREA, lado do MESTRE: a ficha de Ana entra na área marcada e o
 * mestre lê "Armadilha: Ana entrou em <área>" — uma vez por entrada.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

async function sala() {
  const estado = { xAna: 250 }
  const mapa = (): MapData => ({
    ...torre({ abertaBC: true, tokens: [ficha('ana', estado.xAna, 200)] }),
    gatilhos: [{ id: 'g-1', kind: 'armadilha', regionId: 'sala-c', revealed: false }],
  })
  const world = (): HostWorld => ({ open: { sceneId: null, name: 'Torre', map: mapa() }, background: [] })
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: mapa,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: vi.fn(),
    now: () => 0,
  })
  await bridge.start()
  const handler = handlers.get('net:message')
  if (handler === undefined) throw new Error('sem listener de net:message')
  handler({ payload: { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } } })
  const ana = bridge.players().find((p) => p.name === 'Ana')
  if (ana === undefined) throw new Error('Ana deveria ter entrado')
  bridge.assignToken(ana.playerId, 'ana')
  return { bridge, estado }
}

function avisos(): string[] {
  return useToastStore.getState().toasts.map((t) => t.text)
}

describe('hostBridge: "Armadilha: <jogador> entrou em <área>"', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('Ana entra na área: o mestre lê o aviso uma vez só', async () => {
    const { bridge, estado } = await sala()
    bridge.notifyTurnChanged()
    expect(avisos().some((t) => t.startsWith('Armadilha'))).toBe(false)
    estado.xAna = 1250
    bridge.notifyTurnChanged()
    expect(avisos()).toContain('Armadilha: Ana entrou em nome-sala-c')
    bridge.notifyTurnChanged()
    expect(avisos().filter((t) => t === 'Armadilha: Ana entrou em nome-sala-c')).toHaveLength(1)
  })
})
