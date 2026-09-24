import { beforeEach, describe, expect, it, vi } from 'vitest'
import { agruparAvisos, deixarTodos } from '../components/caixaDeAvisos'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { Pin, Token } from '../types/map'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * CAIXA DE PEDIDOS (G4) do lado de quem responde: o "Deixar todos" passa pela
 * mesma revalidação do "Deixar ir" em cada pedido. Arquivo à parte de
 * `hostBridge.test.ts` para não disputar o mesmo trecho com outras frentes.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

/** Salão (aberto) e Cripta (de fundo). Ana e Bruno perto da escada; `semBruno` tira a ficha dele do mapa. */
function mesa() {
  const estado = { naCripta: new Set<string>(), semBruno: false }
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
  const noSalao = (): Token[] =>
    // Os dois encostados na escada (300, 200): pino só atravessa de perto.
    [ficha('ficha-ana', 'Ana', 350, 200), ficha('ficha-bruno', 'Bruno', 250, 200)].filter(
      (t) => !estado.naCripta.has(t.id) && !(t.id === 'ficha-bruno' && estado.semBruno),
    )
  const world = (): HostWorld => ({
    open: {
      sceneId: 'cena-a',
      name: 'Salão',
      map: { ...createEmptyMap('mapa-a', 'A', 40, 10, 50), tokens: noSalao(), pins: [escada('escada-a', 300, 200, 'Escada que desce', 'cena-b', 'escada-b')] },
    },
    background: [
      {
        sceneId: 'cena-b',
        name: 'Cripta',
        map: {
          ...createEmptyMap('mapa-b', 'B', 40, 10, 50),
          tokens: [...estado.naCripta].map((id) => ficha(id, id, 1025, 275)),
          pins: [escada('escada-b', 1000, 250, 'Escada que sobe', 'cena-a', 'escada-a')],
        },
      },
    ],
  })
  const applyTransfer = vi.fn((transfer: AppliedTransfer) => {
    estado.naCripta.add(transfer.tokenId)
    return true
  })
  return { estado, world, applyTransfer }
}

async function mesaComDoisPedidos() {
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
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  await bridge.start()
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
  }
  entra('c1', 'Bruno', 'ficha-bruno')
  entra('c2', 'Ana', 'ficha-ana')
  // Bruno pede primeiro: a falha dele vem ANTES do pedido de Ana no lote.
  emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escada-a' } })
  emit({ clientId: 'c2', msg: { type: 'pin.travel.request', pinId: 'escada-a' } })
  return { ...m, sent }
}

describe('hostBridge: "Deixar todos" da caixa de pedidos', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('dois pedidos viram uma caixa; o que falha a revalidação é recusado só ao jogador dele, e o outro passa', async () => {
    const { estado, applyTransfer, sent } = await mesaComDoisPedidos()
    const itens = agruparAvisos(useToastStore.getState().toasts)
    const caixa = itens.find((item) => item.tipo === 'caixa')
    if (caixa === undefined || caixa.tipo !== 'caixa') throw new Error('dois pedidos deveriam virar uma caixa')
    expect(caixa.toasts.map((t) => t.text)).toEqual(['Bruno quer passar por Escada que desce → Cripta', 'Ana quer passar por Escada que desce → Cripta'])

    // Entre o pedido e o "Deixar todos", a ficha de Bruno some do Salão: a revalidação dele falha.
    estado.semBruno = true
    const antes = sent().length
    deixarTodos(caixa.toasts, useToastStore.getState().dismiss)

    const depois = sent().slice(antes)
    // Bruno lê a recusa, e nada de "Você chegou" para ele. (Sem ficha, ele
    // também volta à espera do lobby no snapshot seguinte — é o efeito do
    // mapa, não da caixa.)
    const paraBruno = depois.filter((args) => JSON.stringify(args).includes('"clientId":"c1"'))
    expect(paraBruno[0]).toEqual({ clientId: 'c1', msg: { type: 'pin.travel.rejected', reason: 'unavailable' } })
    expect(paraBruno).not.toContainEqual({ clientId: 'c1', msg: { type: 'scene.changed' } })
    expect(depois).toContainEqual({ clientId: 'c2', msg: { type: 'scene.changed' } })
    expect(applyTransfer).toHaveBeenCalledTimes(1)
    expect(applyTransfer).toHaveBeenCalledWith(expect.objectContaining({ tokenId: 'ficha-ana', toSceneId: 'cena-b' }))
    // Respondidos os dois, nenhum pedido sobra na tela, e a chegada de Ana aparece.
    const textos = useToastStore.getState().toasts.map((t) => t.text)
    expect(textos.filter((texto) => texto.includes('quer passar'))).toEqual([])
    expect(textos).toContain('Ana entrou em Cripta')
  })
})
