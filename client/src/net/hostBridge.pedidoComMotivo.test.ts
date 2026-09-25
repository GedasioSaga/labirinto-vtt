import { beforeEach, describe, expect, it, vi } from 'vitest'
import { agruparAvisos } from '../components/caixaDeAvisos'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore, type ToastMessage, type ToastResposta } from '../stores/toastStore'
import type { Pin, Token } from '../types/map'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'
import { TRAVEL_DENY_TEXT_MAX_LENGTH } from './protocol'

/**
 * PEDIDO DE PASSAGEM COM "VER" E "NÃO, PORQUE…" do lado do mestre. "Ver" leva
 * o editor à ficha de quem pediu e deixa a linha na Caixa; "Não, porque…"
 * manda um motivo curto só a quem pediu, e os três últimos motivos voltam
 * prontos no próximo pedido.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

/** O campo que envia sozinho (`ToastResposta`); o `ToastReplyField` não tem `enviar`. */
function queEnvia(resposta: ToastMessage['resposta']): ToastResposta | undefined {
  return resposta !== undefined && 'enviar' in resposta ? resposta : undefined
}

/** Espalhados a mais de 2 casas uns dos outros: ninguém vira "quem está perto" de ninguém. */
const FICHAS: Record<string, { x: number; y: number }> = {
  'ficha-felipe': { x: 225, y: 175 },
  'ficha-gabi': { x: 125, y: 375 },
  'ficha-hugo': { x: 425, y: 375 },
  'ficha-iara': { x: 525, y: 175 },
}

function mesa() {
  const ficha = (id: string): Token => {
    const p = FICHAS[id]
    if (p === undefined) throw new Error(`ficha ${id} não existe`)
    return { id, characterId: null, name: id, x: p.x, y: p.y, size: 1, image: null }
  }
  const portao = (id: string, x: number, y: number, description: string, sceneId: string, pinId: string): Pin => ({
    id,
    x,
    y,
    kind: 'viagem',
    description,
    image: null,
    destino: { sceneId, pinId },
  })
  const world = (): HostWorld => ({
    open: {
      sceneId: 'cena-a',
      name: 'Praça',
      map: { ...createEmptyMap('mapa-a', 'A', 40, 10, 50), tokens: Object.keys(FICHAS).map(ficha), pins: [portao('portao-a', 300, 175, 'Portão da muralha', 'cena-b', 'portao-b')] },
    },
    background: [
      {
        sceneId: 'cena-b',
        name: 'Estrada Norte',
        map: { ...createEmptyMap('mapa-b', 'B', 40, 10, 50), tokens: [], pins: [portao('portao-b', 1000, 250, 'Portão', 'cena-a', 'portao-a')] },
      },
    ],
  })
  return { world, applyTransfer: vi.fn((_transfer: AppliedTransfer) => true) }
}

async function mesaComPedidos(nomes: readonly [string, string][], comVer = true) {
  const m = mesa()
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const onGoToPoint = vi.fn()
  // Cada pedido 10 s depois do anterior: o intervalo mínimo por jogador não recusa o segundo pedido do Felipe.
  const relogio = { agora: 0 }
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => m.world().open.map,
    getWorld: m.world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    applyTransfer: m.applyTransfer,
    onPlayersChange: vi.fn(),
    ...(comVer ? { onGoToPoint } : {}),
    now: () => relogio.agora,
  })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  await bridge.start()
  nomes.forEach(([name, tokenId], index) => {
    const clientId = `c${index + 1}`
    emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
  })
  const pedir = (clientId: string) => {
    relogio.agora += 10_000
    emit({ clientId, msg: { type: 'pin.travel.request', pinId: 'portao-a' } })
  }
  return { ...m, sent, onGoToPoint, pedir, emit }
}

const QUATRO: [string, string][] = [
  ['Felipe', 'ficha-felipe'],
  ['Gabi', 'ficha-gabi'],
  ['Hugo', 'ficha-hugo'],
  ['Iara', 'ficha-iara'],
]

