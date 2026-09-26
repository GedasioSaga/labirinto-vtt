import { describe, expect, it } from 'vitest'
import { applyItemChange } from '../lib/items'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, DOOR_TOGGLE_MIN_INTERVAL_MS, type HostResult, type HostWorld } from './hostSession'
import { parsePlayerMessage, type HostMessage } from './protocol'

/**
 * ITEM PEGÁVEL. Diego toca o pino "Chave do Escudo", aperta Pegar: vira
 * pedido na caixa do mestre (ou vai direto, se o pino é livre). Aceito, o
 * pino some para todos e a chave vai à mochila da ficha dele. Diego dá a
 * chave a Bruno, encostado nele. Ninguém recebe a mochila de outro.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const GRID = 40

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function chave(extra: Partial<Pin> = {}): Pin {
  return { ...buildPin('pino-chave', { x: 200, y: 200 }, 'exclamacao'), item: { nome: 'Chave do Escudo' }, ...extra }
}

/** Diego encostado na chave, Bruno encostado no Diego, Carla longe. */
function mansao(pins: Pin[] = [chave()], tokens?: Token[]): MapData {
  return {
    ...createEmptyMap('mapa-mansao', 'Mansão', 1000, 1000, GRID),
    pins,
    tokens: tokens ?? [token('diego', 180, 200), token('bruno', 240, 200), token('carla', 600, 200)],
  }
}

function sequentialIds(): () => string {
  let n = 0
  return () => {
    n += 1
    return `id-${n}`
  }
}

/** Diego (c1), Bruno (c2) e Carla (c3) jogando na Mansão (cena de fundo); o Salão está aberto no editor. */
function mesa(map: MapData = mansao()) {
  let clock = 0
  const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => clock, randomId: sequentialIds() })
  let world: HostWorld = {
    open: { sceneId: 'cena-salao', name: 'Salão', map: createEmptyMap('mapa-salao', 'Salão', 1000, 1000, GRID) },
    background: [{ sceneId: 'cena-mansao', name: 'Mansão', map }],
  }
  const ids: Record<string, string> = {}
  for (const [clientId, nome, ficha] of [
    ['c1', 'Diego', 'diego'],
    ['c2', 'Bruno', 'bruno'],
    ['c3', 'Carla', 'carla'],
  ] as const) {
    const joined = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, world).outbound[0]?.msg
    if (joined?.type !== 'welcome') throw new Error('esperava welcome')
    ids[nome] = joined.playerId
    s.assignToken(joined.playerId, ficha)
  }
  // O primeiro envio: o broadcast só manda de novo quando a tela de alguém muda.
  const inicial = s.broadcast(world)
  return {
    s,
    inicial,
    ids,
    get world() {
      return world
    },
    /** O que o integrador faz: aplica a mudança na cena da Mansão. */
    aplicar(result: HostResult) {
      const change = result.applyItems
      if (change === undefined) throw new Error('esperava applyItems')
      expect(change.sceneId).toBe('cena-mansao')
      const [cena] = world.background
      if (cena === undefined) throw new Error('sem cena')
      world = { ...world, background: [{ ...cena, map: applyItemChange(cena.map, change) }] }
    },
    advance: (ms: number) => void (clock += ms),
  }
}

