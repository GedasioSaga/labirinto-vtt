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
const { useToastStore } = await import('./toastStore')
const { createEmptyMap, addPin, addToken } = await import('../lib/mapFactory')
const { arrivalSpot } = await import('../lib/pinTravel')
const { passengerIdsOf } = await import('../lib/vehicle')
const { createHostBridge, BROADCAST_THROTTLE_MS } = await import('../net/hostBridge')
const { partyMembers } = await import('../lib/party')
const { applyGatherPlan, planGather } = await import('../lib/gatherParty')

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
    applyTransfer: ({ tokenId, fromSceneId, toSceneId, x, y, piso, hold }) => useAdventureStore.getState().transferToken(tokenId, fromSceneId, toSceneId, x, y, piso, hold),
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
  const pede = (clientId: string, pinId: string) => ouvintes.get('net:message')?.({ payload: { clientId, msg: { type: 'pin.travel.request', pinId } } })
  return { ...cenas, bridge, enviados, desligar, entra, pede }
}

/** O poço de a06, do lado do cesto, ligado à boca do poço de a07 (ida e volta). */
function abrirPoco(a06: string, a07: string, passagem: Pin['passagem']): void {
  useMapStore.getState().addPin({ id: 'poco', x: 320, y: 384, kind: 'viagem', description: 'Poço', image: null, destino: { sceneId: a07, pinId: 'saida' }, passagem })
  // A volta, que no app o guardião das ligações grava sozinho.
  useAdventureStore.getState().updateBackgroundScene(a07, (map) => ({
    ...map,
    pins: map.pins.map((pin) => (pin.id === 'saida' ? { ...pin, destino: { sceneId: a06, pinId: 'poco' } } : pin)),
  }))
}

