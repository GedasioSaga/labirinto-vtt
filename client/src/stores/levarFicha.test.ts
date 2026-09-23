/**
 * "Levar para…" da ficha SEM DONO (NPC, monstro), de ponta a ponta no lado do
 * mestre: as stores de verdade e a ponte com a sessão de verdade, ligadas como
 * o App liga (`hostWorldOf` + o `notifyMapChanged` a cada mudança do mapa
 * aberto). Só o transporte é falso.
 *
 * Antes, levar o zumbi do Porão para o Térreo era apagar e recriar — e perder
 * nome, cor e foto. O que se cobra: a ficha sai do Porão e aparece ao lado do
 * alçapão do Térreo, igual (mesmo id, nome, cor e foto); o aviso "Zumbi foi
 * para Térreo" traz "Ir lá"; Ctrl+Z no Porão não a traz de volta; Carla, no
 * Térreo e perto, a vê chegar; Eva, no Térreo e longe, não; e Diego, no Porão,
 * deixa de vê-la sem nunca receber o nome da cena para onde ela foi.
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
const { useToastStore } = await import('./toastStore')
const { levarFichaPara, carriedTokenText } = await import('./levarFicha')
const { createEmptyMap, addPin, addToken } = await import('../lib/mapFactory')
const { arrivalPoint, arrivalSpot } = await import('../lib/pinTravel')
const { selectionOfItem, EMPTY_SELECTION } = await import('../lib/selectionModel')
const { createHostBridge, BROADCAST_THROTTLE_MS } = await import('../net/hostBridge')

const CODIGO = 'NPC123'
const TERREO = 'Térreo'

const ALCAPAO: Pin = { id: 'alcapao', x: 1500, y: 900, kind: 'viagem', description: 'Alçapão', image: null, destino: null }

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

const ZUMBI = ficha('zumbi', 320, 320, { name: 'Zumbi', color: '#6b8f3a', imageData: 'data:image/webp;base64,AAAA', npc: true })

/** Porão aberto (Diego e o zumbi, desfazer cheio); o Térreo de fundo, com o alçapão, Carla perto dele e Eva longe. */
function montarAventura(): { porao: string; terreo: string } {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_porao', 'Porão', 30, 20, 64))
  useSessionStore.getState().markSaved()
  useMapStore.getState().addToken(ficha('diego', 256, 320))
  useMapStore.getState().addToken(ZUMBI)
  useMapStore.getState().setTokenPosition('diego', 192, 320)
  const terreo = useAdventureStore.getState().createScene(TERREO, null)
  const porao = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(porao)
  useAdventureStore.getState().updateBackgroundScene(terreo, (map) => addToken(addToken(addPin(map, ALCAPAO), ficha('carla', 1600, 900)), ficha('eva', 64, 64)))
  return { porao, terreo }
}

interface Enviado {
  clientId: string
  msg: { type: string; [campo: string]: unknown }
}

async function mesa() {
  const { porao, terreo } = montarAventura()
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
  // Como o App: toda mudança do mapa aberto agenda um snapshot para a mesa.
  const desligar = useMapStore.subscribe((state) => state.map, () => bridge.notifyMapChanged())
  const entra = (clientId: string, name: string): string => {
    ouvintes.get('net:message')?.({ payload: { clientId, msg: { type: 'join', code: CODIGO, name } } })
    const boasVindas = enviados.find((e) => e.clientId === clientId && e.msg.type === 'welcome')
    if (boasVindas === undefined || typeof boasVindas.msg.playerId !== 'string') throw new Error(`${name} não entrou`)
    return boasVindas.msg.playerId
  }
  const diego = entra('c-diego', 'Diego')
  const carla = entra('c-carla', 'Carla')
  const eva = entra('c-eva', 'Eva')
  bridge.assignToken(diego, 'diego')
  bridge.assignToken(carla, 'carla')
  bridge.assignToken(eva, 'eva')
  return { bridge, enviados, porao, terreo, desligar }
}

