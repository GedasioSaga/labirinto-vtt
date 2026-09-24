/**
 * LEVAR FICHA JUNTO na CARAVANA do mapa-mundi, de ponta a ponta no lado do
 * mestre: a ponte com a sessão de verdade, ligada às stores de verdade como o
 * App liga (`hostWorldOf` + `transferToken`).
 *
 * O "Desembarcar" é a travessia de um pino de viagem como qualquer outra: quem
 * a Ana (grog) leva desce com ela na cidade. Antes, a caravana só levava as
 * fichas de JOGADOR: o ferido (NPC) ficava no mapa-mundi com `levadoPor`
 * gravado — o vínculo fantasma — e voltava a ser puxado quando a Ana voltasse
 * ao mapa-mundi, sem o mestre ter prendido de novo. E a Bia (lia), levada pela
 * Ana e desembarcando antes dela na ordem do mapa, chegava solta.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Pin, Token } from '../types/map'

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
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { useAdventureStore, hostWorldOf } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap, addPin } = await import('../lib/mapFactory')
const { carryRefsOf } = await import('../lib/carry')
const { createHostBridge } = await import('../net/hostBridge')

const CODIGO = 'AB12CD'
const GRADE = 64
const centro = (casa: number): number => casa * GRADE + GRADE / 2

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino']): Pin {
  return { id, x, y, kind: 'viagem', description: '', image: null, destino, passagem: 'livre' }
}

interface Enviado {
  clientId: string
  msg: { type: string; [campo: string]: unknown }
}

/**
 * Mapa-mundi aberto com a caravana parada no porto. `fichas` entram na ordem
 * dada (é a ordem do mapa, que decide quem desembarca primeiro); `presos` são
 * os pares [levada, quem leva]; `jogadores` os pares [nome, ficha].
 */
async function mesa(fichas: Token[], presos: [string, string][], jogadores: [string, string][]) {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap({ ...createEmptyMap('map_mundo', 'Continente', 30, 20, GRADE), worldMap: true })
  useSessionStore.getState().markSaved()
  for (const f of fichas) useMapStore.getState().addToken(f)
  for (const [levada, leva] of presos) useMapStore.getState().carryToken(levada, leva)
  const vila = useAdventureStore.getState().createScene('Vila do Porto', null)
  const mundo = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(mundo)
  useMapStore.getState().addPin(viagem('porto', centro(4), centro(2), { sceneId: vila, pinId: 'cais' }))
  useAdventureStore.getState().updateBackgroundScene(vila, (map) =>
    addPin(map, viagem('cais', centro(20), centro(10), { sceneId: mundo, pinId: 'porto' })),
  )

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
  const fala = (clientId: string, msg: Record<string, unknown>) => ouvintes.get('net:message')?.({ payload: { clientId, msg } })
  const ids: Record<string, string> = {}
  jogadores.forEach(([nome, tokenId], i) => {
    const clientId = `c${i + 1}`
    fala(clientId, { type: 'join', code: CODIGO, name: nome })
    const boasVindas = enviados.find((e) => e.clientId === clientId && e.msg.type === 'welcome')
    if (boasVindas === undefined || typeof boasVindas.msg.playerId !== 'string') throw new Error(`${nome} não entrou`)
    ids[nome] = boasVindas.msg.playerId
    bridge.assignToken(boasVindas.msg.playerId, tokenId)
  })
  return { bridge, enviados, mundo, vila, ids }
}

function mapaDe(sceneId: string) {
  const { activeSceneId, cache } = useAdventureStore.getState()
  if (sceneId === activeSceneId) return useMapStore.getState().map
  const slot = cache[sceneId]
  if (slot?.status !== 'ok') throw new Error('cena fora do ar')
  return slot.map
}

const idsDe = (sceneId: string): string[] => mapaDe(sceneId).tokens.map((t) => t.id).sort()

describe('a caravana desembarca com quem a Ana leva', () => {
  it('o ferido (NPC) desce na cidade preso à Ana, e não fica no mapa-mundi para voltar a ser puxado', async () => {
    const t = await mesa([ficha('grog', centro(4), centro(2)), ficha('ferido', centro(6), centro(5))], [['ferido', 'grog']], [['Ana', 'grog']])
    expect(t.bridge.disembarkCaravan(t.mundo)).toBe(true)

    expect(idsDe(t.vila)).toEqual(['ferido', 'grog'])
    expect(idsDe(t.mundo)).toEqual([])
    const ferido = mapaDe(t.vila).tokens.find((tk) => tk.id === 'ferido') ?? null
    expect(carryRefsOf(mapaDe(t.vila), ferido).carrier).toEqual({ id: 'grog', name: 'ficha-grog' })

    // A Ana volta ao mapa-mundi: o ferido vai com ela, e nada volta a se prender sozinho lá.
    expect(t.bridge.sendPlayer(t.ids.Ana, t.mundo, null)).toBe(true)
    expect(idsDe(t.mundo)).toEqual(['ferido', 'grog'])
    expect(idsDe(t.vila)).toEqual([])
  })

  it('a Bia, levada pela Ana e antes dela na ordem do mapa, desce ainda presa a ela', async () => {
    const t = await mesa(
      [ficha('lia', centro(4), centro(2)), ficha('grog', centro(4), centro(2))],
      [['lia', 'grog']],
      [['Ana', 'grog'], ['Bia', 'lia']],
    )
    expect(t.bridge.disembarkCaravan(t.mundo)).toBe(true)

    expect(idsDe(t.vila)).toEqual(['grog', 'lia'])
    expect(mapaDe(t.vila).tokens.find((tk) => tk.id === 'lia')?.levadoPor).toBe('grog')
    // Cada uma lê UMA vez que chegou, como sempre na caravana.
    const chegadas = t.enviados.filter((e) => e.msg.type === 'scene.changed').map((e) => e.clientId).sort()
    expect(chegadas).toEqual(['c1', 'c2'])
  })

  it('nada do vínculo nem do ferido chega a jogador nenhum pela rede', async () => {
    const t = await mesa([ficha('grog', centro(4), centro(2)), ficha('ferido', centro(6), centro(5))], [['ferido', 'grog']], [['Ana', 'grog']])
    t.bridge.disembarkCaravan(t.mundo)
    const tudo = JSON.stringify(t.enviados)
    expect(t.enviados.some((e) => e.msg.type === 'scene.changed')).toBe(true)
    expect(tudo).not.toContain('levadoPor')
    expect(tudo).not.toContain('junto')
  })
})
