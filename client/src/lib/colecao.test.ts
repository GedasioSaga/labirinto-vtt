/**
 * COLEÇÃO DE PISTAS — a parte pura: ler a peça do disco, conferir se o pino é
 * uma peça válida e montar o progresso ("5 de 12") que o jogador recebe. A
 * frase inteira só entra no progresso com TODAS as peças juntas.
 */
import { describe, expect, it } from 'vitest'
import { serializeMap, deserializeMap } from './mapFile'
import { createEmptyMap } from './mapFactory'
import { COLECAO_MAX_PARTES, COLECAO_NOME_MAX_LENGTH, colecaoNomesDaCena, guardarPeca, pecaDoPino, progressoDasColecoes, readPinColecao, type ColecoesDoJogador } from './colecao'
import type { Pin } from '../types/map'

describe('readPinColecao — a peça como veio do disco', () => {
  it('forma certa volta igual; ausente continua ausente', () => {
    expect(readPinColecao({ nome: 'Letreiro', parte: 5, total: 12, inteira: 'ÁGUA SOBE' })).toEqual({ nome: 'Letreiro', parte: 5, total: 12, inteira: 'ÁGUA SOBE' })
    expect(readPinColecao({ nome: 'Letreiro', parte: 5, total: 12 })).toEqual({ nome: 'Letreiro', parte: 5, total: 12 })
    expect(readPinColecao(undefined)).toBeUndefined()
  })

  it('forma errada (sem nome, número quebrado, texto no lugar) volta ausente em vez de derrubar o mapa', () => {
    expect(readPinColecao({ parte: 1, total: 2 })).toBeUndefined()
    expect(readPinColecao({ nome: 'X', parte: 'um', total: 2 })).toBeUndefined()
    expect(readPinColecao({ nome: 'X', parte: 1.5, total: 2 })).toBeUndefined()
    expect(readPinColecao('Letreiro')).toBeUndefined()
    expect(readPinColecao({ nome: 'X', parte: 1, total: 2, inteira: 42 })).toEqual({ nome: 'X', parte: 1, total: 2 })
  })

  it('o mapa gravado e reaberto mantém a peça do pino', () => {
    const base = createEmptyMap('m', 'Mapa', 10, 10, 50)
    const pin: Pin = { id: 'p', x: 1, y: 1, kind: 'exclamacao', description: 'Letra Á', image: null, colecao: { nome: 'Letreiro', parte: 1, total: 12, inteira: 'ÁGUA' } }
    const reaberto = deserializeMap(serializeMap({ ...base, pins: [pin] }))
    expect(reaberto.pins[0]?.colecao).toEqual({ nome: 'Letreiro', parte: 1, total: 12, inteira: 'ÁGUA' })
  })
})

describe('colecaoNomesDaCena — sugestões do painel do mestre', () => {
  it('os nomes usados na cena, aparados, sem repetir e sem vazio, em ordem', () => {
    const pino = (id: string, nome?: string): Pin => ({ id, x: 0, y: 0, kind: 'exclamacao', description: '', image: null, colecao: nome === undefined ? undefined : { nome, parte: 1, total: 2 } })
    expect(colecaoNomesDaCena([pino('a', 'Mapa'), pino('b', ' Letreiro '), pino('c'), pino('d', 'Letreiro'), pino('e', '  ')])).toEqual(['Letreiro', 'Mapa'])
  })
})

