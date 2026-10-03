/**
 * CHAT DOS JOGADORES na ponte do mestre (fatia D): a fala de um jogador chega
 * à tela do mestre (`onMasterChatChange`), e a do mestre sai pelo `net_send`
 * a toda a mesa com `fromMaster`.
 */
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'
import type { MasterChatState } from './hostSession'
import { createHostBridge } from './hostBridge'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function ficha(id: string, x: number): Token {
  return { id, characterId: null, name: id, x, y: 100, size: 1, image: null }
}

type Envio = { clientId: string; msg: { type: string; [key: string]: unknown } }

async function salaComDois() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const onMasterChatChange = vi.fn<(chat: MasterChatState) => void>()
  const mapa = { ...createEmptyMap('m', 'M', 10, 10, 50), tokens: [ficha('lanterna', 100), ficha('machado', 200)] }
  const bridge = createHostBridge({ invoke, listen, getMap: () => mapa, applyMove: vi.fn(), applyDoor: vi.fn(), onMasterChatChange, now: () => 0 })
  await bridge.start()
  const emit = (payload: unknown) => handlers.get('net:message')?.({ payload })
  const enviados = (): Envio[] =>
    invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1] as Envio)
  const idDe = (clientId: string): string => {
    const welcome = enviados().find((e) => e.clientId === clientId && e.msg.type === 'welcome')
    if (welcome === undefined) throw new Error(`sem welcome de ${clientId}`)
    return String(welcome.msg.playerId)
  }
  emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  emit({ clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Bruno' } })
  await Promise.resolve()
  bridge.assignToken(idDe('c1'), 'lanterna')
  bridge.assignToken(idDe('c2'), 'machado')
  invoke.mockClear()
  const chat = () => enviados().filter((e) => e.msg.type === 'chat.msg')
  const apagados = () => enviados().filter((e) => e.msg.type === 'chat.delete')
  return { bridge, emit, chat, apagados, onMasterChatChange }
}

describe('hostBridge: chat do mestre', () => {
  it('a fala de Ana chega à tela do mestre, com a cena e o Global', async () => {
    const t = await salaComDois()
    t.emit({ clientId: 'c1', msg: { type: 'chat.send', reqId: 'r1', channel: 'cena', text: '@mestre posso?', mentions: ['mestre'] } })
    await Promise.resolve()
    expect(t.onMasterChatChange).toHaveBeenCalledTimes(1)
    const lido = t.onMasterChatChange.mock.calls[0]?.[0]
    expect(lido?.scenes).toEqual([{ key: 'm', name: 'M', messages: [{ id: expect.any(String), at: 0, from: 'Ana', text: '@mestre posso?', mentions: ['mestre'] }] }])
  })

  it('o mestre fala no Global: sai a todos com fromMaster e a tela dele relê', async () => {
    const t = await salaComDois()
    expect(t.bridge.masterChatSend('Pausa de 5 minutos')).toBe(true)
    await Promise.resolve()
    expect(t.chat().map((e) => e.clientId).sort()).toEqual(['c1', 'c2'])
    expect(t.chat()[0]?.msg).toMatchObject({ channel: 'global', msg: { from: 'Mestre', text: 'Pausa de 5 minutos', fromMaster: true } })
    expect(t.onMasterChatChange.mock.calls.at(-1)?.[0].global).toHaveLength(1)
    expect(t.bridge.masterChatSend('   ')).toBe(false)
  })

  it('o mestre apaga: chat.delete sai a quem tem a lista e a tela dele relê sem a linha', async () => {
    const t = await salaComDois()
    t.emit({ clientId: 'c2', msg: { type: 'chat.send', reqId: 'r1', channel: 'global', text: 'palavrão', mentions: [] } })
    await Promise.resolve()
    const id = t.onMasterChatChange.mock.calls.at(-1)?.[0].global[0]?.id ?? ''
    expect(t.bridge.masterChatDelete(null, id)).toBe(true)
    await Promise.resolve()
    expect(t.apagados().map((e) => e.clientId).sort()).toEqual(['c1', 'c2'])
    expect(t.onMasterChatChange.mock.calls.at(-1)?.[0].global).toEqual([])
    expect(t.bridge.masterChatDelete(null, id)).toBe(false)
  })

  it('sala fechada: não manda nem apaga nada', () => {
    const bridge = createHostBridge({ invoke: vi.fn(), listen: vi.fn(), getMap: () => createEmptyMap('m', 'M', 10, 10, 50), applyMove: vi.fn(), applyDoor: vi.fn() })
    expect(bridge.masterChatSend('oi')).toBe(false)
    expect(bridge.masterChatDelete(null, 'x')).toBe(false)
  })
})
