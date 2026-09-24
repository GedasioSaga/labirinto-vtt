import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { TOKEN_ACTION_REPLY_MAX_LENGTH } from '../lib/tokenActions'
import { useToastStore } from '../stores/toastStore'
import type { Token } from '../types/map'
import type { HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * AGIR SOBRE UMA FICHA do lado do mestre: o pedido vira um aviso na Caixa de
 * Pedidos (grupo "Pedidos") com Aceitar e Recusar; a resposta vai só a quem
 * pediu. O × vale "Recusar": a pergunta nunca some sem resposta.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

async function mesa() {
  const world = (): HostWorld => ({
    open: {
      sceneId: 'cena-a',
      name: 'Salão',
      map: { ...createEmptyMap('mapa-a', 'A', 40, 10, 50), tokens: [ficha('ficha-ana', 'Ana', 200, 200), ficha('ficha-bruno', 'Bruno', 400, 200), ficha('severa', 'Severa', 300, 200)] },
    },
    background: [],
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
    onPlayersChange: vi.fn(),
    now: () => 0,
  })
  const emit = (channel: string, payload: unknown) => {
    const handler = handlers.get(channel)
    if (handler === undefined) throw new Error(`sem listener de ${channel}`)
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  await bridge.start()
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
  }
  entra('c1', 'Ana', 'ficha-ana')
  entra('c2', 'Bruno', 'ficha-bruno')
  // O snapshot sai: é o recorte que vale para "a ficha que ele vê".
  bridge.notifyMapChanged()
  vi.runAllTimers()
  return { emit, sent }
}

function pedidos() {
  return useToastStore.getState().toasts.filter((t) => t.grupo === 'Pedidos')
}

describe('hostBridge: pedido de ação sobre ficha', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })

  it('vira aviso na Caixa de Pedidos, e "Aceitar" responde só a quem pediu', async () => {
    const { emit, sent } = await mesa()
    emit('net:message', { clientId: 'c1', msg: { type: 'token.action', reqId: 'a1', tokenId: 'severa', action: 'falar', text: 'Você viu o Lemos?' } })
    const [aviso] = pedidos()
    if (aviso === undefined) throw new Error('esperava o pedido na caixa')
    expect(aviso.text).toBe('Ana → Severa: Falar (a 2 casas) — "Você viu o Lemos?"')
    expect(aviso.actions?.map((a) => a.label)).toEqual(['Aceitar', 'Recusar'])

    const antes = sent().length
    aviso.actions?.find((a) => a.label === 'Aceitar')?.run()
    const depois = sent().slice(antes)
    expect(depois).toEqual([{ clientId: 'c1', msg: { type: 'token.action.answer', reqId: 'a1', accepted: true } }])
    expect(pedidos()).toEqual([])
  })

  it('o pedido traz o campo "Resposta só para Ana", e o texto escrito vai junto com a resposta, só a ela', async () => {
    const { emit, sent } = await mesa()
    emit('net:message', { clientId: 'c1', msg: { type: 'token.action', reqId: 'a1', tokenId: 'severa', action: 'falar', text: 'Você viu o Lemos?' } })
    const [aviso] = pedidos()
    if (aviso === undefined) throw new Error('esperava o pedido na caixa')
    expect(aviso.resposta).toEqual({ rotulo: 'Resposta só para Ana (opcional)', maxLength: TOKEN_ACTION_REPLY_MAX_LENGTH })

    const antes = sent().length
    // A tela passa a `run` o que o mestre escreveu no campo do aviso (components/Toast.tsx).
    aviso.actions?.find((a) => a.label === 'Aceitar')?.run('Ela aponta a torre: "Subiu ontem."')
    expect(sent().slice(antes)).toEqual([{ clientId: 'c1', msg: { type: 'token.action.answer', reqId: 'a1', accepted: true, reply: 'Ela aponta a torre: "Subiu ontem."' } }])
  })

  it('o × do aviso vale "Recusar"', async () => {
    const { emit, sent } = await mesa()
    emit('net:message', { clientId: 'c2', msg: { type: 'token.action', reqId: 'b1', tokenId: 'severa', action: 'empurrar' } })
    const [aviso] = pedidos()
    if (aviso === undefined) throw new Error('esperava o pedido na caixa')
    expect(aviso.text).toBe('Bruno → Severa: Empurrar (a 2 casas)')
    const antes = sent().length
    // O × da tela roda o `onDismiss` do aviso (components/Toasts).
    aviso.onDismiss?.()
    expect(sent().slice(antes)).toEqual([{ clientId: 'c2', msg: { type: 'token.action.answer', reqId: 'b1', accepted: false } }])
    expect(pedidos()).toEqual([])
  })

  it('quem pediu e caiu: o aviso sai da caixa sozinho', async () => {
    const { emit } = await mesa()
    emit('net:message', { clientId: 'c1', msg: { type: 'token.action', reqId: 'a1', tokenId: 'severa', action: 'pedir' } })
    expect(pedidos()).toHaveLength(1)
    emit('net:peer', { clientId: 'c1', event: 'disconnected' })
    expect(pedidos()).toEqual([])
  })
})
