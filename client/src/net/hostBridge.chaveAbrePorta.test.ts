import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { CarriedItem, DoorState, MapData, Pin, Token, Wall } from '../types/map'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { createHostBridge, pinKeyLine } from './hostBridge'

/**
 * CHAVE ABRE PORTA, do lado do mestre: o "Usar <chave>" do jogador chega à
 * ponte e é ELA que tira o cadeado e abre (pelo `unlockAndOpenDoor`, o mesmo
 * do "Destrancar e abrir") e avisa o mestre. Pelo `applyDoor` a porta
 * trancada não abriria: a store do App recusa abrir porta com cadeado.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const GRID = 40
const CHAVE = 'Chave do Escudo'
const comChave: DoorState = { open: false, locked: true, kind: 'normal', abreCom: CHAVE }
const chaveNaMochila: CarriedItem[] = [{ id: 'pino-chave', nome: CHAVE }]

function wall(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function ficha(mochila?: CarriedItem[]): Token {
  const t: Token = { id: 'diego-ficha', characterId: null, name: 'Diego', x: 460, y: 200, size: 1, image: null }
  return mochila === undefined ? t : { ...t, mochila }
}

function mansao(mochila?: CarriedItem[]): MapData {
  return {
    ...createEmptyMap('mapa-mansao', 'Mansão', 1000, 1000, GRID),
    walls: [
      wall('acima', 500, 0, 500, 180),
      { ...wall('escritorio', 500, 180, 500, 220, comChave), blocksLight: false },
      wall('abaixo', 500, 220, 500, 1000),
    ],
    tokens: [ficha(mochila)],
  }
}

async function mesa(options: { mochila?: CarriedItem[]; comDestrancar?: boolean } = {}) {
  const map = mansao(options.mochila)
  const world = (): HostWorld => ({
    open: { sceneId: 'cena-salao', name: 'Salão', map: createEmptyMap('mapa-salao', 'Salão', 1000, 1000, GRID) },
    background: [{ sceneId: 'cena-mansao', name: 'Mansão', map }],
  })
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const unlockAndOpenDoor = vi.fn()
  const applyDoor = vi.fn()
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor,
    ...(options.comDestrancar === false ? {} : { unlockAndOpenDoor }),
    onPlayersChange: vi.fn(),
    now: () => 0,
  })
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener de ${name}`)
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  await bridge.start()
  emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Diego' } })
  const diego = bridge.players().find((p) => p.name === 'Diego')
  if (diego === undefined) throw new Error('Diego deveria ter entrado')
  bridge.assignToken(diego.playerId, 'diego-ficha')
  // O "Diego entrou…" da chegada não é o que se mede aqui.
  useToastStore.setState({ toasts: [] })
  const usarChave = () => emit('net:message', { clientId: 'c1', msg: { type: 'door.useKey', wallId: 'escritorio' } })
  const avisos = () => useToastStore.getState().toasts.map((t) => t.text)
  return { usarChave, avisos, sent, unlockAndOpenDoor, applyDoor }
}

describe('hostBridge: a chave da mochila abre a porta trancada', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('Diego com a chave: a ponte destranca e abre a porta NA CENA DELA, sem passar pelo applyDoor, e o mestre lê o aviso', async () => {
    const m = await mesa({ mochila: chaveNaMochila })
    m.usarChave()
    expect(m.unlockAndOpenDoor).toHaveBeenCalledTimes(1)
    expect(m.unlockAndOpenDoor).toHaveBeenCalledWith('escritorio', 'cena-mansao')
    // O applyDoor recusa porta trancada (App.tsx): por ele a porta não abriria para ninguém.
    expect(m.applyDoor).not.toHaveBeenCalled()
    expect(m.avisos()).toEqual([`Diego abriu uma porta com ${CHAVE} em Mansão`])
    // A recusa "Trancada" não sai: quem tem a chave não lê o aviso de porta trancada.
    expect(m.sent().some((s) => JSON.stringify(s).includes('door.toggle.rejected'))).toBe(false)
  })

  it('sem a chave na mochila: nada destranca, nenhum aviso ao mestre, e Diego lê "Trancada"', async () => {
    const m = await mesa()
    m.usarChave()
    expect(m.unlockAndOpenDoor).not.toHaveBeenCalled()
    expect(m.applyDoor).not.toHaveBeenCalled()
    expect(m.avisos()).toEqual([])
    expect(m.sent()).toContainEqual({ clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'locked' } })
  })

  it('mestre sem quem destranque: a porta não abre, e o aviso não diz que abriu', async () => {
    const m = await mesa({ mochila: chaveNaMochila, comDestrancar: false })
    m.usarChave()
    expect(m.applyDoor).not.toHaveBeenCalled()
    expect(m.avisos()).toEqual([])
  })
})

/**
 * O mesmo aviso no PINO DE VIAGEM trancado: a sessão já decide que Diego
 * passa; é a ponte que avisa o mestre — e só se a ficha de fato mudou de cena.
 */
