/**
 * MOVIMENTO IMPOSTO pela PONTE: o App pede à ponte o raio de cada ficha com
 * dono (`tokenVisionRadii`) para a esteira e a cabine decidirem quem segura
 * quem. Tem de ser o raio que a sessão APLICA ao recorte do jogador — com
 * "Visão nesta cena" e a noite do relógio do mestre —, não o de base.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostBridge } from './hostBridge'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const GRID = 50

function ficha(id: string, x: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y: 125, size: 1, image: null }
}

function setup(hora: { atual: number }) {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return () => undefined
  })
  const map: MapData = { ...createEmptyMap('praca', 'Praça', 20, 10, GRID), tokens: [ficha('ana', 125), ficha('npc', 375)], visionCells: 4 }
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => map,
    applyMove: () => undefined,
    applyDoor: () => undefined,
    onPlayersChange: () => undefined,
    now: () => 0,
    visionRadius: 700,
    getClock: () => hora.atual,
  })
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener para ${name}`)
    handler({ payload })
  }
  return { bridge, emit, map }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('HostBridge.tokenVisionRadii — o raio que a sessão aplica, para a esteira', () => {
  it('sala fechada: nenhum raio (ninguém tem dono)', () => {
    const { bridge, map } = setup({ atual: 12 })
    expect(bridge.tokenVisionRadii(map).size).toBe(0)
  })

  it('sala aberta: a ficha do jogador leva o raio da cena (4 casas = 200 px), não o de base (700); à noite na cena externa, a metade', async () => {
    vi.useFakeTimers()
    const hora = { atual: 12 }
    const { bridge, emit, map } = setup(hora)
    await bridge.start()
    emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    const ana = bridge.players().find((p) => p.name === 'Ana')
    if (ana === undefined) throw new Error('esperava Ana na sala')
    bridge.assignToken(ana.playerId, 'ana')

    expect(bridge.players().find((p) => p.name === 'Ana')?.visionRadius).toBe(700)
    expect(Object.fromEntries(bridge.tokenVisionRadii(map))).toEqual({ ana: 200 })

    hora.atual = 23
    expect(bridge.tokenVisionRadii({ ...map, externa: true }).get('ana')).toBe(100)

    await bridge.stop()
    expect(bridge.tokenVisionRadii(map).size).toBe(0)
  })
})
