/**
 * VEÍCULO — a viagem pedida pela MOTORISTA e a vez na iniciativa, de ponta a
 * ponta no lado do mestre: as stores de verdade e a ponte com a sessão de
 * verdade, ligadas como o App liga. Só o transporte é falso (o molde é
 * `stores/veiculo.test.ts`).
 *
 * Queixa: "o pedido de viagem do motorista atravessa só a ficha dele, e ele
 * desce do veículo". Aceite: a viagem da motorista (pino livre, "Deixar ir",
 * atalho na mesma cena) leva o VEÍCULO com todos a bordo, cada um no
 * afastamento que tinha, ainda a bordo; a passageira que não dirige lê
 * "a_bordo" e nada anda; dirigindo para longe do pino, o pedido cai por
 * "far"; nenhum frame leva a lista nem os lugares. Na vez de outra ficha, o
 * "Subir" e o "Descer" voltam "not_your_turn" (o host continua validando).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'
import type { TurnRef } from '../lib/initiative'

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
const { createEmptyMap, addPin } = await import('../lib/mapFactory')
const { passengerIdsOf } = await import('../lib/vehicle')
const { createHostBridge, BROADCAST_THROTTLE_MS } = await import('../net/hostBridge')
const { VEHICLE_ACTION_MIN_INTERVAL_MS } = await import('../net/hostSession')
const { hostPlayerChanges } = await import('../net/playerChanges')

const CODIGO = 'CESTO4'
const A07 = 'a07'
/** A boca do poço em a07, longe da borda e de parede: quem chega a bordo cabe no afastamento que tinha. */
const SAIDA: Pin = { id: 'saida', x: 960, y: 640, kind: 'viagem', description: 'Boca do poço', image: null, destino: null }
/** Bem mais que qualquer limite de frequência do host (pedido de passagem, "Subir"/"Descer"). */
const PASSO_DO_RELOGIO_MS = 60_000

function ficha(id: string, name: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null, ...extra }
}

/**
 * a06 aberta: o cesto (2 lugares) com o Gui à esquerda, a Bia em cima e o
 * Caio duas casas à direita; o poço uma casa abaixo do cesto (o Gui e a Bia
 * alcançam? só o Gui e quem encosta). a07 de fundo, com a boca do poço.
 */
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

/** O poço de a06, uma casa abaixo do cesto (o Gui e a Bia encostam; o Caio não), ligado à boca de a07. */
function abrirPoco(a06: string, a07: string, passagem: Pin['passagem']): void {
  useMapStore.getState().addPin({ id: 'poco', x: 320, y: 384, kind: 'viagem', description: 'Poço', image: null, destino: { sceneId: a07, pinId: 'saida' }, passagem })
  useAdventureStore.getState().updateBackgroundScene(a07, (map) => ({
    ...map,
    pins: map.pins.map((pin) => (pin.id === 'saida' ? { ...pin, destino: { sceneId: a06, pinId: 'poco' } } : pin)),
  }))
}

function tokensDaCena(sceneId: string): Token[] {
  const { activeSceneId, cache } = useAdventureStore.getState()
  if (sceneId === activeSceneId) return useMapStore.getState().map.tokens
  const slot = cache[sceneId]
  return slot?.status === 'ok' ? slot.map.tokens : []
}

