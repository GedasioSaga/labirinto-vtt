import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Toast } from '../components/Toast'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Token, Wall } from '../types/map'
import type { HostWorld } from './hostSession'
import { createHostBridge, doorRequestLine } from './hostBridge'

/**
 * PORTA TRANCADA VIRA PEDIDO, do lado do mestre: o pedido do jogador vira uma
 * linha no grupo "Pedidos" (a mesma caixa dos pedidos de passagem), e a
 * resposta do mestre destranca e abre a porta NA CENA DELA — mesmo com outra
 * cena aberta no editor.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const GRID = 40

function wall(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

const lirio: Token = { id: 'lirio', characterId: null, name: 'Lírio', x: 460, y: 200, size: 1, image: null }

function mansao(): MapData {
  return {
    ...createEmptyMap('mapa-mansao', 'Mansão', 1000, 1000, GRID),
    walls: [
      wall('acima', 500, 0, 500, 180),
      { ...wall('escritorio', 500, 180, 500, 220, { open: false, locked: true, kind: 'normal' }), blocksLight: false },
      wall('abaixo', 500, 220, 500, 1000),
    ],
    tokens: [lirio],
  }
}

async function mesa(options: { comDestrancar?: boolean } = {}) {
  const world = (): HostWorld => ({
    open: { sceneId: 'cena-salao', name: 'Salão', map: createEmptyMap('mapa-salao', 'Salão', 1000, 1000, GRID) },
    background: [{ sceneId: 'cena-mansao', name: 'Mansão', map: mansao() }],
  })
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const unlockAndOpenDoor = vi.fn()
  let clock = 0
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    ...(options.comDestrancar === false ? {} : { unlockAndOpenDoor }),
    onPlayersChange: vi.fn(),
    now: () => clock,
  })
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener de ${name}`)
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  await bridge.start()
  emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  const ana = bridge.players().find((p) => p.name === 'Ana')
  if (ana === undefined) throw new Error('Ana deveria ter entrado')
  bridge.assignToken(ana.playerId, 'lirio')
  const pedir = (how: string) => {
    clock += 1000
    emit('net:message', { clientId: 'c1', msg: { type: 'door.request', wallId: 'escritorio', how } })
  }
  const pedidos = () => useToastStore.getState().toasts.filter((t) => t.grupo === 'Pedidos')
  return { pedir, pedidos, sent, unlockAndOpenDoor, emit }
}

function acao(label: string, toast: { actions?: { label: string; run: () => void }[] } | undefined) {
  const found = toast?.actions?.find((a) => a.label === label)
  if (found === undefined) throw new Error(`sem ação ${label}`)
  return found
}

describe('hostBridge: porta trancada vira pedido na caixa', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('Ana tenta forçar: uma linha em Pedidos que diz quem, o quê e em que cena, com "Destrancar e abrir" e "Não"', async () => {
    const m = await mesa()
    m.pedir('force')
    const [linha] = m.pedidos()
    expect(m.pedidos()).toHaveLength(1)
    expect(linha?.text).toBe('Ana tenta forçar a porta em Mansão')
    expect(linha?.actions?.map((a) => a.label)).toEqual(['Destrancar e abrir', 'Não'])
  })

  it('o mestre, noutra cena, vê "Pedidos (1)" com a linha da Ana: o pedido da porta abre a caixa sozinho', async () => {
    const m = await mesa()
    m.pedir('force')
    const html = renderToStaticMarkup(createElement(Toast, { toasts: useToastStore.getState().toasts, onDismiss: () => {} }))
    expect(html).toContain('aria-label="Pedidos (1)"')
    expect(html).toMatch(/<h2[^>]*>Pedidos \(1\)<\/h2>/)
    expect(html).toContain('Ana tenta forçar a porta em Mansão')
  })

  it('porta na cena aberta no editor (ou mapa solto): a linha não repete o nome da cena', () => {
    expect(doorRequestLine({ requestId: 'r1', playerId: 'p1', playerName: 'Ana', how: 'force' })).toBe('Ana tenta forçar a porta')
  })

  it('Bater e Usar chave também viram linha, cada um com o seu verbo', async () => {
    const m = await mesa()
    m.pedir('knock')
    expect(m.pedidos()[0]?.text).toBe('Ana bate na porta em Mansão')
    acao('Não', m.pedidos()[0]).run()
    m.pedir('key')
    expect(m.pedidos().map((t) => t.text)).toContain('Ana tenta usar uma chave na porta em Mansão')
  })

  it('5 toques não viram 5 linhas', async () => {
    const m = await mesa()
    for (let i = 0; i < 5; i += 1) m.pedir('force')
    expect(m.pedidos()).toHaveLength(1)
  })

  it('"Destrancar e abrir": destranca e abre a porta na cena de fundo, e Ana recebe "abriu"', async () => {
    const m = await mesa()
    m.pedir('force')
    const antes = m.sent().length
    acao('Destrancar e abrir', m.pedidos()[0]).run()
    expect(m.unlockAndOpenDoor).toHaveBeenCalledWith('escritorio', 'cena-mansao')
    expect(m.sent().slice(antes)).toContainEqual({ clientId: 'c1', msg: { type: 'door.request.answer', answer: 'opened' } })
    expect(m.pedidos()).toHaveLength(0)
  })

  it('"Não" e o × respondem "disse não", sem mexer na porta', async () => {
    const m = await mesa()
    m.pedir('force')
    const antes = m.sent().length
    const linha = m.pedidos()[0]
    linha?.onDismiss?.()
    expect(m.unlockAndOpenDoor).not.toHaveBeenCalled()
    expect(m.sent().slice(antes)).toContainEqual({ clientId: 'c1', msg: { type: 'door.request.answer', answer: 'denied' } })
  })

  it('jogador que cai: a linha sai da caixa', async () => {
    const m = await mesa()
    m.pedir('force')
    m.emit('net:peer', { clientId: 'c1', event: 'disconnected' })
    expect(m.pedidos()).toHaveLength(0)
  })

  it('mestre sem quem destranque: o pedido nem vira linha, e Ana lê "disse não"', async () => {
    const m = await mesa({ comDestrancar: false })
    m.pedir('force')
    expect(m.pedidos()).toHaveLength(0)
    expect(m.sent()).toContainEqual({ clientId: 'c1', msg: { type: 'door.request.answer', answer: 'denied' } })
  })
})
