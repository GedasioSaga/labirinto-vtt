import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CabineDeTransporte } from '../lib/cabine'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Pin } from '../types/map'
import { createHostBridge } from './hostBridge'
import type { AppliedTransfer, HostWorld } from './hostSession'

/**
 * CABINE DE TRANSPORTE, lado da PONTE: quem passa pela parada leva a cabine,
 * e a ponte grava a posição nova pelo `applyCabine` do integrador — só se a
 * ficha de fato mudou de cena.
 */

const ROOM = { code: 'CB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const TERREO = { sceneId: 'cena-terreo', pinId: 'grade-terreo' }
const TOPO = { sceneId: 'cena-topo', pinId: 'grade-topo' }

function grade(id: string, destino: Pin['destino']): Pin {
  return { id, x: 300, y: 100, kind: 'viagem', description: 'Grade', image: null, destino, passagem: 'livre' }
}

function mundo(): HostWorld {
  const terreo: MapData = {
    ...createEmptyMap('m-terreo', 'Térreo', 30, 10, 50),
    tokens: [{ id: 'arco', characterId: null, name: 'Arco', x: 200, y: 100, size: 1, image: null }],
    pins: [grade('grade-terreo', TOPO)],
  }
  const topo: MapData = { ...createEmptyMap('m-topo', 'Topo', 30, 10, 50), pins: [grade('grade-topo', TERREO)] }
  const espinha: CabineDeTransporte = { id: 'cab-espinha', nome: 'Espinha', paradas: [TERREO, TOPO], atual: TERREO }
  return { open: { sceneId: TERREO.sceneId, name: 'Térreo', map: terreo }, background: [{ sceneId: TOPO.sceneId, name: 'Topo', map: topo }], cabines: [espinha] }
}

function setup(moveu: boolean) {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const w = mundo()
  const applyTransfer = vi.fn((_transfer: AppliedTransfer) => moveu)
  const applyCabine = vi.fn()
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => w.open.map,
    getWorld: () => w,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    applyTransfer,
    applyCabine,
  })
  const mandar = (msg: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener para net:message')
    handler({ payload: { clientId: 'c1', msg } })
  }
  return { bridge, mandar, applyTransfer, applyCabine }
}

describe('hostBridge: cabine de transporte', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('passou pela parada: a ponte leva a cabine para a chegada', async () => {
    const t = setup(true)
    await t.bridge.start()
    t.mandar({ type: 'join', code: ROOM.code, name: 'Duda' })
    const duda = t.bridge.players().find((p) => p.name === 'Duda')?.playerId
    if (duda === undefined) throw new Error('esperava a Duda na sala')
    t.bridge.assignToken(duda, 'arco')
    t.mandar({ type: 'pin.travel.request', pinId: 'grade-terreo' })
    expect(t.applyTransfer).toHaveBeenCalledTimes(1)
    expect(t.applyCabine).toHaveBeenCalledWith({ cabineId: 'cab-espinha', parada: TOPO })
  })

  it('a ficha não mudou de cena: a cabine fica onde estava', async () => {
    const t = setup(false)
    await t.bridge.start()
    t.mandar({ type: 'join', code: ROOM.code, name: 'Duda' })
    const duda = t.bridge.players().find((p) => p.name === 'Duda')?.playerId
    if (duda === undefined) throw new Error('esperava a Duda na sala')
    t.bridge.assignToken(duda, 'arco')
    t.mandar({ type: 'pin.travel.request', pinId: 'grade-terreo' })
    expect(t.applyTransfer).toHaveBeenCalledTimes(1)
    expect(t.applyCabine).not.toHaveBeenCalled()
  })
})