function mapaDaCena(sceneId: string): MapData {
  const { activeSceneId, cache } = useAdventureStore.getState()
  if (sceneId === activeSceneId) return useMapStore.getState().map
  const slot = cache[sceneId]
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

const esperarSnapshot = () => new Promise((resolve) => setTimeout(resolve, BROADCAST_THROTTLE_MS + 30))

async function mesa(turno: { atual: TurnRef | null } = { atual: null }) {
  const cenas = montarAventura()
  const ouvintes = new Map<string, (event: { payload: unknown }) => void>()
  const enviados: Enviado[] = []
  let relogio = 0
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
    applyMove: hostPlayerChanges.applyMove,
    applyVehicle: hostPlayerChanges.applyVehicle,
    applyVehicleHop: hostPlayerChanges.applyVehicleHop,
    applyDoor: () => undefined,
    applyTransfer: ({ tokenId, fromSceneId, toSceneId, x, y, piso, hold }) => useAdventureStore.getState().transferToken(tokenId, fromSceneId, toSceneId, x, y, piso, hold),
    getTurn: () => turno.atual,
    onPlayersChange: vi.fn(),
    now: () => relogio,
  })
  await bridge.start()
  const desligar = useMapStore.subscribe((state) => state.map, () => bridge.notifyMapChanged())
  const envia = (clientId: string, msg: Record<string, unknown>) => {
    relogio += PASSO_DO_RELOGIO_MS
    ouvintes.get('net:message')?.({ payload: { clientId, msg } })
  }
  const entra = (clientId: string, name: string): string => {
    envia(clientId, { type: 'join', code: CODIGO, name })
    const boasVindas = enviados.find((e) => e.clientId === clientId && e.msg.type === 'welcome')
    if (boasVindas === undefined || typeof boasVindas.msg.playerId !== 'string') throw new Error(`${name} não entrou`)
    return boasVindas.msg.playerId
  }
  bridge.assignToken(entra('c-gui', 'Gui'), 'gui')
  bridge.assignToken(entra('c-bia', 'Bia'), 'bia')
  bridge.assignToken(entra('c-caio', 'Caio'), 'caio')
  const sobe = (clientId: string, tokenId: string) => {
    relogio += VEHICLE_ACTION_MIN_INTERVAL_MS
    envia(clientId, { type: 'vehicle.board', tokenId, vehicleId: 'cesto' })
  }
  const desce = (clientId: string, tokenId: string) => envia(clientId, { type: 'vehicle.leave', tokenId })
  const pede = (clientId: string, pinId: string) => envia(clientId, { type: 'pin.travel.request', pinId })
  const anda = (clientId: string, tokenId: string, x: number, y: number) => envia(clientId, { type: 'token.move', reqId: `${tokenId}-${x}-${y}`, tokenId, x, y })
  const fim = async () => {
    desligar()
    await bridge.stop()
  }
  return { ...cenas, bridge, enviados, sobe, desce, pede, anda, fim }
}

/** As respostas de `clientId` a partir de `desde`, sem os snapshots. */
function respostas(enviados: Enviado[], clientId: string, desde: number): Enviado['msg'][] {
  return enviados
    .slice(desde)
    .filter((e) => e.clientId === clientId && e.msg.type !== 'snapshot' && e.msg.type !== 'patch')
    .map((e) => e.msg)
}

/** A troca de cena que `clientId` recebeu a partir de `desde` (`by` incluso). */
function trocas(enviados: Enviado[], clientId: string, desde: number): { by?: unknown }[] {
  return enviados.slice(desde).filter((e) => e.clientId === clientId && e.msg.type === 'scene.changed').map((e) => ({ by: e.msg.by }))
}

const pedidoNaCaixa = (nome: string) => useToastStore.getState().toasts.find((toast) => toast.text.startsWith(`${nome} quer passar`))

function deixarIr(nome: string): void {
  const deixar = pedidoNaCaixa(nome)?.actions?.find((a) => a.label === 'Deixar ir')
  if (deixar === undefined) throw new Error(`sem "Deixar ir" para ${nome}`)
  deixar.run()
}

/** O afastamento de cada ficha a bordo em volta do cesto, em `sceneId`. */
function afastamentos(sceneId: string): Record<string, [number, number]> {
  const aqui = posicoes(sceneId)
  const cesto = aqui.cesto
  if (cesto === undefined) throw new Error('o cesto não está nesta cena')
  return Object.fromEntries(passengerIdsOf(mapaDaCena(sceneId), 'cesto').map((id) => [id, [aqui[id][0] - cesto[0], aqui[id][1] - cesto[1]]]))
}

