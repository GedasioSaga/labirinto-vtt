import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { CamadaId, LayerId, MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * FICHAS NO HOST PELO OLHO "JOGADORES VEEM" (fatia 2 de
 * `docs/planos/camadas-fase3-2026-10-22.md`). Ficha própria, troca e oferta,
 * trocar a vista e sinal decidem pela camada como o JOGADOR a vê: ficha na
 * camada Tokens escondida só dos jogadores não dá nome ao sinal, não entra em
 * troca e não abre a vista; escondida só do mestre, tudo segue.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const GRID = 40

interface Olhos {
  mestre: LayerId[]
  jogadores: CamadaId[]
}

const SO_DOS_JOGADORES: Olhos = { mestre: [], jogadores: ['tokens'] }
const SO_DO_MESTRE: Olhos = { mestre: ['tokens'], jogadores: [] }

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function comOlhos(map: MapData, olhos: Olhos): MapData {
  return { ...map, hiddenLayers: [...olhos.mestre], ocultasDoJogador: [...olhos.jogadores], versaoDasCamadas: 2 }
}

/** Diego encostado em Bruno na Mansão; Diego também tem uma ficha no Salão (para trocar a vista). */
function mansao(): MapData {
  return {
    ...createEmptyMap('mapa-mansao', 'Mansão', 1000, 1000, GRID),
    tokens: [
      token('diego', 180, 200, { moedas: 10 }),
      token('bruno', 240, 200, { moedas: 5, mochila: [{ id: 'faca', nome: 'Faca de rede' }] }),
      token('zulmira', 140, 200, { npc: true, moedas: 50 }),
    ],
  }
}

function salao(): MapData {
  return { ...createEmptyMap('mapa-salao', 'Salão', 1000, 1000, GRID), tokens: [token('diego-salao', 300, 300)] }
}

function mesa(olhos: Olhos, mansaoAberta: boolean) {
  const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => 0, randomId: () => 'oferta-1' })
  const daMansao = { sceneId: 'cena-mansao', name: 'Mansão', map: comOlhos(mansao(), olhos) }
  const doSalao = { sceneId: 'cena-salao', name: 'Salão', map: salao() }
  const world: HostWorld = mansaoAberta ? { open: daMansao, background: [doSalao] } : { open: doSalao, background: [daMansao] }
  const ids: Record<string, string> = {}
  for (const [clientId, nome, fichas] of [
    ['c1', 'Diego', ['diego', 'diego-salao']],
    ['c2', 'Bruno', ['bruno']],
  ] as const) {
    const joined = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, world).outbound[0]?.msg
    if (joined?.type !== 'welcome') throw new Error('esperava welcome')
    ids[nome] = joined.playerId
    for (const ficha of fichas) s.assignToken(joined.playerId, ficha)
  }
  s.broadcast(world)
  return { s, ids, world }
}

const OFERTA = { de: 'Zulmira', dou: { itens: ['Xarope'], moedas: 0 }, peco: { itemIds: ['faca'], moedas: 0 } }

function paraCliente(result: HostResult, clientId: string): HostMessage[] {
  return result.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

describe('fichas no host: o olho "Jogadores veem" da camada Tokens', () => {
  it('oferta de troca: recusada se a ficha está escondida só dos jogadores; escondida só do mestre, sai', () => {
    const oculta = mesa(SO_DOS_JOGADORES, true)
    expect(oculta.s.proposeTrade(oculta.ids.Bruno ?? '', 'bruno', OFERTA, oculta.world)).toEqual({ outbound: [], offerId: null, refusal: 'hidden' })
    const doMestre = mesa(SO_DO_MESTRE, true)
    expect(doMestre.s.proposeTrade(doMestre.ids.Bruno ?? '', 'bruno', OFERTA, doMestre.world).offerId).toBe('oferta-1')
  })

  it('aceitar a troca depois que o mestre esconde a ficha só dos jogadores: nada troca de mão', () => {
    const t = mesa({ mestre: [], jogadores: [] }, true)
    expect(t.s.proposeTrade(t.ids.Bruno ?? '', 'bruno', OFERTA, t.world).offerId).toBe('oferta-1')
    const escondida: HostWorld = { ...t.world, open: { ...t.world.open, map: comOlhos(t.world.open.map, SO_DOS_JOGADORES) } }
    const r = t.s.handleMessage('c2', { type: 'trade.answer', offerId: 'oferta-1', answer: 'accept' }, escondida)
    expect(paraCliente(r, 'c2')).toEqual([{ type: 'trade.closed', offerId: 'oferta-1', result: 'unavailable' }])
    expect(r.applyItems).toBeUndefined()
  })

  it('sinal: a ficha escondida só dos jogadores não dá nome nem cor; escondida só do mestre, dá', () => {
    const oculta = mesa(SO_DOS_JOGADORES, true)
    const semNome = oculta.s.handleMessage('c1', { type: 'signal', x: 180, y: 200 }, oculta.world)
    expect(paraCliente(semNome, 'c1')[0]).toMatchObject({ type: 'signal', from: '' })
    expect(JSON.stringify(semNome.outbound)).not.toContain('nome-diego')
    const doMestre = mesa(SO_DO_MESTRE, true)
    const comNome = doMestre.s.handleMessage('c1', { type: 'signal', x: 180, y: 200 }, doMestre.world)
    expect(paraCliente(comNome, 'c1')[0]).toMatchObject({ type: 'signal', from: 'nome-diego' })
  })

  it('trocar a vista para a ficha escondida só dos jogadores: nada muda; escondida só do mestre, troca', () => {
    const oculta = mesa(SO_DOS_JOGADORES, false)
    expect(oculta.s.handleMessage('c1', { type: 'view.switch', tokenId: 'diego' }, oculta.world).outbound).toEqual([])
    const doMestre = mesa(SO_DO_MESTRE, false)
    const troca = doMestre.s.handleMessage('c1', { type: 'view.switch', tokenId: 'diego' }, doMestre.world)
    expect(paraCliente(troca, 'c1').some((msg) => msg.type === 'snapshot')).toBe(true)
  })
})
