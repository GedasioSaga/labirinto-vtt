import { describe, expect, it } from 'vitest'
import { applyItemChange } from '../lib/items'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, PEDIDO_LOJA_MIN_INTERVAL_MS, type HostResult, type HostWorld } from './hostSession'
import { parsePlayerMessage, type HostMessage } from './protocol'

/**
 * LOJA COM PREÇOS pela rede. O jogador toca "Quero" numa mercadoria
 * (`pin.buy`); o host confere que a banca está no recorte DELE agora, que a
 * mercadoria existe e não acabou e que uma ficha dele está na banca — e só
 * então o pedido chega ao mestre (`purchaseRequest`). O mestre vende (o
 * estoque cai e a mercadoria vai à mochila de quem comprou) ou não. Banca que
 * o jogador não vê responde o mesmo "indisponível" de mercadoria inventada:
 * ninguém descobre o que existe no escuro.
 */

const CODE = 'LOJA01'
const GRID = 40
const RAIO = 700

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function botica(extra: Partial<Pin> = {}): Pin {
  return {
    id: 'botica',
    x: 200,
    y: 200,
    kind: 'exclamacao',
    description: 'Botica de Zulmira',
    image: null,
    loja: [
      { id: 'xarope', nome: 'Xarope de tosse', preco: '1 moeda', estoque: 3 },
      { id: 'atadura', nome: 'Atadura', preco: '2 moedas', estoque: 0 },
      { id: 'chave', nome: 'Chave-mestra', preco: '40 moedas' },
    ],
    ...extra,
  }
}

/** Ana encostada na banca; Bia longe dela, no mesmo mercado. */
function mercado(pins: Pin[] = [botica()], tokens?: Token[]): MapData {
  return {
    ...createEmptyMap('mapa-mercado', 'Mercado', 1000, 1000, GRID),
    pins,
    tokens: tokens ?? [ficha('ana', 180, 200, { mochila: [{ id: 'faca', nome: 'Faca' }] }), ficha('bia', 600, 200)],
  }
}

function sequentialIds(): () => string {
  let n = 0
  return () => {
    n += 1
    return `id-${n}`
  }
}

/** Ana (c1) e Bia (c2) jogando no Mercado, cena de FUNDO; o Salão está aberto no editor. */
function mesa(map: MapData = mercado(), extraBackground: HostWorld['background'] = []) {
  let clock = 0
  const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => clock, randomId: sequentialIds() })
  let world: HostWorld = {
    open: { sceneId: 'cena-salao', name: 'Salão', map: createEmptyMap('mapa-salao', 'Salão', 1000, 1000, GRID) },
    background: [{ sceneId: 'cena-mercado', name: 'Mercado', map }, ...extraBackground],
  }
  const ids: Record<string, string> = {}
  for (const [clientId, nome, fichaId] of [
    ['c1', 'Ana', 'ana'],
    ['c2', 'Bia', 'bia'],
  ] as const) {
    const joined = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, world).outbound[0]?.msg
    if (joined?.type !== 'welcome') throw new Error('esperava welcome')
    ids[nome] = joined.playerId
    s.assignToken(joined.playerId, fichaId)
  }
  s.broadcast(world)
  return {
    s,
    ids,
    get world() {
      return world
    },
    quero: (itemId: string, clientId = 'c1', pinId = 'botica') => s.handleMessage(clientId, { type: 'pin.buy', pinId, itemId }, world),
    /** O que o integrador faz: aplica a mudança na cena do Mercado. */
    aplicar(result: HostResult) {
      const change = result.applyItems
      if (change === undefined) throw new Error('esperava applyItems')
      expect(change.sceneId).toBe('cena-mercado')
      const [cena, ...resto] = world.background
      if (cena === undefined) throw new Error('sem cena')
      world = { ...world, background: [{ ...cena, map: applyItemChange(cena.map, change) }, ...resto] }
    },
    advance: (ms: number) => void (clock += ms),
  }
}

function para(r: HostResult, clientId: string): HostMessage | undefined {
  return r.outbound.find((o) => o.clientId === clientId)?.msg
}

function snapshotFor(result: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = para(result, clientId)
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

describe('protocolo: pin.buy', () => {
  it('aceita pino e mercadoria curtos e devolve só os campos conhecidos', () => {
    expect(parsePlayerMessage({ type: 'pin.buy', pinId: 'botica', itemId: 'xarope', preco: '0 moedas' })).toEqual({ type: 'pin.buy', pinId: 'botica', itemId: 'xarope' })
  })

  it('recusa pino ou mercadoria vazios, longos demais ou que não são texto', () => {
    expect(parsePlayerMessage({ type: 'pin.buy', pinId: '', itemId: 'xarope' })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.buy', pinId: 'botica', itemId: '' })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.buy', pinId: 'botica', itemId: 'x'.repeat(65) })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.buy', pinId: 'botica', itemId: 7 })).toBeNull()
  })
})

