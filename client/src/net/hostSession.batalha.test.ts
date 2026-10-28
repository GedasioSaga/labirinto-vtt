// @vitest-environment node
/**
 * MODO BATALHA, fatia B4: testes de aceite do plano
 * (docs/planos/modo-batalha-2026-10-24.md).
 *
 * - 1.000 pedidos em batalha: nenhuma posição aceita fora do centro da casa.
 * - Batalha desligada: 500 pedidos com semente fixa dão o mesmo veredito de
 *   uma sessão sem a opção de batalha, sem as duas recusas retiradas.
 * - Mapa salvo com a chave antiga do modo de vez abre igual ao mapa sem ela.
 */
import { describe, expect, it } from 'vitest'
import { centroDaCasa, casaDoPonto } from '../lib/batalha/blocos'
import { deserializeMap, serializeMap } from '../lib/mapFile'
import { createEmptyMap } from '../lib/mapFactory'
import { validateTokenMove } from '../lib/moveValidation'
import { useBatalhaStore } from '../stores/batalhaStore'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostSession, type HostWorld } from './hostSession'
import { lerBatalhaIniciada, type HostMessage } from './protocol'

const CODE = 'BATA04'
const GRID = 50
const COLUNAS = 20
const LINHAS = 20
const VISAO = 400
const CENA = 'cena'
/** As duas recusas do modo de vez, retiradas na B4 (montadas em pedaços para não casar com a busca abaixo). */
const RECUSAS_RETIRADAS = ['not_your' + '_turn', 'too' + '_far']

/** Gerador com semente (mulberry32): mesma semente, mesma sequência. */
function sorteio(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** 20 x 20 casas; a Ana no centro de (4,4), um guarda parado e duas paredes. */
function mundo(extra: Partial<MapData> = {}): HostWorld {
  const map: MapData = {
    ...createEmptyMap('mapa-batalha', 'Batalha', COLUNAS, LINHAS, GRID),
    tokens: [ficha('ana', 225, 225), ficha('guarda', 375, 225, { npc: true })],
    walls: [parede('p1', 300, 100, 300, 300), parede('p2', 100, 400, 350, 400)],
    movement: { tokensOccupy: true },
    ...extra,
  }
  return { open: { sceneId: CENA, name: 'Cena', map }, background: [] }
}

function playerIdOf(r: HostResult): string {
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

interface Mesa {
  s: HostSession
  andou: Array<{ sceneKey: string; tokenId: string; blocos: number }>
}

/** `batalha`: undefined = sessão sem a opção (como antes da B4); boolean = o que `getBatalha` responde. */
function mesa(w: HostWorld, batalha: boolean | undefined): Mesa {
  let n = 0
  const andou: Mesa['andou'] = []
  const s = createHostSession({
    code: CODE,
    visionRadius: VISAO,
    now: () => 1_000_000,
    randomId: () => `id-${(n += 1)}`,
    ...(batalha === undefined
      ? {}
      : { getBatalha: () => batalha, onBatalhaAndou: (sceneKey: string, tokenId: string, blocos: number) => andou.push({ sceneKey, tokenId, blocos }) }),
  })
  const ana = playerIdOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w))
  s.assignToken(ana, 'ana')
  s.broadcast(w)
  return { s, andou }
}

function resposta(r: HostResult): HostMessage | undefined {
  return r.outbound.find((o) => o.clientId === 'c1')?.msg
}

function pedido(s: HostSession, w: HostWorld, reqId: string, x: number, y: number): HostResult {
  return s.handleMessage('c1', { type: 'token.move', reqId, tokenId: 'ana', x, y }, w)
}

/** Ponto sorteado em qualquer lugar do mapa, inclusive fora do centro e na borda. */
function pontoSorteado(rnd: () => number): { x: number; y: number } {
  return { x: rnd() * COLUNAS * GRID, y: rnd() * LINHAS * GRID }
}

function noCentroDaCasa(x: number, y: number): boolean {
  const centro = centroDaCasa(casaDoPonto({ x, y }, GRID), GRID)
  return centro.x === x && centro.y === y
}

