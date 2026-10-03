/**
 * VEÍCULO pela tela do JOGADOR, de ponta a ponta no lado do mestre: as stores
 * de verdade e a ponte com a sessão de verdade, ligadas como o App liga. Só o
 * transporte é falso (o molde é `stores/veiculo.test.ts`).
 *
 * Queixa: "os jogadores não estão conseguindo subir nele nem controlar o
 * token". Aceite: encostado, o jogador sobe sozinho ("Subir", sem o mestre);
 * o primeiro a bordo é o motorista e o passo dele leva o cesto e todos; o
 * passageiro que não dirige não anda (e não cai do cesto); "Descer" tira só
 * ele, e o próximo vira motorista. Nenhum frame leva a lista nem os lugares.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Token } from '../types/map'

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
const { passengerIdsOf } = await import('../lib/vehicle')
const { createHostBridge, BROADCAST_THROTTLE_MS } = await import('../net/hostBridge')
const { VEHICLE_ACTION_MIN_INTERVAL_MS } = await import('../net/hostSession')
const { hostPlayerChanges } = await import('../net/playerChanges')

const CODIGO = 'CESTO2'

function ficha(id: string, name: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null, ...extra }
}

/** a06: o cesto (2 lugares) com o Gui à esquerda, a Bia à direita e o Caio duas casas à direita — todos encostados. */
function montarCena(): void {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_a06', 'a06', 30, 20, 64))
  useSessionStore.getState().markSaved()
  useMapStore.getState().addToken(ficha('cesto', 'Cesto', 320, 320, { npc: true }))
  useMapStore.getState().setVehicleSeats('cesto', 2)
  useMapStore.getState().addToken(ficha('gui', 'Gui', 256, 320))
  useMapStore.getState().addToken(ficha('bia', 'Bia', 384, 320))
  useMapStore.getState().addToken(ficha('caio', 'Caio', 448, 320))
}

interface Enviado {
  clientId: string
  msg: { type: string; [campo: string]: unknown }
}

const esperarSnapshot = () => new Promise((resolve) => setTimeout(resolve, BROADCAST_THROTTLE_MS + 30))

async function mesa() {
  montarCena()
  const ouvintes = new Map<string, (event: { payload: unknown }) => void>()
  const enviados: Enviado[] = []
  // O relógio anda a cada pedido do veículo: o host limita a frequência (`VEHICLE_ACTION_MIN_INTERVAL_MS`).
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
    applyDoor: () => undefined,
    onPlayersChange: vi.fn(),
    now: () => relogio,
  })
  await bridge.start()
  const desligar = useMapStore.subscribe((state) => state.map, () => bridge.notifyMapChanged())
  const envia = (clientId: string, msg: Record<string, unknown>) => ouvintes.get('net:message')?.({ payload: { clientId, msg } })
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
  const desce = (clientId: string, tokenId: string) => {
    relogio += VEHICLE_ACTION_MIN_INTERVAL_MS
    envia(clientId, { type: 'vehicle.leave', tokenId })
  }
  const anda = (clientId: string, tokenId: string, x: number, y: number) => envia(clientId, { type: 'token.move', reqId: `${tokenId}-${x}-${y}`, tokenId, x, y })
  const fim = async () => {
    desligar()
    await bridge.stop()
  }
  return { bridge, enviados, sobe, desce, anda, fim }
}

function posicoes(): Record<string, [number, number]> {
  return Object.fromEntries(useMapStore.getState().map.tokens.map((t) => [t.id, [t.x, t.y]]))
}

const aBordo = () => passengerIdsOf(useMapStore.getState().map, 'cesto')

/** As fichas do último mapa inteiro que `clientId` recebeu. */
function fichasRecebidas(enviados: Enviado[], clientId: string): Token[] {
  const ultimo = enviados.filter((e) => e.clientId === clientId && e.msg.type === 'snapshot').at(-1)
  const map = ultimo?.msg.map as { tokens?: Token[] } | undefined
  return map?.tokens ?? []
}

const recebida = (enviados: Enviado[], clientId: string, tokenId: string) => fichasRecebidas(enviados, clientId).find((t) => t.id === tokenId)

