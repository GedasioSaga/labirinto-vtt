/**
 * CONFRONTO POR CENA no host: a vez e o passo valem só na cena do confronto,
 * o gasto da vez zera quando o mestre passa a vez, e o jogador recebe a faixa
 * da cena DELE — sem ficha escondida, sem o confronto de outra cena.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { proximaVez } from '../lib/confronto'
import type { Confronto, MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostSession, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const GRADE = 50

/** Ficha no centro da casa (cx, cy). */
function ficha(id: string, cx: number, cy: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x: cx * GRADE + GRADE / 2, y: cy * GRADE + GRADE / 2, size: 1, image: null, ...extra }
}

function mapa(id: string, tokens: Token[], confronto?: Confronto): MapData {
  const base: MapData = { ...createEmptyMap(id, `Cena ${id}`, 30, 10, GRADE), tokens }
  return confronto === undefined ? base : { ...base, confronto }
}

const casa = (cx: number, cy: number) => ({ x: cx * GRADE + GRADE / 2, y: cy * GRADE + GRADE / 2 })

/** Três jogadores: Ana e Bruno na arena, Caio no porão. */
function mesa(world: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 2000, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entrar = (clientId: string, name: string, tokenId: string): string => {
    const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, world)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
    return welcome.playerId
  }
  entrar('c-ana', 'Ana', 'ana')
  entrar('c-bruno', 'Bruno', 'bruno')
  entrar('c-caio', 'Caio', 'caio')
  return s
}

let req = 0
function mover(s: HostSession, clientId: string, tokenId: string, alvo: { x: number; y: number }, world: HostWorld): HostResult {
  req += 1
  return s.handleMessage(clientId, { type: 'token.move', reqId: `r${req}`, tokenId, ...alvo }, world)
}

function resposta(r: HostResult): HostMessage | undefined {
  return r.outbound[0]?.msg
}

function snapshotDe(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error(`sem snapshot para ${clientId}`)
  return msg
}

function arena(tokens: Token[], confronto: Confronto | undefined): HostWorld {
  const porao = mapa('m-porao', [ficha('caio', 1, 1)])
  return { open: { sceneId: 's-arena', name: 'Arena', map: mapa('m-arena', tokens, confronto) }, background: [{ sceneId: 's-porao', name: 'Porão', map: porao }] }
}

const RATO = ficha('rato', 1, 2, { npc: true })
const BRUNO = ficha('bruno', 1, 3)
const FICHAS = [ficha('ana', 1, 1), RATO, BRUNO]
/** As fichas da arena com a Ana já na casa (cx, 1). */
const anaEm = (cx: number): Token[] => [ficha('ana', cx, 1), RATO, BRUNO]
const CONFRONTO: Confronto = { fila: ['ana', 'rato', 'bruno'], vez: 0, passo: 6, turno: 0 }

