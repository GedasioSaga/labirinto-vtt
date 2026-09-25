import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Pin, Wall } from '../types/map'
import { createHostBridge } from './hostBridge'
import { hostPlayerChanges } from './playerChanges'

/**
 * FECHADURA COM SEGREDO pela ponte do host, com o MESMO objeto de retornos que
 * o App passa (`...hostPlayerChanges`): o jogador manda `pin.answer`, a ponte
 * responde, abre a fechadura no mapa do mestre (e destranca a porta ligada),
 * manda o snapshot novo na hora e avisa o mestre da tentativa. Sem a costura
 * da ponte, o jogador leria "Abriu." e o mapa do mestre seguiria trancado.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const RESPOSTA = '9-3-8-2'

const COFRE: Pin = { id: 'cofre', x: 240, y: 200, kind: 'exclamacao', description: 'Cofre do bispo', image: null, segredo: { resposta: RESPOSTA, forma: 'volantes', abrePorta: 'porta' } }
const PORTA: Wall = { id: 'porta', x1: 600, y1: 150, x2: 600, y2: 250, blocksLight: true, blocksMove: true, door: { open: false, locked: true, kind: 'normal' } }

function mapa(): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }],
    walls: [PORTA],
    pins: [COFRE],
  }
}

interface Enviado {
  clientId: string
  msg: { type: string }
}

function isEnviado(value: unknown): value is Enviado {
  if (typeof value !== 'object' || value === null || !('clientId' in value) || !('msg' in value)) return false
  const { msg } = value
  return typeof msg === 'object' && msg !== null && 'type' in msg && typeof msg.type === 'string'
}

async function hostComAna() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return () => {}
  })
  const applyLock = vi.spyOn(hostPlayerChanges, 'applyLock')
  const bridge = createHostBridge({ invoke, listen, getMap: () => useMapStore.getState().map, ...hostPlayerChanges, now: () => 0 })
  const emit = (payload: unknown): void => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener para net:message')
    handler({ payload })
  }
  const enviados = (): Enviado[] => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1]).filter(isEnviado)
  await bridge.start()
  emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  const welcome = enviados().find((e) => e.msg.type === 'welcome')?.msg
  if (welcome === undefined || !('playerId' in welcome) || typeof welcome.playerId !== 'string') throw new Error('sem welcome')
  bridge.assignToken(welcome.playerId, 'heroi')
  // O aviso de entrada não conta: o que se cobra é o aviso da tentativa.
  useToastStore.setState({ toasts: [] })
  const tentar = (tentativa: string): Enviado[] => {
    const antes = enviados().length
    emit({ clientId: 'c1', msg: { type: 'pin.answer', pinId: 'cofre', tentativa } })
    return enviados().slice(antes)
  }
  return { tentar, applyLock }
}

const avisos = (): string[] => useToastStore.getState().toasts.map((t) => t.text)
const cofreNoMestre = (): Pin | undefined => useMapStore.getState().map.pins.find((p) => p.id === 'cofre')

beforeEach(() => {
  vi.restoreAllMocks()
  useMapStore.getState().loadMap(mapa())
  useAdventureStore.setState({ cache: {}, dirty: {} })
  useToastStore.setState({ toasts: [] })
})

describe('hostBridge: fechadura com segredo', () => {
  it('combinação certa: responde "abriu", abre no mapa do mestre, destranca a porta, manda o snapshot e avisa o mestre', async () => {
    const t = await hostComAna()
    const saiu = t.tentar('9 3 8 2')

    expect(saiu[0]).toEqual({ clientId: 'c1', msg: { type: 'pin.answer.result', pinId: 'cofre', ok: true } })
    expect(t.applyLock).toHaveBeenCalledTimes(1)
    expect(t.applyLock).toHaveBeenCalledWith({ pinId: 'cofre' })
    expect(cofreNoMestre()?.segredo?.aberta).toBe(true)
    expect(useMapStore.getState().map.walls[0].door).toEqual({ open: false, locked: false, kind: 'normal' })
    // O snapshot de agora já não tem a fechadura: o cartão do jogador a perde.
    const snapshot = saiu.find((e) => e.msg.type === 'snapshot' || e.msg.type === 'delta')
    expect(snapshot?.clientId).toBe('c1')
    expect(JSON.stringify(snapshot)).not.toContain('fechadura')
    expect(JSON.stringify(saiu)).not.toContain('9382')
    expect(avisos()).toContain('Ana abriu a fechadura de Cofre do bispo com “9 3 8 2”')
  })

  it('combinação errada: "não abre", o mapa do mestre não muda, e o mestre lê a tentativa', async () => {
    const t = await hostComAna()
    const antes = useMapStore.getState().map
    const saiu = t.tentar('1111')

    expect(saiu).toEqual([{ clientId: 'c1', msg: { type: 'pin.answer.result', pinId: 'cofre', ok: false } }])
    expect(t.applyLock).not.toHaveBeenCalled()
    expect(useMapStore.getState().map).toBe(antes)
    expect(cofreNoMestre()?.segredo?.aberta).toBeUndefined()
    expect(avisos()).toEqual(['Ana tentou “1111” em Cofre do bispo: não abriu'])
  })
})
