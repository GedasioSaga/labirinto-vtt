import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Token } from '../types/map'
import { createHostBridge } from './hostBridge'

/**
 * ESCONDER-SE do lado do integrador: o pedido da Duda vira uma linha que
 * ESPERA o mestre, no grupo "Pedidos". "Deixar" esconde a ficha (`hideToken`,
 * passo do Ctrl+Z do mestre) e manda o snapshot na hora — o Enzo deixa de
 * receber a ficha dela. "Não" (ou o ×) devolve a recusa só à Duda.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const PEDIDO = 'Duda quer se esconder'

const ficha = (id: string, name: string, x: number): Token => ({ id, characterId: null, name, x, y: 200, size: 1, image: null })

async function mesa(comHideToken = true) {
  let map: MapData = { ...createEmptyMap('m', 'Porto', 40, 10, 50), tokens: [ficha('ficha-duda', 'Duda', 250), ficha('ficha-enzo', 'Enzo', 350)] }
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const hideToken = vi.fn((tokenId: string, _sceneId?: string) => {
    map = { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, secret: true } : t)) }
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => map,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    ...(comHideToken ? { hideToken } : {}),
    onPlayersChange: vi.fn(),
    now: () => 0,
  })
  await bridge.start()
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
  }
  entra('c-duda', 'Duda', 'ficha-duda')
  entra('c-enzo', 'Enzo', 'ficha-enzo')
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  /** Fichas do último snapshot enviado a `clientId`. */
  const fichasDe = (clientId: string): string[] => {
    const envios = sent()
    for (let i = envios.length - 1; i >= 0; i -= 1) {
      const envio = envios[i]
      if (typeof envio !== 'object' || envio === null || !('clientId' in envio) || !('msg' in envio) || envio.clientId !== clientId) continue
      const msg = envio.msg
      if (typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'snapshot' && 'map' in msg) {
        const m = msg.map
        if (typeof m === 'object' && m !== null && 'tokens' in m && Array.isArray(m.tokens)) {
          return m.tokens.flatMap((t: unknown) => (typeof t === 'object' && t !== null && 'id' in t && typeof t.id === 'string' ? [t.id] : []))
        }
      }
    }
    throw new Error(`nenhum snapshot para ${clientId}`)
  }
  const pedido = () => {
    const toast = useToastStore.getState().toasts.find((t) => t.text === PEDIDO)
    if (toast === undefined) throw new Error('o pedido deveria aparecer para o mestre')
    return toast
  }
  const acao = (label: string) => {
    const action = pedido().actions?.find((a) => a.label === label)
    if (action === undefined) throw new Error(`sem a ação ${label}`)
    return action
  }
  const pedir = () => emit({ clientId: 'c-duda', msg: { type: 'token.hide.request', tokenId: 'ficha-duda' } })
  return { emit, sent, fichasDe, pedido, acao, pedir, hideToken }
}

describe('hostBridge: pedido de esconder-se', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('o pedido espera o mestre no grupo Pedidos, com "Deixar" e "Não"; nada muda antes da resposta', async () => {
    const m = await mesa()
    m.pedir()
    const toast = m.pedido()
    expect(toast.grupo).toBe('Pedidos')
    expect(toast.actions?.map((a) => a.label)).toEqual(['Deixar', 'Não'])
    expect(m.hideToken).not.toHaveBeenCalled()
    expect(m.fichasDe('c-enzo')).toContain('ficha-duda')
  })

  it('"Deixar": a ficha fica oculta pelo mestre e o Enzo deixa de recebê-la na hora; a Duda continua com a dela', async () => {
    const m = await mesa()
    m.pedir()
    m.acao('Deixar').run()
    expect(m.hideToken).toHaveBeenCalledWith('ficha-duda', undefined)
    expect(m.fichasDe('c-enzo')).toEqual(['ficha-enzo'])
    expect(m.fichasDe('c-duda')).toContain('ficha-duda')
    expect(useToastStore.getState().toasts.some((t) => t.text === PEDIDO)).toBe(false)
  })

  it('"Não": só a Duda recebe a recusa, e nada muda no mapa', async () => {
    const m = await mesa()
    m.pedir()
    const antes = m.sent().length
    m.acao('Não').run()
    expect(m.sent().slice(antes)).toEqual([{ clientId: 'c-duda', msg: { type: 'token.hide.rejected', reason: 'denied' } }])
    expect(m.hideToken).not.toHaveBeenCalled()
    expect(useToastStore.getState().toasts.some((t) => t.text === PEDIDO)).toBe(false)
  })

  it('o × da linha vale "Não"', async () => {
    const m = await mesa()
    m.pedir()
    const antes = m.sent().length
    const fechar = m.pedido().onDismiss
    expect(fechar).toBeTypeOf('function')
    fechar?.()
    expect(m.sent().slice(antes)).toEqual([{ clientId: 'c-duda', msg: { type: 'token.hide.rejected', reason: 'denied' } }])
    expect(m.hideToken).not.toHaveBeenCalled()
  })

  it('integrador sem hideToken: a recusa sai na hora e o mestre nem é perguntado', async () => {
    const m = await mesa(false)
    const antes = m.sent().length
    m.pedir()
    expect(m.sent().slice(antes)).toEqual([{ clientId: 'c-duda', msg: { type: 'token.hide.rejected', reason: 'denied' } }])
    expect(useToastStore.getState().toasts.some((t) => t.text === PEDIDO)).toBe(false)
  })
})
