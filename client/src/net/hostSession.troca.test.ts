import { describe, expect, it } from 'vitest'
import { applyItemChange } from '../lib/items'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import { parseHostTradeMessage, parsePlayerMessage, type HostMessage } from './protocol'

/**
 * MOEDAS E TROCA ENTRE FICHAS. Diego paga 3 moedas a Bruno, encostado nele.
 * O mestre propõe a Bruno, pela Zulmira: "dou Xarope, peço a Faca e 3
 * moedas". Bruno aceita, recusa ou contrapropõe (a Vela e 1 moeda), e o
 * mestre aceita ou recusa a contraproposta. A oferta vai só a quem é dela; a
 * bolsa de uma ficha só chega ao dono.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const GRID = 40

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

/** Diego encostado em Bruno; Carla longe; Zulmira é NPC do mestre, encostada em Diego. */
function mansao(tokens?: Token[]): MapData {
  return {
    ...createEmptyMap('mapa-mansao', 'Mansão', 1000, 1000, GRID),
    tokens: tokens ?? [
      token('diego', 180, 200, { moedas: 10 }),
      token('bruno', 240, 200, { moedas: 5, mochila: [{ id: 'faca', nome: 'Faca de rede' }, { id: 'vela', nome: 'Vela' }] }),
      token('carla', 600, 200, { moedas: 1 }),
      token('zulmira', 140, 200, { npc: true, moedas: 50 }),
    ],
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
  s.broadcast(world)
  return {
    s,
    ids,
    get world() {
      return world
    },
    aplicar(result: HostResult) {
      const change = result.applyItems
      if (change === undefined) throw new Error('esperava applyItems')
      expect(change.sceneId).toBe('cena-mansao')
      const [cena] = world.background
      if (cena === undefined) throw new Error('sem cena')
      world = { ...world, background: [{ ...cena, map: applyItemChange(cena.map, change) }] }
    },
    ficha(id: string): Token | undefined {
      return world.background[0]?.map.tokens.find((t) => t.id === id)
    },
    advance: (ms: number) => void (clock += ms),
  }
}

function snapshotFor(result: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = result.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

const OFERTA = { de: 'Zulmira', dou: { itens: ['Xarope'], moedas: 0 }, peco: { itemIds: ['faca'], moedas: 3 } }

function ofertaAoBruno(t: ReturnType<typeof mesa>): string {
  const r = t.s.proposeTrade(t.ids.Bruno ?? '', 'bruno', OFERTA, t.world)
  if (r.offerId === null) throw new Error('esperava oferta')
  return r.offerId
}

describe('protocolo: moedas e troca', () => {
  it('aceita a forma certa, sem campo extra; recusa valor torto', () => {
    expect(parsePlayerMessage({ type: 'coins.give', toTokenId: 'bruno', moedas: 3, extra: 1 })).toEqual({ type: 'coins.give', toTokenId: 'bruno', moedas: 3 })
    expect(parsePlayerMessage({ type: 'coins.give', toTokenId: 'bruno', moedas: 0 })).toBeNull()
    expect(parsePlayerMessage({ type: 'coins.give', toTokenId: 'bruno', moedas: 1.5 })).toBeNull()
    expect(parsePlayerMessage({ type: 'coins.give', toTokenId: '', moedas: 2 })).toBeNull()
    expect(parsePlayerMessage({ type: 'trade.answer', offerId: 'o1', answer: 'accept' })).toEqual({ type: 'trade.answer', offerId: 'o1', answer: 'accept' })
    expect(parsePlayerMessage({ type: 'trade.answer', offerId: 'o1', answer: 'talvez' })).toBeNull()
    expect(parsePlayerMessage({ type: 'trade.counter', offerId: 'o1', itemIds: ['vela'], moedas: 1 })).toEqual({ type: 'trade.counter', offerId: 'o1', itemIds: ['vela'], moedas: 1 })
    expect(parsePlayerMessage({ type: 'trade.counter', offerId: 'o1', itemIds: [3], moedas: 1 })).toBeNull()
    expect(parsePlayerMessage({ type: 'trade.counter', offerId: 'o1', itemIds: [], moedas: -1 })).toBeNull()
  })

  it('o jogador só aceita a oferta bem formada e guarda só os campos conhecidos', () => {
    const certa = { type: 'trade.offer', offerId: 'o1', tokenId: 'bruno', de: 'Zulmira', dou: { itens: ['Xarope'], moedas: 0 }, peco: { itens: [{ id: 'faca', nome: 'Faca' }], moedas: 3 }, cena: 'Mansão' }
    expect(parseHostTradeMessage(certa)).toEqual({ type: 'trade.offer', offerId: 'o1', tokenId: 'bruno', de: 'Zulmira', dou: { itens: ['Xarope'], moedas: 0 }, peco: { itens: [{ id: 'faca', nome: 'Faca' }], moedas: 3 } })
    expect(parseHostTradeMessage({ ...certa, dou: { itens: 'Xarope', moedas: 0 } })).toBeNull()
    expect(parseHostTradeMessage({ ...certa, tokenId: '' })).toBeNull()
    expect(parseHostTradeMessage({ type: 'trade.closed', offerId: 'o1', result: 'done' })).toEqual({ type: 'trade.closed', offerId: 'o1', result: 'done' })
    expect(parseHostTradeMessage({ type: 'trade.closed', offerId: 'o1', result: 'sei-la' })).toBeNull()
  })
})

describe('recorte: a bolsa só chega ao dono', () => {
  it('SEGURANÇA: Diego recebe as próprias moedas; ninguém recebe a bolsa de outro nem a do NPC', () => {
    const t = mesa()
    const envio = t.s.broadcast(t.world)
    const doDiego = snapshotFor(envio, 'c1')
    expect(doDiego.map.tokens.find((tk) => tk.id === 'diego')?.moedas).toBe(10)
    const brunoVistoPeloDiego = doDiego.map.tokens.find((tk) => tk.id === 'bruno')
    expect(brunoVistoPeloDiego).toBeDefined()
    expect(brunoVistoPeloDiego !== undefined && 'moedas' in brunoVistoPeloDiego).toBe(false)
    const zulmira = doDiego.map.tokens.find((tk) => tk.id === 'zulmira')
    expect(zulmira).toBeDefined()
    expect(zulmira !== undefined && 'moedas' in zulmira).toBe(false)
    const doBruno = snapshotFor(envio, 'c2')
    expect(doBruno.map.tokens.find((tk) => tk.id === 'bruno')?.moedas).toBe(5)
    const diegoVistoPeloBruno = doBruno.map.tokens.find((tk) => tk.id === 'diego')
    expect(diegoVistoPeloBruno !== undefined && 'moedas' in diegoVistoPeloBruno).toBe(false)
  })
})

describe('Pagar: moedas a um colega encostado', () => {
  it('Diego paga 3 a Bruno: sai de um e entra no outro, na cena da Mansão', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'coins.give', toTokenId: 'bruno', moedas: 3 }, t.world)
    expect(r.outbound).toEqual([])
    t.aplicar(r)
    expect(t.ficha('diego')?.moedas).toBe(7)
    expect(t.ficha('bruno')?.moedas).toBe(8)
  })

  it('sem moeda bastante: "short"; longe: "far"; NPC ou ficha própria: "unavailable"', () => {
    const t = mesa()
    expect(t.s.handleMessage('c1', { type: 'coins.give', toTokenId: 'bruno', moedas: 11 }, t.world).outbound).toEqual([
      { clientId: 'c1', msg: { type: 'coins.give.rejected', reason: 'short' } },
    ])
    t.advance(1000)
    expect(t.s.handleMessage('c1', { type: 'coins.give', toTokenId: 'carla', moedas: 1 }, t.world).outbound).toEqual([
      { clientId: 'c1', msg: { type: 'coins.give.rejected', reason: 'far' } },
    ])
    t.advance(1000)
    const aoNpc = t.s.handleMessage('c1', { type: 'coins.give', toTokenId: 'zulmira', moedas: 1 }, t.world)
    expect(aoNpc.outbound).toEqual([{ clientId: 'c1', msg: { type: 'coins.give.rejected', reason: 'unavailable' } }])
    expect(aoNpc.applyItems).toBeUndefined()
  })
})

