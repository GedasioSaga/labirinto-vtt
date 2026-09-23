import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { TravelLogEntry } from '../lib/travelLog'
import { useToastStore } from '../stores/toastStore'
import type { Pin, Token } from '../types/map'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * DIÁRIO DE VIAGENS (G15) do lado da ponte: cada viagem que a ficha faz de
 * verdade vira uma linha do diário do MESTRE (hora, ficha, de onde, para onde
 * e a casa de partida); o "Desfazer" da última viagem de um jogador devolve a
 * ficha àquela casa. O diário nunca vai pelo fio: o jogador só recebe o
 * `scene.changed` e o recorte da cena dele, como em qualquer viagem.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const SALAO = 'Salao Norte'
const CRIPTA = 'Cripta Rubra'

type Lugar = { scene: 'cena-a' | 'cena-b'; x: number; y: number }

function mesa() {
  const lugar = new Map<string, Lugar>([
    ['ficha-ana', { scene: 'cena-a', x: 700, y: 300 }],
    ['ficha-bruno', { scene: 'cena-a', x: 820, y: 300 }],
  ])
  const nomes: Record<string, string> = { 'ficha-ana': 'Ana', 'ficha-bruno': 'Bruno' }
  const escada = (id: string, x: number, y: number, description: string, sceneId: string, pinId: string): Pin => ({
    id,
    x,
    y,
    kind: 'viagem',
    description,
    image: null,
    destino: { sceneId, pinId },
  })
  const fichasEm = (scene: Lugar['scene']): Token[] =>
    [...lugar].filter(([, l]) => l.scene === scene).map(([id, l]) => ({ id, characterId: null, name: nomes[id] ?? id, x: l.x, y: l.y, size: 1, image: null }))
  const world = (): HostWorld => ({
    open: {
      sceneId: 'cena-a',
      name: SALAO,
      map: { ...createEmptyMap('mapa-a', 'A', 40, 12, 50), tokens: fichasEm('cena-a'), pins: [escada('escada-a', 760, 330, 'Escada que desce', 'cena-b', 'escada-b')] },
    },
    background: [
      {
        sceneId: 'cena-b',
        name: CRIPTA,
        map: { ...createEmptyMap('mapa-b', 'B', 40, 12, 50), tokens: fichasEm('cena-b'), pins: [escada('escada-b', 1700, 450, 'Escada que sobe', 'cena-a', 'escada-a')] },
      },
    ],
  })
  const applyTransfer = vi.fn((transfer: AppliedTransfer) => {
    const atual = lugar.get(transfer.tokenId)
    if (atual === undefined || atual.scene !== transfer.fromSceneId) return false
    if (transfer.toSceneId !== 'cena-a' && transfer.toSceneId !== 'cena-b') return false
    lugar.set(transfer.tokenId, { scene: transfer.toSceneId, x: transfer.x, y: transfer.y })
    return true
  })
  return { lugar, world, applyTransfer }
}

async function mesaMontada() {
  const m = mesa()
  let relogio = new Date(2026, 8, 23, 22, 10).getTime()
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  let diario: TravelLogEntry[] = []
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => m.world().open.map,
    getWorld: m.world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    applyTransfer: m.applyTransfer,
    onPlayersChange: vi.fn(),
    onTravelLogChange: (log) => {
      diario = log
    },
    now: () => relogio,
  })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  /** Tudo que saiu pelo `net_send`, na ordem, como o jogador receberia. */
  const fio = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => JSON.stringify(call[1]))
  await bridge.start()
  const ids = new Map<string, string>()
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
    ids.set(name, player.playerId)
  }
  entra('c1', 'Ana', 'ficha-ana')
  entra('c2', 'Bruno', 'ficha-bruno')
  /** Pede pela escada e o mestre clica "Deixar ir" no aviso. */
  const viajaComDeixarIr = (clientId: string, pinId: string) => {
    emit({ clientId, msg: { type: 'pin.travel.request', pinId } })
    const aviso = useToastStore.getState().toasts.find((t) => t.text.includes('quer passar'))
    const deixar = aviso?.actions?.find((a) => a.label === 'Deixar ir')
    if (deixar === undefined) throw new Error('o mestre deveria ler o pedido com "Deixar ir"')
    deixar.run()
    relogio += 60_000
  }
  const playerId = (name: string): string => {
    const id = ids.get(name)
    if (id === undefined) throw new Error(`${name} não entrou`)
    return id
  }
  return { ...m, bridge, emit, fio, viajaComDeixarIr, playerId, diario: () => diario }
}