describe('recorte: a banca no snapshot', () => {
  it('o snapshot leva as mercadorias da banca que o jogador vê', () => {
    const t = mesa()
    const pin = snapshotFor(t.s.broadcast(t.world), 'c1').map.pins.find((p) => p.id === 'botica')
    expect(pin?.loja?.map((i) => i.nome)).toEqual(['Xarope de tosse', 'Atadura', 'Chave-mestra'])
  })

  it('SEGURANÇA: banca oculta para jogadores — o snapshot não leva nem o nome de uma mercadoria', () => {
    const t = mesa(mercado([botica({ secret: true })]))
    const snap = snapshotFor(t.s.broadcast(t.world), 'c1')
    expect(snap.map.pins).toEqual([])
    expect(JSON.stringify(snap)).not.toContain('Xarope')
    expect(JSON.stringify(snap)).not.toContain('Chave-mestra')
  })
})

describe('hostSession: "Quero"', () => {
  it('o pedido chega ao mestre com quem, o quê, o preço, a banca e a cena de fundo; ao jogador não sai nada ainda', () => {
    const t = mesa()
    const r = t.quero('xarope')
    expect(r.outbound).toEqual([])
    expect(r.purchaseRequest).toEqual({
      requestId: expect.any(String),
      playerId: t.ids.Ana,
      playerName: 'Ana',
      pinLabel: 'Botica de Zulmira',
      itemName: 'Xarope de tosse',
      preco: '1 moeda',
      sceneName: 'Mercado',
    })
    expect(t.s.isPurchasePending(r.purchaseRequest?.requestId ?? '')).toBe(true)
  })

  it('mercadoria sem conta de estoque também pode ser pedida', () => {
    const t = mesa()
    expect(t.quero('chave').purchaseRequest?.itemName).toBe('Chave-mestra')
  })

  it('mercadoria que acabou, ou inventada: "indisponível", e nada chega ao mestre', () => {
    const t = mesa()
    const acabou = t.quero('atadura')
    expect(para(acabou, 'c1')).toEqual({ type: 'pin.buy.rejected', reason: 'unavailable' })
    expect(acabou.purchaseRequest).toBeUndefined()
    t.advance(PEDIDO_LOJA_MIN_INTERVAL_MS)
    const inventada = t.quero('espada-lendaria')
    expect(para(inventada, 'c1')).toEqual({ type: 'pin.buy.rejected', reason: 'unavailable' })
    expect(inventada.purchaseRequest).toBeUndefined()
  })

  it('ficha longe da banca: "chegue mais perto", e nada chega ao mestre', () => {
    const t = mesa()
    const r = t.quero('xarope', 'c2')
    expect(para(r, 'c2')).toEqual({ type: 'pin.buy.rejected', reason: 'far' })
    expect(r.purchaseRequest).toBeUndefined()
  })

  it('SEGURANÇA: banca oculta, no escuro ou em outra cena — a mesma recusa genérica, sem nome de cena, e nada chega ao mestre', () => {
    const oculta = mesa(mercado([botica({ secret: true })]))
    const r1 = oculta.quero('xarope')
    expect(para(r1, 'c1')).toEqual({ type: 'pin.buy.rejected', reason: 'unavailable' })
    expect(r1.purchaseRequest).toBeUndefined()

    const escuro = mesa(mercado([botica({ x: 990, y: 990 })], [ficha('ana', 20, 20), ficha('bia', 40, 20)]))
    const r2 = escuro.quero('xarope')
    expect(para(r2, 'c1')).toEqual({ type: 'pin.buy.rejected', reason: 'unavailable' })
    expect(r2.purchaseRequest).toBeUndefined()

    // A banca mora na cripta; a Ana está no mercado, sem banca nenhuma.
    const cripta = { sceneId: 'cena-cripta', name: 'Cripta Proibida', map: { ...createEmptyMap('mapa-cripta', 'Cripta Proibida', 1000, 1000, GRID), pins: [botica()] } }
    const outraCena = mesa(mercado([]), [cripta])
    const r3 = outraCena.quero('xarope')
    expect(para(r3, 'c1')).toEqual({ type: 'pin.buy.rejected', reason: 'unavailable' })
    expect(r3.purchaseRequest).toBeUndefined()
    expect(JSON.stringify(r3)).not.toContain('Cripta')
    expect(JSON.stringify(r3)).not.toContain('Chave-mestra')
  })

  it('SEGURANÇA: "Quem vê" só a Bia — a Ana, na banca, lê "indisponível"', () => {
    const t = mesa()
    t.s.setPinAudience('botica', [t.ids.Bia ?? ''])
    const r = t.quero('xarope')
    expect(para(r, 'c1')).toEqual({ type: 'pin.buy.rejected', reason: 'unavailable' })
    expect(r.purchaseRequest).toBeUndefined()
  })

  it('um pedido por vez: o segundo, com o primeiro esperando o mestre, é "pending"', () => {
    const t = mesa()
    t.quero('xarope')
    t.advance(PEDIDO_LOJA_MIN_INTERVAL_MS)
    const r = t.quero('chave')
    expect(para(r, 'c1')).toEqual({ type: 'pin.buy.rejected', reason: 'pending' })
    expect(r.purchaseRequest).toBeUndefined()
  })

  it('pedir de novo antes do intervalo: "too_soon", e nada chega ao mestre', () => {
    const t = mesa()
    const primeiro = t.quero('atadura')
    expect(para(primeiro, 'c1')).toEqual({ type: 'pin.buy.rejected', reason: 'unavailable' })
    const r = t.quero('xarope')
    expect(para(r, 'c1')).toEqual({ type: 'pin.buy.rejected', reason: 'too_soon' })
    expect(r.purchaseRequest).toBeUndefined()
    t.advance(PEDIDO_LOJA_MIN_INTERVAL_MS)
    expect(t.quero('xarope').purchaseRequest?.itemName).toBe('Xarope de tosse')
  })
})

