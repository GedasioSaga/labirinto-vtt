import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { SavedExploration, SavedTable } from '../lib/savedTable'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Region, Token } from '../types/map'
import { BROADCAST_THROTTLE_MS, createHostBridge, EXPLORATION_SAVE_DELAY_MS } from './hostBridge'

/**
 * RETOMAR A MESA COM O MAPA EXPLORADO, lado da ponte: o explorado de cada
 * jogador é gravado alguns instantes depois de mudar (e ao fechar a sala), e
 * "Retomar" o devolve a quem voltar com o mesmo nome. "Mesa nova" não lê nada.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const OESTE = { x: 250, y: 250 }
const LESTE = { x: 1250, y: 250 }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

function sala(id: string, x0: number, y0: number, x1: number, y1: number): Region {
  return {
    id,
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: id },
  }
}

function porao(carla: { x: number; y: number }): MapData {
  return {
    ...createEmptyMap('m-porao', 'Porão', 30, 10, 50),
    tokens: [ficha('carla-f', carla.x, carla.y)],
    regions: [sala('porao-oeste', 50, 50, 450, 450), sala('porao-leste', 1050, 50, 1450, 450), sala('sotao', 600, 100, 850, 400)],
  }
}

interface Guardado {
  table: SavedTable | null
  exploration: SavedExploration | null
}

function montar(guardado: Guardado = { table: null, exploration: null }) {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const estado = { map: porao(LESTE) }
  const mesas: SavedTable[] = []
  const exploracoes: SavedExploration[] = []
  const loadExploration = vi.fn(() => guardado.exploration)
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => estado.map,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    loadTable: () => guardado.table,
    saveTable: (table) => {
      mesas.push(table)
    },
    loadExploration,
    saveExploration: (exploration) => {
      exploracoes.push(exploration)
    },
  })
  const entra = (clientId: string, name: string) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload: { clientId, msg: { type: 'join', code: ROOM.code, name } } })
  }
  const enviadas = (clientId: string) =>
    invoke.mock.calls
      .filter((call) => call[0] === 'net_send')
      .map((call) => JSON.stringify(call[1]))
      .filter((text) => text.includes(`"clientId":"${clientId}"`))
  return { bridge, entra, enviadas, estado, mesas, exploracoes, loadExploration }
}

/** Dia 1: Carla explora o Porão do leste ao oeste com raio 250; o mestre fecha a sala. */
async function dia1() {
  const m = montar()
  await m.bridge.start()
  m.entra('c1', 'Carla')
  const carla = m.bridge.players()[0]
  if (carla === undefined) throw new Error('Carla deveria ter entrado')
  // O raio antes da ficha: o primeiro mapa dela já sai com o raio pequeno, sem ver o Sótão.
  m.bridge.setVisionRadius(carla.playerId, 250)
  m.bridge.assignToken(carla.playerId, 'carla-f')
  vi.advanceTimersByTime(BROADCAST_THROTTLE_MS)
  m.estado.map = porao(OESTE)
  m.bridge.notifyMapChanged()
  vi.advanceTimersByTime(BROADCAST_THROTTLE_MS)
  return m
}

describe('hostBridge: retomar a mesa com o mapa explorado', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })
  afterEach(() => {
    vi.useRealTimers()
    useToastStore.setState({ toasts: [] })
  })

  it('o explorado é gravado uma vez, alguns instantes depois de mudar, e não a cada passo', async () => {
    const m = await dia1()
    expect(m.exploracoes).toEqual([])
    vi.advanceTimersByTime(EXPLORATION_SAVE_DELAY_MS)
    expect(m.exploracoes.length).toBe(1)
    const gravada = m.exploracoes[0]
    expect(gravada?.version).toBe(1)
    expect(gravada?.seats.map((seat) => [seat.name, seat.scenes.map((scene) => scene.mapId)])).toEqual([['Carla', ['m-porao']]])
    // Nada mudou depois: não grava de novo sozinho.
    vi.advanceTimersByTime(EXPLORATION_SAVE_DELAY_MS * 3)
    expect(m.exploracoes.length).toBe(1)
  })

  it('fechar a sala grava o explorado pendente na hora (o último passo não se perde)', async () => {
    const m = await dia1()
    expect(m.exploracoes).toEqual([])
    await m.bridge.stop()
    expect(m.exploracoes.length).toBe(1)
    expect(m.exploracoes[0]?.seats[0]?.name).toBe('Carla')
    // Com a sala fechada, o timer não grava uma mesa vazia por cima.
    vi.advanceTimersByTime(EXPLORATION_SAVE_DELAY_MS * 2)
    expect(m.exploracoes.length).toBe(1)
  })

  it('Retomar: Carla volta no oeste e recebe o leste que explorou ontem, sem o Sótão que nunca viu', async () => {
    const ontem = await dia1()
    await ontem.bridge.stop()
    const hoje = montar({ table: ontem.mesas.at(-1) ?? null, exploration: ontem.exploracoes.at(-1) ?? null })
    hoje.estado.map = porao(OESTE)
    await hoje.bridge.start({ resume: true })
    hoje.entra('c1', 'carla')
    expect(hoje.bridge.players()[0]).toMatchObject({ status: 'playing', tokenIds: ['carla-f'], visionRadius: 250 })
    const texto = hoje.enviadas('c1').join('\n')
    expect(texto).toContain('porao-leste')
    expect(texto).toContain('porao-oeste')
    expect(texto).not.toContain('sotao')
  })

  it('Mesa nova: não lê o explorado guardado e Carla começa do zero', async () => {
    const ontem = await dia1()
    await ontem.bridge.stop()
    const hoje = montar({ table: ontem.mesas.at(-1) ?? null, exploration: ontem.exploracoes.at(-1) ?? null })
    hoje.estado.map = porao(OESTE)
    await hoje.bridge.start({ resume: false })
    expect(hoje.loadExploration).not.toHaveBeenCalled()
    hoje.entra('c1', 'Carla')
    const carla = hoje.bridge.players()[0]
    if (carla === undefined) throw new Error('Carla deveria ter entrado')
    hoje.bridge.assignToken(carla.playerId, 'carla-f')
    const texto = hoje.enviadas('c1').join('\n')
    expect(texto).toContain('porao-oeste')
    expect(texto).not.toContain('porao-leste')
  })
})
