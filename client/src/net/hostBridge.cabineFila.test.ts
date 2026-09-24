import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CabineDeTransporte, ChamadaAceita } from '../lib/cabine'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Pin } from '../types/map'
import { createHostBridge } from './hostBridge'
import type { AppliedTransfer, HostWorld } from './hostSession'

/**
 * CABINE DE TRANSPORTE, lado da PONTE — a chamada chega ao mestre: a ponte
 * grava a chamada na fila (pelo integrador) e mostra o aviso "Duda chamou a
 * cabine Espinha em Topo", com "Mandar a cabine", que a leva até a parada.
 * O pedido de quem embarcou diz ao mestre que ele está na cabine.
 */

const ROOM = { code: 'CB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const TERREO = { sceneId: 'cena-terreo', pinId: 'grade-terreo' }
const TOPO = { sceneId: 'cena-topo', pinId: 'grade-topo' }

function grade(id: string, destino: Pin['destino']): Pin {
  return { id, x: 300, y: 100, kind: 'viagem', description: 'Grade', image: null, destino, passagem: 'pede' }
}

function mundo(atual: CabineDeTransporte['atual']): HostWorld {
  const terreo: MapData = {
    ...createEmptyMap('m-terreo', 'Térreo', 30, 10, 50),
    tokens: [{ id: 'arco', characterId: null, name: 'Arco', x: 200, y: 100, size: 1, image: null }],
    pins: [grade('grade-terreo', TOPO)],
  }
  const topo: MapData = { ...createEmptyMap('m-topo', 'Topo', 30, 10, 50), pins: [grade('grade-topo', TERREO)] }
  const espinha: CabineDeTransporte = { id: 'cab-espinha', nome: 'Espinha', paradas: [TERREO, TOPO], atual }
  return { open: { sceneId: TERREO.sceneId, name: 'Térreo', map: terreo }, background: [{ sceneId: TOPO.sceneId, name: 'Topo', map: topo }], cabines: [espinha] }
}

async function setup(atual: CabineDeTransporte['atual'], aceita = true) {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const w = mundo(atual)
  const applyCabine = vi.fn()
  const applyChamadaDeCabine = vi.fn((_chamada: ChamadaAceita) => aceita)
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => w.open.map,
    getWorld: () => w,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    applyTransfer: vi.fn((_transfer: AppliedTransfer) => true),
    applyCabine,
    applyChamadaDeCabine,
  })
  const mandar = (msg: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener para net:message')
    handler({ payload: { clientId: 'c1', msg } })
  }
  await bridge.start()
  mandar({ type: 'join', code: ROOM.code, name: 'Duda' })
  const duda = bridge.players().find((p) => p.name === 'Duda')?.playerId
  if (duda === undefined) throw new Error('esperava a Duda na sala')
  bridge.assignToken(duda, 'arco')
  return { mandar, applyCabine, applyChamadaDeCabine }
}

const avisos = () => useToastStore.getState().toasts

describe('hostBridge: chamar a cabine', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('a chamada vai à fila pelo integrador e o mestre lê o aviso com "Mandar a cabine", que a leva até a parada', async () => {
    const t = await setup(TOPO)
    t.mandar({ type: 'cabine.call', pinId: 'grade-terreo' })
    expect(t.applyChamadaDeCabine).toHaveBeenCalledWith({ cabineId: 'cab-espinha', chamada: { parada: TERREO, tokenId: 'arco', nome: 'Arco' } })
    const aviso = avisos().find((a) => a.text === 'Duda chamou a cabine Espinha em Térreo')
    expect(aviso?.actions?.map((a) => a.label)).toEqual(['Mandar a cabine'])
    aviso?.actions?.[0].run()
    expect(t.applyCabine).toHaveBeenCalledWith({ cabineId: 'cab-espinha', parada: TERREO })
  })

  it('o integrador recusou a chamada (já na fila): nenhum aviso novo', async () => {
    const t = await setup(TOPO, false)
    t.mandar({ type: 'cabine.call', pinId: 'grade-terreo' })
    expect(t.applyChamadaDeCabine).toHaveBeenCalledTimes(1)
    expect(avisos().some((a) => a.text.includes('chamou a cabine'))).toBe(false)
  })

  it('quem embarca: o pedido ao mestre diz que ele está na cabine', async () => {
    const t = await setup(TERREO)
    t.mandar({ type: 'pin.travel.request', pinId: 'grade-terreo' })
    expect(avisos().map((a) => a.text)).toContain('Duda quer passar por Grade → Topo (na cabine Espinha)')
    expect(t.applyChamadaDeCabine).not.toHaveBeenCalled()
  })
})