describe('hostBridge: a chave da mochila abre o pino trancado', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  function pinWorld(): HostWorld {
    const portao: Pin = {
      id: 'portao',
      x: 400,
      y: 200,
      kind: 'viagem',
      description: 'Portão do cemitério',
      image: null,
      destino: { sceneId: 'cena-cripta', pinId: 'fundo' },
      passagem: 'trancada',
      abreCom: CHAVE,
    }
    const fundo: Pin = { id: 'fundo', x: 1000, y: 250, kind: 'viagem', description: 'Fundo', image: null, destino: { sceneId: 'cena-mansao', pinId: 'portao' } }
    return {
      open: { sceneId: 'cena-salao', name: 'Salão', map: createEmptyMap('mapa-salao', 'Salão', 40, 10, 50) },
      background: [
        { sceneId: 'cena-mansao', name: 'Mansão', map: { ...createEmptyMap('mapa-mansao', 'Mansão', 40, 10, 50), tokens: [{ ...ficha(chaveNaMochila), x: 350 }], pins: [portao] } },
        { sceneId: 'cena-cripta', name: 'Cripta', map: { ...createEmptyMap('mapa-cripta', 'Cripta', 40, 10, 50), pins: [fundo] } },
      ],
    }
  }

  async function mesaDoPino(moved: boolean) {
    const world = pinWorld()
    const handlers = new Map<string, (event: { payload: unknown }) => void>()
    const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
    const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
      handlers.set(name, handler)
      return vi.fn()
    })
    const applyTransfer = vi.fn((_t: AppliedTransfer) => moved)
    const bridge = createHostBridge({
      invoke,
      listen,
      getMap: () => world.open.map,
      getWorld: () => world,
      applyMove: vi.fn(),
      applyDoor: vi.fn(),
      applyTransfer,
      onPlayersChange: vi.fn(),
      now: () => 0,
    })
    const emit = (name: string, payload: unknown) => handlers.get(name)?.({ payload })
    await bridge.start()
    emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Diego' } })
    const diego = bridge.players().find((p) => p.name === 'Diego')
    if (diego === undefined) throw new Error('Diego deveria ter entrado')
    bridge.assignToken(diego.playerId, 'diego-ficha')
    useToastStore.setState({ toasts: [] })
    emit('net:message', { clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'portao' } })
    return { applyTransfer, avisos: () => useToastStore.getState().toasts.map((t) => t.text) }
  }

  it('Diego passa com a chave: a ficha dele vai para a Cripta e o mestre lê quem abriu, o quê e com que item', async () => {
    const m = await mesaDoPino(true)
    expect(m.applyTransfer).toHaveBeenCalledTimes(1)
    expect(m.applyTransfer.mock.calls[0]?.[0]).toMatchObject({ tokenId: 'diego-ficha', toSceneId: 'cena-cripta' })
    expect(m.avisos()).toContain(`Diego abriu Portão do cemitério com ${CHAVE} em Mansão`)
  })

  it('a ficha não saiu do lugar: nenhum aviso diz que ele abriu', async () => {
    const m = await mesaDoPino(false)
    expect(m.applyTransfer).toHaveBeenCalledTimes(1)
    expect(m.avisos().some((t) => t.includes('abriu'))).toBe(false)
  })

  it('a linha do aviso, com e sem cena de fundo', () => {
    const base = { playerId: 'p1', playerName: 'Diego', itemName: CHAVE, pinLabel: 'Portão do cemitério' }
    expect(pinKeyLine(base)).toBe(`Diego abriu Portão do cemitério com ${CHAVE}`)
    expect(pinKeyLine({ ...base, sceneName: 'Mansão' })).toBe(`Diego abriu Portão do cemitério com ${CHAVE} em Mansão`)
  })
})