describe('veículo: a viagem da motorista leva o veículo inteiro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useToastStore.setState({ toasts: [] })
  })

  it('pino livre: o Gui (motorista) passa e chega em a07 com o cesto e a Bia, a bordo e no mesmo afastamento; o Caio fica', async () => {
    const t = await mesa()
    abrirPoco(t.a06, t.a07, 'livre')
    t.sobe('c-gui', 'gui')
    t.sobe('c-bia', 'bia')
    const antes = afastamentos(t.a06)
    const desde = t.enviados.length

    t.pede('c-gui', 'poco')
    await esperarSnapshot()

    expect(tokensDaCena(t.a06).map((tk) => tk.id)).toEqual(['caio'])
    expect(tokensDaCena(t.a07).map((tk) => tk.id).sort()).toEqual(['bia', 'cesto', 'gui'])
    expect(passengerIdsOf(mapaDaCena(t.a07), 'cesto')).toEqual(['gui', 'bia'])
    expect(afastamentos(t.a07)).toEqual(antes)
    // O Gui pediu: "Você chegou". A Bia foi levada a bordo: a troca do mestre, como no "Levar para…" do veículo.
    expect(trocas(t.enviados, 'c-gui', desde)).toEqual([{ by: undefined }])
    expect(trocas(t.enviados, 'c-bia', desde)).toEqual([{ by: 'master' }])
    expect(trocas(t.enviados, 'c-caio', desde)).toEqual([])
    await t.fim()
  })

  it('"Deixar ir" do mestre: a mesma chegada com o cesto e a Bia; nenhum frame leva a lista nem os lugares', async () => {
    const t = await mesa()
    abrirPoco(t.a06, t.a07, undefined)
    t.sobe('c-gui', 'gui')
    t.sobe('c-bia', 'bia')
    const antes = afastamentos(t.a06)
    t.pede('c-gui', 'poco')
    expect(pedidoNaCaixa('Gui')).toBeDefined()
    expect(tokensDaCena(t.a07).map((tk) => tk.id)).toEqual([])

    deixarIr('Gui')
    await esperarSnapshot()

    expect(tokensDaCena(t.a07).map((tk) => tk.id).sort()).toEqual(['bia', 'cesto', 'gui'])
    expect(passengerIdsOf(mapaDaCena(t.a07), 'cesto')).toEqual(['gui', 'bia'])
    expect(afastamentos(t.a07)).toEqual(antes)
    const fio = JSON.stringify(t.enviados.filter((e) => e.clientId.startsWith('c-')))
    expect(fio).not.toContain('passageiros')
    expect(fio).not.toContain('lugares')
    expect(fio).not.toContain('"veiculo"')
    // O Caio, que ficou, nunca lê o nome de a07.
    expect(JSON.stringify(t.enviados.filter((e) => e.clientId === 'c-caio'))).not.toContain(`"${A07}"`)
    await t.fim()
  })

  it('a passageira que não dirige pede o poço: "a_bordo", nada vai à Caixa do mestre e ninguém anda', async () => {
    const t = await mesa()
    abrirPoco(t.a06, t.a07, 'livre')
    t.sobe('c-gui', 'gui')
    t.sobe('c-bia', 'bia')
    const desde = t.enviados.length

    t.pede('c-bia', 'poco')

    expect(respostas(t.enviados, 'c-bia', desde)).toEqual([{ type: 'pin.travel.rejected', reason: 'a_bordo' }])
    expect(pedidoNaCaixa('Bia')).toBeUndefined()
    expect(tokensDaCena(t.a07).map((tk) => tk.id)).toEqual([])
    expect(passengerIdsOf(mapaDaCena(t.a06), 'cesto')).toEqual(['gui', 'bia'])
    await t.fim()
  })

  it('pedido feito a pé e aprovado depois de subir como passageira: o "Deixar ir" recusa "a_bordo" e ela fica a bordo', async () => {
    const t = await mesa()
    abrirPoco(t.a06, t.a07, undefined)
    t.sobe('c-gui', 'gui')
    t.pede('c-bia', 'poco')
    expect(pedidoNaCaixa('Bia')).toBeDefined()
    t.sobe('c-bia', 'bia')
    const desde = t.enviados.length

    deixarIr('Bia')

    expect(respostas(t.enviados, 'c-bia', desde)).toContainEqual({ type: 'pin.travel.rejected', reason: 'a_bordo' })
    expect(tokensDaCena(t.a07).map((tk) => tk.id)).toEqual([])
    expect(passengerIdsOf(mapaDaCena(t.a06), 'cesto')).toEqual(['gui', 'bia'])
    await t.fim()
  })

  it('a motorista dirige para longe do poço com o pedido esperando: o pedido cai por "far"; perto, continua', async () => {
    const t = await mesa()
    abrirPoco(t.a06, t.a07, undefined)
    t.sobe('c-gui', 'gui')
    t.sobe('c-bia', 'bia')
    t.pede('c-gui', 'poco')
    expect(t.bridge.players().find((p) => p.name === 'Gui')?.travelPending).toBe(true)

    // Uma casa para baixo: o cesto vai junto e o Gui ainda encosta no poço.
    t.anda('c-gui', 'gui', 256, 384)
    expect(posicoes(t.a06).cesto).toEqual([320, 384])
    expect(t.bridge.players().find((p) => p.name === 'Gui')?.travelPending).toBe(true)

    // Três casas para cima: o cesto, o Gui e a Bia saem de perto.
    const desde = t.enviados.length
    t.anda('c-gui', 'gui', 256, 192)
    expect(posicoes(t.a06)).toMatchObject({ gui: [256, 192], cesto: [320, 192], bia: [384, 192] })
    expect(respostas(t.enviados, 'c-gui', desde)).toContainEqual({ type: 'pin.travel.cancelled', reason: 'far' })
    expect(t.bridge.players().find((p) => p.name === 'Gui')?.travelPending).toBeUndefined()
    expect(pedidoNaCaixa('Gui')).toBeUndefined()
    await t.fim()
  })

  it('atalho na mesma cena: o cesto salta para o outro pino com o Gui e a Bia a bordo, mesmo com parede no meio', async () => {
    const t = await mesa()
    useMapStore.getState().addPin({ id: 'ida', x: 320, y: 384, kind: 'viagem', description: 'Alçapão', image: null, destino: { sceneId: t.a06, pinId: 'volta' }, passagem: 'livre' })
    useMapStore.getState().addPin({ id: 'volta', x: 1280, y: 768, kind: 'viagem', description: 'Saída do alçapão', image: null, destino: { sceneId: t.a06, pinId: 'ida' }, passagem: 'livre' })
    // Uma parede inteira entre os dois pinos: o passo a passo derrubaria quem vai a bordo.
    useMapStore.getState().addWall({ id: 'muro', x1: 900, y1: 0, x2: 900, y2: 1280, blocksLight: true, blocksMove: true, door: null })
    t.sobe('c-gui', 'gui')
    t.sobe('c-bia', 'bia')
    const antes = afastamentos(t.a06)

    t.pede('c-gui', 'ida')

    const [cx] = posicoes(t.a06).cesto
    expect(cx).toBeGreaterThan(900)
    expect(passengerIdsOf(mapaDaCena(t.a06), 'cesto')).toEqual(['gui', 'bia'])
    expect(afastamentos(t.a06)).toEqual(antes)
    expect(posicoes(t.a06).caio).toEqual([448, 320])
    await t.fim()
  })
})