function tokensDaCena(sceneId: string): Token[] {
  const { activeSceneId, cache } = useAdventureStore.getState()
  if (sceneId === activeSceneId) return useMapStore.getState().map.tokens
  const slot = cache[sceneId]
  return slot?.status === 'ok' ? slot.map.tokens : []
}

function mapaDoTerreo(terreo: string): MapData {
  const slot = useAdventureStore.getState().cache[terreo]
  if (slot?.status !== 'ok') throw new Error('o Térreo deveria estar de fundo')
  return slot.map
}

function ultimoSnapshot(enviados: Enviado[], clientId: string): string {
  return JSON.stringify(enviados.filter((e) => e.clientId === clientId && e.msg.type === 'snapshot').at(-1)?.msg ?? null)
}

const esperarSnapshot = () => new Promise((resolve) => setTimeout(resolve, BROADCAST_THROTTLE_MS + 30))

describe('"Levar para…" da ficha sem dono', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useToastStore.setState({ toasts: [] })
  })

  it('o zumbi sai do Porão e chega ao lado do alçapão do Térreo com o mesmo id, nome, cor e foto', () => {
    const { porao, terreo } = montarAventura()
    const esperado = arrivalSpot(mapaDoTerreo(terreo), ALCAPAO, 1)

    expect(levarFichaPara('zumbi', terreo, 'alcapao')).toBe(true)

    expect(tokensDaCena(porao).map((t) => t.id)).toEqual(['diego'])
    const chegou = tokensDaCena(terreo).find((t) => t.id === 'zumbi')
    expect(chegou).toEqual({ ...ZUMBI, x: esperado.x, y: esperado.y })
  })

  it('ficha só com os campos obrigatórios (sem cor, foto nem marca de NPC) viaja igual, sem ganhar campo', () => {
    const { terreo } = montarAventura()
    const simples = ficha('rato', 448, 320)
    useMapStore.getState().addToken(simples)
    const centro = arrivalPoint(mapaDoTerreo(terreo))
    expect(levarFichaPara('rato', terreo, null)).toBe(true)
    expect(tokensDaCena(terreo).find((t) => t.id === 'rato')).toEqual({ ...simples, x: centro.x, y: centro.y })
    expect(useToastStore.getState().toasts.map((a) => a.text)).toEqual(['ficha-rato foi para Térreo'])
  })

  it('sem pino, chega no centro livre da cena (arrivalPoint)', () => {
    const { terreo } = montarAventura()
    const centro = arrivalPoint(mapaDoTerreo(terreo))
    expect(levarFichaPara('zumbi', terreo, null)).toBe(true)
    expect(tokensDaCena(terreo).filter((t) => t.id === 'zumbi').map((t) => [t.x, t.y])).toEqual([[centro.x, centro.y]])
  })

  it('avisa "Zumbi foi para Térreo" com "Ir lá", que leva o editor à ficha no Térreo', () => {
    const { terreo } = montarAventura()
    const esperado = arrivalSpot(mapaDoTerreo(terreo), ALCAPAO, 1)
    levarFichaPara('zumbi', terreo, 'alcapao')

    const avisos = useToastStore.getState().toasts
    expect(avisos.map((a) => a.text)).toEqual(['Zumbi foi para Térreo'])
    const irLa = avisos[0]?.actions?.find((a) => a.label === 'Ir lá')
    expect(irLa).toBeDefined()
    irLa?.run()
    expect(useAdventureStore.getState().activeSceneId).toBe(terreo)
    expect(useAdventureStore.getState().cameraRequest?.focus).toEqual(esperado)
  })

  it('ficha sem nome vira "A ficha foi para …": o aviso nunca começa em branco', () => {
    expect(carriedTokenText({ tokenName: '   ', sceneId: 's', sceneName: TERREO, x: 0, y: 0 })).toBe('A ficha foi para Térreo')
    expect(carriedTokenText({ tokenName: 'Zumbi', sceneId: 's', sceneName: TERREO, x: 0, y: 0 })).toBe('Zumbi foi para Térreo')
  })

  it('fica fora do desfazer: Ctrl+Z e Ctrl+Y no Porão nunca trazem o zumbi de volta', () => {
    const { terreo } = montarAventura()
    expect(useMapStore.getState().past.length).toBeGreaterThan(0)
    levarFichaPara('zumbi', terreo, 'alcapao')
    while (useMapStore.getState().past.length > 0) {
      useMapStore.getState().undo()
      expect(useMapStore.getState().map.tokens.map((t) => t.id)).not.toContain('zumbi')
    }
    while (useMapStore.getState().future.length > 0) {
      useMapStore.getState().redo()
      expect(useMapStore.getState().map.tokens.map((t) => t.id)).not.toContain('zumbi')
    }
    expect(tokensDaCena(terreo).filter((t) => t.id === 'zumbi')).toHaveLength(1)
  })

  it('o zumbi selecionado sai da seleção do editor junto com a cena', () => {
    const { terreo } = montarAventura()
    useMapStore.getState().setSelection(selectionOfItem({ kind: 'token', id: 'zumbi' }))
    levarFichaPara('zumbi', terreo, 'alcapao')
    expect(useMapStore.getState().selection).toEqual(EMPTY_SELECTION)
  })

  it('recusa sem mexer em nada: pino que sumiu, a própria cena, ficha que não está aqui, mapa solto', () => {
    const { porao, terreo } = montarAventura()
    expect(levarFichaPara('zumbi', terreo, 'pino-que-nao-existe')).toBe(false)
    expect(levarFichaPara('zumbi', porao, null)).toBe(false)
    expect(levarFichaPara('fantasma', terreo, null)).toBe(false)
    expect(tokensDaCena(porao).map((t) => t.id)).toEqual(['diego', 'zumbi'])
    expect(tokensDaCena(terreo).map((t) => t.id)).toEqual(['carla', 'eva'])
    expect(useToastStore.getState().toasts).toEqual([])

    useAdventureStore.getState().reset()
    useMapStore.getState().loadMap({ ...createEmptyMap('solto', 'Solto', 10, 10, 64), tokens: [ZUMBI] })
    expect(levarFichaPara('zumbi', terreo, null)).toBe(false)
    expect(useMapStore.getState().map.tokens.map((t) => t.id)).toEqual(['zumbi'])
  })

  it('na mesa: Carla (perto do alçapão) vê o zumbi chegar, Eva (longe) não, e Diego deixa de vê-lo sem receber o nome da cena', async () => {
    const t = await mesa()
    await esperarSnapshot()
    expect(ultimoSnapshot(t.enviados, 'c-diego')).toContain('"zumbi"')
    expect(ultimoSnapshot(t.enviados, 'c-carla')).not.toContain('"zumbi"')
    const antes = t.enviados.length

    expect(levarFichaPara('zumbi', t.terreo, 'alcapao')).toBe(true)
    await esperarSnapshot()

    const depois = t.enviados.slice(antes)
    expect(depois.map((e) => e.clientId)).toEqual(expect.arrayContaining(['c-diego', 'c-carla']))
    expect(ultimoSnapshot(t.enviados, 'c-carla')).toContain('"zumbi"')
    expect(ultimoSnapshot(t.enviados, 'c-eva')).not.toContain('"zumbi"')
    expect(ultimoSnapshot(t.enviados, 'c-diego')).not.toContain('"zumbi"')
    expect(ultimoSnapshot(t.enviados, 'c-diego')).toContain('"diego"')
    // Nenhum frame do Diego, do começo ao fim, traz o nome da cena para onde o zumbi foi.
    expect(JSON.stringify(t.enviados.filter((e) => e.clientId === 'c-diego'))).not.toContain(TERREO)
    // Ninguém recebe aviso de viagem: não foi jogador que atravessou.
    expect(depois.map((e) => e.msg.type)).not.toContain('scene.changed')
    t.desligar()
    await t.bridge.stop()
  })
})