describe('confronto na cena: vez e passo', () => {
  it('fora da vez o host recusa com not_your_turn, e nada se aplica', () => {
    const world = arena(FICHAS, CONFRONTO)
    const s = mesa(world)
    const r = mover(s, 'c-bruno', 'bruno', casa(2, 3), world)
    expect(resposta(r)).toMatchObject({ type: 'token.move.rejected', reason: 'not_your_turn' })
    expect(r.applyMove).toBeUndefined()
  })

  it('na vez, o passo é somado entre arrastos; passou do que resta, too_far', () => {
    let world = arena(FICHAS, CONFRONTO)
    const s = mesa(world)
    const primeiro = mover(s, 'c-ana', 'ana', casa(5, 1), world)
    expect(resposta(primeiro)).toMatchObject({ type: 'token.move.accepted', ...casa(5, 1) })
    // O integrador aplica o movimento: o mundo de agora tem a Ana na casa 5.
    world = arena(anaEm(5), CONFRONTO)
    const longe = mover(s, 'c-ana', 'ana', casa(8, 1), world)
    expect(resposta(longe)).toMatchObject({ type: 'token.move.rejected', reason: 'too_far' })
    expect(longe.applyMove).toBeUndefined()
    const cabe = mover(s, 'c-ana', 'ana', casa(7, 1), world)
    expect(resposta(cabe)).toMatchObject({ type: 'token.move.accepted', ...casa(7, 1) })
    expect(cabe.applyMove).toEqual({ tokenId: 'ana', ...casa(7, 1) })
  })

  it('"Próxima vez" do mestre: o gasto zera e a vez passa, mesmo voltando à mesma ficha', () => {
    const sozinha: Confronto = { fila: ['ana'], vez: 0, passo: 2, turno: 0 }
    let world = arena(FICHAS, sozinha)
    const s = mesa(world)
    expect(resposta(mover(s, 'c-ana', 'ana', casa(3, 1), world))).toMatchObject({ type: 'token.move.accepted' })
    world = arena(anaEm(3), sozinha)
    expect(resposta(mover(s, 'c-ana', 'ana', casa(4, 1), world))).toMatchObject({ reason: 'too_far' })
    // Fila de uma ficha: a vez volta a ela, mas é OUTRA vez (o turno mudou).
    const depois = proximaVez(sozinha, new Set(['ana']))
    world = arena(anaEm(3), depois)
    expect(resposta(mover(s, 'c-ana', 'ana', casa(5, 1), world))).toMatchObject({ type: 'token.move.accepted', ...casa(5, 1) })
  })

  it('"Encerrar" e começar de novo: o passo gasto no confronto velho não passa para o novo', () => {
    const curto: Confronto = { fila: ['ana'], vez: 0, passo: 2, turno: 0 }
    let world = arena(FICHAS, curto)
    const s = mesa(world)
    expect(resposta(mover(s, 'c-ana', 'ana', casa(3, 1), world))).toMatchObject({ type: 'token.move.accepted' })
    // O mestre encerra: o mapa muda e o integrador faz o broadcast.
    world = arena(anaEm(3), undefined)
    s.broadcast(world)
    // Recomeça com a mesma fila: turno 0 de novo, mas é outro confronto.
    world = arena(anaEm(3), curto)
    expect(resposta(mover(s, 'c-ana', 'ana', casa(5, 1), world))).toMatchObject({ type: 'token.move.accepted', ...casa(5, 1) })
  })

  it('a outra cena segue livre: Caio anda 20 casas no porão enquanto a arena luta', () => {
    const world = arena(FICHAS, CONFRONTO)
    const s = mesa(world)
    const r = mover(s, 'c-caio', 'caio', casa(21, 1), world)
    expect(resposta(r)).toMatchObject({ type: 'token.move.accepted', ...casa(21, 1) })
    expect(r.applyMove).toEqual({ tokenId: 'caio', ...casa(21, 1), sceneId: 's-porao' })
  })

  it('cada cena tem a própria vez: no porão a vez é do Caio, na arena é da Ana', () => {
    const doPorao: Confronto = { fila: ['vulto', 'caio'], vez: 1, passo: 3, turno: 0 }
    const world: HostWorld = {
      open: { sceneId: 's-arena', name: 'Arena', map: mapa('m-arena', FICHAS, CONFRONTO) },
      background: [{ sceneId: 's-porao', name: 'Porão', map: mapa('m-porao', [ficha('caio', 1, 1), ficha('vulto', 5, 5)], doPorao) }],
    }
    const s = mesa(world)
    expect(resposta(mover(s, 'c-caio', 'caio', casa(4, 1), world))).toMatchObject({ type: 'token.move.accepted' })
    expect(resposta(mover(s, 'c-bruno', 'bruno', casa(2, 3), world))).toMatchObject({ reason: 'not_your_turn' })
    expect(resposta(mover(s, 'c-ana', 'ana', casa(4, 1), world))).toMatchObject({ type: 'token.move.accepted' })
  })
})

describe('o que o jogador recebe do confronto', () => {
  it('na cena do confronto: a faixa com a fila, de quem é a vez e o que resta, e o mapa sem o campo do mestre', () => {
    let world = arena(FICHAS, CONFRONTO)
    const s = mesa(world)
    mover(s, 'c-ana', 'ana', casa(5, 1), world)
    world = arena(anaEm(5), CONFRONTO)
    const r = s.broadcast(world)
    const daAna = snapshotDe(r, 'c-ana')
    expect(daAna.confronto).toEqual({ fila: ['ana', 'rato', 'bruno'], vez: 'ana', suaVez: true, passo: 6, restam: 2 })
    expect('confronto' in daAna.map).toBe(false)
    const doBruno = snapshotDe(r, 'c-bruno')
    expect(doBruno.confronto).toEqual({ fila: ['ana', 'rato', 'bruno'], vez: 'ana', suaVez: false, passo: 6, restam: null })
  })

  it('quem está em outra cena não recebe nada do confronto da arena', () => {
    const world = arena(FICHAS, CONFRONTO)
    const s = mesa(world)
    const r = s.broadcast(world)
    const doCaio = snapshotDe(r, 'c-caio')
    expect(doCaio.confronto).toBeUndefined()
    const texto = JSON.stringify(r.outbound.filter((o) => o.clientId === 'c-caio'))
    expect(texto).not.toContain('rato')
    expect(texto).not.toContain('"fila"')
    expect(texto).toContain('caio')
  })

  it('ficha secreta na fila não chega: some da fila e, na vez dela, a vez sai null', () => {
    const comEspiao = [...FICHAS, ficha('espiao', 3, 2, { secret: true, npc: true })]
    const naVezDoEspiao: Confronto = { fila: ['ana', 'espiao', 'bruno'], vez: 1, passo: 6, turno: 4 }
    const world = arena(comEspiao, naVezDoEspiao)
    const s = mesa(world)
    const r = s.broadcast(world)
    const daAna = snapshotDe(r, 'c-ana')
    expect(daAna.confronto).toEqual({ fila: ['ana', 'bruno'], vez: null, suaVez: false, passo: 6, restam: null })
    const texto = JSON.stringify(r.outbound.filter((o) => o.clientId === 'c-ana' || o.clientId === 'c-bruno'))
    expect(texto).not.toContain('espiao')
    expect(texto).not.toContain('"turno"')
  })

  it('sem confronto na cena, o snapshot sai como sempre (sem o campo)', () => {
    const world = arena(FICHAS, undefined)
    const s = mesa(world)
    const daAna = snapshotDe(s.broadcast(world), 'c-ana')
    expect('confronto' in daAna).toBe(false)
    expect(daAna.ownTokens).toEqual(['ana'])
  })
})