describe('pecaDoPino — o pino é uma peça que conta?', () => {
  const pino = (colecao: Pin['colecao']): Pin => ({ id: 'p', x: 0, y: 0, kind: 'exclamacao', description: 'x', image: null, colecao })

  it('nome aparado, parte dentro do total', () => {
    expect(pecaDoPino(pino({ nome: '  Letreiro ', parte: 3, total: 12 }))).toEqual({ nome: 'Letreiro', parte: 3, total: 12, inteira: '' })
  })

  it('sem coleção, nome vazio, parte fora de 1..total ou total acima do teto: não é peça', () => {
    expect(pecaDoPino(pino(undefined))).toBeNull()
    expect(pecaDoPino(pino({ nome: '   ', parte: 1, total: 2 }))).toBeNull()
    expect(pecaDoPino(pino({ nome: 'X', parte: 0, total: 2 }))).toBeNull()
    expect(pecaDoPino(pino({ nome: 'X', parte: 3, total: 2 }))).toBeNull()
    expect(pecaDoPino(pino({ nome: 'X', parte: 1, total: COLECAO_MAX_PARTES + 1 }))).toBeNull()
  })

  it('nome longo é cortado no teto', () => {
    const peca = pecaDoPino(pino({ nome: 'N'.repeat(COLECAO_NOME_MAX_LENGTH + 10), parte: 1, total: 2 }))
    expect(peca?.nome).toBe('N'.repeat(COLECAO_NOME_MAX_LENGTH))
  })
})

describe('progressoDasColecoes — o que o jogador recebe', () => {
  it('com 2 de 3: as peças que ele tem, a contagem, e NADA da frase inteira', () => {
    const guardadas: ColecoesDoJogador = new Map()
    guardarPeca(guardadas, { nome: 'Letreiro', parte: 1, total: 3, inteira: 'A BOCA ABRE' }, 'c1')
    guardarPeca(guardadas, { nome: 'Letreiro', parte: 3, total: 3, inteira: '' }, 'c3')
    const progresso = progressoDasColecoes(guardadas)
    expect(progresso).toEqual([
      {
        nome: 'Letreiro',
        total: 3,
        partes: [
          { parte: 1, clueId: 'c1' },
          { parte: 3, clueId: 'c3' },
        ],
        completa: false,
      },
    ])
    expect(JSON.stringify(progresso)).not.toContain('A BOCA ABRE')
  })

  it('com todas as peças: completa, com a frase inteira da menor peça que a tem', () => {
    const guardadas: ColecoesDoJogador = new Map()
    guardarPeca(guardadas, { nome: 'Letreiro', parte: 2, total: 2, inteira: 'SEGUNDA VERSÃO' }, 'c2')
    guardarPeca(guardadas, { nome: 'Letreiro', parte: 1, total: 2, inteira: 'A BOCA ABRE' }, 'c1')
    const [letreiro] = progressoDasColecoes(guardadas)
    expect(letreiro?.completa).toBe(true)
    expect(letreiro?.inteira).toBe('A BOCA ABRE')
  })

  it('completa sem frase escrita: completa, sem campo `inteira`', () => {
    const guardadas: ColecoesDoJogador = new Map()
    guardarPeca(guardadas, { nome: 'Chave', parte: 1, total: 1, inteira: '' }, 'c1')
    expect(progressoDasColecoes(guardadas)).toEqual([{ nome: 'Chave', total: 1, partes: [{ parte: 1, clueId: 'c1' }], completa: true }])
  })

  it('a mesma peça de novo não muda nada; peça nova muda', () => {
    const guardadas: ColecoesDoJogador = new Map()
    expect(guardarPeca(guardadas, { nome: 'L', parte: 1, total: 2, inteira: '' }, 'c1')).toBe(true)
    expect(guardarPeca(guardadas, { nome: 'L', parte: 1, total: 2, inteira: '' }, 'c1')).toBe(false)
    expect(guardarPeca(guardadas, { nome: 'L', parte: 2, total: 2, inteira: '' }, 'c2')).toBe(true)
  })

  it('o mestre baixou o total: peça acima do total novo não conta', () => {
    const guardadas: ColecoesDoJogador = new Map()
    guardarPeca(guardadas, { nome: 'L', parte: 3, total: 3, inteira: '' }, 'c3')
    guardarPeca(guardadas, { nome: 'L', parte: 1, total: 2, inteira: '' }, 'c1')
    expect(progressoDasColecoes(guardadas)).toEqual([{ nome: 'L', total: 2, partes: [{ parte: 1, clueId: 'c1' }], completa: false }])
  })
})
