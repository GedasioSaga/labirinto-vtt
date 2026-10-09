import { describe, expect, it } from 'vitest'
import { applyItemChange } from '../lib/items'
import { objetoDeItem, pinoDeItem } from '../lib/itemNoMapa'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, PinItem, Prop, Token } from '../types/map'
import { itemRequestLine } from './hostBridge'
import { createHostSession, DOOR_TOGGLE_MIN_INTERVAL_MS, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * ITEM NO MAPA (entrega 5), no host. Diego toca a imagem da Poção deitada no
 * chão (ou o pino de item) e pega: "Pega direto" vai à mochila na hora, com
 * imagem, descrição, categoria, preço e pilha; "Pede ao mestre" vira a linha
 * de Pedidos com "Deixar"/"Não". O host confere no mapa DELE: o item existe,
 * chega ao jogador (oculto e fora da visão não), e uma ficha dele alcança.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const GRID = 40
const IMAGEM = `midia:${'c'.repeat(64)}.webp`
const POCAO: PinItem = { nome: 'Poção', itemId: 'item_pocao', imagem: IMAGEM, descricao: 'Cura 50 HP.', categoria: 'Consumível', preco: 30, empilhavel: true, quantidade: 3, livre: true }

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function noChao(extra: Partial<Prop> = {}, item: PinItem = POCAO): Prop {
  return { ...objetoDeItem('chao-pocao', { x: 230, y: 200 }, 40, item), ...extra }
}

/** Diego encostado na poção, Carla longe. */
function mansao(props: Prop[] = [noChao()], pins: Pin[] = [], tokens?: Token[]): MapData {
  return {
    ...createEmptyMap('mapa-mansao', 'Mansão', 1000, 1000, GRID),
    props,
    pins,
    tokens: tokens ?? [token('diego', 180, 200), token('carla', 600, 200)],
  }
}

function sequentialIds(): () => string {
  let n = 0
  return () => {
    n += 1
    return `id-${n}`
  }
}

function mesa(map: MapData = mansao()) {
  let clock = 0
  const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => clock, randomId: sequentialIds() })
  let world: HostWorld = {
    open: { sceneId: 'cena-mansao', name: 'Mansão', map },
    background: [],
  }
  for (const [clientId, nome, ficha] of [
    ['c1', 'Diego', 'diego'],
    ['c3', 'Carla', 'carla'],
  ] as const) {
    const joined = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, world).outbound[0]?.msg
    if (joined?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(joined.playerId, ficha)
  }
  const inicial = s.broadcast(world)
  return {
    s,
    inicial,
    get world() {
      return world
    },
    aplicar(result: HostResult) {
      const change = result.applyItems
      if (change === undefined) throw new Error('esperava applyItems')
      world = { ...world, open: { ...world.open, map: applyItemChange(world.open.map, change) } }
    },
    trocarMapa(novo: MapData) {
      world = { ...world, open: { ...world.open, map: novo } }
    },
    advance: (ms: number) => void (clock += ms),
  }
}

