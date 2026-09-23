/**
 * "Mandar para…" do painel Grupo, de ponta a ponta no lado do mestre: a ponte
 * (`hostBridge`) com a sessão de verdade, ligada às stores de verdade como o
 * App liga (`hostWorldOf` + `transferToken`). Só o transporte é falso.
 *
 * O que se cobra: a ficha sai da cena de origem e entra na de destino no
 * ponto escolhido; Ctrl+Z não a duplica; quem ficou na origem deixa de vê-la;
 * o dono recebe `scene.changed` do mestre e o mapa novo SEM o nome da cena; e
 * o painel do mestre passa a dizer a cena nova na hora.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
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
const { arrivalPoint, arrivalSpot } = await import('../lib/pinTravel')
const { createHostBridge } = await import('../net/hostBridge')

const CODIGO = 'AB12CD'
const NOME_DA_CRIPTA = 'Cripta Rubra'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

const ESCADA: Pin = { id: 'escada', x: 1500, y: 900, kind: 'viagem', description: 'Escada que sobe', image: null, destino: null }

/** Vale aberto com as duas fichas (e desfazer cheio); a Cripta de fundo, com um pino de viagem. */
function montarAventura(): { vale: string; cripta: string } {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_vale', 'Vale', 30, 20, 64))
  useSessionStore.getState().markSaved()
  useMapStore.getState().addToken(ficha('grog', 128, 128))
  useMapStore.getState().addToken(ficha('lia', 256, 128))
  useMapStore.getState().setTokenPosition('grog', 192, 128)
  const cripta = useAdventureStore.getState().createScene(NOME_DA_CRIPTA, null)
  const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(vale)
  useAdventureStore.getState().updateBackgroundScene(cripta, (map) => addPin(map, ESCADA))
  return { vale, cripta }
}

interface Enviado {
  clientId: string
  msg: { type: string; [campo: string]: unknown }
}

async function mesa() {
  const { vale, cripta } = montarAventura()
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
  const onPlayersChange = vi.fn()
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => useMapStore.getState().map,
    getWorld: () => hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map),
    applyMove: () => undefined,
    applyDoor: () => undefined,
    applyTransfer: ({ tokenId, fromSceneId, toSceneId, x, y }) => useAdventureStore.getState().transferToken(tokenId, fromSceneId, toSceneId, x, y),
    onPlayersChange,
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
  return { bridge, enviados, onPlayersChange, vale, cripta, ana, bia }
}

function tokensDaCena(sceneId: string): Token[] {
  const { activeSceneId, cache } = useAdventureStore.getState()
  if (sceneId === activeSceneId) return useMapStore.getState().map.tokens
  const slot = cache[sceneId]
  return slot?.status === 'ok' ? slot.map.tokens : []
}

function mapaDaCripta(cripta: string): MapData {
  const slot = useAdventureStore.getState().cache[cripta]
  if (slot?.status !== 'ok') throw new Error('a Cripta deveria estar de fundo')
  return slot.map
}

function snapshotPara(enviados: Enviado[], clientId: string): Enviado['msg'] | undefined {
  return enviados.filter((e) => e.clientId === clientId && e.msg.type === 'snapshot').at(-1)?.msg
}