/** As mensagens de `clientId` a partir de `desde`, só os tipos que dizem a cena: a troca e o mapa. */
function trocaEMapa(enviados: Enviado[], clientId: string, desde: number): { type: string; by?: unknown }[] {
  return enviados
    .slice(desde)
    .filter((e) => e.clientId === clientId && (e.msg.type === 'scene.changed' || e.msg.type === 'snapshot'))
    .map((e) => (e.msg.type === 'scene.changed' ? { type: e.msg.type, by: e.msg.by } : { type: e.msg.type }))
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

  it('levado pelo pino, o cesto chega em a07 com o Gui e a Bia ao lado; o Caio fica em a06', () => {
    const { a06, a07 } = montarAventura()
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    useMapStore.getState().setVehiclePassenger('cesto', 'bia', true)
    const chegada = arrivalSpot(mapaDaCena(a07), SAIDA, 1)
    // O cesto chega à esquerda da boca do poço (a casa de cima cobriria a cabeça do pino).
    expect(chegada).toEqual({ x: 1440, y: 928 })

    expect(levarFichaPara('cesto', a07, 'saida')).toBe(true)

    expect(tokensDaCena(a06).map((t) => t.id)).toEqual(['caio'])
    // O Gui mantém o afastamento (uma casa à esquerda). A Bia, uma casa à
    // direita, cairia em cima da boca do poço: senta na casa livre de cima.
    expect(posicoes(a07)).toEqual({
      cesto: [chegada.x, chegada.y],
      gui: [chegada.x - 64, chegada.y],
      bia: [chegada.x, chegada.y - 64],
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

  it('as setas com o cesto selecionado levam quem está a bordo junto, e o cesto segue levando os dois', () => {
    montarAventura()
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    useMapStore.getState().setVehiclePassenger('cesto', 'bia', true)
    useMapStore.getState().setSelection([{ kind: 'token', id: 'cesto' }])
    useMapStore.getState().moveSelectionBy(64, 0)
    expect(posicoes(useAdventureStore.getState().activeSceneId ?? '')).toEqual({
      cesto: [384, 320],
      gui: [320, 320],
      bia: [448, 320],
      caio: [448, 320],
    })
    expect(passengerIdsOf(useMapStore.getState().map, 'cesto')).toEqual(['gui', 'bia'])
  })

  it('o arrasto da seleção em área leva quem está a bordo, uma vez só mesmo quando o passageiro também está selecionado', () => {
    montarAventura()
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    useMapStore.getState().setVehiclePassenger('cesto', 'bia', true)
    // O retângulo pegou o cesto e o Gui; a Bia, a bordo, ficou fora dele.
    useMapStore.getState().setSelection([
      { kind: 'token', id: 'cesto' },
      { kind: 'token', id: 'gui' },
    ])
    useMapStore.getState().moveSelectionLive(0, 64)
    useMapStore.getState().moveSelectionLive(0, 64)
    const tokens = useMapStore.getState().map.tokens
    expect(tokens.find((t) => t.id === 'cesto')?.y).toBe(448)
    expect(tokens.find((t) => t.id === 'gui')?.y).toBe(448)
    expect(tokens.find((t) => t.id === 'bia')?.y).toBe(448)
    expect(tokens.find((t) => t.id === 'caio')?.y).toBe(320)
    expect(passengerIdsOf(useMapStore.getState().map, 'cesto')).toEqual(['gui', 'bia'])
  })

  it('o passageiro empurrado sozinho pelas setas desce do cesto, e o cesto fica onde estava', () => {
    montarAventura()
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    useMapStore.getState().setVehiclePassenger('cesto', 'bia', true)
    useMapStore.getState().setSelection([{ kind: 'token', id: 'gui' }])
    useMapStore.getState().moveSelectionBy(-64, 0)
    const tokens = useMapStore.getState().map.tokens
    expect(tokens.find((t) => t.id === 'gui')?.x).toBe(192)
    expect(tokens.find((t) => t.id === 'cesto')?.x).toBe(320)
    expect(passengerIdsOf(useMapStore.getState().map, 'cesto')).toEqual(['bia'])
  })

  it('a07 já tem uma ficha com o id do Gui: o cesto chega levando o Gui que viajou, e a cópia de lá segue com o veículo dela', () => {
    const { a07 } = montarAventura()
    useAdventureStore.getState().updateBackgroundScene(a07, (map) => ({
      ...map,
      tokens: [
        ...map.tokens,
        ficha('gui', 'Gui de a07', 900, 900),
        ficha('barco', 'Barco', 960, 900, { veiculo: { lugares: 1, passageiros: ['gui'] } }),
        // Arquivo antigo: a jangada guardou o id da Bia, que não está em a07.
        ficha('jangada', 'Jangada', 1024, 900, { veiculo: { lugares: 2, passageiros: ['bia'] } }),
      ],
    }))
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    useMapStore.getState().setVehiclePassenger('cesto', 'bia', true)
    const chegada = arrivalSpot(mapaDaCena(a07), SAIDA, 1)

    expect(levarFichaPara('cesto', a07, 'saida')).toBe(true)

    const destino = mapaDaCena(a07)
    const guiQueViajou = destino.tokens.find((t) => t.id === 'gui')
    expect(guiQueViajou?.name).toBe('Gui')
    expect([guiQueViajou?.x, guiQueViajou?.y]).toEqual([chegada.x - 64, chegada.y])
    expect(passengerIdsOf(destino, 'cesto')).toEqual(['gui', 'bia'])
    const copia = destino.tokens.find((t) => t.name === 'Gui de a07')
    expect(copia?.id).not.toBe('gui')
    expect(passengerIdsOf(destino, 'barco')).toEqual([copia?.id])
    // A Bia que chegou não "embarca" sozinha na jangada pelo id que sobrou lá.
    expect(passengerIdsOf(destino, 'jangada')).toEqual([])
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

  it('levados no cesto pelo mestre, o Gui e a Bia recebem "scene.changed" do mestre antes do mapa de a07, e o pedido de pino do Gui em a06 morre', async () => {
    const t = await mesa()
    abrirPoco(t.a06, t.a07, undefined)
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    useMapStore.getState().setVehiclePassenger('cesto', 'bia', true)
    await esperarSnapshot()
    // O Gui pede o poço em a06 (passagem "pede"): o pedido espera o mestre.
    t.pede('c-gui', 'poco')
    const pedidoDoGui = () => useToastStore.getState().toasts.some((toast) => toast.text.startsWith('Gui quer passar'))
    expect(pedidoDoGui()).toBe(true)
    expect(t.bridge.players().find((p) => p.name === 'Gui')?.travelPending).toBe(true)
    const desde = t.enviados.length

    expect(levarFichaPara('cesto', t.a07, 'saida')).toBe(true)
    await esperarSnapshot()

    // A troca vem ANTES do mapa novo: é ela que limpa o movimento sem resposta de a06.
    for (const clientId of ['c-gui', 'c-bia']) {
      expect(trocaEMapa(t.enviados, clientId, desde)).toEqual([{ type: 'scene.changed', by: 'master' }, { type: 'snapshot' }])
    }
    // O Caio ficou: nenhuma troca.
    expect(trocaEMapa(t.enviados, 'c-caio', desde).map((m) => m.type)).not.toContain('scene.changed')
    // O pedido do poço ficou em a06: sai da sessão e do painel do mestre.
    expect(t.bridge.players().find((p) => p.name === 'Gui')?.travelPending).toBeUndefined()
    expect(pedidoDoGui()).toBe(false)
    // O broadcast seguinte não repete a troca: um rato aparece colado ao Gui,
    // em a07, e ele recebe só o mapa novo.
    const depois = t.enviados.length
    const [guiX, guiY] = posicoes(t.a07).gui
    useAdventureStore.getState().updateBackgroundScene(t.a07, (map) => addToken(map, ficha('rato', 'Rato', guiX, guiY + 64)))
    t.bridge.notifyMapChanged()
    await esperarSnapshot()
    expect(trocaEMapa(t.enviados, 'c-gui', depois)).toEqual([{ type: 'snapshot' }])
    expect(ultimoSnapshot(t.enviados, 'c-gui')).toContain('"rato"')
    t.desligar()
    await t.bridge.stop()
  })

  it('o cesto é a ficha de uma jogadora: ela passa pelo poço livre e o Gui, a bordo, recebe a troca do mestre; ela só a dela', async () => {
    const t = await mesa()
    abrirPoco(t.a06, t.a07, 'livre')
    t.bridge.assignToken(t.entra('c-duda', 'Duda'), 'cesto')
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    await esperarSnapshot()
    const desde = t.enviados.length

    t.pede('c-duda', 'poco')

    expect(tokensDaCena(t.a07).map((token) => token.id).sort()).toEqual(['cesto', 'gui'])
    expect(trocaEMapa(t.enviados, 'c-duda', desde)).toEqual([{ type: 'scene.changed', by: undefined }, { type: 'snapshot' }])
    expect(trocaEMapa(t.enviados, 'c-gui', desde)).toEqual([{ type: 'scene.changed', by: 'master' }, { type: 'snapshot' }])
    expect(trocaEMapa(t.enviados, 'c-bia', desde).map((m) => m.type)).not.toContain('scene.changed')
    t.desligar()
    await t.bridge.stop()
  })

  it('embarcar exige proximidade: a ficha do outro lado de a06 é recusada e fica; quem está ao lado do cesto sobe', () => {
    const { a06 } = montarAventura()
    useMapStore.getState().addToken(ficha('longe', 'Longe', 1800, 1200))
    expect(useMapStore.getState().setVehiclePassenger('cesto', 'longe', true)).toBe(false)
    expect(useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)).toBe(true)
    expect(passengerIdsOf(useMapStore.getState().map, 'cesto')).toEqual(['gui'])
    // A recusa não gasta passo do desfazer: o Ctrl+Z desfaz o embarque do Gui.
    useMapStore.getState().undo()
    expect(passengerIdsOf(useMapStore.getState().map, 'cesto')).toEqual([])
    expect(tokensDaCena(a06).map((t) => t.id)).toContain('longe')
  })

  it('pino na borda de a07: quem vai a bordo chega dentro do mapa, numa casa livre ao lado do cesto', () => {
    const { a06, a07 } = montarAventura()
    // a07 tem 30x20 casas de 64 px (1920 x 1280); a borda é o pino na coluna 0.
    const BORDA: Pin = { id: 'borda', x: 0, y: 600, kind: 'viagem', description: 'Beira', image: null, destino: null }
    useAdventureStore.getState().updateBackgroundScene(a07, (map) => addPin(map, BORDA))
    // O Gui está uma casa à esquerda do cesto: o mesmo afastamento cairia fora do mapa.
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    useMapStore.getState().setVehiclePassenger('cesto', 'bia', true)
    // O cesto chega na casa de cima da do pino: a cabeça dele fica tocável.
    const chegada = arrivalSpot(mapaDaCena(a07), BORDA, 1)
    expect(chegada).toEqual({ x: 32, y: 544 })

    expect(levarFichaPara('cesto', a07, 'borda')).toBe(true)

    // O Gui na casa de cima do cesto (a primeira do anel; a da esquerda é fora do mapa); a Bia mantém o lado.
    expect(posicoes(a07)).toEqual({ cesto: [32, 544], gui: [32, 480], bia: [96, 544] })
    expect(passengerIdsOf(mapaDaCena(a07), 'cesto')).toEqual(['gui', 'bia'])
    expect(tokensDaCena(a06).map((t) => t.id)).toEqual(['caio'])
  })

  it('pino com parede ao lado: o passageiro não chega do outro lado da parede nem em cima do pino', () => {
    const { a07 } = montarAventura()
    // Parede de cima a baixo em x = 1408, a linha da grade colada à esquerda da casa onde o cesto chega.
    useAdventureStore.getState().updateBackgroundScene(a07, (map) => ({
      ...map,
      walls: [...map.walls, { id: 'muro', x1: 1408, y1: 0, x2: 1408, y2: 1280, blocksLight: true, blocksMove: true, door: null }],
    }))
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    useMapStore.getState().setVehiclePassenger('cesto', 'bia', true)
    // A casa de cima do pino cobriria a cabeça dele: o cesto chega à esquerda da boca do poço.
    const chegada = arrivalSpot(mapaDaCena(a07), SAIDA, 1)
    expect(chegada).toEqual({ x: 1440, y: 928 })

    expect(levarFichaPara('cesto', a07, 'saida')).toBe(true)

    // O Gui (uma casa à esquerda) iria para trás do muro: senta na casa de cima.
    // A Bia (uma casa à direita) iria para a casa da boca do poço: senta na de baixo.
    expect(posicoes(a07)).toEqual({ cesto: [1440, 928], gui: [1440, 864], bia: [1440, 992] })
  })

  it('"Reunir o grupo" com a dona do cesto antes do Gui a bordo: os dois chegam, sem falha, cada um na casa reservada', async () => {
    const t = await mesa()
    const duda = t.entra('c-duda', 'Duda')
    t.bridge.assignToken(duda, 'cesto')
    const gui = t.bridge.players().find((p) => p.name === 'Gui')?.playerId ?? ''
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    // O mestre abre a07 e reúne o grupo na fogueira de lá.
    expect(useAdventureStore.getState().switchScene(t.a07)).toBe(true)
    const FOGUEIRA: Pin = { id: 'fogueira', x: 10 * 64 + 32, y: 8 * 64 + 32, kind: 'exclamacao', description: 'Fogueira', image: null }
    useMapStore.getState().addPin(FOGUEIRA)
    const world = hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map)
    const ordem = [duda, gui]
    const members = partyMembers(t.bridge.players(), world)
      .filter((m) => ordem.includes(m.playerId))
      .sort((a, b) => ordem.indexOf(a.playerId) - ordem.indexOf(b.playerId))
    const plan = planGather(members, world, FOGUEIRA)
    expect(plan.moves.map((m) => [m.tokenId, m.travels])).toEqual([
      ['cesto', true],
      ['gui', true],
    ])

    const failed = applyGatherPlan(plan, {
      sceneId: world.open.sceneId,
      bringFromOtherScene: (playerId, sceneId, at) => t.bridge.sendPlayer(playerId, sceneId, null, at),
      placeInScene: (positions) => useMapStore.getState().setTokenPositions(positions),
    })

    expect(failed).toEqual([])
    const reservadas = Object.fromEntries(plan.moves.map((m) => [m.tokenId, [m.x, m.y]]))
    const noA07 = posicoes(t.a07)
    expect(noA07.cesto).toEqual(reservadas.cesto)
    expect(noA07.gui).toEqual(reservadas.gui)
    t.desligar()
    await t.bridge.stop()
  })

  it('"Reunir o grupo" num pino apertado: a última casa vai para o cesto, o Gui chega a bordo e ninguém lê "sem casa livre"', async () => {
    const t = await mesa()
    const duda = t.entra('c-duda', 'Duda')
    t.bridge.assignToken(duda, 'cesto')
    const gui = t.bridge.players().find((p) => p.name === 'Gui')?.playerId ?? ''
    useMapStore.getState().setVehiclePassenger('cesto', 'gui', true)
    // Um nicho de duas casas em a07: a da fogueira e a da direita — só uma serve.
    const [x1, x2, y1, y2] = [10 * 64, 12 * 64, 8 * 64, 9 * 64]
    useAdventureStore.getState().updateBackgroundScene(t.a07, (map) => ({
      ...map,
      walls: [
        ...map.walls,
        ...[
          [x1, y1, x2, y1],
          [x2, y1, x2, y2],
          [x2, y2, x1, y2],
          [x1, y2, x1, y1],
        ].map(([ax, ay, bx, by], i) => ({ id: `nicho-${i}`, x1: ax, y1: ay, x2: bx, y2: by, blocksLight: true, blocksMove: true, door: null })),
      ],
    }))
    expect(useAdventureStore.getState().switchScene(t.a07)).toBe(true)
    const FOGUEIRA: Pin = { id: 'fogueira', x: 10 * 64 + 32, y: 8 * 64 + 32, kind: 'exclamacao', description: 'Fogueira', image: null }
    useMapStore.getState().addPin(FOGUEIRA)
    const world = hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map)
    const ordem = [duda, gui]
    const members = partyMembers(t.bridge.players(), world)
      .filter((m) => ordem.includes(m.playerId))
      .sort((a, b) => ordem.indexOf(a.playerId) - ordem.indexOf(b.playerId))
    const plan = planGather(members, world, FOGUEIRA)
    expect(plan.leftOut).toEqual([])
    expect(plan.moves.map((m) => [m.tokenId, m.x, m.y])).toEqual([['cesto', 11 * 64 + 32, 8 * 64 + 32]])
    expect(plan.ridesAlong.map((r) => [r.tokenId, r.carriedBy])).toEqual([['gui', 'cesto']])

    const failed = applyGatherPlan(plan, {
      sceneId: world.open.sceneId,
      bringFromOtherScene: (playerId, sceneId, at) => t.bridge.sendPlayer(playerId, sceneId, null, at),
      placeInScene: (positions) => useMapStore.getState().setTokenPositions(positions),
    })

    expect(failed).toEqual([])
    // O Gui atravessou a bordo: está em a07, ainda no cesto, dentro do nicho — não ficou em a06.
    expect(tokensDaCena(t.a06).map((tk) => tk.id).sort()).toEqual(['bia', 'caio'])
    expect(passengerIdsOf(useMapStore.getState().map, 'cesto')).toEqual(['gui'])
    const [gx, gy] = posicoes(t.a07).gui
    expect(gx).toBeGreaterThan(x1)
    expect(gx).toBeLessThan(x2)
    expect(gy).toBeGreaterThan(y1)
    expect(gy).toBeLessThan(y2)
    t.desligar()
    await t.bridge.stop()
  })

  it('"Reunir o grupo" num pino apertado com mais gente: quem chega a bordo não senta na casa de quem viaja depois', async () => {
    const t = await mesa()
    const duda = t.entra('c-duda', 'Duda')
    t.bridge.assignToken(duda, 'cesto')
    const bia = t.bridge.players().find((p) => p.name === 'Bia')?.playerId ?? ''
    const caio = t.bridge.players().find((p) => p.name === 'Caio')?.playerId ?? ''
    // A Bia vai a bordo, uma casa à direita do cesto: o afastamento dela cai na casa que o plano dá ao Caio.
    useMapStore.getState().setVehiclePassenger('cesto', 'bia', true)
    // Um nicho de três casas em a07: a da fogueira, a do meio e a da direita.
    const [x1, x2, y1, y2] = [10 * 64, 13 * 64, 8 * 64, 9 * 64]
    useAdventureStore.getState().updateBackgroundScene(t.a07, (map) => ({
      ...map,
      walls: [
        ...map.walls,
        ...[
          [x1, y1, x2, y1],
          [x2, y1, x2, y2],
          [x2, y2, x1, y2],
          [x1, y2, x1, y1],
        ].map(([ax, ay, bx, by], i) => ({ id: `nicho-${i}`, x1: ax, y1: ay, x2: bx, y2: by, blocksLight: true, blocksMove: true, door: null })),
      ],
    }))
    expect(useAdventureStore.getState().switchScene(t.a07)).toBe(true)
    const FOGUEIRA: Pin = { id: 'fogueira', x: 10 * 64 + 32, y: 8 * 64 + 32, kind: 'exclamacao', description: 'Fogueira', image: null }
    useMapStore.getState().addPin(FOGUEIRA)
    const world = hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map)
    const ordem = [duda, caio, bia]
    const members = partyMembers(t.bridge.players(), world)
      .filter((m) => ordem.includes(m.playerId))
      .sort((a, b) => ordem.indexOf(a.playerId) - ordem.indexOf(b.playerId))
    const plan = planGather(members, world, FOGUEIRA)
    expect(plan.leftOut).toEqual([])
    expect(plan.moves.map((m) => [m.tokenId, m.x, m.y])).toEqual([
      ['cesto', 11 * 64 + 32, 8 * 64 + 32],
      ['caio', 12 * 64 + 32, 8 * 64 + 32],
    ])
    expect(plan.ridesAlong.map((r) => [r.tokenId, r.carriedBy])).toEqual([['bia', 'cesto']])

    const failed = applyGatherPlan(plan, {
      sceneId: world.open.sceneId,
      bringFromOtherScene: (playerId, sceneId, at) => t.bridge.sendPlayer(playerId, sceneId, null, at),
      placeInScene: (positions) => useMapStore.getState().setTokenPositions(positions),
    })

    expect(failed).toEqual([])
    const noA07 = posicoes(t.a07)
    // O Caio na casa dele, e a Bia fora dela: nenhuma ficha empilhada em cima de outra (a de baixo sumia).
    expect(noA07.caio).toEqual([12 * 64 + 32, 8 * 64 + 32])
    expect(noA07.bia).not.toEqual(noA07.caio)
    // Sem casa livre fora da fogueira, a Bia fica dentro do cesto — ainda a bordo, dentro do nicho.
    expect(noA07.bia).toEqual(noA07.cesto)
    expect(passengerIdsOf(useMapStore.getState().map, 'cesto')).toEqual(['bia'])
    t.desligar()
    await t.bridge.stop()
  })
})
