/**
 * LEVAR FICHA JUNTO — o vínculo não volta sozinho. De ponta a ponta no lado
 * do mestre: a ponte com a sessão de verdade, ligada às stores de verdade como
 * o App liga (`hostWorldOf` + `transferToken`).
 *
 * O mestre prende a Bia (lia) à Ana (grog) no Vale. Se a Bia muda de cena SEM
 * a Ana (pino livre dela, "Mandar para…" só nela, reunião sem a Ana), o
 * vínculo é solto na chegada. Antes, `levadoPor` viajava gravado: o painel a
 * mostrava solta (a Ana não estava ali), e quando a Ana chegava à mesma cena a
 * travessia seguinte dela levava a Bia de novo — com "o mestre te levou" para
 * a Bia —, sem o mestre ter prendido nada.
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
const { partyMembers } = await import('../lib/party')
const { applyGatherPlan, planGather } = await import('../lib/gatherParty')
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

/** Vale aberto com a Ana levando a Bia e um pino livre para a Cripta ao lado da Bia; a Cripta com o par. */
async function mesa() {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_vale', 'Vale', 30, 20, GRADE))
  useSessionStore.getState().markSaved()
  useMapStore.getState().addToken(ficha('grog', centro(2), centro(2)))
  useMapStore.getState().addToken(ficha('lia', centro(3), centro(2)))
  useMapStore.getState().carryToken('lia', 'grog')
  const cripta = useAdventureStore.getState().createScene('Cripta Rubra', null)
  const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(vale)
  useMapStore.getState().addPin(viagem('alcapao', centro(4), centro(2), { sceneId: cripta, pinId: 'alcapao-b' }))
  useAdventureStore.getState().updateBackgroundScene(cripta, (map) =>
    addPin(map, viagem('alcapao-b', centro(20), centro(10), { sceneId: vale, pinId: 'alcapao' })),
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
  const entra = (clientId: string, name: string): string => {
    fala(clientId, { type: 'join', code: CODIGO, name })
    const boasVindas = enviados.find((e) => e.clientId === clientId && e.msg.type === 'welcome')
    if (boasVindas === undefined || typeof boasVindas.msg.playerId !== 'string') throw new Error(`${name} não entrou`)
    return boasVindas.msg.playerId
  }
  const ana = entra('c1', 'Ana')
  const bia = entra('c2', 'Bia')
  bridge.assignToken(ana, 'grog')
  bridge.assignToken(bia, 'lia')
  return { bridge, enviados, fala, vale, cripta, ana, bia }
}

function tokensDaCena(sceneId: string): Token[] {
  const { activeSceneId, cache } = useAdventureStore.getState()
  if (sceneId === activeSceneId) return useMapStore.getState().map.tokens
  const slot = cache[sceneId]
  return slot?.status === 'ok' ? slot.map.tokens : []
}

function mapaDe(sceneId: string) {
  const { activeSceneId, cache } = useAdventureStore.getState()
  if (sceneId === activeSceneId) return useMapStore.getState().map
  const slot = cache[sceneId]
  if (slot?.status !== 'ok') throw new Error('cena fora do ar')
  return slot.map
}

const cenaDaBia = (enviados: Enviado[]): Enviado['msg'][] => enviados.filter((e) => e.clientId === 'c2' && e.msg.type === 'scene.changed').map((e) => e.msg)

describe('o vínculo da ficha levada que muda de cena sem quem a leva', () => {
  it('a Bia passa sozinha pelo pino livre: chega solta, e a Ana, chegando depois, atravessa sem levá-la', async () => {
    const t = await mesa()
    t.fala('c2', { type: 'pin.travel.request', pinId: 'alcapao' })
    const liaNaCripta = tokensDaCena(t.cripta).find((tk) => tk.id === 'lia')
    expect(liaNaCripta).toBeDefined()
    // O campo some, como no "Soltar" do mestre.
    expect(liaNaCripta !== undefined && 'levadoPor' in liaNaCripta).toBe(false)

    // A Ana chega depois à Cripta: o painel continua dizendo que a Bia está solta.
    expect(t.bridge.sendPlayer(t.ana, t.cripta, 'alcapao-b')).toBe(true)
    expect(tokensDaCena(t.cripta).map((tk) => tk.id).sort()).toEqual(['grog', 'lia'])
    const lia = mapaDe(t.cripta).tokens.find((tk) => tk.id === 'lia') ?? null
    expect(carryRefsOf(mapaDe(t.cripta), lia).carrier).toBe(null)
    expect(carryRefsOf(mapaDe(t.cripta), mapaDe(t.cripta).tokens.find((tk) => tk.id === 'grog') ?? null).carried).toEqual([])

    // A Ana atravessa de volta: a Bia fica, e não lê "o mestre te levou".
    const antes = t.enviados.length
    t.fala('c1', { type: 'pin.travel.request', pinId: 'alcapao-b' })
    expect(tokensDaCena(t.vale).map((tk) => tk.id)).toEqual(['grog'])
    expect(tokensDaCena(t.cripta).map((tk) => tk.id)).toEqual(['lia'])
    expect(cenaDaBia(t.enviados.slice(antes))).toEqual([])
  })

  it('"Mandar para…" só na Bia: ela chega solta, e a Ana, mandada depois, volta sem ela', async () => {
    const t = await mesa()
    expect(t.bridge.sendPlayer(t.bia, t.cripta, null)).toBe(true)
    expect(t.bridge.sendPlayer(t.ana, t.cripta, null)).toBe(true)
    expect(tokensDaCena(t.cripta).map((tk) => tk.id).sort()).toEqual(['grog', 'lia'])
    expect(tokensDaCena(t.cripta).find((tk) => tk.id === 'lia')?.levadoPor).toBe(undefined)

    const antes = t.enviados.length
    expect(t.bridge.sendPlayer(t.ana, t.vale, null)).toBe(true)
    expect(tokensDaCena(t.vale).map((tk) => tk.id)).toEqual(['grog'])
    expect(tokensDaCena(t.cripta).map((tk) => tk.id)).toEqual(['lia'])
    expect(cenaDaBia(t.enviados.slice(antes))).toEqual([])
  })

  it('a Ana leva a Bia pelo pino: o vínculo atravessa inteiro (a Bia chega com a Ana já lá)', async () => {
    const t = await mesa()
    // A Ana precisa do pino à vista: o alçapão fica a duas casas dela.
    t.fala('c1', { type: 'pin.travel.request', pinId: 'alcapao' })
    expect(tokensDaCena(t.cripta).map((tk) => tk.id).sort()).toEqual(['grog', 'lia'])
    expect(tokensDaCena(t.cripta).find((tk) => tk.id === 'lia')?.levadoPor).toBe('grog')
  })

  it('reunião: a levada vem na travessia de quem leva e só assenta; se quem leva não veio, ela viaja sozinha', () => {
    const plan = {
      leftOut: [],
      moves: [
        { playerId: 'p-ana', name: 'Ana', tokenId: 'grog', travels: true, x: 10, y: 10 },
        { playerId: 'p-bia', name: 'Bia', tokenId: 'lia', travels: true, x: 20, y: 10, vemCom: 'grog' },
      ],
    }
    const efeitos = (anaChega: boolean) => ({
      sceneId: 'vale',
      bringFromOtherScene: vi.fn((playerId: string) => (playerId === 'p-ana' ? anaChega : true)),
      placeInScene: vi.fn(),
    })
    const chegou = efeitos(true)
    expect(applyGatherPlan(plan, chegou)).toEqual([])
    expect(chegou.bringFromOtherScene.mock.calls.map(([playerId]) => playerId)).toEqual(['p-ana'])
    expect(chegou.placeInScene).toHaveBeenCalledWith([{ id: 'lia', x: 20, y: 10 }])

    const naoChegou = efeitos(false)
    expect(applyGatherPlan(plan, naoChegou)).toEqual(['Ana'])
    expect(naoChegou.bringFromOtherScene.mock.calls.map(([playerId]) => playerId)).toEqual(['p-ana', 'p-bia'])
    expect(naoChegou.placeInScene).not.toHaveBeenCalled()
  })

  it('reunião só da Bia, com a Ana ficando na Cripta: a Bia chega solta ao Vale', async () => {
    const t = await mesa()
    // As duas vão juntas para a Cripta (a Bia levada), e o mestre reúne só a Bia no Vale.
    expect(t.bridge.sendPlayer(t.ana, t.cripta, null)).toBe(true)
    expect(tokensDaCena(t.cripta).find((tk) => tk.id === 'lia')?.levadoPor).toBe('grog')
    const world = hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map)
    const members = partyMembers(t.bridge.players(), world).filter((m) => m.playerId === t.bia)
    const plan = planGather(members, world, { x: centro(10), y: centro(8) })
    const failed = applyGatherPlan(plan, {
      sceneId: world.open.sceneId,
      bringFromOtherScene: (playerId, sceneId, at) => t.bridge.sendPlayer(playerId, sceneId, null, at),
      placeInScene: (positions) => useMapStore.getState().setTokenPositions(positions),
    })
    expect(failed).toEqual([])
    const lia = tokensDaCena(t.vale).find((tk) => tk.id === 'lia')
    expect(lia).toBeDefined()
    expect(lia !== undefined && 'levadoPor' in lia).toBe(false)
    expect(tokensDaCena(t.cripta).map((tk) => tk.id)).toEqual(['grog'])
  })
})
