import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Pin, Token } from '../types/map'
import { createHostBridge } from './hostBridge'
import type { HostWorld } from './hostSession'

/**
 * ATALHO NA MESMA CENA do lado do integrador: a passagem livre (ou o "Deixar
 * ir") dentro da mesma cena MOVE a ficha no mapa, pelo mesmo caminho do
 * movimento do jogador — nunca pela troca de cena, que recusa origem e
 * destino iguais. Depois vai o "Você chegou" e o snapshot com a ficha no topo.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const TORRE = 'cena-torre'

const ficha = (id: string, x: number, y: number): Token => ({ id, characterId: null, name: id, x, y, size: 1, image: null })
const escada = (id: string, x: number, par: string, extra: Partial<Pin> = {}): Pin => ({
  id,
  x,
  y: 200,
  kind: 'viagem',
  description: id,
  image: null,
  destino: { sceneId: TORRE, pinId: par },
  ...extra,
})

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

async function mesa(passagem: Pin['passagem']) {
  let map: MapData = {
    ...createEmptyMap('mapa-torre', 'Torre', 40, 10, 50),
    tokens: [ficha('heroi', 200, 200)],
    pins: [escada('escada-baixo', 250, 'escada-topo', { passagem }), escada('escada-topo', 1800, 'escada-baixo')],
  }
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const applyMove = vi.fn((tokenId: string, x: number, y: number, _sceneId?: string) => {
    map = { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) }
  })
  const applyTransfer = vi.fn(() => false)
  const world = (): HostWorld => ({ open: { sceneId: TORRE, name: 'Torre', map }, background: [] })
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, getWorld: world, applyMove, applyDoor: vi.fn(), applyTransfer, now: () => 0 })
  await bridge.start()
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  const ana = bridge.players().find((p) => p.name === 'Ana')
  if (ana === undefined) throw new Error('Ana deveria ter entrado')
  bridge.assignToken(ana.playerId, 'heroi')
  /** Tipos das mensagens mandadas a `c1`, em ordem. */
  const enviados = (): string[] =>
    invoke.mock.calls.flatMap((call) => {
      const envio = call[1]
      if (call[0] !== 'net_send' || typeof envio !== 'object' || envio === null || !('clientId' in envio) || !('msg' in envio)) return []
      if (envio.clientId !== 'c1' || typeof envio.msg !== 'object' || envio.msg === null || !('type' in envio.msg)) return []
      return typeof envio.msg.type === 'string' ? [envio.msg.type] : []
    })
  return { bridge, emit, applyMove, applyTransfer, enviados, mapa: () => map }
}

describe('hostBridge: atalho na mesma cena', () => {
  it('livre: move a ficha na cena aberta, manda "Você chegou" e depois o snapshot', async () => {
    const t = await mesa('livre')
    const antes = t.enviados().length
    t.emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escada-baixo' } })
    expect(t.applyTransfer).not.toHaveBeenCalled()
    expect(t.applyMove).toHaveBeenCalledTimes(1)
    const [tokenId, x, y, sceneId] = t.applyMove.mock.calls[0] ?? []
    expect(tokenId).toBe('heroi')
    // Cena aberta: sem o quarto argumento, como o movimento de sempre.
    expect(sceneId).toBeUndefined()
    expect(Math.hypot(Number(x) - 1800, Number(y) - 200)).toBeLessThanOrEqual(50)
    expect(Number(x)).toBeGreaterThan(1700)
    const depois = t.enviados().slice(antes)
    expect(depois[0]).toBe('scene.changed')
    expect(depois).toContain('snapshot')
    expect(depois.indexOf('snapshot')).toBeGreaterThan(depois.indexOf('scene.changed'))
    expect(useToastStore.getState().toasts.map((toast) => toast.text)).toContain('Ana atravessou para outro ponto de Torre')
  })

  it('pede: o "Deixar ir" também move dentro da cena, sem trocar de cena', async () => {
    const t = await mesa('pede')
    t.emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escada-baixo' } })
    expect(t.applyMove).not.toHaveBeenCalled()
    const pedido = useToastStore.getState().toasts.find((toast) => toast.text.startsWith('Ana quer passar'))
    expect(pedido?.text).toBe('Ana quer passar por escada-baixo → Torre')
    const deixar = pedido?.actions?.find((a) => a.label === 'Deixar ir')
    if (deixar === undefined) throw new Error('sem "Deixar ir"')
    deixar.run()
    expect(t.applyTransfer).not.toHaveBeenCalled()
    expect(t.applyMove).toHaveBeenCalledTimes(1)
    expect(t.mapa().tokens[0]?.x).toBeGreaterThan(1700)
    expect(t.enviados()).toContain('scene.changed')
  })
})
