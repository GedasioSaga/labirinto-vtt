import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Token } from '../types/map'
import { createHostBridge } from './hostBridge'

/**
 * EMPRESTAR A FICHA DE QUEM SAIU, lado do mestre: "Emprestar ficha a" manda
 * na hora o mapa novo a quem recebe (a ficha vem como dele), e a volta do dono
 * manda na hora o mapa sem ela — sem esperar outra mudança do mapa.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function ficha(id: string, name: string, x: number): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null }
}

interface Enviado {
  type: string
  ownTokens?: string[]
}

async function mesa() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const map: MapData = { ...createEmptyMap('m', 'Mapa', 30, 10, 50), tokens: [ficha('f-lirio', 'Lírio', 100), ficha('f-escudo', 'Escudo', 300)] }
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove: vi.fn(), applyDoor: vi.fn(), removeToken: vi.fn(), restoreToken: vi.fn() })
  await bridge.start()
  const emit = (event: string, payload: unknown) => {
    const handler = handlers.get(event)
    if (handler === undefined) throw new Error(`sem listener de ${event}`)
    handler({ payload })
  }
  const enviados = (clientId: string): Enviado[] =>
    invoke.mock.calls
      .filter((call) => call[0] === 'net_send')
      .map((call) => call[1])
      .filter((args): args is { clientId: string; msg: Enviado } => typeof args === 'object' && args !== null && 'clientId' in args && args.clientId === clientId)
      .map((args) => args.msg)
  const ultimoMapa = (clientId: string): Enviado | undefined => enviados(clientId).filter((msg) => msg.type === 'snapshot').at(-1)
  const entra = (clientId: string, name: string, resume?: string) =>
    emit('net:message', { clientId, msg: resume === undefined ? { type: 'join', code: ROOM.code, name } : { type: 'join', code: ROOM.code, name, resume } })
  entra('c1', 'Ana')
  entra('c3', 'Carla')
  const resumeDaAna = /"resumeToken":"([^"]+)"/.exec(JSON.stringify(enviados('c1').find((msg) => msg.type === 'welcome') ?? {}))?.[1]
  const ana = bridge.players().find((p) => p.name === 'Ana')
  const carla = bridge.players().find((p) => p.name === 'Carla')
  if (ana === undefined || carla === undefined || resumeDaAna === undefined) throw new Error('Ana e Carla deveriam ter entrado')
  bridge.assignToken(ana.playerId, 'f-lirio')
  bridge.assignToken(carla.playerId, 'f-escudo')
  useToastStore.setState({ toasts: [] })
  return { bridge, emit, entra, ultimoMapa, ana, carla, resumeDaAna }
}

beforeEach(() => {
  vi.useFakeTimers()
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('hostBridge: emprestar a ficha de quem saiu', () => {
  it('emprestar manda o mapa na hora; a volta da Ana tira a ficha da Carla na hora', async () => {
    const m = await mesa()
    m.emit('net:peer', { clientId: 'c1', event: 'disconnected' })
    expect(m.bridge.lendTokens(m.ana.playerId, m.carla.playerId)).toBe(true)
    expect(m.ultimoMapa('c3')?.ownTokens).toEqual(['f-escudo', 'f-lirio'])
    expect(m.bridge.players().find((p) => p.playerId === m.ana.playerId)?.lentTo).toEqual(['Carla'])
    // Emprestada, a ficha não se guarda: sairia do mapa debaixo da Carla.
    expect(m.bridge.storeTokens(m.ana.playerId)).toBe(false)
    m.entra('c9', 'Ana', m.resumeDaAna)
    expect(m.ultimoMapa('c3')?.ownTokens).toEqual(['f-escudo'])
    expect(m.ultimoMapa('c9')?.ownTokens).toEqual(['f-lirio'])
    expect(m.bridge.players().find((p) => p.playerId === m.ana.playerId)?.lentTo).toBeUndefined()
  })

  it('"Tomar de volta" tira a ficha da Carla na hora; sem empréstimo, não faz nada', async () => {
    const m = await mesa()
    m.emit('net:peer', { clientId: 'c1', event: 'disconnected' })
    expect(m.bridge.endLoans(m.ana.playerId)).toBe(false)
    m.bridge.lendTokens(m.ana.playerId, m.carla.playerId)
    expect(m.bridge.endLoans(m.ana.playerId)).toBe(true)
    expect(m.ultimoMapa('c3')?.ownTokens).toEqual(['f-escudo'])
  })

  it('empréstimo recusado avisa o mestre e não manda nada novo', async () => {
    const m = await mesa()
    // A Ana está conectada: nada a emprestar.
    const antes = m.ultimoMapa('c3')
    expect(m.bridge.lendTokens(m.ana.playerId, m.carla.playerId)).toBe(false)
    expect(m.ultimoMapa('c3')).toBe(antes)
    expect(useToastStore.getState().toasts.map((t) => t.kind)).toEqual(['error'])
  })
})
