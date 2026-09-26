/**
 * LEVAR FICHA JUNTO quando a ficha levada é de uma jogadora com MAIS de uma
 * ficha: a Bia é dona da 'bia' e do 'familiar'; o mestre prendeu o familiar à
 * Ana. A travessia da Ana leva o familiar, mas só leva a Bia (a cena dela, o
 * aviso, o pedido de passagem dela) se ela estava na cena de origem e não
 * deixa ficha lá. Quem ficou para trás continua mandando na própria ficha.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, PinPassage, Token } from '../types/map'
import type { AppliedTransfer, HostResult, HostWorld } from './hostSession'
import { createHostSession } from './hostSession'

const CODE = 'AB12CD'
const GRID = 50
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino'], passagem: PinPassage): Pin {
  return { id, x, y, kind: 'viagem', description: '', image: null, destino, passagem }
}

/** Salão com a escada livre para a Cripta; a escada da Cripta PEDE ao mestre. */
function mundo(noSalao: Token[], naCripta: Token[]): HostWorld {
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Salão Nobre', 40, 10, GRID),
    tokens: noSalao,
    // A escada encostada na Ana (50 px): o pino de viagem só atravessa de perto.
    pins: [viagem('escada', 175, 225, { sceneId: CRIPTA, pinId: 'escada-b' }, 'livre')],
  }
  const cripta: MapData = {
    ...createEmptyMap('mapa-cripta', 'Cripta Rubra', 40, 10, GRID),
    tokens: naCripta,
    pins: [viagem('escada-b', 1025, 275, { sceneId: SALAO, pinId: 'escada' }, 'pede')],
  }
  return {
    open: { sceneId: SALAO, name: 'Salão Nobre', map: salao },
    background: [{ sceneId: CRIPTA, name: 'Cripta Rubra', map: cripta }],
  }
}

/** O que o integrador faz com a transferência: quem leva e as levadas saem do Salão e assentam na Cripta. */
function aplica(w: HostWorld, transfer: AppliedTransfer): HostWorld {
  const destinos = new Map<string, { x: number; y: number }>([[transfer.tokenId, { x: transfer.x, y: transfer.y }]])
  for (const levada of transfer.junto ?? []) destinos.set(levada.tokenId, { x: levada.x, y: levada.y })
  const vao = w.open.map.tokens.flatMap((t) => {
    const destino = destinos.get(t.id)
    return destino === undefined ? [] : [{ ...t, ...destino }]
  })
  const [fundo] = w.background
  return {
    open: { ...w.open, map: { ...w.open.map, tokens: w.open.map.tokens.filter((t) => !destinos.has(t.id)) } },
    background: [{ ...fundo, map: { ...fundo.map, tokens: [...fundo.map.tokens, ...vao] } }],
  }
}

function playerIdOf(r: HostResult): string {
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

/** Ana (c1) e Bia (c2) na mesa; a Ana é dona da 'ana'. As fichas da Bia ficam com quem chama. */
function mesa(w: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000_000, randomId: () => `id-${(n += 1)}` })
  const ana = playerIdOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w))
  const bia = playerIdOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, w))
  s.assignToken(ana, 'ana')
  return { s, bia }
}

/** A Ana passa pela escada livre; devolve a resposta e o mundo com a transferência aplicada. */
function anaAtravessa(s: ReturnType<typeof createHostSession>, w: HostWorld): { r: HostResult; w: HostWorld } {
  const r = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada' }, w)
  if (r.applyTransfer === undefined) throw new Error('a passagem livre deveria valer')
  return { r, w: aplica(w, r.applyTransfer) }
}

const paraBia = (r: HostResult) => r.outbound.filter((o) => o.clientId === 'c2')
const infoDaBia = (s: ReturnType<typeof createHostSession>, bia: string, w: HostWorld) => s.listPlayers(w).find((p) => p.playerId === bia)

describe('levar ficha junto: a dona do familiar tem outra ficha', () => {
  it('a ficha principal da Bia fica no Salão: o familiar vai, a Bia fica e ainda move a própria ficha', () => {
    const w = mundo([ficha('ana', 225, 225), ficha('familiar', 275, 225, { levadoPor: 'ana' }), ficha('bia', 325, 325)], [])
    const { s, bia } = mesa(w)
    s.assignToken(bia, 'bia')
    s.assignToken(bia, 'familiar')
    s.broadcast(w)

    const passou = anaAtravessa(s, w)
    expect(passou.r.applyTransfer?.junto?.map((j) => j.tokenId)).toEqual(['familiar'])
    // Não foi a Bia que o mestre levou: nenhum aviso de troca de cena para ela.
    expect(paraBia(passou.r)).toEqual([])
    expect(infoDaBia(s, bia, passou.w)?.sceneId).toBe(SALAO)

    const passo = s.handleMessage('c2', { type: 'token.move', reqId: 'r1', tokenId: 'bia', x: 325, y: 275 }, passou.w)
    expect(passo.outbound[0]?.msg).toEqual({ type: 'token.move.accepted', reqId: 'r1', x: 325, y: 275 })
    expect(passo.applyMove).toEqual({ tokenId: 'bia', x: 325, y: 275 })
  })

  it('a Bia está na Cripta com a ficha principal: o pedido de passagem dela lá continua de pé', () => {
    const w = mundo([ficha('ana', 225, 225), ficha('familiar', 275, 225, { levadoPor: 'ana' })], [ficha('bia', 975, 275)])
    const { s, bia } = mesa(w)
    // Primeiro a ficha da Cripta: é lá que ela está quando ganha o familiar.
    s.assignToken(bia, 'bia')
    s.broadcast(w)
    s.assignToken(bia, 'familiar')
    s.broadcast(w)
    expect(infoDaBia(s, bia, w)?.sceneId).toBe(CRIPTA)
    const pedido = s.handleMessage('c2', { type: 'pin.travel.request', pinId: 'escada-b' }, w)
    const requestId = pedido.travelRequest?.requestId
    if (requestId === undefined) throw new Error('a escada da Cripta deveria virar pedido ao mestre')

    const passou = anaAtravessa(s, w)
    expect(passou.r.applyTransfer?.junto?.map((j) => j.tokenId)).toEqual(['familiar'])
    expect(paraBia(passou.r)).toEqual([])
    const depois = infoDaBia(s, bia, passou.w)
    expect(depois?.travelPending).toBe(true)
    expect(depois?.sceneId).toBe(CRIPTA)
    expect(s.isTravelPending(requestId)).toBe(true)
  })

  it('as duas fichas da Bia vão com a Ana: aí ela é levada, com um aviso só', () => {
    const w = mundo(
      [ficha('ana', 225, 225), ficha('familiar', 275, 225, { levadoPor: 'ana' }), ficha('bia', 225, 275, { levadoPor: 'ana' })],
      [],
    )
    const { s, bia } = mesa(w)
    s.assignToken(bia, 'bia')
    s.assignToken(bia, 'familiar')
    s.broadcast(w)

    const passou = anaAtravessa(s, w)
    expect(passou.r.applyTransfer?.junto?.map((j) => j.tokenId).sort()).toEqual(['bia', 'familiar'])
    expect(paraBia(passou.r)).toEqual([{ clientId: 'c2', msg: { type: 'scene.changed', by: 'master' } }])
    expect(infoDaBia(s, bia, passou.w)?.sceneId).toBe(CRIPTA)
  })
})