function snapshotFor(result: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = result.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

describe('protocolo: pin.take e item.give', () => {
  it('aceita a forma certa, sem campo extra; recusa id vazio ou ausente', () => {
    expect(parsePlayerMessage({ type: 'pin.take', pinId: 'pino-chave', extra: 1 })).toEqual({ type: 'pin.take', pinId: 'pino-chave' })
    expect(parsePlayerMessage({ type: 'pin.take', pinId: '' })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.take' })).toBeNull()
    expect(parsePlayerMessage({ type: 'item.give', itemId: 'pino-chave', toTokenId: 'bruno' })).toEqual({ type: 'item.give', itemId: 'pino-chave', toTokenId: 'bruno' })
    expect(parsePlayerMessage({ type: 'item.give', itemId: 'pino-chave' })).toBeNull()
    expect(parsePlayerMessage({ type: 'item.give', itemId: 3, toTokenId: 'bruno' })).toBeNull()
  })
})

describe('recorte: o jogador recebe o pino pegável, nunca a mochila alheia', () => {
  it('o pino chega com o nome do item e nada mais do que o cartão precisa', () => {
    const t = mesa()
    const pino = snapshotFor(t.inicial, 'c1').map.pins.find((p) => p.id === 'pino-chave')
    expect(pino?.item).toEqual({ nome: 'Chave do Escudo' })
  })

  it('SEGURANÇA: Bruno não recebe o que o Diego carrega; Diego recebe a própria mochila', () => {
    const map = mansao([], [token('diego', 180, 200, { mochila: [{ id: 'x', nome: 'Carta Secreta' }] }), token('bruno', 240, 200), token('carla', 600, 200)])
    const t = mesa(map)
    const envio = t.inicial
    expect(snapshotFor(envio, 'c1').map.tokens.find((tk) => tk.id === 'diego')?.mochila).toEqual([{ id: 'x', nome: 'Carta Secreta' }])
    const doBruno = snapshotFor(envio, 'c2')
    expect(doBruno.map.tokens.find((tk) => tk.id === 'diego')).toBeDefined()
    expect(JSON.stringify(doBruno)).not.toContain('Carta Secreta')
    expect(JSON.stringify(snapshotFor(envio, 'c3'))).not.toContain('Carta Secreta')
  })

  it('SEGURANÇA: item oculto para jogadores não chega a ninguém, nem o nome dele', () => {
    const t = mesa(mansao([chave({ secret: true })]))
    const envio = t.inicial
    for (const c of ['c1', 'c2', 'c3']) expect(JSON.stringify(snapshotFor(envio, c))).not.toContain('Chave do Escudo')
  })
})

describe('Pegar: pedido ao mestre', () => {
  it('Diego pega a chave: vira pedido para o mestre, com a cena só para ele; Diego não recebe nada ainda', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'pin.take', pinId: 'pino-chave' }, t.world)
    expect(r.itemRequest).toEqual({ requestId: expect.any(String), playerId: t.ids.Diego, playerName: 'Diego', itemName: 'Chave do Escudo', sceneName: 'Mansão' })
    expect(r.outbound).toEqual([])
    expect(r.applyItems).toBeUndefined()
    expect(t.s.isItemRequestPending(r.itemRequest?.requestId ?? '')).toBe(true)
  })

  it('mestre deixa: a chave some para Diego e Bruno e está na mochila do Diego — só dele', () => {
    const t = mesa()
    const pedido = t.s.handleMessage('c1', { type: 'pin.take', pinId: 'pino-chave' }, t.world).itemRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    const r = t.s.approveItemRequest(pedido.requestId, t.world)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.take.answer', answer: 'taken', nome: 'Chave do Escudo' } }])
    expect(r.applyItems).toEqual({ sceneId: 'cena-mansao', removePinId: 'pino-chave', mochilas: [{ tokenId: 'diego', mochila: [{ id: 'pino-chave', nome: 'Chave do Escudo' }] }] })
    t.aplicar(r)
    const envio = t.s.broadcast(t.world)
    const doDiego = snapshotFor(envio, 'c1')
    const doBruno = snapshotFor(envio, 'c2')
    expect(doDiego.map.pins).toEqual([])
    expect(doBruno.map.pins).toEqual([])
    expect(doDiego.map.tokens.find((tk) => tk.id === 'diego')?.mochila).toEqual([{ id: 'pino-chave', nome: 'Chave do Escudo' }])
    expect(JSON.stringify(doBruno)).not.toContain('Chave do Escudo')
    // Respondido, o pedido não vale uma segunda vez.
    expect(t.s.approveItemRequest(pedido.requestId, t.world)).toEqual({ outbound: [] })
  })

  it('mestre diz não: Diego lê a recusa, a chave fica no mapa, e ele pode pedir de novo', () => {
    const t = mesa()
    const pedido = t.s.handleMessage('c1', { type: 'pin.take', pinId: 'pino-chave' }, t.world).itemRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    expect(t.s.denyItemRequest(pedido.requestId)).toEqual({ outbound: [{ clientId: 'c1', msg: { type: 'pin.take.answer', answer: 'denied' } }] })
    t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
    expect(t.s.handleMessage('c1', { type: 'pin.take', pinId: 'pino-chave' }, t.world).itemRequest).toBeDefined()
  })

  it('5 toques não viram 5 linhas: com um pedido esperando, os seguintes respondem "pending"', () => {
    const t = mesa()
    const rs: HostResult[] = []
    for (let i = 0; i < 5; i += 1) {
      rs.push(t.s.handleMessage('c1', { type: 'pin.take', pinId: 'pino-chave' }, t.world))
      t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
    }
    expect(rs.filter((r) => r.itemRequest !== undefined)).toHaveLength(1)
    for (const r of rs.slice(1)) expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.take.rejected', reason: 'pending' } }])
  })

  it('pino livre: vai direto para a mochila, sem pedido ao mestre', () => {
    const t = mesa(mansao([chave({ item: { nome: 'Moeda', livre: true } })]))
    const r = t.s.handleMessage('c1', { type: 'pin.take', pinId: 'pino-chave' }, t.world)
    expect(r.itemRequest).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.take.answer', answer: 'taken', nome: 'Moeda' } }])
    expect(r.applyItems).toEqual({ sceneId: 'cena-mansao', removePinId: 'pino-chave', mochilas: [{ tokenId: 'diego', mochila: [{ id: 'pino-chave', nome: 'Moeda' }] }] })
  })

  it('longe, pino que não é item, oculto ou inventado: recusa sem pedido; o escuro responde igual ao inexistente', () => {
    const t = mesa(mansao([chave(), buildPin('so-leitura', { x: 200, y: 260 }, 'exclamacao'), chave({ id: 'oculto', secret: true, x: 190, y: 190 })]))
    const longe = t.s.handleMessage('c3', { type: 'pin.take', pinId: 'pino-chave' }, t.world)
    expect(longe.itemRequest).toBeUndefined()
    expect(longe.outbound).toEqual([{ clientId: 'c3', msg: { type: 'pin.take.rejected', reason: 'far' } }])
    for (const pinId of ['so-leitura', 'oculto', 'nao-existe']) {
      t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
      const r = t.s.handleMessage('c1', { type: 'pin.take', pinId }, t.world)
      expect(r.itemRequest).toBeUndefined()
      expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.take.rejected', reason: 'unavailable' } }])
    }
  })

  it('SEGURANÇA: nada que vai ao jogador leva o nome da cena, nem o do Salão aberto no editor', () => {
    const t = mesa()
    const pedido = t.s.handleMessage('c1', { type: 'pin.take', pinId: 'pino-chave' }, t.world)
    const paraJogador = JSON.stringify([pedido.outbound, t.s.approveItemRequest(pedido.itemRequest?.requestId ?? '', t.world).outbound])
    expect(paraJogador).not.toContain('Mansão')
    expect(paraJogador).not.toContain('Salão')
    expect(paraJogador).not.toContain('cena-')
  })

  it('o pino sumiu antes do mestre responder (outro pegou): Diego lê que não deu, e nada muda', () => {
    const t = mesa()
    const pedido = t.s.handleMessage('c1', { type: 'pin.take', pinId: 'pino-chave' }, t.world).itemRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    const semPino = { ...t.world, background: [{ sceneId: 'cena-mansao', name: 'Mansão', map: mansao([]) }] }
    const r = t.s.approveItemRequest(pedido.requestId, semPino)
    expect(r.applyItems).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.take.rejected', reason: 'unavailable' } }])
  })

  it('jogador que cai perde o pedido: o "Deixar" do mestre não entrega nada', () => {
    const t = mesa()
    const pedido = t.s.handleMessage('c1', { type: 'pin.take', pinId: 'pino-chave' }, t.world).itemRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    t.s.disconnect('c1')
    expect(t.s.isItemRequestPending(pedido.requestId)).toBe(false)
    expect(t.s.approveItemRequest(pedido.requestId, t.world)).toEqual({ outbound: [] })
  })
})