function snapshotFor(result: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = result.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

const pegar = (id = 'chao-pocao') => ({ type: 'pin.take' as const, pinId: id })

describe('item no chão: o jogador recebe a referência, nunca a imagem embutida', () => {
  it('o snapshot leva o objeto com o item limpo (sem id do acervo nem preço)', () => {
    const t = mesa()
    const chao = snapshotFor(t.inicial, 'c1').map.props.find((p) => p.id === 'chao-pocao')
    expect(chao?.item).toEqual({ nome: 'Poção', livre: true, imagem: IMAGEM, descricao: 'Cura 50 HP.', categoria: 'Consumível', quantidade: 3 })
    expect(chao?.src).toBe('')
    expect(JSON.stringify(snapshotFor(t.inicial, 'c1'))).not.toContain('item_pocao')
  })
})

describe('pegar o item no chão', () => {
  it('"Pega direto": vai à mochila com tudo e o objeto sai do mapa', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', pegar(), t.world)
    expect(r.itemRequest).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.take.answer', answer: 'taken', nome: 'Poção' } }])
    expect(r.applyItems?.removePropId).toBe('chao-pocao')
    t.aplicar(r)
    expect(t.world.open.map.props).toEqual([])
    const { livre: _livre, ...dados } = POCAO
    expect(t.world.open.map.tokens.find((k) => k.id === 'diego')?.mochila).toEqual([{ id: 'chao-pocao', ...dados }])
  })

  it('empilha na poção que ele já carrega', () => {
    const diego = token('diego', 180, 200, { mochila: [{ id: 'v1', nome: 'Poção', itemId: 'item_pocao', quantidade: 2, empilhavel: true }] })
    const t = mesa(mansao([noChao()], [], [diego, token('carla', 600, 200)]))
    const r = t.s.handleMessage('c1', pegar(), t.world)
    t.aplicar(r)
    expect(t.world.open.map.tokens.find((k) => k.id === 'diego')?.mochila).toEqual([expect.objectContaining({ id: 'v1', quantidade: 5, imagem: IMAGEM })])
  })

  it('"Pede ao mestre": vira pedido com a pilha; "Deixar" entrega, "Não" deixa no chão', () => {
    const { livre: _livre, ...pede } = POCAO
    const t = mesa(mansao([noChao({}, pede)]))
    const pedido = t.s.handleMessage('c1', pegar(), t.world).itemRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    expect(pedido).toMatchObject({ playerName: 'Diego', itemName: 'Poção', quantidade: 3 })
    expect(itemRequestLine(pedido)).toBe('Diego quer pegar Poção (3)')
    expect(t.s.denyItemRequest(pedido.requestId)).toEqual({ outbound: [{ clientId: 'c1', msg: { type: 'pin.take.answer', answer: 'denied' } }] })
    expect(t.world.open.map.props).toHaveLength(1)

    t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
    const deNovo = t.s.handleMessage('c1', pegar(), t.world).itemRequest
    if (deNovo === undefined) throw new Error('esperava pedido')
    const r = t.s.approveItemRequest(deNovo.requestId, t.world)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.take.answer', answer: 'taken', nome: 'Poção' } }])
    t.aplicar(r)
    expect(t.world.open.map.props).toEqual([])
    expect(t.world.open.map.tokens.find((k) => k.id === 'diego')?.mochila?.[0]).toMatchObject({ nome: 'Poção', quantidade: 3, descricao: 'Cura 50 HP.' })
  })

  it('o mestre trocou a forma enquanto decidia (virou pino): "Deixar" entrega o pino', () => {
    const { livre: _livre, ...pede } = POCAO
    const t = mesa(mansao([noChao({}, pede)]))
    const pedido = t.s.handleMessage('c1', pegar(), t.world).itemRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    t.trocarMapa({ ...t.world.open.map, props: [], pins: [pinoDeItem('chao-pocao', { x: 230, y: 200 }, pede)] })
    const r = t.s.approveItemRequest(pedido.requestId, t.world)
    expect(r.applyItems?.removePinId).toBe('chao-pocao')
  })

  it('longe, oculto para jogadores, fora da visão, objeto comum ou id inventado: recusa sem pedido nem mudança', () => {
    const comum: Prop = { id: 'mesa', src: 'C:/m/mesa.png', x: 200, y: 220, width: 40, height: 40, linkedMapPath: null }
    const t = mesa(mansao([noChao(), noChao({ id: 'oculto', secret: true }), noChao({ id: 'no-escuro', x: 900, y: 900 }), comum]))
    const longe = t.s.handleMessage('c3', pegar(), t.world)
    expect(longe.applyItems).toBeUndefined()
    expect(longe.outbound).toEqual([{ clientId: 'c3', msg: { type: 'pin.take.rejected', reason: 'far' } }])
    for (const id of ['oculto', 'no-escuro', 'mesa', 'inventado']) {
      t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
      const r = t.s.handleMessage('c1', pegar(id), t.world)
      expect(r.applyItems, id).toBeUndefined()
      expect(r.itemRequest, id).toBeUndefined()
      expect(r.outbound, id).toEqual([{ clientId: 'c1', msg: { type: 'pin.take.rejected', reason: 'unavailable' } }])
    }
  })

  it('toques em rajada não pegam duas vezes: o limite de tempo segura o segundo', () => {
    const t = mesa(mansao([noChao(), noChao({ id: 'outra' })]))
    expect(t.s.handleMessage('c1', pegar(), t.world).applyItems).toBeDefined()
    expect(t.s.handleMessage('c1', pegar('outra'), t.world)).toEqual({ outbound: [] })
  })
})

describe('o pino "!" de antes continua pegando', () => {
  it('pino só com o nome, livre: vai à mochila como sempre, id do pino e nome', () => {
    const chave: Pin = { ...buildPin('pino-chave', { x: 200, y: 200 }, 'exclamacao'), item: { nome: 'Chave do Escudo', livre: true } }
    const t = mesa(mansao([], [chave]))
    const r = t.s.handleMessage('c1', pegar('pino-chave'), t.world)
    t.aplicar(r)
    expect(t.world.open.map.pins).toEqual([])
    expect(t.world.open.map.tokens.find((k) => k.id === 'diego')?.mochila).toEqual([{ id: 'pino-chave', nome: 'Chave do Escudo' }])
  })
})
