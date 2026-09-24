/**
 * Ponte do "Recado" do Grupo: o texto sai por `net_send` só para a conexão do
 * jogador escolhido; ninguém mais na sala recebe o frame.
 */
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { createHostBridge } from './hostBridge'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function sala(): MapData {
  return {
    ...createEmptyMap('m', 'Biblioteca', 1000, 1000, 40),
    tokens: [
      { id: 'gabi', characterId: null, name: 'Gabi', x: 200, y: 200, size: 1, image: null },
      { id: 'elisa', characterId: null, name: 'Elisa', x: 240, y: 200, size: 1, image: null },
    ],
  }
}

function setup() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const map = sala()
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove: vi.fn(), applyDoor: vi.fn(), onPlayersChange: vi.fn(), now: () => 0 })
  const emit = (name: string, payload: unknown) => handlers.get(name)?.({ payload })
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  return { bridge, emit, sent }
}

function idDe(sent: unknown[], clientId: string): string {
  for (const args of sent) {
    const text = JSON.stringify(args)
    const found = /"type":"welcome","playerId":"([^"]+)"/.exec(text)
    if (found?.[1] !== undefined && text.includes(`"clientId":"${clientId}"`)) return found[1]
  }
  throw new Error(`sem welcome para ${clientId}`)
}

describe('hostBridge.playerNote (recado para um jogador só)', () => {
  it('sala fechada: null, nada sai', () => {
    const t = setup()
    expect(t.bridge.playerNote('gabi', 'oi')).toBeNull()
    expect(t.sent()).toEqual([])
  })

  it('manda só para a conexão da Gabi; a Elisa, na mesma sala, não recebe o frame', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c-gabi', msg: { type: 'join', code: ROOM.code, name: 'Gabi' } })
    t.emit('net:message', { clientId: 'c-elisa', msg: { type: 'join', code: ROOM.code, name: 'Elisa' } })
    const gabi = idDe(t.sent(), 'c-gabi')
    t.bridge.assignToken(gabi, 'gabi')
    t.bridge.assignToken(idDe(t.sent(), 'c-elisa'), 'elisa')
    const antes = t.sent().length

    expect(t.bridge.playerNote(gabi, 'A carta tem o seu nome.')).toBe('sent')
    const novos = t.sent().slice(antes)
    expect(novos).toEqual([{ clientId: 'c-gabi', msg: { type: 'scene.note', id: expect.any(String), text: 'A carta tem o seu nome.', at: expect.any(Number), onlyYou: true } }])
    expect(JSON.stringify(novos)).not.toContain('c-elisa')
  })
})