describe('Dar a um colega encostado', () => {
  const comChave = () =>
    mansao([], [token('diego', 180, 200, { mochila: [{ id: 'pino-chave', nome: 'Chave do Escudo' }] }), token('bruno', 240, 200), token('carla', 600, 200)])

  it('Diego dá a chave ao Bruno: sai de uma mochila e entra na outra, no mesmo passo', () => {
    const t = mesa(comChave())
    const r = t.s.handleMessage('c1', { type: 'item.give', itemId: 'pino-chave', toTokenId: 'bruno' }, t.world)
    expect(r.outbound).toEqual([])
    expect(r.applyItems).toEqual({
      sceneId: 'cena-mansao',
      mochilas: [
        { tokenId: 'diego', mochila: [] },
        { tokenId: 'bruno', mochila: [{ id: 'pino-chave', nome: 'Chave do Escudo' }] },
      ],
    })
    t.aplicar(r)
    const envio = t.s.broadcast(t.world)
    expect(snapshotFor(envio, 'c2').map.tokens.find((tk) => tk.id === 'bruno')?.mochila).toEqual([{ id: 'pino-chave', nome: 'Chave do Escudo' }])
    expect(JSON.stringify(snapshotFor(envio, 'c1'))).not.toContain('Chave do Escudo')
  })

  it('colega longe: recusa "far"; item que ele não tem, ficha que não é de jogador ou é a própria: "unavailable"', () => {
    const t = mesa(comChave())
    expect(t.s.handleMessage('c1', { type: 'item.give', itemId: 'pino-chave', toTokenId: 'carla' }, t.world).outbound).toEqual([
      { clientId: 'c1', msg: { type: 'item.give.rejected', reason: 'far' } },
    ])
    for (const [clientId, itemId, toTokenId] of [
      ['c2', 'pino-chave', 'diego'],
      ['c1', 'pino-chave', 'diego'],
      ['c1', 'inventado', 'bruno'],
      ['c1', 'pino-chave', 'nao-existe'],
    ] as const) {
      t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
      const r = t.s.handleMessage(clientId, { type: 'item.give', itemId, toTokenId }, t.world)
      expect(r.applyItems).toBeUndefined()
      expect(r.outbound).toEqual([{ clientId, msg: { type: 'item.give.rejected', reason: 'unavailable' } }])
    }
  })

  it('o snapshot diz quais fichas vistas são de COLEGAS: NPC do mestre e a própria ficha ficam de fora', () => {
    const t = mesa(mansao([], [token('diego', 180, 200), token('bruno', 240, 200), token('zumbi', 180, 240), token('carla', 600, 200)]))
    const envio = t.inicial
    expect(snapshotFor(envio, 'c1').partyTokens).toEqual(['bruno', 'carla'])
    expect(snapshotFor(envio, 'c2').partyTokens).toEqual(['diego', 'carla'])
  })

  it('SEGURANÇA: ficha de colega que ele não vê não entra na lista', () => {
    const t = mesa(mansao([], [token('diego', 180, 200), token('bruno', 240, 200), token('carla', 600, 200, { hidden: true })]))
    const doDiego = snapshotFor(t.inicial, 'c1')
    expect(doDiego.partyTokens).toEqual(['bruno'])
    expect(JSON.stringify(doDiego)).not.toContain('carla')
  })
})
