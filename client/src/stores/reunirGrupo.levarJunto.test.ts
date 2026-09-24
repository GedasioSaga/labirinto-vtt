/**
 * "Reunir o grupo aqui" com uma ficha levada junto, de ponta a ponta no lado
 * do mestre (a ponte com a sessão de verdade, as stores de verdade, ligadas
 * como o App liga). Ana leva a ficha da Bia; as duas estão na Cripta; o
 * mestre reúne as duas no Vale.
 *
 * Antes, a travessia da Ana trazia a Bia junto, e a da Bia, logo depois,
 * achava a Bia já no Vale: "nada a fazer" virava "não deu", o mestre lia
 * "Não deu para trazer: Bia" com ela ali, e ela não assentava na casa que a
 * reunião escolheu para ela.
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
const { createEmptyMap } = await import('../lib/mapFactory')
const { partyMembers } = await import('../lib/party')
const { applyGatherPlan, planGather } = await import('../lib/gatherParty')
const { createHostBridge } = await import('../net/hostBridge')

const CODIGO = 'AB12CD'
const GRADE = 64
const FOGUEIRA: Pin = { id: 'fogueira', x: 10 * GRADE + GRADE / 2, y: 8 * GRADE + GRADE / 2, kind: 'exclamacao', description: 'Fogueira', image: null }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

interface Enviado {
  clientId: string
  msg: { type: string; [campo: string]: unknown }
}

async function mesa() {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_vale', 'Vale', 30, 20, GRADE))
  useSessionStore.getState().markSaved()
  useMapStore.getState().addToken(ficha('grog', 2 * GRADE + GRADE / 2, 2 * GRADE + GRADE / 2))
  useMapStore.getState().addToken(ficha('lia', 3 * GRADE + GRADE / 2, 2 * GRADE + GRADE / 2))
  useMapStore.getState().addPin(FOGUEIRA)
  // A Ana (grog) leva a Bia (lia).
  useMapStore.getState().carryToken('lia', 'grog')
  const cripta = useAdventureStore.getState().createScene('Cripta Rubra', null)
  const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(vale)

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
  const entra = (clientId: string, name: string): string => {
    ouvintes.get('net:message')?.({ payload: { clientId, msg: { type: 'join', code: CODIGO, name } } })
    const boasVindas = enviados.find((e) => e.clientId === clientId && e.msg.type === 'welcome')
    if (boasVindas === undefined || typeof boasVindas.msg.playerId !== 'string') throw new Error(`${name} não entrou`)
    return boasVindas.msg.playerId
  }
  const ana = entra('c1', 'Ana')
  const bia = entra('c2', 'Bia')
  bridge.assignToken(ana, 'grog')
  bridge.assignToken(bia, 'lia')
  // O mestre manda a Ana para a Cripta: a Bia vai junto (ela é levada).
  if (!bridge.sendPlayer(ana, cripta, null)) throw new Error('Ana deveria ir para a Cripta')
  return { bridge, enviados, cripta, ana, bia }
}

function tokensDaCripta(cripta: string): Token[] {
  const slot = useAdventureStore.getState().cache[cripta]
  return slot?.status === 'ok' ? slot.map.tokens : []
}

describe('"Reunir o grupo aqui" com a Bia levada pela Ana', () => {
  it('as duas vêm da Cripta, sem "não deu", cada uma na casa que a reunião escolheu', async () => {
    const t = await mesa()
    expect(tokensDaCripta(t.cripta).map((tk) => tk.id).sort()).toEqual(['grog', 'lia'])
    expect(useMapStore.getState().map.tokens).toEqual([])
    const antes = t.enviados.length

    const world = hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map)
    const members = partyMembers(t.bridge.players(), world).filter((m) => m.playerId === t.ana || m.playerId === t.bia)
    const plan = planGather(members, world, FOGUEIRA)
    expect(plan.leftOut).toEqual([])
    const failed = applyGatherPlan(plan, {
      sceneId: world.open.sceneId,
      bringFromOtherScene: (playerId, sceneId, at) => t.bridge.sendPlayer(playerId, sceneId, null, at),
      placeInScene: (positions) => useMapStore.getState().setTokenPositions(positions),
    })

    expect(failed).toEqual([])
    expect(tokensDaCripta(t.cripta)).toEqual([])
    const noVale = useMapStore.getState().map.tokens
    expect(noVale.map((tk) => tk.id).sort()).toEqual(['grog', 'lia'])
    for (const move of plan.moves) {
      expect(noVale.find((tk) => tk.id === move.tokenId)).toMatchObject({ x: move.x, y: move.y })
    }
    // O vínculo atravessou: no Vale a Ana continua levando a Bia.
    expect(noVale.find((tk) => tk.id === 'lia')?.levadoPor).toBe('grog')
    // A Bia lê o aviso de reunião (uma vez), não o "o mestre te levou".
    const daBia = t.enviados.slice(antes).filter((e) => e.clientId === 'c2' && e.msg.type === 'scene.changed').map((e) => e.msg)
    expect(daBia).toEqual([{ type: 'scene.changed', by: 'gather' }])
  })
})