describe('hostBridge: diário de viagens', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('"Deixar ir" vira uma linha do diário com hora, ficha, as duas cenas e a casa de partida', async () => {
    const t = await mesaMontada()
    expect(t.diario()).toEqual([])
    t.viajaComDeixarIr('c1', 'escada-a')
    expect(t.lugar.get('ficha-ana')?.scene).toBe('cena-b')
    expect(t.diario()).toEqual([
      expect.objectContaining({
        at: new Date(2026, 8, 23, 22, 10).getTime(),
        playerId: t.playerId('Ana'),
        tokenId: 'ficha-ana',
        tokenName: 'Ana',
        fromSceneId: 'cena-a',
        fromSceneName: SALAO,
        fromX: 700,
        fromY: 300,
        toSceneId: 'cena-b',
        toSceneName: CRIPTA,
      }),
    ])
  })

  it('o diário não vai pelo fio: nenhum frame traz "Diário" nem nome de cena', async () => {
    const t = await mesaMontada()
    t.viajaComDeixarIr('c1', 'escada-a')
    t.viajaComDeixarIr('c2', 'escada-a')
    const ana = t.diario().find((e) => e.tokenId === 'ficha-ana')
    if (ana === undefined) throw new Error('a viagem de Ana deveria estar no diário')
    expect(t.bridge.undoTravel(ana.id)).toBe(true)
    const frames = t.fio()
    expect(frames.length).toBeGreaterThan(0)
    for (const frame of frames) {
      expect(frame).not.toMatch(/Di[aá]rio/i)
      expect(frame).not.toContain(SALAO)
      expect(frame).not.toContain(CRIPTA)
    }
  })

  it('"Desfazer" devolve a ficha à cena e à CASA de onde saiu, e a jogadora lê só o aviso do mestre', async () => {
    const t = await mesaMontada()
    t.viajaComDeixarIr('c1', 'escada-a')
    const [ida] = t.diario()
    if (ida === undefined) throw new Error('a ida deveria estar no diário')
    const antes = t.fio().length
    expect(t.bridge.undoTravel(ida.id)).toBe(true)
    expect(t.lugar.get('ficha-ana')).toEqual({ scene: 'cena-a', x: 700, y: 300 })
    expect(t.applyTransfer).toHaveBeenLastCalledWith(expect.objectContaining({ tokenId: 'ficha-ana', fromSceneId: 'cena-b', toSceneId: 'cena-a', x: 700, y: 300 }))
    const depois = t.fio().slice(antes)
    expect(depois).toContain(JSON.stringify({ clientId: 'c1', msg: { type: 'scene.changed', by: 'master' } }))
    // Ninguém mais é avisado da volta: Bruno só recebe o recorte de sempre.
    expect(depois.filter((f) => f.includes('"clientId":"c2"') && f.includes('scene.changed'))).toEqual([])
    // A viagem desfeita sai do diário.
    expect(t.diario()).toEqual([])
    expect(t.bridge.players().find((p) => p.name === 'Ana')?.sceneName).toBe(SALAO)
  })

  it('só a ÚLTIMA viagem de cada jogador desfaz: a ida de Ana, depois da volta, recusa', async () => {
    const t = await mesaMontada()
    t.viajaComDeixarIr('c1', 'escada-a')
    t.viajaComDeixarIr('c1', 'escada-b')
    const [volta, ida] = t.diario()
    if (volta === undefined || ida === undefined) throw new Error('ida e volta deveriam estar no diário')
    expect([volta.fromSceneId, ida.fromSceneId]).toEqual(['cena-b', 'cena-a'])
    const chamadas = t.applyTransfer.mock.calls.length
    expect(t.bridge.undoTravel(ida.id)).toBe(false)
    expect(t.applyTransfer.mock.calls.length).toBe(chamadas)
    expect(t.diario()).toHaveLength(2)
  })

  it('a ficha já saiu da cena de destino (o mestre a mandou para outro lugar): o "Desfazer" antigo recusa sem mexer', async () => {
    const t = await mesaMontada()
    t.viajaComDeixarIr('c1', 'escada-a')
    const [ida] = t.diario()
    if (ida === undefined) throw new Error('a ida deveria estar no diário')
    // A ficha voltou ao Salão por fora do diário (editor, outra ferramenta).
    t.lugar.set('ficha-ana', { scene: 'cena-a', x: 100, y: 100 })
    expect(t.bridge.undoTravel(ida.id)).toBe(false)
    expect(t.lugar.get('ficha-ana')).toEqual({ scene: 'cena-a', x: 100, y: 100 })
  })

  it('ação no ponto e diário na mesma sala: o pedido de Ana sobrevive à viagem de Bruno, e fechar a sala limpa os dois', async () => {
    const t = await mesaMontada()
    t.emit({ clientId: 'c1', msg: { type: 'point.action', action: 'procurar', x: 700, y: 300 } })
    const pedido = () => useToastStore.getState().toasts.find((toast) => toast.text.startsWith('Ana quer Procurar'))
    expect(pedido()?.grupo).toBe('Pedidos')
    t.viajaComDeixarIr('c2', 'escada-a')
    expect(t.diario()).toEqual([expect.objectContaining({ tokenId: 'ficha-bruno', toSceneId: 'cena-b' })])
    const nada = pedido()?.actions?.find((a) => a.label === 'Nada aqui')
    if (nada === undefined) throw new Error('o pedido de Ana deveria seguir com "Nada aqui" depois da viagem de Bruno')
    const antes = t.fio().length
    nada.run()
    expect(t.fio().slice(antes)).toEqual([JSON.stringify({ clientId: 'c1', msg: { type: 'point.action.answer', action: 'procurar', answer: 'nothing' } })])
    t.emit({ clientId: 'c1', msg: { type: 'point.action', action: 'escutar', x: 700, y: 300 } })
    expect(useToastStore.getState().toasts.some((toast) => toast.text.startsWith('Ana quer Escutar'))).toBe(true)
    await t.bridge.stop()
    expect(t.diario()).toEqual([])
    expect(useToastStore.getState().toasts.some((toast) => toast.text.startsWith('Ana quer'))).toBe(false)
  })

  it('fechar a sala zera o diário', async () => {
    const t = await mesaMontada()
    t.viajaComDeixarIr('c1', 'escada-a')
    expect(t.diario()).toHaveLength(1)
    await t.bridge.stop()
    expect(t.diario()).toEqual([])
  })
})