describe('hostSession: a resposta do mestre', () => {
  it('"Vender": a Ana lê que comprou; o estoque cai um e o xarope entra na mochila dela, na cena da banca', () => {
    const t = mesa()
    const pedido = t.quero('xarope').purchaseRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    const r = t.s.approvePurchase(pedido.requestId, t.world)
    expect(para(r, 'c1')).toEqual({ type: 'pin.buy.answer', answer: 'sold', nome: 'Xarope de tosse' })
    expect(r.applyItems).toEqual({
      sceneId: 'cena-mercado',
      venda: { pinId: 'botica', itemId: 'xarope' },
      mochilas: [{ tokenId: 'ana', mochila: [{ id: 'faca', nome: 'Faca' }, { id: expect.any(String), nome: 'Xarope de tosse' }] }],
    })
    // O id novo não repete o de nada que já está na mochila.
    expect(r.applyItems?.mochilas[0]?.mochila[1]?.id).not.toBe('faca')
    t.aplicar(r)
    const snap = snapshotFor(t.s.broadcast(t.world), 'c1')
    expect(snap.map.pins[0]?.loja?.[0]?.estoque).toBe(2)
    expect(snap.map.tokens.find((tk) => tk.id === 'ana')?.mochila?.map((i) => i.nome)).toEqual(['Faca', 'Xarope de tosse'])
    // Já respondido: responder de novo não faz nada.
    expect(t.s.approvePurchase(pedido.requestId, t.world)).toEqual({ outbound: [] })
    expect(t.s.isPurchasePending(pedido.requestId)).toBe(false)
  })

  it('SEGURANÇA: a Bia não recebe a mochila da Ana depois da venda', () => {
    const t = mesa()
    const pedido = t.quero('xarope').purchaseRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    t.aplicar(t.s.approvePurchase(pedido.requestId, t.world))
    const bia = snapshotFor(t.s.broadcast(t.world), 'c2')
    expect(JSON.stringify(bia)).not.toContain('"mochila"')
  })

  it('"Não": a Ana lê que o mestre não vendeu, e nada muda', () => {
    const t = mesa()
    const pedido = t.quero('xarope').purchaseRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    const r = t.s.denyPurchase(pedido.requestId)
    expect(r).toEqual({ outbound: [{ clientId: 'c1', msg: { type: 'pin.buy.answer', answer: 'denied' } }] })
    expect(t.s.isPurchasePending(pedido.requestId)).toBe(false)
  })

  it('"Vender" depois que a mercadoria acabou (o mestre mexeu no estoque): "indisponível", sem venda', () => {
    const t = mesa()
    const pedido = t.quero('xarope').purchaseRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    const esgotado = mercado([botica({ loja: [{ id: 'xarope', nome: 'Xarope de tosse', preco: '1 moeda', estoque: 0 }] })])
    const mundo: HostWorld = { ...t.world, background: [{ sceneId: 'cena-mercado', name: 'Mercado', map: esgotado }] }
    const r = t.s.approvePurchase(pedido.requestId, mundo)
    expect(r).toEqual({ outbound: [{ clientId: 'c1', msg: { type: 'pin.buy.rejected', reason: 'unavailable' } }] })
  })

  it('pedido de quem caiu some: "Vender" depois não manda nada nem muda o mapa', () => {
    const t = mesa()
    const pedido = t.quero('xarope').purchaseRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    t.s.disconnect('c1')
    expect(t.s.isPurchasePending(pedido.requestId)).toBe(false)
    expect(t.s.approvePurchase(pedido.requestId, t.world)).toEqual({ outbound: [] })
  })

  it('pedido de quem foi expulso some', () => {
    const t = mesa()
    const pedido = t.quero('xarope').purchaseRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    t.s.kick('c1')
    expect(t.s.isPurchasePending(pedido.requestId)).toBe(false)
    expect(t.s.denyPurchase(pedido.requestId)).toEqual({ outbound: [] })
  })
})
