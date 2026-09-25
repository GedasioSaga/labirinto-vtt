/**
 * DADO ROLADO NA SALA na ponte do mestre: a rolagem de um jogador sai pelo
 * `net_send` a toda a mesa e chega à tela do mestre (`onDiceRoll`); a do
 * mestre sai igual, menos a ESCONDIDA, que não toca o transporte.
 */
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { HostDiceRoll } from './hostSession'
import { createHostBridge } from './hostBridge'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

async function salaComDois() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const onDiceRoll = vi.fn<(roll: HostDiceRoll) => void>()
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => createEmptyMap('m', 'M', 10, 10, 50),
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onDiceRoll,
    now: () => 0,
  })
  await bridge.start()
  const emit = (payload: unknown) => handlers.get('net:message')?.({ payload })
  emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  emit({ clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Bruno' } })
  invoke.mockClear()
  const dados = () =>
    invoke.mock.calls
      .filter((call) => call[0] === 'net_send')
      .map((call) => call[1])
      .filter((args): args is { clientId: string; msg: { type: string } } => typeof args === 'object' && args !== null && Reflect.get(Reflect.get(args, 'msg') ?? {}, 'type') === 'dice.rolled')
  return { bridge, emit, dados, onDiceRoll }
}

describe('hostBridge: dado rolado na sala', () => {
  it('a rolagem de Ana vai à mesa inteira e aparece na tela do mestre', async () => {
    const t = await salaComDois()
    t.emit({ clientId: 'c1', msg: { type: 'dice.roll', count: 2, sides: 6, modifier: 3 } })
    await Promise.resolve()
    expect(t.dados().map((args) => args.clientId).sort()).toEqual(['c1', 'c2'])
    expect(t.onDiceRoll).toHaveBeenCalledTimes(1)
    expect(t.onDiceRoll.mock.calls[0]?.[0]).toMatchObject({ from: 'Ana', count: 2, sides: 6, modifier: 3 })
  })

  it('a do mestre aberta sai para todos; a escondida só aparece na tela dele', async () => {
    const t = await salaComDois()
    const aberta = t.bridge.rollDice({ count: 1, sides: 20, modifier: 0 }, false)
    await Promise.resolve()
    expect(aberta).toMatchObject({ from: 'Mestre', master: true })
    expect(t.dados()).toHaveLength(2)

    const escondida = t.bridge.rollDice({ count: 1, sides: 20, modifier: 0 }, true)
    await Promise.resolve()
    expect(escondida).toMatchObject({ hidden: true })
    expect(t.dados()).toHaveLength(2)
    expect(t.onDiceRoll).toHaveBeenCalledTimes(2)
    expect(t.onDiceRoll.mock.calls[1]?.[0]).toMatchObject({ hidden: true })
  })

  it('sala fechada: não rola nada', () => {
    const bridge = createHostBridge({ invoke: vi.fn(), listen: vi.fn(), getMap: () => createEmptyMap('m', 'M', 10, 10, 50), applyMove: vi.fn(), applyDoor: vi.fn() })
    expect(bridge.rollDice({ count: 1, sides: 6, modifier: 0 }, false)).toBeNull()
  })
})