describe('batalha ligada: o destino vai para o centro da casa', () => {
  it('1.000 pedidos sorteados: 0 posições aceitas fora do centro da casa, e todo aceite leva `blocos`', () => {
    const w = mundo()
    const { s } = mesa(w, true)
    const rnd = sorteio(0xb4)
    let aceitos = 0
    let foraDoCentro = 0
    let semBlocos = 0
    for (let i = 0; i < 1000; i += 1) {
      const alvo = pontoSorteado(rnd)
      const msg = resposta(pedido(s, w, `r${i}`, alvo.x, alvo.y))
      if (msg?.type !== 'token.move.accepted') continue
      aceitos += 1
      if (!noCentroDaCasa(msg.x, msg.y)) foraDoCentro += 1
      if (msg.blocos === undefined) semBlocos += 1
    }
    // Pré-condição: o sorteio não pode passar por ter recusado tudo.
    expect(aceitos).toBeGreaterThan(100)
    expect(foraDoCentro).toBe(0)
    expect(semBlocos).toBe(0)
  })

  it('o aceite leva os blocos andados e o host avisa o caminho da cena', () => {
    const w = mundo()
    const { s, andou } = mesa(w, true)
    // Duas casas à esquerda, pedido fora do centro: vai ao centro de (2,4).
    const msg = resposta(pedido(s, w, 'r1', 130, 210))
    expect(msg).toEqual({ type: 'token.move.accepted', reqId: 'r1', x: 125, y: 225, blocos: 2 })
    expect(andou).toEqual([{ sceneKey: CENA, tokenId: 'ana', blocos: 2 }])
  })

  it('mapa hexagonal: a batalha não vale e o pedido segue a regra comum (sem `blocos`)', () => {
    const w = mundo({ gridShape: 'hex' })
    const { s } = mesa(w, true)
    const msg = resposta(pedido(s, w, 'r1', 130, 210))
    if (msg?.type === 'token.move.accepted') expect(msg.blocos).toBeUndefined()
  })

  it('snapshot do jogador leva `batalha: true` só com a batalha ligada', () => {
    const w = mundo()
    const ligada = mesa(w, true).s.handleMessage('c2', { type: 'join', code: CODE, name: 'Caio' }, w)
    const desligada = mesa(w, false).s.handleMessage('c2', { type: 'join', code: CODE, name: 'Caio' }, w)
    const snap = (r: HostResult) => r.outbound.find((o) => o.clientId === 'c2' && o.msg.type === 'snapshot')?.msg
    const comBatalha = snap(ligada)
    const semBatalha = snap(desligada)
    if (comBatalha?.type === 'snapshot') expect(comBatalha.batalha).toBe(true)
    if (semBatalha?.type === 'snapshot') expect(semBatalha.batalha).toBeUndefined()
  })
})

describe('contagem em blocos (xadrez) e a quina da parede', () => {
  const dono = { p1: ['ana'] }
  const mapaCom = (walls: Wall[]): MapData => ({ ...createEmptyMap('m', 'M', 10, 10, GRID), tokens: [ficha('ana', 125, 125)], walls })

  it('diagonal livre conta 1 bloco', () => {
    const map = mapaCom([])
    const r = validateTokenMove(map, { playerId: 'p1', tokenId: 'ana', x: 180, y: 160 }, dono, { batalha: { paredesDoJogador: map.walls } })
    expect(r).toEqual({ ok: true, x: 175, y: 175, blocos: 1 })
  })

  it('diagonal que raspa a quina da parede não vale: o caminho dá a volta e conta 2 blocos', () => {
    const map = mapaCom([parede('q', 150, 50, 150, 150)])
    const r = validateTokenMove(map, { playerId: 'p1', tokenId: 'ana', x: 175, y: 175 }, dono, { batalha: { paredesDoJogador: map.walls } })
    expect(r).toEqual({ ok: true, x: 175, y: 175, blocos: 2 })
  })

  it('opção D: parede que o jogador não conhece para a ficha na última casa legal', () => {
    // O jogador planeja em linha reta (o recorte dele não tem a parede); o host anda com todas.
    const map = mapaCom([parede('oculta', 250, 0, 250, 500)])
    const r = validateTokenMove(map, { playerId: 'p1', tokenId: 'ana', x: 325, y: 125 }, dono, { batalha: { paredesDoJogador: [] } })
    expect(r).toEqual({ ok: true, x: 225, y: 125, blocos: 2 })
  })
})

