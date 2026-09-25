import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore, type ToastMessage, type ToastResposta } from '../stores/toastStore'
import type { MapData, Pin, Token } from '../types/map'
import { TRAVEL_REQUEST_MIN_INTERVAL_MS, type HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'
import { TRAVEL_DENY_TEXT_MAX_LENGTH } from './protocol'

/**
 * PINO TRANCADO VIRA PEDIDO, do lado do mestre: o pedido pelo pino trancado
 * vira uma linha em "Pedidos" com "Liberar uma vez", "Passar para pede" e
 * "Não" — e não com o "Deixar ir" do pedido comum. "Passar para pede" muda o
 * modo do pino NA CENA DELE (a de fundo, aqui) e leva o Diego.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

/** O campo que envia sozinho (`ToastResposta`); o `ToastReplyField` não tem `enviar`. */
function queEnvia(resposta: ToastMessage['resposta']): ToastResposta | undefined {
  return resposta !== undefined && 'enviar' in resposta ? resposta : undefined
}
const GRID = 50
const CENA_LAB = 'cena-laboratorio'
const CENA_PATIO = 'cena-patio'

const diego: Token = { id: 'diego', characterId: null, name: 'Diego', x: 200, y: 200, size: 1, image: null }

function viagem(id: string, x: number, y: number, description: string, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description, image: null, destino, ...extra }
}

