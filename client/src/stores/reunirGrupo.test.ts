/**
 * "Reunir o grupo aqui" (G5) de ponta a ponta no lado do mestre: a ponte com a
 * sessão de verdade, ligada às stores de verdade do jeito que o App liga
 * (`planGather` + `applyGatherPlan`, com `sendPlayer` e `setTokenPositions`).
 * Só o transporte é falso.
 *
 * O que se cobra: Bia, que estava na Cripta, chega ao Vale em volta do pino e
 * lê o aviso de reunião, sem o nome de cena nenhuma; Ana, que já estava no
 * Vale, só anda e não recebe aviso; as duas em casas diferentes; e um Ctrl+Z
 * desfaz só o passo de Ana, sem duplicar a ficha de Bia nem devolvê-la à
 * Cripta.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
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
const NOME_DA_CRIPTA = 'Cripta Rubra'
const GRADE = 64
/** O pino "!" da reunião, no meio de uma casa do Vale, longe das duas fichas. */
const FOGUEIRA: Pin = { id: 'fogueira', x: 10 * GRADE + GRADE / 2, y: 8 * GRADE + GRADE / 2, kind: 'exclamacao', description: 'Fogueira', image: null }
const INICIO_DA_ANA = { x: 2 * GRADE + GRADE / 2, y: 2 * GRADE + GRADE / 2 }

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
  useMapStore.getState().addToken(ficha('grog', INICIO_DA_ANA.x, INICIO_DA_ANA.y))
  useMapStore.getState().addToken(ficha('lia', 5 * GRADE + GRADE / 2, 2 * GRADE + GRADE / 2))
  useMapStore.getState().addPin(FOGUEIRA)
  const cripta = useAdventureStore.getState().createScene(NOME_DA_CRIPTA, null)
  const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  const nomeDoVale = useAdventureStore.getState().adventure?.scenes[0].name ?? ''
  useAdventureStore.getState().switchScene(vale)

  const ouvintes = new Map<string, (event: { payload: unknown }) => void>()
  const enviados: Enviado[] = []
  const invoke = vi.fn(async (cmd: string, args?: unknown) => {
    if (cmd === 'net_start_room') return { code: CODIGO, urls: [], qrSvg: '<svg/>' }
    // O `JSON.parse(JSON.stringify(…))` é o fio: o que o jogador recebe é texto.
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
  // Bia vai para a Cripta pelo "Mandar para…": o grupo está espalhado.
  if (!bridge.sendPlayer(bia, cripta, null)) throw new Error('Bia deveria ir para a Cripta')
  return { bridge, enviados, vale, cripta, nomeDoVale, ana, bia }
}

/** O mesmo que o App faz ao confirmar "Reunir". */
function reunir(t: Awaited<ReturnType<typeof mesa>>, playerIds: string[]): string[] {
  const world = hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map)
  const members = partyMembers(t.bridge.players(), world).filter((m) => playerIds.includes(m.playerId))
  const plan = planGather(members, world, FOGUEIRA)
  expect(plan.leftOut).toEqual([])
  return applyGatherPlan(plan, {
    sceneId: world.open.sceneId,
    bringFromOtherScene: (playerId, sceneId, at) => t.bridge.sendPlayer(playerId, sceneId, null, at),
    placeInScene: (positions) => useMapStore.getState().setTokenPositions(positions),
  })
}

function tokensDaCripta(cripta: string): Token[] {
  const slot = useAdventureStore.getState().cache[cripta]
  return slot?.status === 'ok' ? slot.map.tokens : []
}

const pertoDoPino = (t: Token) => Math.max(Math.abs(t.x - FOGUEIRA.x), Math.abs(t.y - FOGUEIRA.y)) <= 2 * GRADE

describe('"Reunir o grupo aqui"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Bia vem da Cripta com o aviso de reunião; Ana, já no Vale, só anda; casas diferentes', async () => {
    const t = await mesa()
    expect(tokensDaCripta(t.cripta).map((tk) => tk.id)).toEqual(['lia'])
    const antes = t.enviados.length

    expect(reunir(t, [t.ana, t.bia])).toEqual([])

    const noVale = useMapStore.getState().map.tokens
    expect(noVale.map((tk) => tk.id).sort()).toEqual(['grog', 'lia'])
    expect(tokensDaCripta(t.cripta)).toEqual([])
    expect(noVale.every(pertoDoPino)).toBe(true)
    const [a, b] = noVale
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(GRADE)

    const depois = t.enviados.slice(antes)
    expect(depois.filter((e) => e.clientId === 'c2' && e.msg.type === 'scene.changed').map((e) => e.msg)).toEqual([{ type: 'scene.changed', by: 'gather' }])
    expect(depois.filter((e) => e.clientId === 'c1' && e.msg.type === 'scene.changed')).toEqual([])
    // Nenhum frame da Bia, do começo ao fim, traz o nome de cena nenhuma.
    const daBia = JSON.stringify(t.enviados.filter((e) => e.clientId === 'c2'))
    expect(daBia).not.toContain(NOME_DA_CRIPTA)
    expect(daBia).not.toContain(`"${t.nomeDoVale}"`)
  })

  it('um Ctrl+Z desfaz só o passo de Ana; a ficha de Bia continua uma só, no Vale', async () => {
    const t = await mesa()
    reunir(t, [t.ana, t.bia])
    const lia = useMapStore.getState().map.tokens.find((tk) => tk.id === 'lia')

    useMapStore.getState().undo()

    const tokens = useMapStore.getState().map.tokens
    expect(tokens.find((tk) => tk.id === 'grog')).toMatchObject(INICIO_DA_ANA)
    expect(tokens.filter((tk) => tk.id === 'lia')).toEqual([lia])
    expect(tokensDaCripta(t.cripta)).toEqual([])
    // Desfazer até o começo nunca devolve Bia à Cripta nem a duplica.
    while (useMapStore.getState().past.length > 0) {
      useMapStore.getState().undo()
      expect(useMapStore.getState().map.tokens.filter((tk) => tk.id === 'lia').length).toBeLessThanOrEqual(1)
    }
    expect(tokensDaCripta(t.cripta)).toEqual([])
  })

  it('Bia desmarcada fica na Cripta; só Ana anda', async () => {
    const t = await mesa()
    reunir(t, [t.ana])
    expect(tokensDaCripta(t.cripta).map((tk) => tk.id)).toEqual(['lia'])
    expect(useMapStore.getState().map.tokens.map((tk) => tk.id)).toEqual(['grog'])
    expect(useMapStore.getState().map.tokens.every(pertoDoPino)).toBe(true)
  })
})
