import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { ConcealZone, MapData, Pin, Token } from '../types/map'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'
import type { HostMessage } from './protocol'

/*
 * ESPELHAR A TELA DO JOGADOR, lado da rede. O espelho do mestre é o que SAIU
 * pelo fio para aquele jogador: nada da zona oculta, nada de outra cena, e a
 * cena DELE (não a aberta no editor). Mesma mesa da régua
 * e2e/task-jornada-espelhar-tela-do-jogador.spec.ts, em miniatura.
 */

const ROOM = { code: 'ESPE15', urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg/>' }
const NOME_DA_ZONA = 'Galeria do Espiao'
const NOME_DO_ESPIAO = 'Espiao'
const CENA_B = 'Cripta Rubra'
const GRADE = 50
const LARGURA = 40 * GRADE
const ALTURA = 12 * GRADE

function ficha(id: string, name: string, x: number, y: number, color: string): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null, color }
}

function escada(id: string, x: number, description: string, sceneId: string, pinId: string): Pin {
  return { id, x, y: 450, kind: 'viagem', description, image: null, destino: { sceneId, pinId } }
}

function cena(id: string, tokens: Token[], pins: Pin[], zonas: ConcealZone[]): MapData {
  const base = createEmptyMap(id, id, 40, 12, GRADE)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    tokens,
    pins,
    concealZones: zonas,
  }
}

const ZONA: ConcealZone = {
  id: 'zona-espiao',
  name: NOME_DA_ZONA,
  revealed: false,
  points: [
    { x: 10, y: 10 },
    { x: LARGURA - 10, y: 10 },
    { x: LARGURA - 10, y: 290 },
    { x: 10, y: 290 },
  ],
}

/** Salão aberto no editor (zona oculta sobre o Espião) e Cripta de fundo. `brunoNaCripta` diz onde está o Machado. */
function mesa() {
  const estado = { brunoNaCripta: false }
  const world = (): HostWorld => ({
    open: {
      sceneId: 'cena-a',
      name: 'Salao Norte',
      map: cena(
        'mapa-a',
        [
          ficha('lanterna', 'Lanterna', 700, 450, '#3cff00'),
          ...(estado.brunoNaCripta ? [] : [ficha('machado', 'Machado', 820, 450, '#ff5a00')]),
          ficha('espiao', NOME_DO_ESPIAO, 1000, 150, '#b000ff'),
        ],
        [escada('escada-a', 1300, 'Escada que desce', 'cena-b', 'escada-b')],
        [ZONA],
      ),
    },
    background: [
      {
        sceneId: 'cena-b',
        name: CENA_B,
        map: cena('mapa-b', estado.brunoNaCripta ? [ficha('machado', 'Machado', 1700, 450, '#ff5a00')] : [], [escada('escada-b', 1700, 'Escada que sobe', 'cena-a', 'escada-a')], []),
      },
    ],
  })
  const applyTransfer = vi.fn((_transfer: AppliedTransfer) => {
    estado.brunoNaCripta = true
    return true
  })
  return { world, applyTransfer }
}

