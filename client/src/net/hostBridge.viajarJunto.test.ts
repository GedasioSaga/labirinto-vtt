import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { Pin, Token } from '../types/map'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * VIAJAR JUNTO (G10) do lado da ponte: o aviso do pedido ganha "Deixar ir com
 * quem está perto (N)" só com alguém perto, e o clique leva cada um pela mesma
 * conclusão do "Deixar ir" (store primeiro, depois o "Você chegou").
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const TOGETHER = /com quem está perto/

/** Salão (aberto) e Cripta (de fundo). `pos` diz onde cada ficha está no Salão; quem viajou sai dele. */
async function mesa(pos: Record<string, { x: number; y: number }>) {
  const naCripta = new Map<string, { x: number; y: number }>()
  const ficha = (id: string, p: { x: number; y: number }): Token => ({ id, characterId: null, name: id, x: p.x, y: p.y, size: 1, image: null })
  const escada = (id: string, x: number, y: number, sceneId: string, pinId: string): Pin => ({ id, x, y, kind: 'viagem', description: 'Escada', image: null, destino: { sceneId, pinId } })
  const world = (): HostWorld => ({
    open: {
      sceneId: 'cena-a',
      name: 'Salão',
      map: {
        ...createEmptyMap('mapa-a', 'A', 40, 10, 50),
        tokens: Object.entries(pos).filter(([id]) => !naCripta.has(id)).map(([id, p]) => ficha(id, p)),
        pins: [escada('escada-a', 525, 275, 'cena-b', 'escada-b')],
      },
    },
    background: [
      {
        sceneId: 'cena-b',
        name: 'Cripta',
        map: { ...createEmptyMap('mapa-b', 'B', 40, 10, 50), tokens: [...naCripta].map(([id, p]) => ficha(id, p)), pins: [escada('escada-b', 1025, 275, 'cena-a', 'escada-a')] },
      },
    ],
  })
  const applyTransfer = vi.fn((transfer: AppliedTransfer) => {
    naCripta.set(transfer.tokenId, { x: transfer.x, y: transfer.y })
    return true
  })
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
    now: () => 0,
  })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  await bridge.start()
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
  }
  entra('c1', 'Ana', 'ficha-ana')
  entra('c2', 'Bruno', 'ficha-bruno')
  const pede = (clientId: string) => emit({ clientId, msg: { type: 'pin.travel.request', pinId: 'escada-a' } })
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  return { pede, sent, applyTransfer, naCripta }
}

const avisoDe = (nome: string) => useToastStore.getState().toasts.find((t) => t.text.startsWith(`${nome} quer passar`))

describe('hostBridge: "Deixar ir com quem está perto"', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('sem ninguém perto, o aviso não oferece o botão', async () => {
    const m = await mesa({ 'ficha-ana': { x: 475, y: 325 }, 'ficha-bruno': { x: 625, y: 325 } })
    m.pede('c1')
    expect(avisoDe('Ana')?.actions?.map((a) => a.label)).toEqual(['Deixar ir', 'Não'])
  })

  it('com Bruno perto: o botão diz (1), leva os dois e cada um lê a chegada; o pedido de Bruno sai da tela junto', async () => {
    const m = await mesa({ 'ficha-ana': { x: 475, y: 325 }, 'ficha-bruno': { x: 575, y: 325 } })
    m.pede('c1')
    m.pede('c2')
    const botao = avisoDe('Ana')?.actions?.find((a) => TOGETHER.test(a.label))
    if (botao === undefined) throw new Error('o aviso de Ana deveria oferecer ir com quem está perto')
    expect(botao.label).toBe('Deixar ir com quem está perto (1)')
    const antes = m.sent().length
    botao.run()
    expect(m.applyTransfer.mock.calls.map(([t]) => t.tokenId)).toEqual(['ficha-ana', 'ficha-bruno'])
    const depois = m.sent().slice(antes)
    expect(depois).toContainEqual({ clientId: 'c1', msg: { type: 'scene.changed' } })
    expect(depois).toContainEqual({ clientId: 'c2', msg: { type: 'scene.changed' } })
    // Nenhum nome de cena ao jogador.
    expect(JSON.stringify(depois)).not.toMatch(/Cripta|Salão/)
    const [ana, bruno] = [...m.naCripta.values()]
    expect(`${ana.x}|${ana.y}`).not.toBe(`${bruno.x}|${bruno.y}`)
    expect(avisoDe('Ana')).toBeUndefined()
    expect(avisoDe('Bruno')).toBeUndefined()
  })
})