describe('"Mandar para…" (painel Grupo)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('leva a ficha do Vale para o pino escolhido da Cripta; Bia, no Vale, deixa de vê-la', async () => {
    const t = await mesa()
    const esperado = arrivalSpot(mapaDaCripta(t.cripta), ESCADA, 1)
    const antes = t.enviados.length

    expect(t.bridge.sendPlayer(t.ana, t.cripta, 'escada')).toBe(true)

    expect(tokensDaCena(t.vale).map((tk) => tk.id)).toEqual(['lia'])
    expect(tokensDaCena(t.cripta).map((tk) => [tk.id, tk.x, tk.y])).toEqual([['grog', esperado.x, esperado.y]])

    const depois = t.enviados.slice(antes)
    // Ao dono, primeiro o aviso do mestre, depois o mapa novo.
    expect(depois.filter((e) => e.clientId === 'c1').map((e) => e.msg.type)).toEqual(['scene.changed', 'snapshot'])
    expect(depois.find((e) => e.clientId === 'c1')?.msg).toEqual({ type: 'scene.changed', by: 'master' })
    const daAna = snapshotPara(depois, 'c1')
    expect(daAna?.map).toMatchObject({ id: mapaDaCripta(t.cripta).id, name: '' })
    // Nenhum frame da Ana, do começo ao fim, traz o nome da cena.
    expect(JSON.stringify(t.enviados.filter((e) => e.clientId === 'c1'))).not.toContain(NOME_DA_CRIPTA)

    const daBia = snapshotPara(depois, 'c2')
    expect(JSON.stringify(daBia)).not.toContain('"grog"')
    expect(JSON.stringify(daBia)).toContain('"lia"')
  })

  it('sem pino, a ficha chega no centro da cena (arrivalPoint)', async () => {
    const t = await mesa()
    const centro = arrivalPoint(mapaDaCripta(t.cripta))
    expect(t.bridge.sendPlayer(t.bia, t.cripta, null)).toBe(true)
    expect(tokensDaCena(t.cripta).map((tk) => [tk.id, tk.x, tk.y])).toEqual([['lia', centro.x, centro.y]])
  })

  it('Ctrl+Z e Ctrl+Y no Vale depois do envio não trazem a ficha de volta; ela continua só na Cripta', async () => {
    const t = await mesa()
    expect(useMapStore.getState().past.length).toBeGreaterThan(0)
    t.bridge.sendPlayer(t.ana, t.cripta, 'escada')
    while (useMapStore.getState().past.length > 0) {
      useMapStore.getState().undo()
      expect(useMapStore.getState().map.tokens.map((tk) => tk.id)).not.toContain('grog')
    }
    while (useMapStore.getState().future.length > 0) {
      useMapStore.getState().redo()
      expect(useMapStore.getState().map.tokens.map((tk) => tk.id)).not.toContain('grog')
    }
    expect(tokensDaCena(t.cripta).map((tk) => tk.id)).toEqual(['grog'])
  })

  it('o painel do mestre diz a cena nova na hora, com o id que o "Ir lá" usa', async () => {
    const t = await mesa()
    t.bridge.sendPlayer(t.ana, t.cripta, null)
    const lista: unknown = t.onPlayersChange.mock.calls.at(-1)?.[0]
    expect(lista).toEqual([
      expect.objectContaining({ name: 'Ana', sceneName: NOME_DA_CRIPTA, sceneId: t.cripta }),
      expect.objectContaining({ name: 'Bia', sceneName: 'Vale', sceneId: t.vale }),
    ])
  })

  it('recusa sem mexer em nada: pino que não existe, a própria cena, jogador sem ficha', async () => {
    const t = await mesa()
    const antes = t.enviados.length
    expect(t.bridge.sendPlayer(t.ana, t.cripta, 'pino-que-nao-existe')).toBe(false)
    expect(t.bridge.sendPlayer(t.ana, t.vale, null)).toBe(false)
    t.bridge.unassignToken(t.bia, 'lia')
    const semFicha = t.enviados.length
    expect(t.bridge.sendPlayer(t.bia, t.cripta, null)).toBe(false)
    expect(tokensDaCena(t.vale).map((tk) => tk.id)).toEqual(['grog', 'lia'])
    expect(tokensDaCena(t.cripta)).toEqual([])
    // Só o `lobby.waiting` da Bia (que perdeu a ficha) saiu; nada de scene.changed.
    expect(t.enviados.slice(antes, semFicha).map((e) => e.msg.type)).not.toContain('scene.changed')
    expect(t.enviados.slice(semFicha)).toEqual([])
  })
})
