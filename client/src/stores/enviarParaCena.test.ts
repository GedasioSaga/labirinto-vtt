/**
 * "Enviar para cena ›" do clique direito no token, de ponta a ponta no lado do
 * mestre: as stores de verdade e, na ficha de jogador, a ponte com a sessão de
 * verdade (só o transporte é falso). O que se cobra: a ficha sai da cena
 * aberta e chega no pino de chegada da outra; um Ctrl+Z a devolve à cena e à
 * casa de antes, e o Ctrl+Y a manda de novo; várias de uma vez vão para casas
 * vizinhas num passo só; e a tela do jogador troca de cena junto com a ficha,
 * na ida e na volta. Dados inventados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => ''),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined), isTauri: () => false }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { useAdventureStore, hostWorldOf } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { useToastStore } = await import('./toastStore')
const { enviarParaCena, ligarSalaAoEnvio } = await import('./enviarParaCena')
const { createEmptyMap, addPin } = await import('../lib/mapFactory')
const { arrivalSpot } = await import('../lib/pinTravel')
const { createHostBridge } = await import('../net/hostBridge')

const CODIGO = 'ENV123'
const ALCAPAO: Pin = { id: 'alcapao', x: 1500, y: 900, kind: 'viagem', description: 'Alçapão', image: null, destino: null }

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

/** Porão aberto (Diego, o zumbi e o rato); o Térreo de fundo, com o alçapão. */
function montarAventura(): { porao: string; terreo: string } {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_porao', 'Porão', 30, 20, 64))
  useSessionStore.getState().markSaved()
  useMapStore.getState().addToken(ficha('diego', 192, 320, { name: 'Diego' }))
  useMapStore.getState().addToken(ficha('zumbi', 320, 320, { name: 'Zumbi', npc: true }))
  useMapStore.getState().addToken(ficha('rato', 448, 320, { name: 'Rato' }))
  const terreo = useAdventureStore.getState().createScene('Térreo', null)
  const porao = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(porao)
  useAdventureStore.getState().updateBackgroundScene(terreo, (map) => addPin(map, ALCAPAO))
  return { porao, terreo }
}

function tokensDaCena(sceneId: string): Token[] {
  const { activeSceneId, cache } = useAdventureStore.getState()
  if (sceneId === activeSceneId) return useMapStore.getState().map.tokens
  const slot = cache[sceneId]
  return slot?.status === 'ok' ? slot.map.tokens : []
}

function casaDe(sceneId: string, tokenId: string): [number, number] | null {
  const token = tokensDaCena(sceneId).find((t) => t.id === tokenId)
  return token === undefined ? null : [token.x, token.y]
}

function mapaDoTerreo(terreo: string): MapData {
  const slot = useAdventureStore.getState().cache[terreo]
  if (slot?.status !== 'ok') throw new Error('o Térreo deveria estar de fundo')
  return slot.map
}

/** A volta e a ida do Ctrl+Z/Ctrl+Y rodam logo depois do passo (fora do aviso da store). */
const depoisDoPasso = () => Promise.resolve()

interface Enviado {
  clientId: string
  msg: { type: string; [campo: string]: unknown }
}

