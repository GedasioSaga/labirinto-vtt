import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Token, Wall } from '../types/map'
import type { HostWorld } from './hostSession'
import { BROADCAST_THROTTLE_MS, createHostBridge } from './hostBridge'

/*
 * "VISTO POR", lado da rede. O mestre pergunta quem vê o guarda: a resposta é
 * o que SAIU pelo fio para cada jogador (o mesmo recorte de `fogFilter`), não
 * uma conta nova. Mesa do porto em miniatura: a Duda na rua, a Ana longe, o
 * guarda atrás da parede do beco.
 */

const ROOM = { code: 'PORT07', urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg/>' }
const GRADE = 50
const LARGURA = 40 * GRADE
const ALTURA = 12 * GRADE
/** Parede do beco: vertical em x = 1000, de ponta a ponta. */
const PAREDE_DO_BECO: Wall = { id: 'beco', x1: 1000, y1: 0, x2: 1000, y2: ALTURA, blocksLight: true, blocksMove: true, door: null }
const ATRAS_DA_PAREDE = { x: 1200, y: 300 }
const NA_RUA = { x: 600, y: 300 }
/** Longe demais (raio padrão 700): não vê o guarda nem na rua, nem atrás da parede. */
const ANA_LONGE = { x: 1950, y: 300 }
const ANA_NA_RUA = { x: 400, y: 300 }

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null, color: '#cccccc' }
}

function porto(guarda: { x: number; y: number }, ana: { x: number; y: number }): MapData {
  const base = createEmptyMap('mapa-porto', 'Porto', 40, 12, GRADE)
  return {
    ...base,
    floor: [{ id: 'chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    walls: [PAREDE_DO_BECO],
    tokens: [
      ficha('duda-ficha', 'Duda', 800, 300),
      ficha('ana-ficha', 'Ana', ana.x, ana.y),
      ficha('guarda', 'Guarda do cais', guarda.x, guarda.y),
    ],
  }
}

async function montada() {
  const estado = { guarda: ATRAS_DA_PAREDE, ana: ANA_LONGE }
  const world = (): HostWorld => ({ open: { sceneId: 'cena-porto', name: 'Porto', map: porto(estado.guarda, estado.ana) }, background: [] })
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return () => undefined
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    now: () => 0,
  })
  const emit = (name: string, payload: unknown) => handlers.get(name)?.({ payload })
  await bridge.start()
  emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Duda' } })
  emit('net:message', { clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  const idDe = (nome: string): string => {
    const id = bridge.players().find((p) => p.name === nome)?.playerId
    if (id === undefined) throw new Error(`${nome} não entrou`)
    return id
  }
  const duda = idDe('Duda')
  const ana = idDe('Ana')
  bridge.assignToken(duda, 'duda-ficha')
  bridge.assignToken(ana, 'ana-ficha')
  /** O mestre arrasta o guarda: o mapa muda e o snapshot sai pelo throttle, como no editor. */
  const arrastarGuarda = (para: { x: number; y: number }) => {
    estado.guarda = para
    bridge.notifyMapChanged()
    vi.advanceTimersByTime(BROADCAST_THROTTLE_MS)
  }
  const anaVaiPara = (para: { x: number; y: number }) => {
    estado.ana = para
    bridge.notifyMapChanged()
    vi.advanceTimersByTime(BROADCAST_THROTTLE_MS)
  }
  const fichasNaTela = (playerId: string): string[] => {
    const screen = bridge.playerScreen(playerId)
    if (screen === null || screen.kind !== 'map') throw new Error('o jogador deveria ter tela de mapa')
    return screen.map.tokens.map((t) => t.id)
  }
  return { bridge, emit, duda, ana, anaVaiPara, arrastarGuarda, fichasNaTela }
}

describe('hostBridge: "Visto por" — quais jogadores enxergam uma ficha', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('guarda atrás da parede: ninguém vê; na rua: a Duda (e só ela) vê; atrás da parede de novo: ninguém', async () => {
    const { bridge, duda, arrastarGuarda, fichasNaTela } = await montada()
    expect(bridge.tokenSeenBy('guarda')).toEqual([])
    expect(fichasNaTela(duda)).not.toContain('guarda')

    arrastarGuarda(NA_RUA)
    expect(bridge.tokenSeenBy('guarda')).toEqual(['Duda'])
    // A mesma regra do recorte: o que o painel diz é o que chegou na tela dela.
    expect(fichasNaTela(duda)).toContain('guarda')

    arrastarGuarda(ATRAS_DA_PAREDE)
    expect(bridge.tokenSeenBy('guarda')).toEqual([])
    expect(fichasNaTela(duda)).not.toContain('guarda')
  })

  it('ficha com dono não se aplica (null); sala fechada também (null)', async () => {
    const { bridge } = await montada()
    expect(bridge.tokenSeenBy('duda-ficha')).toBeNull()
    expect(bridge.tokenSeenBy('guarda')).toEqual([])
    await bridge.stop()
    expect(bridge.tokenSeenBy('guarda')).toBeNull()
  })

  it('jogador que caiu não conta como quem vê', async () => {
    const { bridge, emit, arrastarGuarda } = await montada()
    arrastarGuarda(NA_RUA)
    expect(bridge.tokenSeenBy('guarda')).toEqual(['Duda'])
    emit('net:peer', { clientId: 'c1', event: 'disconnected' })
    expect(bridge.tokenSeenBy('guarda')).toEqual([])
  })

  it('a Ana vem para a rua: os dois nomes, na ordem de entrada na sala', async () => {
    const { bridge, ana, anaVaiPara, arrastarGuarda, fichasNaTela } = await montada()
    arrastarGuarda(NA_RUA)
    expect(bridge.tokenSeenBy('guarda')).toEqual(['Duda'])
    anaVaiPara(ANA_NA_RUA)
    expect(bridge.tokenSeenBy('guarda')).toEqual(['Duda', 'Ana'])
    expect(fichasNaTela(ana)).toContain('guarda')
  })
})
