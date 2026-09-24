/**
 * VEÍCULO COM LUGARES, de ponta a ponta no lado do mestre: as stores de
 * verdade e a ponte com a sessão de verdade, ligadas como o App liga
 * (`hostWorldOf` + o `notifyMapChanged` a cada mudança do mapa aberto). Só o
 * transporte é falso.
 *
 * Aceite: o cesto (2 lugares) leva o Gui e mais 1 (a Bia), recusa o 3º (o
 * Caio), e os dois chegam juntos em a07 quando o mestre leva o cesto pelo
 * pino. Na mesa: o Gui passa a ver a07, e nenhum frame de ninguém carrega a
 * lista de passageiros; o Caio, que ficou, nunca recebe o nome de a07.
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
const { levarFichaPara } = await import('./levarFicha')
const { createEmptyMap, addPin } = await import('../lib/mapFactory')
const { arrivalSpot } = await import('../lib/pinTravel')
const { passengerIdsOf } = await import('../lib/vehicle')
const { createHostBridge, BROADCAST_THROTTLE_MS } = await import('../net/hostBridge')

const CODIGO = 'CESTO1'
const A07 = 'a07'
const SAIDA: Pin = { id: 'saida', x: 1500, y: 900, kind: 'viagem', description: 'Boca do poço', image: null, destino: null }

function ficha(id: string, name: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null, ...extra }
}

/** a06 aberta: o cesto com 2 lugares e o Gui, a Bia e o Caio em volta; a07 de fundo, com a boca do poço. */
function montarAventura(): { a06: string; a07: string } {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_a06', 'a06', 30, 20, 64))
  useSessionStore.getState().markSaved()
  useMapStore.getState().addToken(ficha('cesto', 'Cesto', 320, 320, { npc: true }))
  useMapStore.getState().setVehicleSeats('cesto', 2)
  useMapStore.getState().addToken(ficha('gui', 'Gui', 256, 320))
  useMapStore.getState().addToken(ficha('bia', 'Bia', 384, 320))
  useMapStore.getState().addToken(ficha('caio', 'Caio', 448, 320))
  const a07 = useAdventureStore.getState().createScene(A07, null)
  const a06 = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(a06)
  useAdventureStore.getState().updateBackgroundScene(a07, (map) => addPin(map, SAIDA))
  return { a06, a07 }
}

function tokensDaCena(sceneId: string): Token[] {
  const { activeSceneId, cache } = useAdventureStore.getState()
  if (sceneId === activeSceneId) return useMapStore.getState().map.tokens
  const slot = cache[sceneId]
  return slot?.status === 'ok' ? slot.map.tokens : []
}

function mapaDaCena(sceneId: string): MapData {
  const slot = useAdventureStore.getState().cache[sceneId]
  if (slot?.status !== 'ok') throw new Error('a cena deveria estar de fundo')
  return slot.map
}

function posicoes(sceneId: string): Record<string, [number, number]> {
  return Object.fromEntries(tokensDaCena(sceneId).map((t) => [t.id, [t.x, t.y]]))
}

interface Enviado {
  clientId: string
  msg: { type: string; [campo: string]: unknown }
}

async function mesa() {
  const cenas = montarAventura()
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
  const desligar = useMapStore.subscribe((state) => state.map, () => bridge.notifyMapChanged())
  const entra = (clientId: string, name: string): string => {
    ouvintes.get('net:message')?.({ payload: { clientId, msg: { type: 'join', code: CODIGO, name } } })
    const boasVindas = enviados.find((e) => e.clientId === clientId && e.msg.type === 'welcome')
    if (boasVindas === undefined || typeof boasVindas.msg.playerId !== 'string') throw new Error(`${name} não entrou`)
    return boasVindas.msg.playerId
  }
  bridge.assignToken(entra('c-gui', 'Gui'), 'gui')
  bridge.assignToken(entra('c-bia', 'Bia'), 'bia')
  bridge.assignToken(entra('c-caio', 'Caio'), 'caio')
  return { ...cenas, bridge, enviados, desligar }
}

function ultimoSnapshot(enviados: Enviado[], clientId: string): string {
  return JSON.stringify(enviados.filter((e) => e.clientId === clientId && e.msg.type === 'snapshot').at(-1)?.msg ?? null)
}

const esperarSnapshot = () => new Promise((resolve) => setTimeout(resolve, BROADCAST_THROTTLE_MS + 30))

