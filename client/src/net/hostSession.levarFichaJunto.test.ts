/**
 * LEVAR FICHA JUNTO na sessão do mestre: a Ana leva o ferido (vínculo que o
 * mestre pôs na ficha dele). O arrasto dela o leva junto, o pino de viagem o
 * leva junto, e NADA do vínculo chega à tela de quem joga — nem o campo, nem
 * o ferido que o mestre escondeu.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap, setTokenPosition } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const GRID = 50
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino']): Pin {
  return { id, x, y, kind: 'viagem', description: '', image: null, destino, passagem: 'livre' }
}

function mundo(ferido: Partial<Token> = {}, salaoExtra: Partial<MapData> = {}): HostWorld {
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Salão Nobre', 40, 10, GRID),
    tokens: [ficha('ana', 225, 225), ficha('ferido', 275, 225, { levadoPor: 'ana', ...ferido }), ficha('npc', 225, 325)],
    pins: [viagem('escada', 425, 225, { sceneId: CRIPTA, pinId: 'escada-b' })],
    ...salaoExtra,
  }
  const cripta: MapData = {
    ...createEmptyMap('mapa-cripta', 'Cripta Rubra', 40, 10, GRID),
    pins: [viagem('escada-b', 1025, 275, { sceneId: SALAO, pinId: 'escada' })],
  }
  return {
    open: { sceneId: SALAO, name: 'Salão Nobre', map: salao },
    background: [{ sceneId: CRIPTA, name: 'Cripta Rubra', map: cripta }],
  }
}

function playerIdOf(r: HostResult): string {
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function mesa(w: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000_000, randomId: () => `id-${(n += 1)}` })
  const ana = playerIdOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w))
  s.assignToken(ana, 'ana')
  return { s, ana }
}

function snapshotTokens(msg: HostMessage | undefined): Token[] {
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot')
  return msg.map.tokens
}

describe('hostSession: a Ana arrasta e o ferido vem junto', () => {
  it('o integrador aplica o movimento dela e o ferido anda o mesmo tanto', () => {
    const w = mundo()
    const { s } = mesa(w)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'ana', x: 225, y: 125 }, w)
    expect(r.applyMove).toEqual({ tokenId: 'ana', x: 225, y: 125 })
    if (r.applyMove === undefined) throw new Error('o movimento deveria valer')
    const depois = setTokenPosition(w.open.map, r.applyMove.tokenId, r.applyMove.x, r.applyMove.y)
    expect(depois.tokens.find((t) => t.id === 'ferido')).toMatchObject({ x: 275, y: 125 })
  })

  it('parede em cima do ferido: o passo dela vale, e aplicado ele NÃO atravessa a parede', () => {
    const parede = { id: 'parede', x1: 250, y1: 200, x2: 400, y2: 200, blocksLight: true, blocksMove: true, door: null }
    const w = mundo({}, { walls: [parede] })
    const { s } = mesa(w)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'ana', x: 225, y: 125 }, w)
    expect(r.applyMove).toEqual({ tokenId: 'ana', x: 225, y: 125 })
    if (r.applyMove === undefined) throw new Error('o movimento deveria valer')
    const depois = setTokenPosition(w.open.map, r.applyMove.tokenId, r.applyMove.x, r.applyMove.y)
    expect(depois.tokens.find((t) => t.id === 'ferido')).toMatchObject({ x: 275, y: 225 })
  })

  it('"Fichas ocupam espaço": o ferido que ela leva não barra o passo dela', () => {
    const w = mundo({}, { movement: { tokensOccupy: true } })
    const { s } = mesa(w)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'ana', x: 275, y: 225 }, w)
    expect(r.outbound[0]?.msg).toEqual({ type: 'token.move.accepted', reqId: 'r1', x: 275, y: 225 })
    // Controle: o NPC, que ela NÃO leva, continua barrando.
    const barrado = s.handleMessage('c1', { type: 'token.move', reqId: 'r2', tokenId: 'ana', x: 225, y: 325 }, w)
    expect(barrado.outbound[0]?.msg).toEqual({ type: 'token.move.rejected', reqId: 'r2', reason: 'occupied' })
  })
})

describe('hostSession: o ferido atravessa o pino junto', () => {
  it('pino livre: a transferência leva o ferido, colado à chegada dela, e deixa o NPC', () => {
    const w = mundo()
    const { s } = mesa(w)
    const r = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada' }, w)
    const transfer = r.applyTransfer
    if (transfer === undefined) throw new Error('a passagem livre deveria valer')
    expect(transfer).toMatchObject({ tokenId: 'ana', fromSceneId: SALAO, toSceneId: CRIPTA })
    expect(transfer.junto?.map((j) => j.tokenId)).toEqual(['ferido'])
    const [ferido] = transfer.junto ?? []
    expect(ferido.x === transfer.x && ferido.y === transfer.y).toBe(false)
    expect(Math.hypot(ferido.x - transfer.x, ferido.y - transfer.y)).toBeLessThanOrEqual(GRID * Math.SQRT2 + 0.01)
  })

  it('"Mandar para…" do mestre também leva o ferido', () => {
    const w = mundo()
    const { s, ana } = mesa(w)
    s.broadcast(w)
    const r = s.sendPlayer(ana, CRIPTA, 'escada-b', w)
    expect(r.applyTransfer?.junto?.map((j) => j.tokenId)).toEqual(['ferido'])
  })

  it('sem ninguém levado, a transferência não ganha o campo (o formato de antes)', () => {
    const w = mundo({ levadoPor: undefined })
    const { s } = mesa(w)
    const r = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada' }, w)
    expect(r.applyTransfer).toBeDefined()
    expect(r.applyTransfer !== undefined && 'junto' in r.applyTransfer).toBe(false)
  })

  it('o ferido é a ficha da Bia: ela é avisada de que o mestre a levou', () => {
    const w = mundo()
    const { s } = mesa(w)
    const bia = playerIdOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, w))
    s.assignToken(bia, 'ferido')
    const r = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada' }, w)
    expect(r.outbound).toContainEqual({ clientId: 'c1', msg: { type: 'scene.changed' } })
    expect(r.outbound).toContainEqual({ clientId: 'c2', msg: { type: 'scene.changed', by: 'master' } })
  })

  it('a Bia levada também CHEGA: lê o texto de chegada da cena, e quem ficou para trás não lê nada', () => {
    const base = mundo()
    const w: HostWorld = { ...base, background: base.background.map((b) => ({ ...b, map: { ...b.map, textoChegada: 'Cheiro de enxofre.' } })) }
    const { s } = mesa(w)
    const bia = playerIdOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, w))
    s.assignToken(bia, 'ferido')
    const caio = playerIdOf(s.handleMessage('c3', { type: 'join', code: CODE, name: 'Caio' }, w))
    s.assignToken(caio, 'npc')
    const r = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada' }, w)
    expect(r.outbound).toContainEqual({ clientId: 'c1', msg: { type: 'scene.changed', chegada: 'Cheiro de enxofre.' } })
    expect(r.outbound).toContainEqual({ clientId: 'c2', msg: { type: 'scene.changed', by: 'master', chegada: 'Cheiro de enxofre.' } })
    expect(r.outbound.filter((o) => o.clientId === 'c3')).toEqual([])
  })
})

describe('hostSession: o vínculo nunca chega a quem joga', () => {
  it('o snapshot manda o ferido à vista SEM o campo do vínculo', () => {
    const w = mundo()
    const { s } = mesa(w)
    const tokens = snapshotTokens(s.broadcast(w).outbound[0]?.msg)
    expect(tokens.map((t) => t.id).sort()).toEqual(['ana', 'ferido', 'npc'])
    for (const t of tokens) expect('levadoPor' in t).toBe(false)
    expect(JSON.stringify(tokens)).not.toContain('levadoPor')
  })

  it('ferido oculto pelo mestre: anda junto no mapa do mestre e continua fora do recorte', () => {
    const w = mundo({ hidden: true })
    const { s } = mesa(w)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'ana', x: 225, y: 125 }, w)
    if (r.applyMove === undefined) throw new Error('o movimento deveria valer')
    const depois: HostWorld = { ...w, open: { ...w.open, map: setTokenPosition(w.open.map, 'ana', 225, 125) } }
    expect(depois.open.map.tokens.find((t) => t.id === 'ferido')).toMatchObject({ x: 275, y: 125 })
    const enviado = s.broadcast(depois).outbound[0]?.msg
    expect(snapshotTokens(enviado).map((t) => t.id).sort()).toEqual(['ana', 'npc'])
    expect(JSON.stringify(enviado)).not.toContain('ferido')
  })

  it('a resposta ao jogador na passagem não carrega nada do ferido', () => {
    const w = mundo()
    const { s } = mesa(w)
    const r = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada' }, w)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed' } }])
    expect(JSON.stringify(r.outbound)).not.toContain('ferido')
  })
})