/** As respostas diretas (`vehicle.rejected`, `token.move.*`) que `clientId` recebeu a partir de `desde`. */
function respostas(enviados: Enviado[], clientId: string, desde: number): Enviado['msg'][] {
  return enviados
    .slice(desde)
    .filter((e) => e.clientId === clientId && (e.msg.type === 'vehicle.rejected' || e.msg.type.startsWith('token.move')))
    .map((e) => e.msg)
}

describe('veículo pela tela do jogador: subir, dirigir, descer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('o Gui encostado vê o cesto como veículo (sem lugares nem lista), sobe sozinho e lê que é o motorista', async () => {
    const t = await mesa()
    await esperarSnapshot()
    const cesto = recebida(t.enviados, 'c-gui', 'cesto')
    expect(cesto?.embarcavel).toBe(true)
    expect(cesto?.veiculo).toBeUndefined()
    expect(recebida(t.enviados, 'c-gui', 'gui')?.aBordo).toBeUndefined()

    t.sobe('c-gui', 'gui')
    await esperarSnapshot()

    expect(aBordo()).toEqual(['gui'])
    expect(recebida(t.enviados, 'c-gui', 'gui')?.aBordo).toEqual({ motorista: true })
    await t.fim()
  })

  it('a Bia sobe depois e é passageira; o Caio, com o cesto cheio, lê "cheio" e fica a pé', async () => {
    const t = await mesa()
    t.sobe('c-gui', 'gui')
    t.sobe('c-bia', 'bia')
    const antes = t.enviados.length
    t.sobe('c-caio', 'caio')
    await esperarSnapshot()

    expect(aBordo()).toEqual(['gui', 'bia'])
    expect(recebida(t.enviados, 'c-bia', 'bia')?.aBordo).toEqual({ motorista: false })
    expect(recebida(t.enviados, 'c-gui', 'gui')?.aBordo).toEqual({ motorista: true })
    expect(respostas(t.enviados, 'c-caio', antes)).toEqual([{ type: 'vehicle.rejected', reason: 'cheio' }])
    expect(recebida(t.enviados, 'c-caio', 'caio')?.aBordo).toBeUndefined()
    // A marca de bordo só vai na ficha do DONO: o Caio vê o Gui, mas não que ele está a bordo.
    expect(recebida(t.enviados, 'c-caio', 'gui')?.aBordo).toBeUndefined()
    await t.fim()
  })

  it('longe do cesto o pedido volta "longe"; ficha de outro morre em silêncio', async () => {
    const t = await mesa()
    useMapStore.getState().setTokenPosition('caio', 576, 320)
    await esperarSnapshot()
    const antes = t.enviados.length
    t.sobe('c-caio', 'caio')
    // O Gui tenta pôr a Bia no cesto: a ficha não é dele.
    t.sobe('c-gui', 'bia')
    await esperarSnapshot()

    expect(aBordo()).toEqual([])
    expect(respostas(t.enviados, 'c-caio', antes)).toEqual([{ type: 'vehicle.rejected', reason: 'longe' }])
    expect(respostas(t.enviados, 'c-gui', antes)).toEqual([])
    await t.fim()
  })

  it('o motorista dirige: o passo dele leva o cesto e a Bia pelo mesmo deslocamento, e ninguém desce', async () => {
    const t = await mesa()
    t.sobe('c-gui', 'gui')
    t.sobe('c-bia', 'bia')
    const antes = t.enviados.length

    t.anda('c-gui', 'gui', 256, 448)

    expect(respostas(t.enviados, 'c-gui', antes)).toEqual([{ type: 'token.move.accepted', reqId: 'gui-256-448', x: 256, y: 448 }])
    const aqui = posicoes()
    expect(aqui.gui).toEqual([256, 448])
    expect(aqui.cesto).toEqual([320, 448])
    expect(aqui.bia).toEqual([384, 448])
    expect(aqui.caio).toEqual([448, 320])
    expect(aBordo()).toEqual(['gui', 'bia'])
    await t.fim()
  })

  it('a passageira que não dirige não anda: recusa "a_bordo", fica no lugar e continua a bordo', async () => {
    const t = await mesa()
    t.sobe('c-gui', 'gui')
    t.sobe('c-bia', 'bia')
    const antes = t.enviados.length

    t.anda('c-bia', 'bia', 384, 448)

    expect(respostas(t.enviados, 'c-bia', antes)).toEqual([{ type: 'token.move.rejected', reqId: 'bia-384-448', reason: 'a_bordo' }])
    expect(posicoes().bia).toEqual([384, 320])
    expect(posicoes().cesto).toEqual([320, 320])
    expect(aBordo()).toEqual(['gui', 'bia'])
    await t.fim()
  })

  it('o muro barra o cesto: o passo do motorista não vale e ninguém sai do lugar', async () => {
    const t = await mesa()
    t.sobe('c-gui', 'gui')
    // Muro só embaixo do cesto: o Gui desceria livre, o cesto não.
    useMapStore.getState().addWall({ id: 'muro', x1: 290, y1: 352, x2: 350, y2: 352, blocksLight: true, blocksMove: true, door: null })
    const antes = t.enviados.length

    t.anda('c-gui', 'gui', 256, 384)

    expect(respostas(t.enviados, 'c-gui', antes)).toEqual([{ type: 'token.move.rejected', reqId: 'gui-256-384', reason: 'wall' }])
    expect(posicoes().gui).toEqual([256, 320])
    expect(posicoes().cesto).toEqual([320, 320])
    expect(aBordo()).toEqual(['gui'])
    await t.fim()
  })

  it('"Descer": o Gui sai e fica onde está; a Bia vira motorista e passa a dirigir', async () => {
    const t = await mesa()
    t.sobe('c-gui', 'gui')
    t.sobe('c-bia', 'bia')

    t.desce('c-gui', 'gui')
    await esperarSnapshot()

    expect(aBordo()).toEqual(['bia'])
    expect(posicoes().gui).toEqual([256, 320])
    expect(recebida(t.enviados, 'c-gui', 'gui')?.aBordo).toBeUndefined()
    expect(recebida(t.enviados, 'c-bia', 'bia')?.aBordo).toEqual({ motorista: true })

    t.anda('c-bia', 'bia', 448, 384)
    expect(posicoes().bia).toEqual([448, 384])
    expect(posicoes().cesto).toEqual([384, 384])
    // O Gui, a pé, ficou.
    expect(posicoes().gui).toEqual([256, 320])
    await t.fim()
  })

  it('quem desce em cima do cesto vai para a casa livre ao lado, fora das casas dos outros', async () => {
    const t = await mesa()
    // O mestre põe o Caio em cima do cesto (a pé), e ele sobe e desce dali.
    useMapStore.getState().setTokenPosition('caio', 320, 320)
    t.sobe('c-caio', 'caio')
    expect(aBordo()).toEqual(['caio'])

    t.desce('c-caio', 'caio')

    expect(aBordo()).toEqual([])
    const [x, y] = posicoes().caio
    // Fora do cesto (uma casa inteira de centro a centro) e logo ao lado dele: a
    // casa livre assenta no centro da casa da grade, por isso até uma casa e meia.
    const doCesto = Math.max(Math.abs(x - 320), Math.abs(y - 320))
    expect(doCesto).toBeGreaterThanOrEqual(64)
    expect(doCesto).toBeLessThanOrEqual(96)
    // Nem em cima do Gui nem da Bia.
    for (const [ox, oy] of [posicoes().gui, posicoes().bia]) expect(Math.max(Math.abs(x - ox), Math.abs(y - oy))).toBeGreaterThanOrEqual(64)
    await t.fim()
  })

  it('o arrasto do MESTRE de um passageiro continua o desembarcando, como antes', async () => {
    const t = await mesa()
    t.sobe('c-gui', 'gui')
    useMapStore.getState().setTokenPosition('gui', 192, 320)
    expect(aBordo()).toEqual([])
    expect(posicoes().cesto).toEqual([320, 320])
    await t.fim()
  })

  it('nenhum frame de ninguém leva a lista de passageiros nem os lugares', async () => {
    const t = await mesa()
    t.sobe('c-gui', 'gui')
    t.sobe('c-bia', 'bia')
    t.anda('c-gui', 'gui', 256, 448)
    t.desce('c-gui', 'gui')
    await esperarSnapshot()
    const paraJogadores = t.enviados.filter((e) => e.clientId.startsWith('c-'))
    expect(paraJogadores.length).toBeGreaterThan(0)
    const fio = JSON.stringify(paraJogadores)
    expect(fio).not.toContain('passageiros')
    expect(fio).not.toContain('lugares')
    expect(fio).not.toContain('"veiculo"')
    await t.fim()
  })
})
