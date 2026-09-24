import { beforeEach, describe, expect, it, vi } from 'vitest'
import { agruparAvisos } from '../components/caixaDeAvisos'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore, type ToastMessage } from '../stores/toastStore'
import type { Token } from '../types/map'
import type { HostWorld, MasterCall } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * CHAMAR O MESTRE do lado de quem responde: cada chamado vira uma linha no
 * grupo "Chamados", com "Ir lá", "Visto" e "Responder", e um bipe só.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

const world = (): HostWorld => ({
  open: { sceneId: 'cena-a', name: 'Salão', map: { ...createEmptyMap('mapa-a', 'A', 40, 10, 50), tokens: [ficha('ficha-duda', 'Duda', 200, 200), ficha('ficha-carla', 'Carla', 250, 200)] } },
  background: [{ sceneId: 'cena-b', name: 'Cripta', map: { ...createEmptyMap('mapa-b', 'B', 40, 10, 50), tokens: [ficha('ficha-bia', 'Bia', 400, 100)] } }],
})

async function mesa() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const onCall = vi.fn((_call: MasterCall) => {})
  const onGoToPoint = vi.fn((_sceneId: string | null, _x: number, _y: number) => {})
  let agora = 50_000
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onCall,
    onGoToPoint,
    now: () => agora,
  })
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener de ${name}`)
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  await bridge.start()
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
  }
  entra('c-duda', 'Duda', 'ficha-duda')
  entra('c-carla', 'Carla', 'ficha-carla')
  entra('c-bia', 'Bia', 'ficha-bia')
  // Os avisos de "entrou" não interessam aqui.
  useToastStore.setState({ toasts: [] })
  const chama = (clientId: string, reason: string, text?: string) => {
    agora += 10
    emit('net:message', { clientId, msg: text === undefined ? { type: 'call.raise', reason } : { type: 'call.raise', reason, text } })
  }
  return { bridge, emit, sent, onCall, onGoToPoint, chama }
}

function chamados(): ToastMessage[] {
  return useToastStore.getState().toasts.filter((t) => t.grupo === 'Chamados')
}

function acao(toast: ToastMessage | undefined, label: string): () => void {
  const found = toast?.actions?.find((a) => a.label === label)
  if (found === undefined) throw new Error(`sem botão ${label}`)
  return found.run
}

describe('hostBridge: chamar o mestre', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('Duda "Quero agir": uma linha com Ir lá, Visto e Responder, e o bipe toca', async () => {
    const { chama, onCall } = await mesa()
    chama('c-duda', 'agir')
    const [linha] = chamados()
    expect(linha?.text).toBe('Duda: Quero agir')
    expect(linha?.actions?.map((a) => a.label)).toEqual(['Ir lá', 'Visto'])
    expect(linha?.resposta?.rotulo).toBe('Responder')
    expect(onCall).toHaveBeenCalledTimes(1)
  })

  it('Carla com Pergunta entra em 2º; Urgente vai para o topo da caixa', async () => {
    const { chama } = await mesa()
    chama('c-duda', 'agir')
    chama('c-carla', 'pergunta', 'posso usar a corda?')
    const caixa = agruparAvisos(useToastStore.getState().toasts).find((item) => item.tipo === 'caixa')
    if (caixa === undefined || caixa.tipo !== 'caixa') throw new Error('dois chamados deveriam virar uma caixa')
    expect(caixa.grupo).toBe('Chamados')
    expect(caixa.toasts.map((t) => t.text)).toEqual(['Duda: Quero agir', 'Carla: Pergunta — posso usar a corda?'])
    chama('c-bia', 'urgente')
    const depois = agruparAvisos(useToastStore.getState().toasts).find((item) => item.tipo === 'caixa')
    if (depois === undefined || depois.tipo !== 'caixa') throw new Error('esperava a caixa')
    expect(depois.toasts.map((t) => t.text)).toEqual(['Bia: Urgente', 'Duda: Quero agir', 'Carla: Pergunta — posso usar a corda?'])
  })

  it('5 toques não empilham: uma linha, um bipe', async () => {
    const { chama, onCall } = await mesa()
    for (let i = 0; i < 5; i += 1) chama('c-duda', 'agir')
    expect(chamados()).toHaveLength(1)
    expect(onCall).toHaveBeenCalledTimes(1)
  })

  it('"Visto" apaga a mão da Duda e não manda nada a mais ninguém', async () => {
    const { chama, sent } = await mesa()
    chama('c-duda', 'agir')
    chama('c-carla', 'pergunta')
    const antes = sent().length
    const linha = chamados().find((t) => t.text.startsWith('Duda'))
    useToastStore.getState().dismiss(linha?.id ?? '')
    acao(linha, 'Visto')()
    expect(sent().slice(antes)).toEqual([{ clientId: 'c-duda', msg: { type: 'call.state', state: 'seen' } }])
    expect(chamados().map((t) => t.text)).toEqual(['Carla: Pergunta'])
  })

  it('o × da linha vale "Visto": a mão não fica acesa para sempre', async () => {
    const { chama, sent } = await mesa()
    chama('c-duda', 'agir')
    const antes = sent().length
    chamados()[0]?.onDismiss?.()
    expect(sent().slice(antes)).toEqual([{ clientId: 'c-duda', msg: { type: 'call.state', state: 'seen' } }])
  })

  it('"Responder" chega só a Carla', async () => {
    const { chama, sent } = await mesa()
    chama('c-duda', 'agir')
    chama('c-carla', 'pergunta')
    const antes = sent().length
    const linha = chamados().find((t) => t.text.startsWith('Carla'))
    linha?.resposta?.enviar('Pode usar.')
    expect(sent().slice(antes)).toEqual([{ clientId: 'c-carla', msg: { type: 'call.reply', id: expect.any(String), text: 'Pode usar.' } }])
    expect(chamados().map((t) => t.text)).toEqual(['Duda: Quero agir'])
  })

  it('"Ir lá" leva o editor à cena e à ficha de quem chamou, e a linha fica', async () => {
    const { chama, onGoToPoint } = await mesa()
    chama('c-bia', 'ajuda')
    const linha = chamados()[0]
    const irLa = linha?.actions?.find((a) => a.label === 'Ir lá')
    expect(irLa?.mantem).toBe(true)
    acao(linha, 'Ir lá')()
    expect(onGoToPoint).toHaveBeenCalledWith('cena-b', 400, 100)
  })

  it('a jogadora baixou a mão ou caiu: a linha sai da tela do mestre', async () => {
    const { chama, emit } = await mesa()
    chama('c-duda', 'agir')
    chama('c-carla', 'pergunta')
    emit('net:message', { clientId: 'c-duda', msg: { type: 'call.lower' } })
    expect(chamados().map((t) => t.text)).toEqual(['Carla: Pergunta'])
    emit('net:peer', { clientId: 'c-carla', event: 'disconnected' })
    expect(chamados()).toEqual([])
  })
})