describe('Oferta do mestre', () => {
  it('SEGURANÇA: a oferta vai SÓ ao Bruno, sem cena, com o que ele tem para dar pelo nome', () => {
    const t = mesa()
    const r = t.s.proposeTrade(t.ids.Bruno ?? '', 'bruno', OFERTA, t.world)
    expect(r.offerId).toEqual(expect.any(String))
    expect(r.outbound).toEqual([
      {
        clientId: 'c2',
        msg: { type: 'trade.offer', offerId: r.offerId, tokenId: 'bruno', de: 'Zulmira', dou: { itens: ['Xarope'], moedas: 0 }, peco: { itens: [{ id: 'faca', nome: 'Faca de rede' }], moedas: 3 } },
      },
    ])
    expect(JSON.stringify(r.outbound)).not.toContain('Mansão')
    expect(JSON.stringify(r.outbound)).not.toContain('cena-mansao')
    expect(t.s.isTradePending(r.offerId ?? '')).toBe(true)
  })

  it('pedir o que ele não tem, a ficha de outro ou oferta vazia: não sai nada', () => {
    const t = mesa()
    expect(t.s.proposeTrade(t.ids.Bruno ?? '', 'bruno', { ...OFERTA, peco: { itemIds: ['espada'], moedas: 0 } }, t.world)).toEqual({ outbound: [], offerId: null, refusal: 'short' })
    expect(t.s.proposeTrade(t.ids.Bruno ?? '', 'bruno', { ...OFERTA, peco: { itemIds: [], moedas: 99 } }, t.world)).toEqual({ outbound: [], offerId: null, refusal: 'short' })
    expect(t.s.proposeTrade(t.ids.Bruno ?? '', 'diego', OFERTA, t.world)).toEqual({ outbound: [], offerId: null, refusal: 'unavailable' })
    expect(t.s.proposeTrade(t.ids.Bruno ?? '', 'bruno', { de: 'Z', dou: { itens: [], moedas: 0 }, peco: { itemIds: [], moedas: 0 } }, t.world)).toEqual({ outbound: [], offerId: null, refusal: 'unavailable' })
  })

  it('uma oferta por vez: a segunda espera a primeira acabar', () => {
    const t = mesa()
    ofertaAoBruno(t)
    expect(t.s.proposeTrade(t.ids.Bruno ?? '', 'bruno', OFERTA, t.world)).toEqual({ outbound: [], offerId: null, refusal: 'pending' })
  })

  it('Bruno aceita: a faca e 3 moedas saem, o Xarope entra, e o mestre fica sabendo', () => {
    const t = mesa()
    const offerId = ofertaAoBruno(t)
    const r = t.s.handleMessage('c2', { type: 'trade.answer', offerId, answer: 'accept' }, t.world)
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'trade.closed', offerId, result: 'done' } }])
    expect(r.tradeUpdate).toEqual({ offerId, playerName: 'Bruno', de: 'Zulmira', kind: 'accepted', oferta: 'Xarope', pedido: 'Faca de rede e 3 moedas' })
    t.aplicar(r)
    expect(t.ficha('bruno')?.moedas).toBe(2)
    expect(t.ficha('bruno')?.mochila?.map((i) => i.nome)).toEqual(['Vela', 'Xarope'])
    expect(t.s.isTradePending(offerId)).toBe(false)
  })

  it('Bruno recusa: nada muda e o mestre fica sabendo', () => {
    const t = mesa()
    const offerId = ofertaAoBruno(t)
    const r = t.s.handleMessage('c2', { type: 'trade.answer', offerId, answer: 'refuse' }, t.world)
    expect(r.applyItems).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'trade.closed', offerId, result: 'refused' } }])
    expect(r.tradeUpdate?.kind).toBe('refused')
    expect(t.s.isTradePending(offerId)).toBe(false)
  })

  it('SEGURANÇA: Diego não responde pela oferta do Bruno', () => {
    const t = mesa()
    const offerId = ofertaAoBruno(t)
    const r = t.s.handleMessage('c1', { type: 'trade.answer', offerId, answer: 'accept' }, t.world)
    expect(r.outbound).toEqual([])
    expect(r.applyItems).toBeUndefined()
    expect(t.s.isTradePending(offerId)).toBe(true)
  })

  it('Bruno contrapropõe a Vela e 1 moeda: o mestre lê e aceita; a troca vale com a contraproposta', () => {
    const t = mesa()
    const offerId = ofertaAoBruno(t)
    const r = t.s.handleMessage('c2', { type: 'trade.counter', offerId, itemIds: ['vela'], moedas: 1 }, t.world)
    expect(r.outbound).toEqual([])
    expect(r.applyItems).toBeUndefined()
    expect(r.tradeUpdate).toEqual({ offerId, playerName: 'Bruno', de: 'Zulmira', kind: 'countered', oferta: 'Xarope', pedido: 'Vela e 1 moeda' })
    expect(t.s.isTradePending(offerId)).toBe(true)
    const aceito = t.s.acceptTradeCounter(offerId, t.world)
    expect(aceito.outbound).toEqual([{ clientId: 'c2', msg: { type: 'trade.closed', offerId, result: 'done' } }])
    t.aplicar(aceito)
    expect(t.ficha('bruno')?.moedas).toBe(4)
    expect(t.ficha('bruno')?.mochila?.map((i) => i.nome)).toEqual(['Faca de rede', 'Xarope'])
    expect(t.s.isTradePending(offerId)).toBe(false)
  })

  it('o mestre recusa a contraproposta boa', () => {
    const t = mesa()
    const offerId = ofertaAoBruno(t)
    t.s.handleMessage('c2', { type: 'trade.counter', offerId, itemIds: [], moedas: 2 }, t.world)
    const r = t.s.refuseTradeCounter(offerId)
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'trade.closed', offerId, result: 'refused' } }])
    expect(r.applyItems).toBeUndefined()
    expect(t.s.isTradePending(offerId)).toBe(false)
  })

  it('o mestre desiste: Bruno lê que a oferta acabou; a queda da conexão também a encerra', () => {
    const t = mesa()
    const offerId = ofertaAoBruno(t)
    expect(t.s.cancelTrade(offerId).outbound).toEqual([{ clientId: 'c2', msg: { type: 'trade.closed', offerId, result: 'cancelled' } }])
    expect(t.s.isTradePending(offerId)).toBe(false)
    const outra = ofertaAoBruno(t)
    t.s.disconnect('c2')
    expect(t.s.isTradePending(outra)).toBe(false)
  })

  it('aceitar sem ter mais o que pagar: "unavailable" ao Bruno e o mestre lê que não deu', () => {
    const t = mesa()
    const offerId = ofertaAoBruno(t)
    // O mestre tirou a faca da mochila depois de propor.
    const [cena] = t.world.background
    if (cena === undefined) throw new Error('sem cena')
    const semFaca: HostWorld = {
      ...t.world,
      background: [{ ...cena, map: { ...cena.map, tokens: cena.map.tokens.map((tk) => (tk.id === 'bruno' ? { ...tk, mochila: [{ id: 'vela', nome: 'Vela' }] } : tk)) } }],
    }
    const r = t.s.handleMessage('c2', { type: 'trade.answer', offerId, answer: 'accept' }, semFaca)
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'trade.closed', offerId, result: 'unavailable' } }])
    expect(r.applyItems).toBeUndefined()
    expect(r.tradeUpdate?.kind).toBe('failed')
  })

  it('contraproposta que a ficha da oferta não paga: "unavailable" ao Bruno e o mestre lê que não deu', () => {
    const t = mesa()
    const offerId = ofertaAoBruno(t)
    const r = t.s.handleMessage('c2', { type: 'trade.counter', offerId, itemIds: ['espada'], moedas: 0 }, t.world)
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'trade.closed', offerId, result: 'unavailable' } }])
    expect(r.applyItems).toBeUndefined()
    expect(r.tradeUpdate).toEqual({ offerId, playerName: 'Bruno', de: 'Zulmira', kind: 'failed', oferta: 'Xarope', pedido: 'espada' })
    expect(t.s.isTradePending(offerId)).toBe(false)
  })

  it('Bruno com duas fichas contrapropõe com item da OUTRA: a troca fecha "unavailable", nada muda', () => {
    const cavalo = token('cavalo', 300, 200, { moedas: 20, mochila: [{ id: 'sela', nome: 'Sela' }] })
    const t = mesa(mansao([...mansao().tokens, cavalo]))
    t.s.assignToken(t.ids.Bruno ?? '', 'cavalo')
    const offerId = ofertaAoBruno(t)
    const r = t.s.handleMessage('c2', { type: 'trade.counter', offerId, itemIds: ['sela'], moedas: 0 }, t.world)
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'trade.closed', offerId, result: 'unavailable' } }])
    expect(r.applyItems).toBeUndefined()
    expect(r.tradeUpdate?.kind).toBe('failed')
    expect(t.s.isTradePending(offerId)).toBe(false)
  })

  it('a ficha da oferta saiu da cena antes da contraproposta: "unavailable", sem nome de cena', () => {
    const t = mesa()
    const offerId = ofertaAoBruno(t)
    const [cena] = t.world.background
    if (cena === undefined) throw new Error('sem cena')
    const semBruno: HostWorld = {
      ...t.world,
      background: [{ ...cena, map: { ...cena.map, tokens: cena.map.tokens.filter((tk) => tk.id !== 'bruno') } }],
    }
    const r = t.s.handleMessage('c2', { type: 'trade.counter', offerId, itemIds: ['vela'], moedas: 1 }, semBruno)
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'trade.closed', offerId, result: 'unavailable' } }])
    expect(r.tradeUpdate?.kind).toBe('failed')
    expect(JSON.stringify(r.outbound)).not.toContain('Mansão')
    expect(t.s.isTradePending(offerId)).toBe(false)
  })
})
