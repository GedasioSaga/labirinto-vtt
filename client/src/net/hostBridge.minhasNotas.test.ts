/**
 * MINHAS NOTAS na ponte do mestre: a sala abre com as notas guardadas da mesa
 * (com ou sem "Retomar a mesa"), quem entra com o nome as recebe, e a lista
 * que um jogador manda vai ao disco um pouco depois — e na hora, ao fechar a
 * sala. Nada disto passa pela Caixa do mestre.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { PersonalNote } from '../lib/minhasNotas'
import { SAVED_MY_NOTES_VERSION, type SavedMyNotes } from '../lib/savedTable'
import { useToastStore } from '../stores/toastStore'
import type { Token } from '../types/map'
import type { HostWorld } from './hostSession'
import { createHostBridge, EXPLORATION_SAVE_DELAY_MS } from './hostBridge'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const BAU: PersonalNote = { id: 'n1', mapId: 'mapa-a', x: 120, y: 140, text: 'baú trancado' }
const RATO: PersonalNote = { id: 'n2', mapId: 'mapa-b', x: 10, y: 20, text: 'rato morto' }

function ficha(id: string, name: string, x: number): Token {
  return { id, characterId: null, name, x, y: 200, size: 1, image: null }
}

async function mesa(guardadas: SavedMyNotes | null) {
  const world = (): HostWorld => ({
    open: { sceneId: 'cena-a', name: 'Salão', map: { ...createEmptyMap('mapa-a', 'A', 40, 10, 50), tokens: [ficha('ficha-ana', 'Ana', 200)] } },
    background: [],
  })
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const saveMyNotes = vi.fn<(notes: SavedMyNotes) => void>()
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: vi.fn(),
    now: () => 0,
    loadMyNotes: () => guardadas,
    saveMyNotes,
  })
  const emit = (channel: string, payload: unknown) => {
    const handler = handlers.get(channel)
    if (handler === undefined) throw new Error(`sem listener de ${channel}`)
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  await bridge.start()
  return { bridge, emit, sent, saveMyNotes }
}

describe('hostBridge: Minhas notas', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })

  it('a sala abre com as notas guardadas: a Ana entra pelo nome e recebe a lista dela; nada vai à Caixa', async () => {
    const { emit, sent } = await mesa({ version: SAVED_MY_NOTES_VERSION, seats: [{ name: 'Ana', notes: [BAU, RATO] }] })
    emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'ana' } })
    expect(sent()).toContainEqual({ clientId: 'c1', msg: { type: 'mynotes.book', notes: [BAU, RATO] } })
    expect(useToastStore.getState().toasts.some((t) => t.text.includes('baú'))).toBe(false)
  })

  it('a lista nova vai ao disco um pouco depois (uma vez só para várias mudanças), com as guardadas de quem não voltou', async () => {
    const { emit, saveMyNotes } = await mesa({ version: SAVED_MY_NOTES_VERSION, seats: [{ name: 'Eva', notes: [RATO] }] })
    emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    emit('net:message', { clientId: 'c1', msg: { type: 'mynotes.set', notes: [BAU] } })
    expect(saveMyNotes).not.toHaveBeenCalled()
    vi.advanceTimersByTime(EXPLORATION_SAVE_DELAY_MS)
    expect(saveMyNotes).toHaveBeenCalledTimes(1)
    expect(saveMyNotes).toHaveBeenLastCalledWith({
      version: SAVED_MY_NOTES_VERSION,
      seats: [
        { name: 'Ana', notes: [BAU] },
        { name: 'Eva', notes: [RATO] },
      ],
    })
  })

  it('fechar a sala grava na hora o que estava esperando o prazo', async () => {
    const { bridge, emit, saveMyNotes } = await mesa(null)
    emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    emit('net:message', { clientId: 'c1', msg: { type: 'mynotes.set', notes: [BAU] } })
    await bridge.stop()
    expect(saveMyNotes).toHaveBeenCalledWith({ version: SAVED_MY_NOTES_VERSION, seats: [{ name: 'Ana', notes: [BAU] }] })
  })
})
