import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Token } from '../types/map'
import type { PlayerInfo } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * REMOVER QUEM SAIU E PASSAR FICHAS E MAPA, lado do mestre: "Passar fichas e
 * mapa a…" do card de quem foi embora tira o card e entrega as fichas dele —
 * inclusive a que o mestre tinha guardado — ao jogador escolhido.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function ficha(id: string, name: string, x: number): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null }
}

async function mesa() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  let players: PlayerInfo[] = []
  let map: MapData = { ...createEmptyMap('m', 'Mapa', 30, 10, 50), tokens: [ficha('f-lirio', 'Lírio', 100), ficha('f-escudo', 'Escudo', 300)] }
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => map,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    removeToken: (tokenId: string) => {
      map = { ...map, tokens: map.tokens.filter((t) => t.id !== tokenId) }
    },
    restoreToken: (token: Token) => {
      map = { ...map, tokens: [...map.tokens, token] }
    },
    onPlayersChange: (list) => {
      players = list
    },
  })
  await bridge.start()
  const emit = (event: string, payload: unknown) => {
    const handler = handlers.get(event)
    if (handler === undefined) throw new Error(`sem listener de ${event}`)
    handler({ payload })
  }
  emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  emit('net:message', { clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Fábio' } })
  const ana = bridge.players().find((p) => p.name === 'Ana')
  const fabio = bridge.players().find((p) => p.name === 'Fábio')
  if (ana === undefined || fabio === undefined) throw new Error('Ana e Fábio deveriam ter entrado')
  bridge.assignToken(ana.playerId, 'f-lirio')
  bridge.assignToken(fabio.playerId, 'f-escudo')
  useToastStore.setState({ toasts: [] })
  const cai = (clientId: string) => emit('net:peer', { clientId, event: 'disconnected' })
  return { bridge, cai, ana, fabio, mapa: () => map, players: () => players }
}

beforeEach(() => {
  vi.useFakeTimers()
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('hostBridge: passar fichas e mapa de quem saiu', () => {
  it('o Fábio foi embora: o card sai e o Escudo passa à Ana, que é avisada ao mestre', async () => {
    const m = await mesa()
    m.cai('c2')
    expect(m.bridge.handOverPlayer(m.fabio.playerId, m.ana.playerId)).toBe(true)
    expect(m.players().map((p) => p.name)).toEqual(['Ana'])
    expect(m.players()[0]?.tokenIds).toEqual(['f-lirio', 'f-escudo'])
    expect(useToastStore.getState().toasts.map((t) => t.text)).toContain('Fichas e mapa de Fábio passaram a Ana: Escudo.')
  })

  it('o Escudo guardado volta ao mapa e passa à Ana, não fica sem dono', async () => {
    const m = await mesa()
    m.cai('c2')
    expect(m.bridge.storeTokens(m.fabio.playerId)).toBe(true)
    expect(m.mapa().tokens.map((t) => t.id)).toEqual(['f-lirio'])
    expect(m.bridge.handOverPlayer(m.fabio.playerId, m.ana.playerId)).toBe(true)
    expect(m.mapa().tokens.map((t) => t.id).sort()).toEqual(['f-escudo', 'f-lirio'])
    expect(m.bridge.storedTokens()).toEqual([])
    expect(m.players()[0]?.tokenIds).toEqual(['f-lirio', 'f-escudo'])
  })

  it('quem está conectado não é removido: nada muda', async () => {
    const m = await mesa()
    expect(m.bridge.handOverPlayer(m.fabio.playerId, m.ana.playerId)).toBe(false)
    expect(m.bridge.players().map((p) => p.name)).toEqual(['Ana', 'Fábio'])
    expect(m.bridge.players().find((p) => p.name === 'Ana')?.tokenIds).toEqual(['f-lirio'])
  })
})