async function mesa(porta: Partial<Pin> = { passagem: 'trancada' }, comVer = false) {
  const lab = (): MapData => ({
    ...createEmptyMap('mapa-lab', 'Laboratório', 2000, 500, GRID),
    tokens: [diego],
    pins: [viagem('porta-lab', 400, 200, 'Porta de aço', { sceneId: CENA_PATIO, pinId: 'porta-patio' }, porta)],
  })
  const patio = (): MapData => ({
    ...createEmptyMap('mapa-patio', 'Pátio', 2000, 500, GRID),
    pins: [viagem('porta-patio', 1000, 250, 'Porta dos fundos', { sceneId: CENA_LAB, pinId: 'porta-lab' })],
  })
  // O mestre está com o Pátio aberto; o Diego está no Laboratório, de fundo.
  const world = (): HostWorld => ({
    open: { sceneId: CENA_PATIO, name: 'Pátio', map: patio() },
    background: [{ sceneId: CENA_LAB, name: 'Laboratório', map: lab() }],
  })
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const applyTransfer = vi.fn(() => true)
  const setPinPassage = vi.fn()
  const onGoToPoint = vi.fn()
  const relogio = { agora: 0 }
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    applyTransfer,
    setPinPassage,
    onPlayersChange: vi.fn(),
    ...(comVer ? { onGoToPoint } : {}),
    now: () => relogio.agora,
  })
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener de ${name}`)
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  await bridge.start()
  emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Diego' } })
  const jogador = bridge.players().find((p) => p.name === 'Diego')
  if (jogador === undefined) throw new Error('Diego deveria ter entrado')
  bridge.assignToken(jogador.playerId, 'diego')
  const pedir = () => {
    // Cada pedido depois do intervalo mínimo: o segundo pedido do Diego não volta "too_soon".
    relogio.agora += TRAVEL_REQUEST_MIN_INTERVAL_MS
    emit('net:message', { clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'porta-lab' } })
  }
  const pedidos = () => useToastStore.getState().toasts.filter((t) => t.grupo === 'Pedidos')
  return { pedir, pedidos, sent, applyTransfer, setPinPassage, onGoToPoint }
}

function acao(label: string, toast: { actions?: { label: string; run: () => void }[] } | undefined) {
  const found = toast?.actions?.find((a) => a.label === label)
  if (found === undefined) throw new Error(`sem ação ${label}`)
  return found
}

describe('hostBridge: pino de viagem trancado vira pedido', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('o pedido pelo pino trancado vira linha com "Liberar uma vez", "Passar para pede" e "Não"', async () => {
    const m = await mesa()
    m.pedir()
    const [linha] = m.pedidos()
    expect(m.pedidos()).toHaveLength(1)
    expect(linha?.text).toBe('Diego quer passar por Porta de aço (trancada) → Pátio')
    expect(linha?.actions?.map((a) => a.label)).toEqual(['Liberar uma vez', 'Passar para pede', 'Não'])
  })

  it('"Liberar uma vez": o Diego passa e lê "Você chegou"; o modo do pino fica como está', async () => {
    const m = await mesa()
    m.pedir()
    const antes = m.sent().length
    acao('Liberar uma vez', m.pedidos()[0]).run()
    expect(m.applyTransfer).toHaveBeenCalledTimes(1)
    expect(m.sent().slice(antes)).toContainEqual({ clientId: 'c1', msg: { type: 'scene.changed' } })
    expect(m.setPinPassage).not.toHaveBeenCalled()
    expect(m.pedidos()).toHaveLength(0)
  })

  it('"Passar para pede": o pino vira "pede" na cena de fundo dele, e o Diego passa', async () => {
    const m = await mesa()
    m.pedir()
    acao('Passar para pede', m.pedidos()[0]).run()
    expect(m.setPinPassage).toHaveBeenCalledWith('porta-lab', 'pede', CENA_LAB)
    expect(m.applyTransfer).toHaveBeenCalledTimes(1)
    expect(m.sent()).toContainEqual({ clientId: 'c1', msg: { type: 'scene.changed' } })
  })

  it('"Não": pin.travel.denied, ninguém passa', async () => {
    const m = await mesa()
    m.pedir()
    acao('Não', m.pedidos()[0]).run()
    expect(m.applyTransfer).not.toHaveBeenCalled()
    expect(m.sent()).toContainEqual({ clientId: 'c1', msg: { type: 'pin.travel.denied' } })
  })

  it('com "Ver": a linha trancada ganha "Ver", que leva o editor à ficha do Diego e deixa a linha', async () => {
    const m = await mesa({ passagem: 'trancada' }, true)
    m.pedir()
    const linha = m.pedidos()[0]
    expect(linha?.actions?.map((a) => a.label)).toEqual(['Liberar uma vez', 'Passar para pede', 'Ver', 'Não'])
    const ver = linha?.actions?.find((a) => a.label === 'Ver')
    expect(ver?.mantem).toBe(true)
    const antes = m.sent().length
    acao('Ver', linha).run()
    expect(m.onGoToPoint).toHaveBeenCalledWith(CENA_LAB, 200, 200)
    // Olhar não responde: nada vai ao Diego, ninguém passa.
    expect(m.sent().slice(antes)).toEqual([])
    expect(m.applyTransfer).not.toHaveBeenCalled()
  })

  it('"Não, porque…": o motivo chega ao Diego no pin.travel.denied, ninguém passa, e volta pronto no próximo pedido trancado', async () => {
    const m = await mesa()
    m.pedir()
    const resposta = queEnvia(m.pedidos()[0]?.resposta)
    expect(resposta?.rotulo).toBe('Não, porque…')
    expect(resposta?.maxLength).toBe(TRAVEL_DENY_TEXT_MAX_LENGTH)
    resposta?.enviar('A porta está soldada')
    expect(m.sent()).toContainEqual({ clientId: 'c1', msg: { type: 'pin.travel.denied', text: 'A porta está soldada' } })
    expect(m.applyTransfer).not.toHaveBeenCalled()
    expect(m.setPinPassage).not.toHaveBeenCalled()
    expect(m.pedidos()).toHaveLength(0)
    m.pedir()
    expect(m.pedidos()).toHaveLength(1)
    expect(queEnvia(m.pedidos()[0]?.resposta)?.recentes?.()).toEqual(['A porta está soldada'])
  })

  it('opção desligada (mudo): nenhuma linha, e o Diego lê a recusa genérica', async () => {
    const m = await mesa({ passagem: 'trancada', mudo: true })
    m.pedir()
    expect(m.pedidos()).toHaveLength(0)
    expect(m.sent()).toContainEqual({ clientId: 'c1', msg: { type: 'pin.travel.rejected', reason: 'unavailable' } })
  })

  it('controle: o pedido comum continua com "Deixar ir"', async () => {
    const m = await mesa({})
    m.pedir()
    expect(m.pedidos()[0]?.actions?.map((a) => a.label)).toEqual(['Deixar ir', 'Não'])
  })
})
