/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from 'vitest'
import appSource from '../App.tsx?raw'
import { createEmptyMap } from '../lib/mapFactory'
import { useAdventureStore, type SceneSlot } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import type { MapData, Token, Wall } from '../types/map'
import { createHostBridge } from './hostBridge'
import { hostPlayerChanges } from './playerChanges'

/**
 * Peça "desfazer-limpo", do lado da ponte do host: o que o JOGADOR faz
 * (movimento, porta, nome/foto da ficha) não é passo do Ctrl+Z do mestre, nem
 * é desfeito por ele — na cena aberta e numa cena de fundo.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const LIGHT = { id: 'l1', x: 0, y: 0, radius: 8, color: '#ffaa33', intensity: 0.8 }

// Porta fechada 40 px abaixo do herói (o jogador alcança); o caminho para (240, 200) fica livre.
const porta: Wall = { id: 'porta', x1: 180, y1: 240, x2: 220, y2: 240, blocksLight: false, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }
const trancada: Wall = { id: 'trancada', x1: 300, y1: 240, x2: 340, y2: 240, blocksLight: false, blocksMove: true, door: { open: false, locked: true, kind: 'normal' } }
const heroi: Token = { id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }

function sampleMap(): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 40), walls: [porta, trancada], tokens: [heroi] }
}

function tokenIn(map: MapData): Token {
  const found = map.tokens.find((t) => t.id === 'heroi')
  if (found === undefined) throw new Error('herói sumiu do mapa')
  return found
}

function doorOpen(map: MapData, wallId: string): boolean | undefined {
  return map.walls.find((w) => w.id === wallId)?.door?.open
}

const current = (): MapData => useMapStore.getState().map

beforeEach(() => {
  useMapStore.getState().loadMap(sampleMap())
  useAdventureStore.setState({ cache: {}, dirty: {} })
})

describe('mudança do jogador na cena aberta: fora do Ctrl+Z do mestre', () => {
  it('porta aberta pelo jogador não vira passo, e o Ctrl+Z desfaz a luz do mestre, não a porta', () => {
    useMapStore.getState().addLight(LIGHT)
    hostPlayerChanges.applyDoor('porta', true)

    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(current().lights).toHaveLength(0)
    expect(doorOpen(current(), 'porta')).toBe(true)
  })

  it('movimento do jogador: o Ctrl+Z desfaz a luz do mestre e a ficha fica onde o jogador pôs', () => {
    useMapStore.getState().addLight(LIGHT)
    hostPlayerChanges.applyMove('heroi', 240, 200)

    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(current().lights).toHaveLength(0)
    expect(tokenIn(current())).toMatchObject({ x: 240, y: 200 })
  })

  it('nome e foto que o jogador trocou não viram passo nem voltam no Ctrl+Z', () => {
    useMapStore.getState().addLight(LIGHT)
    hostPlayerChanges.applyTokenEdit({ tokenId: 'heroi', name: 'Zé', image: 'data:image/png;base64,AAAA' })

    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(current().lights).toHaveLength(0)
    expect(tokenIn(current())).toMatchObject({ name: 'Zé', image: null, imageData: 'data:image/png;base64,AAAA' })
  })

  it('Ctrl+Y depois de uma porta do jogador também a mantém', () => {
    useMapStore.getState().addLight(LIGHT)
    useMapStore.getState().undo()
    hostPlayerChanges.applyDoor('porta', true)

    useMapStore.getState().redo()
    expect(current().lights).toHaveLength(1)
    expect(doorOpen(current(), 'porta')).toBe(true)
  })

  it('porta trancada continua fechada (recusa defensiva) e não mexe no histórico', () => {
    const before = current()
    hostPlayerChanges.applyDoor('trancada', true)

    expect(current()).toBe(before)
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})

describe('mudança do jogador numa cena de fundo', () => {
  function backgroundSlot(): Extract<SceneSlot, { status: 'ok' }> {
    const slot = useAdventureStore.getState().cache['fundo']
    if (slot === undefined || slot.status !== 'ok') throw new Error('cena de fundo sumiu')
    return slot
  }

  beforeEach(() => {
    // Um passo do mestre guardado: o mapa de antes de uma luz.
    const semLuz = sampleMap()
    useAdventureStore.setState({
      cache: { fundo: { status: 'ok', map: { ...semLuz, lights: [LIGHT] }, past: [semLuz], future: [], camera: null } },
      dirty: {},
    })
  })

  it('movimento e porta entram também no desfazer guardado da cena: abrir e dar Ctrl+Z não os desfaz', () => {
    hostPlayerChanges.applyMove('heroi', 240, 200, 'fundo')
    hostPlayerChanges.applyDoor('porta', true, 'fundo')

    const slot = backgroundSlot()
    expect(tokenIn(slot.map)).toMatchObject({ x: 240, y: 200 })
    expect(slot.past).toHaveLength(1)
    const [passo] = slot.past
    if (passo === undefined) throw new Error('passo do mestre sumiu')
    expect(tokenIn(passo)).toMatchObject({ x: 240, y: 200 })
    expect(doorOpen(passo, 'porta')).toBe(true)
    expect(passo.lights).toHaveLength(0)
    expect(useAdventureStore.getState().dirty).toEqual({ fundo: true })
  })

  it('nada muda na cena aberta nem no desfazer dela', () => {
    const before = current()
    hostPlayerChanges.applyTokenEdit({ tokenId: 'heroi', name: 'Zé', sceneId: 'fundo' })

    expect(current()).toBe(before)
    expect(tokenIn(backgroundSlot().map).name).toBe('Zé')
    expect(tokenIn(backgroundSlot().past[0] ?? sampleMap()).name).toBe('Zé')
  })
})

describe('ponte do host ligada às mudanças do jogador (o mesmo objeto que o App passa)', () => {
  async function hostWithPlayer() {
    const handlers = new Map<string, (event: { payload: unknown }) => void>()
    const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
    const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
      handlers.set(name, handler)
      return () => {}
    })
    const bridge = createHostBridge({ invoke, listen, getMap: () => useMapStore.getState().map, ...hostPlayerChanges, now: () => 0 })
    const emit = (name: string, payload: unknown): void => {
      const handler = handlers.get(name)
      if (handler === undefined) throw new Error(`sem listener para ${name}`)
      handler({ payload })
    }
    await bridge.start()
    emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    const welcome = invoke.mock.calls
      .map((call) => call[1])
      .map((args) => (typeof args === 'object' && args !== null && 'msg' in args ? args.msg : null))
      .find((msg): msg is { type: 'welcome'; playerId: string } =>
        typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'welcome' && 'playerId' in msg && typeof msg.playerId === 'string')
    if (welcome === undefined) throw new Error('sem welcome')
    bridge.assignToken(welcome.playerId, 'heroi')
    return emit
  }

  it('jogador abre a porta e anda pela rede; o Ctrl+Z do mestre desfaz só a luz dele', async () => {
    const emit = await hostWithPlayer()
    useMapStore.getState().addLight(LIGHT)

    emit('net:message', { clientId: 'c1', msg: { type: 'door.toggle', wallId: 'porta' } })
    emit('net:message', { clientId: 'c1', msg: { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 240, y: 200 } })
    expect(doorOpen(current(), 'porta')).toBe(true)
    expect(tokenIn(current()).x).not.toBe(200)
    const moved = tokenIn(current())

    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(current().lights).toHaveLength(0)
    expect(doorOpen(current(), 'porta')).toBe(true)
    expect(tokenIn(current())).toMatchObject({ x: moved.x, y: moved.y })
  })
})

describe('App liga a ponte do host às mudanças do jogador', () => {
  // Trava a costura que nenhum teste de store vê: se o App voltar a chamar as
  // actions de edição do mestre (que passam por `withHistory`) nos retornos
  // do jogador, a porta e a ficha do jogador voltam para o Ctrl+Z do mestre.
  const start = appSource.indexOf('createHostBridge({')
  const end = appSource.indexOf('onPlayersChange:', start)
  const bridgeDeps = appSource.slice(start, end)

  it('os retornos do jogador vêm de hostPlayerChanges', () => {
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    expect(bridgeDeps).toContain('...hostPlayerChanges')
  })

  it('e não são redefinidos com as actions do mestre', () => {
    expect(bridgeDeps).not.toMatch(/\bapply(Move|Door|TokenEdit)\s*:/)
    expect(bridgeDeps).not.toMatch(/\.(setTokenPosition|setWallDoor|renameToken|setTokenImage)\(/)
  })
})