describe('veículo na iniciativa: fora da vez, o host recusa o "Subir" e o "Descer"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('na vez do Caio, o Gui não sobe nem desce: "not_your_turn"; na vez dele, sobe', async () => {
    const turno: { atual: TurnRef | null } = { atual: null }
    const t = await mesa(turno)
    t.sobe('c-bia', 'bia')
    turno.atual = { mapId: 'map_a06', tokenId: 'caio' }
    let desde = t.enviados.length

    t.sobe('c-gui', 'gui')
    t.desce('c-bia', 'bia')

    expect(respostas(t.enviados, 'c-gui', desde)).toEqual([{ type: 'vehicle.rejected', reason: 'not_your_turn' }])
    expect(respostas(t.enviados, 'c-bia', desde)).toEqual([{ type: 'vehicle.rejected', reason: 'not_your_turn' }])
    expect(passengerIdsOf(useMapStore.getState().map, 'cesto')).toEqual(['bia'])

    turno.atual = { mapId: 'map_a06', tokenId: 'gui' }
    desde = t.enviados.length
    t.sobe('c-gui', 'gui')
    expect(respostas(t.enviados, 'c-gui', desde)).toEqual([])
    expect(passengerIdsOf(useMapStore.getState().map, 'cesto')).toEqual(['bia', 'gui'])
    await t.fim()
  })
})