describe('"Enviar para cena ›" no clique direito do token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useToastStore.setState({ toasts: [] })
    ligarSalaAoEnvio(() => null)
  })

  it('o zumbi vai ao pino de chegada do Térreo; Ctrl+Z o devolve à casa de antes no Porão; Ctrl+Y o manda de novo', async () => {
    const { porao, terreo } = montarAventura()
    const chegada = arrivalSpot(mapaDoTerreo(terreo), ALCAPAO, 1, 'zumbi')

    expect(enviarParaCena(['zumbi'], terreo)).toBe(true)
    expect(casaDe(porao, 'zumbi')).toBeNull()
    expect(casaDe(terreo, 'zumbi')).toEqual([chegada.x, chegada.y])
    expect(useToastStore.getState().toasts.map((a) => a.text)).toEqual(['Zumbi foi para Térreo'])

    useMapStore.getState().undo()
    await depoisDoPasso()
    expect(casaDe(porao, 'zumbi')).toEqual([320, 320])
    expect(casaDe(terreo, 'zumbi')).toBeNull()

    useMapStore.getState().redo()
    await depoisDoPasso()
    expect(casaDe(porao, 'zumbi')).toBeNull()
    expect(casaDe(terreo, 'zumbi')).toEqual([chegada.x, chegada.y])
  })

  it('duas fichas juntas vão para casas vizinhas do mesmo pino, e um Ctrl+Z só traz as duas de volta', async () => {
    const { porao, terreo } = montarAventura()

    expect(enviarParaCena(['zumbi', 'rato'], terreo)).toBe(true)
    const zumbi = casaDe(terreo, 'zumbi')
    const rato = casaDe(terreo, 'rato')
    expect(zumbi).not.toBeNull()
    expect(rato).not.toBeNull()
    expect(rato).not.toEqual(zumbi)
    // Perto do alçapão: no máximo três casas (o anel da procura).
    for (const casa of [zumbi, rato]) expect(Math.hypot((casa?.[0] ?? 0) - ALCAPAO.x, (casa?.[1] ?? 0) - ALCAPAO.y)).toBeLessThanOrEqual(64 * 4)
    expect(useToastStore.getState().toasts.map((a) => a.text)).toEqual(['2 fichas foram para Térreo'])

    useMapStore.getState().undo()
    await depoisDoPasso()
    expect([casaDe(porao, 'zumbi'), casaDe(porao, 'rato')]).toEqual([
      [320, 320],
      [448, 320],
    ])
    expect(tokensDaCena(terreo)).toEqual([])
  })

  it('a ficha de jogador leva a tela dele junto, na ida e no Ctrl+Z', async () => {
    const { porao, terreo } = montarAventura()
    const ouvintes = new Map<string, (event: { payload: unknown }) => void>()
    const enviados: Enviado[] = []
    const invoke = vi.fn(async (cmd: string, args?: unknown) => {
      if (cmd === 'net_start_room') return { code: CODIGO, urls: [], qrSvg: '<svg/>' }
      if (cmd === 'net_send') enviados.push(JSON.parse(JSON.stringify(args)))
      return undefined
    })
    const listen = vi.fn(async (nome: string, handler: (event: { payload: unknown }) => void) => {
      ouvintes.set(nome, handler)
      return () => undefined
    })
    const bridge = createHostBridge({
      invoke,
      listen,
      getMap: () => useMapStore.getState().map,
      getWorld: () => hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map),
      applyMove: () => undefined,
      applyDoor: () => undefined,
      applyTransfer: ({ tokenId, fromSceneId, toSceneId, x, y }) => useAdventureStore.getState().transferToken(tokenId, fromSceneId, toSceneId, x, y),
      onPlayersChange: vi.fn(),
      now: () => 0,
    })
    await bridge.start()
    ouvintes.get('net:message')?.({ payload: { clientId: 'c-diego', msg: { type: 'join', code: CODIGO, name: 'Diego' } } })
    const boasVindas = enviados.find((e) => e.clientId === 'c-diego' && e.msg.type === 'welcome')
    const diego = boasVindas?.msg.playerId
    if (typeof diego !== 'string') throw new Error('Diego não entrou')
    bridge.assignToken(diego, 'diego')
    ligarSalaAoEnvio(() => bridge)
    const trocasDeCena = () => enviados.filter((e) => e.clientId === 'c-diego' && e.msg.type === 'scene.changed').map((e) => e.msg.by)

    expect(enviarParaCena(['diego'], terreo)).toBe(true)
    expect(casaDe(porao, 'diego')).toBeNull()
    expect(casaDe(terreo, 'diego')).not.toBeNull()
    expect(trocasDeCena()).toEqual(['master'])

    useMapStore.getState().undo()
    await depoisDoPasso()
    expect(casaDe(porao, 'diego')).toEqual([192, 320])
    expect(casaDe(terreo, 'diego')).toBeNull()
    expect(trocasDeCena()).toEqual(['master', 'master'])
    await bridge.stop()
  })
})
