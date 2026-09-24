import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Token } from '../types/map'
import { createHostBridge, secretCheckAnswerText } from './hostBridge'
import type { SecretCheckState } from './hostSession'

/**
 * TESTE SECRETO, lado do integrador: o pedido sai pelo `net_send` só para os
 * escolhidos; a resposta chega ao painel do mestre (`onSecretChecksChange`) e
 * num aviso na tela DELE — e nunca vira `net_send` para jogador nenhum.
 */

const ROOM = { code: 'CR1ME7', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

const ficha = (id: string, x: number): Token => ({ id, characterId: null, name: id, x, y: 200, size: 1, image: null })
const MAPA: MapData = { ...createEmptyMap('m', 'Andar de cima', 40, 10, 50), tokens: [ficha('ficha-gabi', 275), ficha('ficha-ana', 1900)] }

async function mesa() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const onSecretChecksChange = vi.fn<(checks: SecretCheckState[]) => void>()
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => MAPA,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: vi.fn(),
    onSecretChecksChange,
    now: () => 0,
  })
  await bridge.start()
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  const entra = (clientId: string, name: string, tokenId: string): string => {
    emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
    return player.playerId
  }
  const gabi = entra('c-gabi', 'Gabi', 'ficha-gabi')
  const ana = entra('c-ana', 'Ana', 'ficha-ana')
  /** Tudo que saiu para jogador depois deste ponto. */
  const enviados = () => invoke.mock.calls.filter(([cmd]) => cmd === 'net_send').map(([, args]) => JSON.stringify(args))
  /** Id do teste mais novo que o painel recebeu. */
  const ultimoId = (): string => {
    const id = onSecretChecksChange.mock.lastCall?.[0].at(-1)?.id
    if (id === undefined) throw new Error('o painel não recebeu teste nenhum')
    return id
  }
  return { bridge, emit, gabi, ana, invoke, enviados, onSecretChecksChange, ultimoId }
}

afterEach(() => {
  for (const toast of useToastStore.getState().toasts) useToastStore.getState().dismiss(toast.id)
})

describe('hostBridge: teste secreto', () => {
  it('o pedido sai só para quem foi escolhido e o painel do mestre já mostra o teste', async () => {
    const { bridge, gabi, invoke, onSecretChecksChange } = await mesa()
    invoke.mockClear()
    expect(bridge.secretCheck('Percepção', [gabi])).toBe(1)
    const envios = invoke.mock.calls.filter(([cmd]) => cmd === 'net_send')
    expect(envios).toEqual([['net_send', { clientId: 'c-gabi', msg: { type: 'secret.check', id: expect.any(String), label: 'Percepção' } }]])
    expect(onSecretChecksChange).toHaveBeenLastCalledWith([{ id: expect.any(String), label: 'Percepção', asked: [gabi], answers: {}, open: true }])
  })

  it('a resposta vai ao painel e ao aviso do mestre, e não sai para jogador nenhum', async () => {
    const { bridge, emit, gabi, invoke, enviados, onSecretChecksChange, ultimoId } = await mesa()
    bridge.secretCheck('Percepção', [gabi])
    const id = ultimoId()
    invoke.mockClear()
    emit({ clientId: 'c-gabi', msg: { type: 'secret.check.answer', id, result: 187 } })
    expect(onSecretChecksChange).toHaveBeenLastCalledWith([{ id, label: 'Percepção', asked: [gabi], answers: { [gabi]: 187 }, open: true }])
    expect(useToastStore.getState().toasts.map((t) => t.text)).toContain(secretCheckAnswerText('Gabi', 'Percepção', 187))
    expect(enviados().join('')).not.toContain('187')
  })

  it('"Encerrar" avisa quem faltou; fechar a sala apaga o painel; sala fechada não pede', async () => {
    const { bridge, gabi, ana, invoke, onSecretChecksChange, ultimoId } = await mesa()
    bridge.secretCheck('Percepção', [gabi, ana])
    const id = ultimoId()
    invoke.mockClear()
    bridge.closeSecretCheck(id)
    const fechados = invoke.mock.calls.filter(([cmd]) => cmd === 'net_send').map(([, args]) => args)
    expect(fechados).toEqual([
      { clientId: 'c-gabi', msg: { type: 'secret.check.closed', id } },
      { clientId: 'c-ana', msg: { type: 'secret.check.closed', id } },
    ])
    expect(onSecretChecksChange.mock.lastCall?.[0]?.[0]?.open).toBe(false)
    await bridge.stop()
    expect(onSecretChecksChange).toHaveBeenLastCalledWith([])
    expect(bridge.secretCheck('Percepção', [gabi])).toBeNull()
  })

  it('o texto do aviso diz quem, qual teste e o resultado', () => {
    expect(secretCheckAnswerText('Gabi', 'Percepção', 17)).toBe('Gabi — Percepção: 17')
  })
})
