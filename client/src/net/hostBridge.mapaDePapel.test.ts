/**
 * MAPA DE PAPEL na ponte do mestre: "Dar um mapa a…" do painel manda o aviso
 * só a quem recebeu e, logo atrás, o snapshot com as Salas novas — sem esperar
 * o próximo movimento de alguém.
 */
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { createHostBridge } from './hostBridge'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

/** Fumaça que cobre o Pombal inteiro (1200..1600 x 80..320) com folga. */
const ZONA_SOBRE_O_POMBAL = {
  id: 'z-pombal',
  name: 'Fumaça',
  revealed: false,
  points: [
    { x: 1180, y: 60 },
    { x: 1620, y: 60 },
    { x: 1620, y: 340 },
    { x: 1180, y: 340 },
  ],
}

function mapa(zonaSobreOPombal = false): MapData {
  return {
    ...createEmptyMap('m', 'M', 50, 10, 40),
    concealZones: zonaSobreOPombal ? [ZONA_SOBRE_O_POMBAL] : [],
    tokens: [
      { id: 'heroi', characterId: null, name: 'Herói', x: 100, y: 200, size: 1, image: null },
      { id: 'bruxa', characterId: null, name: 'Bruxa', x: 300, y: 200, size: 1, image: null },
    ],
    regions: [
      {
        id: 'r-pombal',
        points: [
          { x: 1200, y: 80 },
          { x: 1600, y: 80 },
          { x: 1600, y: 320 },
          { x: 1200, y: 320 },
        ],
        tag: '',
        fillColor: '#2b2b2b',
        fillPattern: 'solid',
        data: {},
        room: { shape: 'rect', name: 'Pombal' },
      },
    ],
  }
}

function setup(opts: { zonaSobreOPombal?: boolean } = {}) {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const map = mapa(opts.zonaSobreOPombal)
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove: vi.fn(), applyDoor: vi.fn(), now: () => 0 })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de mensagem')
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  return { bridge, emit, sent }
}

function welcomeId(sent: unknown[], clientId: string): string {
  for (const args of sent) {
    if (typeof args !== 'object' || args === null || !('clientId' in args) || args.clientId !== clientId || !('msg' in args)) continue
    const msg = args.msg
    if (typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'welcome' && 'playerId' in msg && typeof msg.playerId === 'string') return msg.playerId
  }
  throw new Error(`sem welcome para ${clientId}`)
}

const tipos = (sent: unknown[], clientId: string): string[] =>
  sent.flatMap((args) => {
    if (typeof args !== 'object' || args === null || !('clientId' in args) || args.clientId !== clientId || !('msg' in args)) return []
    const msg = args.msg
    return typeof msg === 'object' && msg !== null && 'type' in msg && typeof msg.type === 'string' ? [msg.type] : []
  })

async function mesa(opts: { zonaSobreOPombal?: boolean } = {}) {
  const t = setup(opts)
  await t.bridge.start()
  t.emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  t.emit({ clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Bruno' } })
  const ana = welcomeId(t.sent(), 'c1')
  const bruno = welcomeId(t.sent(), 'c2')
  t.bridge.assignToken(ana, 'heroi')
  t.bridge.assignToken(bruno, 'bruxa')
  return { ...t, ana, bruno }
}

describe('hostBridge — mapa de papel', () => {
  it('dar o Pombal à Ana: devolve 1 Sala, ela recebe o aviso e o snapshot logo atrás; a tela do Bruno não mudou e nada sai para ele', async () => {
    const t = await mesa()
    const antes = t.sent().length
    expect(t.bridge.giveRoomsMap(t.ana, null, ['r-pombal'])).toBe(1)
    expect(tipos(t.sent().slice(antes), 'c1')).toEqual(['map.given', 'snapshot'])
    // Broadcast só o que mudou: o mapa é da Ana, a tela do Bruno é a mesma.
    expect(tipos(t.sent().slice(antes), 'c2')).toEqual([])
  })

  it('nada a dar, ou sala fechada: 0 e nada sai', async () => {
    const t = await mesa()
    const antes = t.sent().length
    expect(t.bridge.giveRoomsMap(t.ana, null, ['r-inventada'])).toBe(0)
    expect(t.sent().slice(antes)).toEqual([])
    const semSala = setup()
    expect(semSala.bridge.giveRoomsMap('p1', null, ['r-pombal'])).toBe(0)
    expect(semSala.sent()).toEqual([])
  })

  it('Pombal todo sob zona oculta ativa: 0, sem aviso à Ana e sem snapshot de graça', async () => {
    const t = await mesa({ zonaSobreOPombal: true })
    const antes = t.sent().length
    expect(t.bridge.giveRoomsMap(t.ana, null, ['r-pombal'])).toBe(0)
    expect(t.sent().slice(antes)).toEqual([])
  })
})
