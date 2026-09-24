import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin, Token } from '../types/map'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * MONTARIA E FAMILIAR do lado da ponte: a ficha principal e o séquito dela
 * passam pela MESMA store (`applyTransfer`), a principal primeiro; o diário
 * anota uma viagem só. O "Trazer" do Grupo move a ficha esquecida para a cena
 * do dono sem "Você chegou" e sem entrar no diário.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

async function mesa(inicio: Record<string, { cena: string; x: number; y: number }>) {
  const onde = { ...inicio }
  const ficha = (id: string, p: { x: number; y: number }): Token => ({ id, characterId: null, name: id, x: p.x, y: p.y, size: 1, image: null })
  const ponte = (id: string, x: number, y: number, sceneId: string, pinId: string): Pin => ({ id, x, y, kind: 'viagem', description: 'Ponte', image: null, destino: { sceneId, pinId } })
  const fichasEm = (cena: string) => Object.entries(onde).filter(([, p]) => p.cena === cena).map(([id, p]) => ficha(id, p))
  const world = (): HostWorld => ({
    open: { sceneId: 'cena-a', name: 'Estrada', map: { ...createEmptyMap('mapa-a', 'A', 40, 10, 50), tokens: fichasEm('cena-a'), pins: [ponte('ponte-a', 525, 275, 'cena-b', 'ponte-b')] } },
    background: [{ sceneId: 'cena-b', name: 'Vila', map: { ...createEmptyMap('mapa-b', 'B', 40, 10, 50), tokens: fichasEm('cena-b'), pins: [ponte('ponte-b', 1025, 275, 'cena-a', 'ponte-a')] } }],
  })
  const applyTransfer = vi.fn((transfer: AppliedTransfer) => {
    onde[transfer.tokenId] = { cena: transfer.toSceneId, x: transfer.x, y: transfer.y }
    return true
  })
  const onTravelLogChange = vi.fn()
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    applyTransfer,
    onPlayersChange: vi.fn(),
    onTravelLogChange,
    now: () => 0,
  })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  await bridge.start()
  emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Bruno' } })
  const bruno = bridge.players().find((p) => p.name === 'Bruno')
  if (bruno === undefined) throw new Error('Bruno deveria ter entrado')
  for (const id of ['bruno', 'ponei', 'faisca']) bridge.assignToken(bruno.playerId, id)
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  return { bridge, bruno, onde, applyTransfer, onTravelLogChange, sent }
}

describe('hostBridge: montaria e familiar viajam com o dono', () => {
  it('"Mandar para…": Bruno e o pônei colado passam pela store, Bruno primeiro; o diário ganha UMA viagem', async () => {
    const m = await mesa({ bruno: { cena: 'cena-a', x: 475, y: 325 }, ponei: { cena: 'cena-a', x: 425, y: 325 }, faisca: { cena: 'cena-a', x: 75, y: 75 } })
    expect(m.bridge.sendPlayer(m.bruno.playerId, 'cena-b', 'ponte-b')).toBe(true)
    expect(m.applyTransfer.mock.calls.map(([t]) => t.tokenId)).toEqual(['bruno', 'ponei'])
    expect(m.onde.ponei.cena).toBe('cena-b')
    expect(m.onde.faisca.cena).toBe('cena-a')
    // O último diário entregue ao painel.
    const diario: unknown = m.onTravelLogChange.mock.calls.at(-1)?.[0]
    expect(diario).toHaveLength(1)
  })

  it('"Trazer": a Faísca vem da Vila para o lado de Bruno, sem "Você chegou" e sem entrar no diário', async () => {
    const m = await mesa({ bruno: { cena: 'cena-a', x: 475, y: 325 }, ponei: { cena: 'cena-a', x: 425, y: 325 }, faisca: { cena: 'cena-b', x: 1425, y: 75 } })
    const antes = m.sent().length
    expect(m.bridge.bringToken(m.bruno.playerId, 'faisca')).toBe(true)
    expect(m.applyTransfer.mock.calls.map(([t]) => [t.tokenId, t.fromSceneId, t.toSceneId])).toEqual([['faisca', 'cena-b', 'cena-a']])
    expect(m.onde.faisca.cena).toBe('cena-a')
    const depois = m.sent().slice(antes)
    expect(JSON.stringify(depois)).not.toMatch(/scene\.changed|Vila/)
    expect(m.onTravelLogChange).not.toHaveBeenCalled()
    // Já está na cena dele: trazer de novo não faz nada.
    expect(m.bridge.bringToken(m.bruno.playerId, 'faisca')).toBe(false)
  })
})