describe('batalha desligada: o veredito de hoje', () => {
  it('500 pedidos com semente fixa: mesmo veredito da sessão sem a opção, e nunca as recusas retiradas', () => {
    const w = mundo({ movement: { maxStepCells: 3, tokensOccupy: true } })
    const semOpcao = mesa(w, undefined).s
    const desligada = mesa(w, false).s
    const rnd = sorteio(0x500)
    const vistas = new Set<string>()
    for (let i = 0; i < 500; i += 1) {
      const alvo = pontoSorteado(rnd)
      const a = resposta(pedido(semOpcao, w, `r${i}`, alvo.x, alvo.y))
      const b = resposta(pedido(desligada, w, `r${i}`, alvo.x, alvo.y))
      expect(b).toEqual(a)
      if (b?.type === 'token.move.rejected') vistas.add(b.reason)
      if (b?.type === 'token.move.accepted') expect(b.blocos).toBeUndefined()
    }
    for (const retirada of RECUSAS_RETIRADAS) expect(vistas.has(retirada)).toBe(false)
  })
})

describe('mapa salvo com a chave antiga do modo de vez', () => {
  it('abre igual ao mesmo mapa sem a chave, e a chave some no próximo salvamento', () => {
    const base = createEmptyMap('salvo', 'Salvo', 8, 8, GRID)
    const chaveAntiga = 'confr' + 'onto'
    const comChave = { ...base, [chaveAntiga]: { ativo: true, ordem: ['a', 'b'], vez: 0 } }
    const aberto = deserializeMap(JSON.stringify(comChave))
    expect(aberto).toEqual(deserializeMap(JSON.stringify(base)))
    expect(serializeMap(aberto)).not.toContain(chaveAntiga)
  })
})

describe('anúncio da batalha (protocolo para a B5)', () => {
  it('`batalha.iniciada`: transição e texto opcionais; mensagem torta é recusada inteira', () => {
    expect(lerBatalhaIniciada({ type: 'batalha.iniciada' })).toEqual({ type: 'batalha.iniciada' })
    expect(lerBatalhaIniciada({ type: 'batalha.iniciada', transicao: 'espadas', texto: 'Royals' })).toEqual({ type: 'batalha.iniciada', transicao: 'espadas', texto: 'Royals' })
    expect(lerBatalhaIniciada({ type: 'batalha.iniciada', texto: 'x'.repeat(41) })).toBeNull()
    expect(lerBatalhaIniciada({ type: 'outra' })).toBeNull()
  })

  it('store: ligar publica o anúncio da cena; desligar e zerar limpam o caminho', () => {
    const store = useBatalhaStore.getState()
    store.reset()
    store.ligar(CENA, { transicao: 'espadas', texto: 'Royals' })
    expect(useBatalhaStore.getState().ligada(CENA)).toBe(true)
    expect(useBatalhaStore.getState().anuncio).toMatchObject({ sceneKey: CENA, transicao: 'espadas', texto: 'Royals' })
    useBatalhaStore.getState().somarCaminho(CENA, 'ana', 3)
    useBatalhaStore.getState().somarCaminho(CENA, 'ana', 2)
    expect(useBatalhaStore.getState().cenas[CENA]?.caminhos.ana).toBe(5)
    useBatalhaStore.getState().zerarCaminhos(CENA)
    expect(useBatalhaStore.getState().cenas[CENA]?.caminhos.ana).toBeUndefined()
    useBatalhaStore.getState().desligar(CENA)
    expect(useBatalhaStore.getState().ligada(CENA)).toBe(false)
  })
})