function avisoDe(nome: string): ToastMessage {
  const aviso = useToastStore.getState().toasts.find((toast) => toast.text.startsWith(`${nome} quer passar`))
  if (aviso === undefined) throw new Error(`o mestre deveria ver o pedido de ${nome}`)
  return aviso
}

function linhasDaCaixa(): ToastMessage[] {
  const caixa = agruparAvisos(useToastStore.getState().toasts).find((item) => item.tipo === 'caixa')
  if (caixa === undefined || caixa.tipo !== 'caixa') return []
  return caixa.toasts
}

describe('hostBridge: "Ver" e "Não, porque…" no pedido de passagem', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('"Ver" no Felipe centra nele e a caixa segue com 4; "Não" com motivo tira só a linha dele e o motivo chega só a ele', async () => {
    const t = await mesaComPedidos(QUATRO)
    for (const clientId of ['c1', 'c2', 'c3', 'c4']) t.pedir(clientId)
    expect(linhasDaCaixa()).toHaveLength(4)

    const felipe = avisoDe('Felipe')
    expect(felipe.actions?.map((action) => action.label)).toEqual(['Deixar ir', 'Ver', 'Não'])
    const ver = felipe.actions?.find((action) => action.label === 'Ver')
    // "Ver" não responde: a linha fica para o "Deixar ir"/"Não" depois.
    expect(ver?.mantem).toBe(true)
    const antes = t.sent().length
    ver?.run()
    expect(t.onGoToPoint).toHaveBeenCalledWith('cena-a', 225, 175)
    expect(t.sent().slice(antes)).toEqual([])
    expect(linhasDaCaixa()).toHaveLength(4)

    expect(felipe.resposta?.rotulo).toBe('Não, porque…')
    expect(felipe.resposta?.maxLength).toBe(TRAVEL_DENY_TEXT_MAX_LENGTH)
    queEnvia(felipe.resposta)?.enviar('o portão fecha à noite')
    expect(linhasDaCaixa()).toHaveLength(3)
    expect(linhasDaCaixa().map((toast) => toast.text).some((texto) => texto.startsWith('Felipe'))).toBe(false)
    const depois = t.sent().slice(antes)
    expect(depois).toEqual([{ clientId: 'c1', msg: { type: 'pin.travel.denied', text: 'o portão fecha à noite' } }])
    expect(t.applyTransfer).not.toHaveBeenCalled()
  })

  it('os três últimos motivos voltam prontos, o mais novo primeiro e sem repetir', async () => {
    const t = await mesaComPedidos(QUATRO)
    t.pedir('c1')
    expect(queEnvia(avisoDe('Felipe').resposta)?.recentes?.()).toEqual([])
    queEnvia(avisoDe('Felipe').resposta)?.enviar('o portão fecha à noite')
    t.pedir('c2')
    queEnvia(avisoDe('Gabi').resposta)?.enviar('a ponte caiu')
    t.pedir('c3')
    queEnvia(avisoDe('Hugo').resposta)?.enviar('o portão fecha à noite')
    t.pedir('c4')
    queEnvia(avisoDe('Iara').resposta)?.enviar('ainda não')
    t.pedir('c1')
    expect(queEnvia(avisoDe('Felipe').resposta)?.recentes?.()).toEqual(['ainda não', 'o portão fecha à noite', 'a ponte caiu'])
  })

  it('"Não" sem motivo continua o de sempre, e sem quem leve o editor não há "Ver"', async () => {
    const t = await mesaComPedidos([['Felipe', 'ficha-felipe']], false)
    t.pedir('c1')
    const felipe = avisoDe('Felipe')
    expect(felipe.actions?.map((action) => action.label)).toEqual(['Deixar ir', 'Não'])
    const antes = t.sent().length
    felipe.actions?.find((action) => action.label === 'Não')?.run()
    expect(t.sent().slice(antes)).toEqual([{ clientId: 'c1', msg: { type: 'pin.travel.denied' } }])
  })
})
