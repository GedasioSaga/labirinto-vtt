import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { Region, Token } from '../types/map'
import type { HostWorld, PointActionRequest } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * AÇÕES NO PONTO do lado do mestre: o pedido vira uma linha na Caixa (grupo
 * "Pedidos") com "Ir lá", "Nada aqui" e "Feito". "Ir lá" não responde nada e
 * deixa a linha na tela; as outras duas respondem só a quem pediu.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

const ficha = (id: string, x: number, y: number): Token => ({ id, characterId: null, name: id, x, y, size: 1, image: null })

const ferreiro: Region = {
  id: 'ferreiro',
  points: [
    { x: 50, y: 50 },
    { x: 250, y: 50 },
    { x: 250, y: 250 },
    { x: 50, y: 250 },
  ],
  tag: '',
  fillColor: '#333333',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Ferreiro' },
}

const world = (): HostWorld => ({
  open: { sceneId: 'cena-vila', name: 'Vila', map: { ...createEmptyMap('mapa-vila', 'Vila', 30, 10, 50), tokens: [ficha('ficha-fabi', 100, 100), ficha('ficha-duda', 150, 100)], regions: [ferreiro] } },
  background: [],
})

async function mesa() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const onPointActionGo = vi.fn((_request: PointActionRequest) => {})
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPointActionGo,
    onPlayersChange: vi.fn(),
    now: () => 0,
  })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  await bridge.start()
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
  }
  entra('c1', 'Fabi', 'ficha-fabi')
  entra('c2', 'Duda', 'ficha-duda')
  return { emit, sent, onPointActionGo, bridge }
}

function avisoDoPedido() {
  const aviso = useToastStore.getState().toasts.find((t) => t.text.startsWith('Fabi quer'))
  if (aviso === undefined) throw new Error('o pedido deveria virar aviso do mestre')
  return aviso
}

function acao(label: string) {
  const found = avisoDoPedido().actions?.find((a) => a.label === label)
  if (found === undefined) throw new Error(`o aviso deveria ter "${label}"`)
  return found
}

describe('hostBridge: ações no ponto', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('"Fabi quer Procurar — Ferreiro" entra na Caixa com Ir lá, Nada aqui e Feito', async () => {
    const { emit } = await mesa()
    emit({ clientId: 'c1', msg: { type: 'point.action', action: 'procurar', x: 120, y: 130 } })
    const aviso = avisoDoPedido()
    expect(aviso.text).toBe('Fabi quer Procurar — Ferreiro')
    expect(aviso.grupo).toBe('Pedidos')
    expect(aviso.kind).toBe('instrucao')
    expect(aviso.actions?.map((a) => a.label)).toEqual(['Ir lá', 'Nada aqui', 'Feito'])
  })

  it('"Ir lá" centra e marca o ponto, não responde nada ao jogador e fica na tela', async () => {
    const { emit, sent, onPointActionGo } = await mesa()
    emit({ clientId: 'c1', msg: { type: 'point.action', action: 'procurar', x: 120, y: 130 } })
    const antes = sent().length
    const irLa = acao('Ir lá')
    expect(irLa.mantemAviso).toBe(true)
    irLa.run()
    expect(onPointActionGo).toHaveBeenCalledWith(expect.objectContaining({ sceneId: 'cena-vila', x: 120, y: 130, playerName: 'Fabi', action: 'procurar' }))
    expect(sent().slice(antes)).toEqual([])
    expect(useToastStore.getState().toasts.some((t) => t.text === 'Fabi quer Procurar — Ferreiro')).toBe(true)
  })

  it('"Nada aqui" manda "nothing" só para Fabi e tira a linha', async () => {
    const { emit, sent } = await mesa()
    emit({ clientId: 'c1', msg: { type: 'point.action', action: 'procurar', x: 120, y: 130 } })
    const antes = sent().length
    acao('Nada aqui').run()
    expect(sent().slice(antes)).toEqual([{ clientId: 'c1', msg: { type: 'point.action.answer', action: 'procurar', answer: 'nothing' } }])
    expect(useToastStore.getState().toasts.some((t) => t.text.startsWith('Fabi quer'))).toBe(false)
  })

  it('"Feito" manda "seen" só para Fabi', async () => {
    const { emit, sent } = await mesa()
    emit({ clientId: 'c1', msg: { type: 'point.action', action: 'escutar', x: 120, y: 130 } })
    const antes = sent().length
    acao('Feito').run()
    expect(sent().slice(antes)).toEqual([{ clientId: 'c1', msg: { type: 'point.action.answer', action: 'escutar', answer: 'seen' } }])
  })

  it('o × responde "seen": o pedido nunca some sem resposta', async () => {
    const { emit, sent } = await mesa()
    emit({ clientId: 'c1', msg: { type: 'point.action', action: 'espiar', x: 120, y: 130 } })
    const antes = sent().length
    avisoDoPedido().onDismiss?.()
    expect(sent().slice(antes)).toEqual([{ clientId: 'c1', msg: { type: 'point.action.answer', action: 'espiar', answer: 'seen' } }])
  })

  it('o pedido em si não sai para jogador nenhum', async () => {
    const { emit, sent } = await mesa()
    const antes = sent().length
    emit({ clientId: 'c1', msg: { type: 'point.action', action: 'revistar', x: 120, y: 130 } })
    expect(JSON.stringify(sent().slice(antes))).not.toContain('Ferreiro')
    expect(sent().slice(antes)).toEqual([])
  })

  it('expulsar Fabi tira o pedido dela da tela do mestre', async () => {
    const { emit, bridge } = await mesa()
    emit({ clientId: 'c1', msg: { type: 'point.action', action: 'procurar', x: 120, y: 130 } })
    await bridge.kick('c1')
    expect(useToastStore.getState().toasts.some((t) => t.text.startsWith('Fabi quer'))).toBe(false)
  })
})
