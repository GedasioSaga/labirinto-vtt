/**
 * ALARME PARA VÁRIAS CENAS na ponte do mestre: "Soar alarme" devolve quantos
 * jogadores receberam, o alarme fica ativo para o painel mostrar, e
 * "Encerrar" manda o fim só a quem tinha. Sala fechada: `null`, nada sai.
 */
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'
import { createHostBridge } from './hostBridge'
import type { HostWorld } from './hostSession'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777/player'], qrSvg: '<svg/>' }

function ficha(id: string, x: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y: 100, size: 1, image: null }
}

const MUNDO: HostWorld = {
  open: { sceneId: 's-salao', name: 'Salao Norte', map: { ...createEmptyMap('m-salao', 'Salao Norte', 30, 10, 50), tokens: [ficha('lanterna', 100)] } },
  background: [{ sceneId: 's-porao', name: 'Porao Umido', map: { ...createEmptyMap('m-porao', 'Porao Umido', 30, 10, 50), tokens: [ficha('corda', 200)] } }],
}

function setup() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const bridge = createHostBridge({ invoke, listen, getMap: () => MUNDO.open.map, getWorld: () => MUNDO, applyMove: vi.fn(), applyDoor: vi.fn(), now: () => 0 })
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener para ${name}`)
    handler({ payload })
  }
  const sentTo = (clientId: string) =>
    invoke.mock.calls
      .filter((call) => call[0] === 'net_send')
      .map((call) => call[1])
      .filter((args): args is { clientId: string; msg: unknown } => typeof args === 'object' && args !== null && 'clientId' in args && args.clientId === clientId)
      .map((args) => args.msg)
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name } })
    const welcome = sentTo(clientId)[0]
    if (typeof welcome !== 'object' || welcome === null || !('playerId' in welcome) || typeof welcome.playerId !== 'string') {
      throw new Error('esperava welcome')
    }
    bridge.assignToken(welcome.playerId, tokenId)
  }
  return { bridge, entra, sentTo }
}

describe('hostBridge e o alarme para várias cenas', () => {
  it('sala fechada: null e nenhum alarme ativo', () => {
    const t = setup()
    expect(t.bridge.sceneAlarm(['s-salao'], 'Fogo!')).toBeNull()
    expect(t.bridge.activeAlarm()).toBeNull()
  })

  it('soa para a cena escolhida, conta quem recebeu, e encerrar manda o fim só a quem tinha', async () => {
    const t = setup()
    await t.bridge.start()
    t.entra('c1', 'Ana', 'lanterna')
    t.entra('c2', 'Bruno', 'corda')
    expect(t.bridge.sceneAlarm(['s-salao'], 'Fogo!')).toBe(1)
    expect(t.bridge.activeAlarm()).toEqual({ id: expect.any(String), text: 'Fogo!', sceneIds: ['s-salao'] })
    expect(t.sentTo('c1')).toContainEqual({ type: 'scene.alarm', id: expect.any(String), text: 'Fogo!' })
    expect(JSON.stringify(t.sentTo('c2'))).not.toContain('Fogo!')

    t.bridge.endAlarm()
    expect(t.bridge.activeAlarm()).toBeNull()
    expect(t.sentTo('c1')).toContainEqual({ type: 'scene.alarm.end', id: expect.any(String) })
    expect(JSON.stringify(t.sentTo('c2'))).not.toContain('scene.alarm')
  })
})
