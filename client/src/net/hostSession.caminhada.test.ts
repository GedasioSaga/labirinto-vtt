// @vitest-environment node
/**
 * CLICAR PARA ANDAR (CAMINHOS F2) no servidor da sala. O trecho de caminhada
 * chega marcado (`caminhada: true`) e a marca só ACRESCENTA recusas: chave da
 * cena desligada (`caminhada_desligada`) e trecho que sai do que o jogador
 * conhece (`nevoa`). Ela nunca afrouxa passo máximo, parede, ficha congelada,
 * trava da ficha nem a vez. Sem a marca, o arrasto segue como sempre (o
 * jogador explora arrastando para o escuro).
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostSession, type HostWorld } from './hostSession'
import { parsePlayerMessage, type HostMessage } from './protocol'

const CODE = 'CAMI02'
const GRID = 50
/** O raio da visão: 4 casas. O que fica além, no começo, é escuro. */
const VISAO = 200

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** 40 x 12 casas; a Ana em (225,225), um NPC emprestado a ela e um NPC de ninguém. */
function mundo(extra: Partial<MapData> = {}, fichas: Record<string, Partial<Token>> = {}): HostWorld {
  const base = [ficha('ana', 225, 225), ficha('lirio', 275, 325, { npc: true }), ficha('guarda', 175, 325, { npc: true })]
  const map: MapData = {
    ...createEmptyMap('mapa-clique', 'Clique', 40, 12, GRID),
    tokens: base.map((t) => ({ ...t, ...(fichas[t.id] ?? {}) })),
    ...extra,
  }
  return { open: { sceneId: 'cena', name: 'Cena', map }, background: [] }
}

function playerIdOf(r: HostResult): string {
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

/** Ana (c1) com a ficha dela e o Lírio emprestado; o snapshot já saiu (memória e visão no host). */
function mesa(w: HostWorld): { s: HostSession; ana: string } {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: VISAO, now: () => 1_000_000, randomId: () => `id-${(n += 1)}` })
  const ana = playerIdOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w))
  s.assignToken(ana, 'ana')
  s.assignToken(ana, 'lirio')
  s.broadcast(w)
  return { s, ana }
}

function passo(s: HostSession, w: HostWorld, tokenId: string, x: number, y: number, caminhada: boolean): HostResult {
  const msg = caminhada ? { type: 'token.move', reqId: 'r1', tokenId, x, y, caminhada: true } : { type: 'token.move', reqId: 'r1', tokenId, x, y }
  return s.handleMessage('c1', msg, w)
}

function resposta(r: HostResult): HostMessage | undefined {
  return r.outbound.find((o) => o.clientId === 'c1')?.msg
}

const recusa = (reason: string) => ({ type: 'token.move.rejected', reqId: 'r1', reason })

