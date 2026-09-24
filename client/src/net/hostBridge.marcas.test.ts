import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import type { MapData } from '../types/map'
import { createHostBridge } from './hostBridge'
import { hostPlayerChanges } from './playerChanges'

/**
 * BILHETE NO LUGAR pela ponte do host, com o MESMO objeto de retornos que o
 * App passa (`...hostPlayerChanges`): o jogador manda `mark.place`, a ponte
 * responde, grava a marca no mapa do mestre (fora do Ctrl+Z dele), manda o
 * snapshot na hora e avisa o mestre — com "Apagar", que tira a marca do mapa
 * e dos jogadores.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function mapa(): MapData {
  return {
    ...createEmptyMap('m', 'Corredor Longo', 40, 40, 40),
    tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }],
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
  useToastStore.setState({ toasts: [] })
  const deixar = (msg: Record<string, unknown>): Enviado[] => {
    const antes = enviados().length
    emit({ clientId: 'c1', msg: { type: 'mark.place', ...msg } })
    return enviados().slice(antes)
  }
  return { deixar, enviados }
}

const marcasNoMestre = () => useMapStore.getState().map.marcas ?? []

beforeEach(() => {
  vi.restoreAllMocks()
  useMapStore.getState().loadMap(mapa())
  useAdventureStore.setState({ cache: {}, dirty: {} })
  useToastStore.setState({ toasts: [] })
})

describe('hostBridge: bilhete no lugar', () => {
  it('grava no mapa do mestre com autor, manda o snapshot com o bilhete (sem autor) e avisa o mestre', async () => {
    const t = await hostComAna()
    const saiu = t.deixar({ x: 220, y: 200, tipo: 'bilhete', texto: 'GUI ESPERA NO POÇO' })

    expect(saiu[0]).toEqual({ clientId: 'c1', msg: { type: 'mark.place.result', ok: true } })
    expect(marcasNoMestre()).toEqual([{ id: expect.any(String), tipo: 'bilhete', x: 220, y: 200, texto: 'GUI ESPERA NO POÇO', autor: 'Ana', em: 0 }])
    // Fora do desfazer do mestre: o passo atual e o histórico carregam a marca.
    expect(useMapStore.getState().past.length).toBe(0)
    const snapshot = saiu.find((e) => e.msg.type === 'snapshot' || e.msg.type === 'delta')
    expect(snapshot?.clientId).toBe('c1')
    expect(JSON.stringify(snapshot)).toContain('GUI ESPERA NO POÇO')
    expect(JSON.stringify(snapshot)).not.toContain('"autor"')
    const aviso = useToastStore.getState().toasts[0]
    expect(aviso?.text).toBe('Ana deixou um bilhete em Corredor Longo: “GUI ESPERA NO POÇO”')
    expect(aviso?.actions?.map((a) => a.label)).toEqual(['Apagar'])
  })

  it('"Apagar" do aviso tira a marca do mapa do mestre e do jogador na hora', async () => {
    const t = await hostComAna()
    t.deixar({ x: 220, y: 200, tipo: 'seta', rumo: 'ne' })
    expect(useToastStore.getState().toasts[0]?.text).toBe('Ana riscou uma seta de giz em Corredor Longo')
    expect(marcasNoMestre().map((m) => m.tipo)).toEqual(['seta'])
    const antes = t.enviados().length
    const apagar = useToastStore.getState().toasts[0]?.actions?.find((a) => a.label === 'Apagar')
    if (apagar === undefined) throw new Error('sem "Apagar"')
    apagar.run()
    expect(marcasNoMestre()).toEqual([])
    const depois = t.enviados().slice(antes)
    const snapshot = depois.find((e) => e.msg.type === 'snapshot' || e.msg.type === 'delta')
    expect(snapshot?.clientId).toBe('c1')
    expect(JSON.stringify(snapshot)).not.toContain('"seta"')
  })

  it('recusa: nada no mapa, nenhum aviso ao mestre', async () => {
    const t = await hostComAna()
    const antes = useMapStore.getState().map
    const saiu = t.deixar({ x: 900, y: 900, tipo: 'bilhete', texto: 'longe' })
    expect(saiu).toEqual([{ clientId: 'c1', msg: { type: 'mark.place.result', ok: false, reason: 'unavailable' } }])
    expect(useMapStore.getState().map).toBe(antes)
    expect(useToastStore.getState().toasts).toEqual([])
  })
})
