/**
 * CONFRONTO POR CENA — a lógica pura: montar a fila, passar a vez, ler do
 * arquivo, validar o passo e recortar o que o jogador pode saber.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { validateTokenMove } from './moveValidation'
import {
  comConfronto,
  confrontoFromFile,
  confrontoParaJogador,
  fichaDaVez,
  iniciarConfronto,
  PASSO_PADRAO,
  proximaVez,
} from './confronto'
import type { Confronto, MapData, Token } from '../types/map'

const GRADE = 50

function ficha(id: string, cx: number, cy: number): Token {
  // Centro da casa (cx, cy): é onde a ficha fica depois de encaixar na grade.
  return { id, characterId: null, name: `ficha-${id}`, x: cx * GRADE + GRADE / 2, y: cy * GRADE + GRADE / 2, size: 1, image: null }
}

function mapaCom(tokens: Token[], confronto?: Confronto): MapData {
  const base: MapData = { ...createEmptyMap('m-arena', 'Arena', 30, 10, GRADE), tokens }
  return confronto === undefined ? base : { ...base, confronto }
}

/** Centro da casa (cx, cy), em px de mundo. */
const casa = (cx: number, cy: number) => ({ x: cx * GRADE + GRADE / 2, y: cy * GRADE + GRADE / 2 })

describe('iniciarConfronto', () => {
  it('monta a fila na ordem dada, sem repetir ficha, vez na primeira e turno zero', () => {
    expect(iniciarConfronto(['rato', 'ana', 'rato', 'bruno'], 6)).toEqual({ fila: ['rato', 'ana', 'bruno'], vez: 0, passo: 6, turno: 0 })
  })

  it('passo vira casa inteira de 1 a 99; lixo cai no padrão; fila vazia não começa', () => {
    expect(iniciarConfronto(['a'], 4.7)?.passo).toBe(4)
    expect(iniciarConfronto(['a'], 0)?.passo).toBe(1)
    expect(iniciarConfronto(['a'], 500)?.passo).toBe(99)
    expect(iniciarConfronto(['a'], Number.NaN)?.passo).toBe(PASSO_PADRAO)
    expect(iniciarConfronto([], 6)).toBeNull()
  })
})

describe('proximaVez', () => {
  it('anda a fila, volta ao começo e cada passagem muda o turno', () => {
    const c = iniciarConfronto(['a', 'b', 'c'], 6)
    if (c === null) throw new Error('esperava confronto')
    const noMapa = new Set(['a', 'b', 'c'])
    const b = proximaVez(c, noMapa)
    expect([fichaDaVez(b), b.turno]).toEqual(['b', 1])
    const cc = proximaVez(b, noMapa)
    const a = proximaVez(cc, noMapa)
    expect([fichaDaVez(cc), fichaDaVez(a), a.turno]).toEqual(['c', 'a', 3])
  })

  it('pula ficha que saiu do mapa (morreu, viajou) sem tirá-la da fila', () => {
    const c = iniciarConfronto(['a', 'b', 'c'], 6)
    if (c === null) throw new Error('esperava confronto')
    const semB = proximaVez(c, new Set(['a', 'c']))
    expect(fichaDaVez(semB)).toBe('c')
    expect(semB.fila).toEqual(['a', 'b', 'c'])
  })
})

describe('comConfronto (o que o painel grava)', () => {
  it('liga, troca e encerra; encerrar tira a chave e sem mudança devolve o mesmo mapa', () => {
    const c: Confronto = { fila: ['a'], vez: 0, passo: 6, turno: 0 }
    const sem = mapaCom([ficha('a', 1, 1)])
    const com = comConfronto(sem, c)
    expect(com.confronto).toEqual(c)
    const encerrado = comConfronto(com, undefined)
    expect('confronto' in encerrado).toBe(false)
    expect(encerrado.tokens).toEqual(sem.tokens)
    expect(comConfronto(sem, undefined)).toBe(sem)
  })
})

describe('confrontoFromFile (mapa salvo)', () => {
  it('mapa velho, sem o campo, abre sem confronto e não ganha campo novo', () => {
    const velho = JSON.stringify({ id: 'm-velho', name: 'Velho', width: 10, height: 10, grid: 50 })
    const lido = deserializeMap(velho)
    expect('confronto' in lido).toBe(false)
    expect(lido.id).toBe('m-velho')
  })

  it('o confronto vai e volta do disco igual', () => {
    const c: Confronto = { fila: ['a', 'b'], vez: 1, passo: 5, turno: 7 }
    const lido = deserializeMap(serializeMap(mapaCom([ficha('a', 1, 1), ficha('b', 2, 1)], c)))
    expect(lido.confronto).toEqual(c)
  })

  it('confronto torto some em vez de derrubar o mapa', () => {
    expect(confrontoFromFile({ fila: 'a', vez: 0, passo: 6, turno: 0 })).toBeUndefined()
    expect(confrontoFromFile({ fila: ['a', 3], vez: 0, passo: 6, turno: 0 })).toBeUndefined()
    expect(confrontoFromFile({ fila: ['a'], vez: 4, passo: 6, turno: 0 })).toBeUndefined()
    expect(confrontoFromFile({ fila: ['a'], vez: 0, passo: -2, turno: 0 })).toBeUndefined()
    expect(confrontoFromFile({ fila: [], vez: 0, passo: 6, turno: 0 })).toBeUndefined()
    expect(confrontoFromFile(null)).toBeUndefined()
    expect(confrontoFromFile({ fila: ['a'], vez: 0, passo: 6, turno: 2 })).toEqual({ fila: ['a'], vez: 0, passo: 6, turno: 2 })
  })
})