async function montada() {
  const { world, applyTransfer } = mesa()
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return () => undefined
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    applyTransfer,
    now: () => 0,
  })
  const emit = (name: string, payload: unknown) => handlers.get(name)?.({ payload })
  /** Tudo que saiu pelo fio para `clientId`, em ordem. */
  const enviados = (clientId: string): HostMessage[] =>
    invoke.mock.calls.flatMap((call) => {
      const args = call[1]
      if (call[0] !== 'net_send' || typeof args !== 'object' || args === null || !('clientId' in args) || !('msg' in args)) return []
      return args.clientId === clientId ? [args.msg as HostMessage] : [] // as: é o `msg` que a própria ponte passou ao `net_send`, sempre um HostMessage
    })
  const ultimoSnapshot = (clientId: string) => {
    const snaps = enviados(clientId).filter((msg) => msg.type === 'snapshot' || msg.type === 'delta')
    const ultimo = snaps[snaps.length - 1]
    if (ultimo === undefined || (ultimo.type !== 'snapshot' && ultimo.type !== 'delta')) throw new Error(`nada saiu para ${clientId}`)
    return ultimo
  }

  await bridge.start()
  emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  emit('net:message', { clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Bruno' } })
  const idDe = (nome: string): string => {
    const id = bridge.players().find((p) => p.name === nome)?.playerId
    if (id === undefined) throw new Error(`${nome} não entrou`)
    return id
  }
  const ana = idDe('Ana')
  const bruno = idDe('Bruno')
  bridge.assignToken(ana, 'lanterna')
  bridge.assignToken(bruno, 'machado')
  return { bridge, emit, ana, bruno, ultimoSnapshot }
}

function mapaDaTela(screen: ReturnType<ReturnType<typeof createHostBridge>['playerScreen']>): MapData {
  if (screen === null || screen.kind !== 'map') throw new Error('o espelho deveria ter o mapa do jogador')
  return screen.map
}

describe('hostBridge: espelhar a tela do jogador', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('a tela de Ana é EXATAMENTE o último recorte que saiu para ela', async () => {
    const { bridge, ana, ultimoSnapshot } = await montada()
    const screen = bridge.playerScreen(ana)
    const saiu = ultimoSnapshot('c1')
    expect(screen).toMatchObject({ kind: 'map', rev: saiu.rev, ownTokens: ['lanterna'] })
    expect(mapaDaTela(screen)).toEqual(saiu.map)
  })

  it('o que a zona oculta esconde NÃO chega ao espelho: nem o Espião, nem o nome da zona, nem o nome da outra cena', async () => {
    const { bridge, ana } = await montada()
    const screen = bridge.playerScreen(ana)
    const mapa = mapaDaTela(screen)
    expect(mapa.id).toBe('mapa-a')
    expect(mapa.tokens.map((t) => t.id)).toContain('lanterna')
    expect(mapa.tokens.map((t) => t.id)).not.toContain('espiao')
    const tudo = JSON.stringify(screen)
    expect(tudo).not.toContain(NOME_DA_ZONA)
    expect(tudo).not.toContain(NOME_DO_ESPIAO)
    expect(tudo).not.toContain(CENA_B)
  })

  it('o espelho segue a cena do jogador: Bruno foi à Cripta com o editor no Salão, e Ana deixa de ter a ficha dele', async () => {
    const { bridge, ana, bruno } = await montada()
    expect(mapaDaTela(bridge.playerScreen(ana)).tokens.map((t) => t.id)).toContain('machado')

    expect(bridge.sendPlayer(bruno, 'cena-b', 'escada-b')).toBe(true)

    const deBruno = mapaDaTela(bridge.playerScreen(bruno))
    expect(deBruno.id).toBe('mapa-b')
    expect(deBruno.tokens.map((t) => t.id)).toEqual(['machado'])
    const deAna = mapaDaTela(bridge.playerScreen(ana))
    expect(deAna.id).toBe('mapa-a')
    expect(deAna.tokens.map((t) => t.id)).not.toContain('machado')
    expect(JSON.stringify(bridge.playerScreen(ana))).not.toContain(CENA_B)
  })

  it('avisa quem observa a cada tela nova, e para de avisar ao sair', async () => {
    const { bridge, ana, bruno } = await montada()
    const listener = vi.fn()
    const parar = bridge.watchPlayerScreens(listener)
    bridge.revealPlan(ana)
    expect(listener).toHaveBeenCalled()
    parar()
    listener.mockClear()
    bridge.revealPlan(bruno)
    expect(listener).not.toHaveBeenCalled()
  })

  it('jogador que cai, é expulso ou sala fechada: sem tela para espelhar', async () => {
    const { bridge, emit, ana, bruno } = await montada()
    emit('net:peer', { clientId: 'c1', event: 'disconnected' })
    expect(bridge.playerScreen(ana)).toBeNull()
    expect(bridge.playerScreen(bruno)).not.toBeNull()
    await bridge.kick('c2')
    expect(bridge.playerScreen(bruno)).toBeNull()
    await bridge.stop()
    expect(bridge.playerScreen(ana)).toBeNull()
  })

  it('quem ainda não tem ficha tem a tela de espera', async () => {
    const { bridge, emit } = await montada()
    emit('net:message', { clientId: 'c3', msg: { type: 'join', code: ROOM.code, name: 'Carla' } })
    const carla = bridge.players().find((p) => p.name === 'Carla')?.playerId ?? ''
    expect(bridge.playerScreen(carla)).toEqual({ kind: 'waiting' })
  })
})
