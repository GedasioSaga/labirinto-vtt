import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { Pin, Token } from '../types/map'
import type { HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * CAIXA DE PEDIDOS COM IDADE, do lado do mestre: cada pedido de passagem na
 * Caixa ganha a linha "há 3 min · agora a 20 casas do pino", lida a cada vez
 * que a tela pergunta (`detalhe`) — o relógio andando e a ficha andando
 * aparecem sem pedido novo. A frase do pedido fica a mesma de sempre.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const MIN = 60_000

async function mesa() {
  const estado = { clock: 1_000_000, ana: { x: 200, y: 200 } }
  const ficha = (id: string, x: number, y: number): Token => ({ id, characterId: null, name: id, x, y, size: 1, image: null })
  const escada = (id: string, x: number, y: number, sceneId: string, pinId: string): Pin => ({
    id,
    x,
    y,
    kind: 'viagem',
    description: id === 'escada-a' ? 'Escada que desce' : 'Escada que sobe',
    image: null,
    destino: { sceneId, pinId },
  })
  const world = (): HostWorld => ({
    open: {
      sceneId: 'cena-a',
      name: 'Salão',
      map: { ...createEmptyMap('mapa-a', 'A', 40, 10, 50), tokens: [ficha('ficha-ana', estado.ana.x, estado.ana.y)], pins: [escada('escada-a', 300, 200, 'cena-b', 'escada-b')] },
    },
    background: [{ sceneId: 'cena-b', name: 'Cripta', map: { ...createEmptyMap('mapa-b', 'B', 40, 10, 50), pins: [escada('escada-b', 1000, 250, 'cena-a', 'escada-a')] } }],
  })
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    applyTransfer: vi.fn(() => true),
    onPlayersChange: vi.fn(),
    now: () => estado.clock,
  })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  await bridge.start()
  emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  const ana = bridge.players().find((p) => p.name === 'Ana')
  if (ana === undefined) throw new Error('Ana deveria ter entrado')
  bridge.assignToken(ana.playerId, 'ficha-ana')
  emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escada-a' } })
  const enviados = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').length
  const pedido = () => {
    const toast = useToastStore.getState().toasts.find((t) => t.text.startsWith('Ana quer passar'))
    if (toast === undefined) throw new Error('o pedido de Ana deveria estar na tela')
    return toast
  }
  return { estado, bridge, pedido, enviados }
}

describe('hostBridge: pedido de passagem com idade e distância', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('o pedido novo diz que acabou de chegar e a quantas casas a ficha está do pino', async () => {
    const t = await mesa()
    const toast = t.pedido()
    // A frase de sempre continua inteira: a idade e a distância vêm à parte.
    expect(toast.text).toBe('Ana quer passar por Escada que desce → Cripta')
    // Ana em (200, 200), escada em (300, 200): 100 px = 2 casas de 50 px.
    expect(toast.detalhe?.()).toBe('há menos de 1 min · agora a 2 casas do pino')
  })

  it('o relógio anda e a ficha anda: a mesma linha, lida de novo, mostra os dois', async () => {
    const t = await mesa()
    const toast = t.pedido()
    t.estado.clock += 3 * MIN
    t.estado.ana = { x: 1300, y: 200 }
    // 1.300 - 300 = 1.000 px = 20 casas.
    expect(toast.detalhe?.()).toBe('há 3 min · agora a 20 casas do pino')
  })

  it('ler a linha não manda nada a ninguém: é só a tela do mestre', async () => {
    const t = await mesa()
    const antes = t.enviados()
    t.estado.clock += 5 * MIN
    expect(t.pedido().detalhe?.()).toBe('há 5 min · agora a 2 casas do pino')
    expect(t.enviados()).toBe(antes)
  })

  it('pedido respondido: a linha que ainda estivesse na tela não inventa idade', async () => {
    const t = await mesa()
    const toast = t.pedido()
    const nao = toast.actions?.find((a) => a.label === 'Não')
    if (nao === undefined) throw new Error('o pedido deveria ter "Não"')
    nao.run()
    expect(toast.detalhe?.()).toBe('')
    expect(useToastStore.getState().toasts.filter((x) => x.text.startsWith('Ana quer passar'))).toHaveLength(0)
  })
})