describe('validateTokenMove com confronto na cena', () => {
  const posse = { p1: ['ana'], p2: ['bruno'] }
  const tokens = [ficha('ana', 1, 1), ficha('bruno', 1, 3), ficha('solto', 1, 5)]
  const c: Confronto = { fila: ['ana', 'bruno'], vez: 0, passo: 6, turno: 0 }

  it('ficha da fila fora da vez: not_your_turn', () => {
    const r = validateTokenMove(mapaCom(tokens, c), { playerId: 'p2', tokenId: 'bruno', ...casa(2, 3) }, posse)
    expect(r).toEqual({ ok: false, reason: 'not_your_turn' })
  })

  it('na vez: anda até o passo e devolve as casas gastas; passou do que resta, too_far', () => {
    const mapa = mapaCom(tokens, c)
    const dentro = validateTokenMove(mapa, { playerId: 'p1', tokenId: 'ana', ...casa(7, 1) }, posse)
    expect(dentro).toEqual({ ok: true, ...casa(7, 1), casas: 6 })
    const longe = validateTokenMove(mapa, { playerId: 'p1', tokenId: 'ana', ...casa(8, 1) }, posse)
    expect(longe).toEqual({ ok: false, reason: 'too_far' })
    // Já andou 4 nesta vez: sobram 2.
    const resto = validateTokenMove(mapa, { playerId: 'p1', tokenId: 'ana', ...casa(4, 1) }, posse, { gastoNaVez: 4 })
    expect(resto).toEqual({ ok: false, reason: 'too_far' })
    const cabe = validateTokenMove(mapa, { playerId: 'p1', tokenId: 'ana', ...casa(3, 1) }, posse, { gastoNaVez: 4 })
    expect(cabe).toEqual({ ok: true, ...casa(3, 1), casas: 2 })
  })

  it('parede continua vencendo o passo: o motivo é a parede', () => {
    const mapa: MapData = { ...mapaCom(tokens, c), walls: [{ id: 'w', x1: 125, y1: 0, x2: 125, y2: 500, blocksLight: true, blocksMove: true, door: null }] }
    const r = validateTokenMove(mapa, { playerId: 'p1', tokenId: 'ana', ...casa(20, 1) }, posse)
    expect(r).toEqual({ ok: false, reason: 'wall' })
  })

  it('ficha fora da fila e o mestre andam livres, sem casas no resultado', () => {
    const mapa = mapaCom(tokens, c)
    const posseSolto = { p3: ['solto'] }
    expect(validateTokenMove(mapa, { playerId: 'p3', tokenId: 'solto', ...casa(25, 5) }, posseSolto)).toEqual({ ok: true, ...casa(25, 5) })
    expect(validateTokenMove(mapa, { playerId: 'mestre', tokenId: 'bruno', ...casa(25, 3) }, posse, { isHost: true })).toEqual({ ok: true, ...casa(25, 3) })
  })

  it('sem confronto na cena nada muda: qualquer distância, sem casas', () => {
    const r = validateTokenMove(mapaCom(tokens), { playerId: 'p2', tokenId: 'bruno', ...casa(25, 3) }, posse)
    expect(r).toEqual({ ok: true, ...casa(25, 3) })
  })
})

describe('confrontoParaJogador (o recorte)', () => {
  const c: Confronto = { fila: ['rato', 'ana', 'espiao', 'bruno'], vez: 0, passo: 6, turno: 3 }

  it('sem confronto na cena: nada sai', () => {
    expect(confrontoParaJogador(undefined, ['ana'], ['ana'], 0)).toBeUndefined()
  })

  it('só as fichas que ele recebeu entram na fila; a vez de ficha escondida sai como null', () => {
    const view = confrontoParaJogador({ ...c, vez: 2 }, ['rato', 'ana', 'bruno'], ['ana'], 0)
    expect(view).toEqual({ fila: ['rato', 'ana', 'bruno'], vez: null, suaVez: false, passo: 6, restam: null })
    expect(JSON.stringify(view)).not.toContain('espiao')
    expect(JSON.stringify(view)).not.toContain('turno')
  })

  it('na vez dele: suaVez e o que resta do passo; na vez de outro, o resto não sai', () => {
    expect(confrontoParaJogador({ ...c, vez: 1 }, ['rato', 'ana', 'bruno'], ['ana'], 4)).toEqual({
      fila: ['rato', 'ana', 'bruno'],
      vez: 'ana',
      suaVez: true,
      passo: 6,
      restam: 2,
    })
    const deOutro = confrontoParaJogador({ ...c, vez: 3 }, ['rato', 'ana', 'bruno'], ['ana'], 4)
    expect(deOutro?.vez).toBe('bruno')
    expect(deOutro?.restam).toBeNull()
    expect(deOutro?.suaVez).toBe(false)
  })

  it('jogador que não vê ninguém da fila ainda sabe que há confronto, sem nomes nem ids', () => {
    expect(confrontoParaJogador(c, [], [], 0)).toEqual({ fila: [], vez: null, suaVez: false, passo: 6, restam: null })
  })
})