describe('a marca da caminhada', () => {
  it('trecho no que ela vê: aceito, igual ao arrasto', () => {
    const w = mundo()
    const { s } = mesa(w)
    const r = passo(s, w, 'ana', 325, 225, true)
    expect(resposta(r)).toEqual({ type: 'token.move.accepted', reqId: 'r1', x: 325, y: 225 })
    expect(r.applyMove).toMatchObject({ tokenId: 'ana', x: 325, y: 225 })
  })

  it('chave da cena desligada: o trecho volta com `caminhada_desligada` e nada anda; o arrasto continua', () => {
    const w = mundo({ cliqueParaAndar: false })
    const { s } = mesa(w)
    const r = passo(s, w, 'ana', 325, 225, true)
    expect(resposta(r)).toEqual(recusa('caminhada_desligada'))
    expect(r.applyMove).toBeUndefined()
    expect(resposta(passo(s, w, 'ana', 325, 225, false))).toMatchObject({ type: 'token.move.accepted' })
  })

  it('trecho que sai do conhecido: `nevoa` (o host confere, não só o cliente); o mesmo passo arrastado anda', () => {
    const w = mundo()
    const { s } = mesa(w)
    // 12 casas à direita: muito além da visão de 4 casas e nunca explorado.
    const r = passo(s, w, 'ana', 825, 225, true)
    expect(resposta(r)).toEqual(recusa('nevoa'))
    expect(r.applyMove).toBeUndefined()
    expect(resposta(passo(s, w, 'ana', 825, 225, false))).toMatchObject({ type: 'token.move.accepted', x: 825, y: 225 })
  })

  it('zona oculta do mestre no meio do trecho: `nevoa`, mesmo dentro da visão', () => {
    const oculta = { id: 'z1', name: 'Fosso', revealed: false, points: [{ x: 280, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 250 }, { x: 280, y: 250 }] }
    const comZona = mundo({ concealZones: [oculta] })
    const { s } = mesa(comZona)
    expect(resposta(passo(s, comZona, 'ana', 375, 225, true))).toEqual(recusa('nevoa'))
  })

  it('não afrouxa o passo máximo: pedido além do alcance anda só até o alcance, com ou sem a marca', () => {
    const w = mundo({ movement: { maxStepCells: 2 } })
    const { s } = mesa(w)
    const comMarca = resposta(passo(s, w, 'ana', 375, 225, true))
    expect(comMarca).toEqual({ type: 'token.move.accepted', reqId: 'r1', x: 325, y: 225 })
  })

  it('não afrouxa a parede', () => {
    const w = mundo({ walls: [parede('p', 300, 150, 300, 300)] })
    const { s } = mesa(w)
    expect(resposta(passo(s, w, 'ana', 325, 225, true))).toEqual(recusa('wall'))
  })

  it('não afrouxa a ficha congelada nem a segurada', () => {
    const congelada = mundo({}, { ana: { congelado: true } })
    expect(resposta(passo(mesa(congelada).s, congelada, 'ana', 325, 225, true))).toEqual(recusa('congelado'))
    const segurada = mundo({}, { ana: { locked: true } })
    expect(resposta(passo(mesa(segurada).s, segurada, 'ana', 325, 225, true))).toEqual(recusa('locked'))
  })

  it('ficha congelada no MEIO da caminhada: o trecho seguinte já volta recusado (para em no máximo 1 trecho)', () => {
    const w = mundo()
    const { s } = mesa(w)
    expect(resposta(passo(s, w, 'ana', 275, 225, true))).toMatchObject({ type: 'token.move.accepted' })
    const map = w.open?.map
    if (map === undefined) throw new Error('sem cena')
    const depois: HostWorld = { ...w, open: { sceneId: 'cena', name: 'Cena', map: { ...map, tokens: map.tokens.map((t) => (t.id === 'ana' ? { ...t, x: 275, congelado: true } : t)) } } }
    expect(resposta(passo(s, depois, 'ana', 325, 225, true))).toEqual(recusa('congelado'))
  })

  it('NPC emprestado anda por clique; NPC de outro dono não', () => {
    const w = mundo()
    const { s } = mesa(w)
    expect(resposta(passo(s, w, 'lirio', 325, 325, true))).toEqual({ type: 'token.move.accepted', reqId: 'r1', x: 325, y: 325 })
    expect(resposta(passo(s, w, 'guarda', 125, 325, true))).toEqual(recusa('not_owner'))
  })

  it('leitura tolerante: só `true` vira marca; o pedido sem ela continua igual ao de sempre', () => {
    const base = { type: 'token.move', reqId: 'r1', tokenId: 'ana', x: 1, y: 2 }
    expect(parsePlayerMessage({ ...base, caminhada: true })).toEqual({ ...base, caminhada: true })
    expect(parsePlayerMessage({ ...base, caminhada: 1 })).toEqual(base)
    expect(parsePlayerMessage(base)).toEqual(base)
  })

  it('marca torta (não `true`) não é marca: o passo segue como arrasto', () => {
    const w = mundo({ cliqueParaAndar: false })
    const { s } = mesa(w)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'ana', x: 325, y: 225, caminhada: 'sim' }, w)
    expect(resposta(r)).toMatchObject({ type: 'token.move.accepted' })
  })
})