describe('veículo com lugares: o cesto leva o Gui e mais 1, recusa o 3º, e os dois chegam juntos em a07', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('o mestre embarca Gui e Bia; o Caio é recusado e o cesto continua com dois', () => {
    const { a06 } = montarAventura()
    expect(useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)).toBe(true)
    expect(useMapStore.getState().setVehiclePassenger('cesto', 'bia', true)).toBe(true)
    expect(useMapStore.getState().setVehiclePassenger('cesto', 'caio', true)).toBe(false)
    expect(passengerIdsOf(useMapStore.getState().map, 'cesto')).toEqual(['gui', 'bia'])
    expect(tokensDaCena(a06)).toHaveLength(4)
    // Ctrl+Z desfaz o último embarque: é conteúdo do mapa.
    useMapStore.getState().undo()
    expect(passengerIdsOf(useMapStore.getState().map, 'cesto')).toEqual(['gui'])
  })

  it('arrastar o cesto na cena leva quem está a bordo junto', () => {
    montarAventura()
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    useMapStore.getState().setTokenPosition('cesto', 640, 320)
    const tokens = useMapStore.getState().map.tokens
    expect(tokens.find((t) => t.id === 'gui')?.x).toBe(576)
    expect(tokens.find((t) => t.id === 'bia')?.x).toBe(384)
  })

  it('levado pelo pino, o cesto chega em a07 com o Gui e a Bia no afastamento que tinham; o Caio fica em a06', () => {
    const { a06, a07 } = montarAventura()
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    useMapStore.getState().setVehiclePassenger('cesto', 'bia', true)
    const chegada = arrivalSpot(mapaDaCena(a07), SAIDA, 1)

    expect(levarFichaPara('cesto', a07, 'saida')).toBe(true)

    expect(tokensDaCena(a06).map((t) => t.id)).toEqual(['caio'])
    expect(posicoes(a07)).toEqual({
      cesto: [chegada.x, chegada.y],
      gui: [chegada.x - 64, chegada.y],
      bia: [chegada.x + 64, chegada.y],
    })
    // Chegam ainda a bordo: o cesto segue levando os dois em a07.
    expect(passengerIdsOf(mapaDaCena(a07), 'cesto')).toEqual(['gui', 'bia'])
    // Fora do desfazer: Ctrl+Z em a06 não traz ninguém de volta.
    while (useMapStore.getState().past.length > 0) {
      useMapStore.getState().undo()
      expect(useMapStore.getState().map.tokens.filter((t) => t.id !== 'caio')).toEqual([])
    }
  })

  it('o passageiro que atravessa sozinho sai da lista do cesto que ficou', () => {
    const { a06, a07 } = montarAventura()
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    expect(useAdventureStore.getState().transferToken('gui', a06, a07, 100, 100)).toBe(true)
    expect(passengerIdsOf(useMapStore.getState().map, 'cesto')).toEqual([])
    expect(useMapStore.getState().map.tokens.find((t) => t.id === 'cesto')?.veiculo).toEqual({ lugares: 2 })
    expect(posicoes(a07)).toEqual({ gui: [100, 100] })
  })

  it('na mesa: o Gui passa a ver a07 com a Bia; ninguém recebe a lista do cesto; o Caio nunca recebe o nome de a07', async () => {
    const t = await mesa()
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    useMapStore.getState().setVehiclePassenger('cesto', 'bia', true)
    await esperarSnapshot()
    expect(ultimoSnapshot(t.enviados, 'c-gui')).toContain('"caio"')

    expect(levarFichaPara('cesto', t.a07, 'saida')).toBe(true)
    await esperarSnapshot()

    const doGui = ultimoSnapshot(t.enviados, 'c-gui')
    expect(doGui).toContain('"cesto"')
    expect(doGui).toContain('"bia"')
    expect(doGui).not.toContain('"caio"')
    expect(ultimoSnapshot(t.enviados, 'c-caio')).toContain('"caio"')
    expect(ultimoSnapshot(t.enviados, 'c-caio')).not.toContain('"gui"')
    const tudo = JSON.stringify(t.enviados)
    expect(tudo).not.toContain('veiculo')
    expect(tudo).not.toContain('passageiros')
    expect(JSON.stringify(t.enviados.filter((e) => e.clientId === 'c-caio'))).not.toContain(`"${A07}"`)
    t.desligar()
    await t.bridge.stop()
  })
})
