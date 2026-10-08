/**
 * LIVRO DE REGRAS NA MESA — a fronteira do protocolo: as partes cabem no teto
 * de 64 KiB (contando escape de JSON e UTF-8), juntam de volta no mesmo texto
 * em qualquer ordem, e tudo que chega torto é recusado.
 */
import { describe, expect, it } from 'vitest'
import { resumoDoLivro } from '../lib/livroDeRegras'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { PLAYER_MESSAGE_MAX_BYTES, parsePlayerMessage } from './protocol'
import {
  LIVRO_PARTE_BYTES,
  LIVRO_PARTES_MAX,
  lerPacoteDoLivro,
  parseLivroParte,
  parseLivroRecusa,
  partesDoLivro,
  partirEmPartes,
  receberParte,
  type ChegadaDoLivro,
  type LivroParteMessage,
} from './protocoloDoLivro'
import { parseSistemaDeRpgMessage } from './protocoloDoPersonagem'

const utf8 = new TextEncoder()
const bytesDaString = (texto: string): number => utf8.encode(JSON.stringify(texto)).length

describe('livro: partir em partes', () => {
  it('cada parte, como string JSON, cabe no teto — com aspas, barra, controle, acento e emoji contando o que custam', () => {
    const texto = 'Ação "dupla" \\ barra\n\ttab \u0001 ctrl 😀 fim; '.repeat(400)
    const partes = partirEmPartes(texto, 1024)
    expect(partes.length).toBeGreaterThan(5)
    for (const parte of partes) expect(bytesDaString(parte) - 2).toBeLessThanOrEqual(1024)
    expect(partes.join('')).toBe(texto)
  })

  it('não parte emoji ao meio: nenhuma parte termina com meia letra', () => {
    const partes = partirEmPartes('😀'.repeat(1000), 99)
    for (const parte of partes) expect(/[\ud800-\udbff]$/.test(parte)).toBe(false)
    expect(partes.join('')).toBe('😀'.repeat(1000))
  })

  it('texto pequeno é uma parte só; vazio também', () => {
    expect(partirEmPartes('abc')).toEqual(['abc'])
    expect(partirEmPartes('')).toEqual([''])
  })

  it('o livro do One Piece: poucas partes, e cada mensagem inteira bem abaixo dos 64 KiB', () => {
    const partes = partesDoLivro(SISTEMA_ONE_PIECE)
    if (partes === null) throw new Error('livro grande demais')
    expect(partes.length).toBeGreaterThanOrEqual(2)
    expect(partes.length).toBeLessThanOrEqual(4)
    for (const [indice, texto] of partes.entries()) {
      const mensagem: LivroParteMessage = { type: 'livro.parte', reqId: 'r'.repeat(64), indice, total: partes.length, texto }
      expect(utf8.encode(JSON.stringify(mensagem)).length).toBeLessThan(PLAYER_MESSAGE_MAX_BYTES)
    }
  })

  it(`livro que passaria de ${LIVRO_PARTES_MAX} partes: o host recusa (null)`, () => {
    const enorme = { ...SISTEMA_ONE_PIECE, livro: [{ id: 'x', titulo: 'X', ordem: 1, texto: '\u0001'.repeat(Math.ceil((LIVRO_PARTES_MAX * LIVRO_PARTE_BYTES) / 6) + 10) }] }
    expect(partesDoLivro(enorme)).toBeNull()
  })
})

describe('livro: o que o jogador manda', () => {
  it('livro.pedir: reqId e sistemaId de 1 a 64 caracteres; o resto é recusado', () => {
    expect(parsePlayerMessage({ type: 'livro.pedir', reqId: 'l1', sistemaId: 'one-piece' })).toEqual({ type: 'livro.pedir', reqId: 'l1', sistemaId: 'one-piece' })
    expect(parsePlayerMessage({ type: 'livro.pedir', reqId: '', sistemaId: 'one-piece' })).toBeNull()
    expect(parsePlayerMessage({ type: 'livro.pedir', reqId: 'l1' })).toBeNull()
    expect(parsePlayerMessage({ type: 'livro.pedir', reqId: 'l1', sistemaId: 'x'.repeat(65) })).toBeNull()
    expect(parsePlayerMessage({ type: 'livro.pedir', reqId: 7, sistemaId: 'one-piece' })).toBeNull()
  })
})

describe('livro: o que o host manda', () => {
  const parte = (extra: Record<string, unknown>) => parseLivroParte({ type: 'livro.parte', reqId: 'l1', indice: 0, total: 2, texto: 'abc', ...extra })

  it('livro.parte: índice dentro do total, total até o teto, texto até o tamanho de uma parte', () => {
    expect(parte({})).toEqual({ type: 'livro.parte', reqId: 'l1', indice: 0, total: 2, texto: 'abc' })
    expect(parte({ indice: 2 })).toBeNull()
    expect(parte({ indice: -1 })).toBeNull()
    expect(parte({ indice: 0.5 })).toBeNull()
    expect(parte({ total: 0 })).toBeNull()
    expect(parte({ total: LIVRO_PARTES_MAX + 1, indice: 0 })).toBeNull()
    expect(parte({ texto: 'x'.repeat(LIVRO_PARTE_BYTES + 1) })).toBeNull()
    expect(parte({ texto: 5 })).toBeNull()
    expect(parte({ reqId: '' })).toBeNull()
  })

  it('livro.recusa', () => {
    expect(parseLivroRecusa({ type: 'livro.recusa', reqId: 'l1' })).toEqual({ type: 'livro.recusa', reqId: 'l1' })
    expect(parseLivroRecusa({ type: 'livro.recusa' })).toBeNull()
  })

  it('rpg.sistema traz o resumo do livro; resumo torto é como não ter livro', () => {
    const resumo = resumoDoLivro(SISTEMA_ONE_PIECE)
    expect(parseSistemaDeRpgMessage({ type: 'rpg.sistema', sistema: SISTEMA_ONE_PIECE, livro: resumo })?.livro).toEqual(resumo)
    expect(parseSistemaDeRpgMessage({ type: 'rpg.sistema', sistema: SISTEMA_ONE_PIECE, livro: { capitulos: -1, catalogos: [] } })?.livro).toBeUndefined()
    expect(parseSistemaDeRpgMessage({ type: 'rpg.sistema', sistema: SISTEMA_ONE_PIECE, livro: { capitulos: 2, catalogos: ['pericias', 'magias', 'pericias'] } })?.livro).toEqual({ capitulos: 2, catalogos: ['pericias'] })
    expect(parseSistemaDeRpgMessage({ type: 'rpg.sistema', sistema: SISTEMA_ONE_PIECE })).not.toHaveProperty('livro')
  })
})

describe('livro: juntar as partes', () => {
  const nova = (): ChegadaDoLivro => ({ reqId: 'l1', total: null, partes: [] })
  const msg = (indice: number, texto: string, total = 3, reqId = 'l1'): LivroParteMessage => ({ type: 'livro.parte', reqId, indice, total, texto })

  it('em qualquer ordem, repetida não conta duas vezes; com todas, o texto inteiro', () => {
    let chegada = nova()
    for (const m of [msg(2, 'C'), msg(0, 'A'), msg(2, 'C')]) {
      const passo = receberParte(chegada, m)
      if (passo.tipo !== 'faltando') throw new Error(`esperava faltando, veio ${passo.tipo}`)
      chegada = passo.chegada
    }
    expect(receberParte(chegada, msg(1, 'B'))).toEqual({ tipo: 'completo', texto: 'ABC' })
  })

  it('parte de outro pedido é alheia; total diferente das outras é torto', () => {
    const passo = receberParte(nova(), msg(0, 'A'))
    if (passo.tipo !== 'faltando') throw new Error('esperava faltando')
    expect(receberParte(passo.chegada, msg(1, 'B', 3, 'l9'))).toEqual({ tipo: 'alheia' })
    expect(receberParte(passo.chegada, msg(1, 'B', 4))).toEqual({ tipo: 'torto' })
  })

  it('o pacote junto passa pelos leitores do arquivo: livro do sistema certo, com os mesmos dados', () => {
    const partes = partesDoLivro(SISTEMA_ONE_PIECE) ?? []
    const lido = lerPacoteDoLivro(partes.join(''), SISTEMA_ONE_PIECE)
    expect(lido?.livro).toEqual(SISTEMA_ONE_PIECE.livro)
    expect(lido?.catalogos).toEqual(SISTEMA_ONE_PIECE.catalogos)
  })

  it('JSON quebrado, ou livro de outro sistema, não vale', () => {
    expect(lerPacoteDoLivro('{"sistemaId":', SISTEMA_ONE_PIECE)).toBeNull()
    expect(lerPacoteDoLivro(JSON.stringify({ sistemaId: 'dnd', livro: [], catalogos: null }), SISTEMA_ONE_PIECE)).toBeNull()
  })

  it('o que vem dentro passa pelos tetos: capítulo com id torto sai, item sem nome sai', () => {
    const texto = JSON.stringify({ sistemaId: SISTEMA_ONE_PIECE.id, livro: [{ id: '../x', texto: 'a' }, { id: 'ok', titulo: 'Ok', texto: '<script>' }], catalogos: { vantagens: [{ descricao: 'sem nome' }] } })
    expect(lerPacoteDoLivro(texto, SISTEMA_ONE_PIECE)).toEqual({ livro: [{ id: 'ok', titulo: 'Ok', ordem: 2, texto: '<script>' }], catalogos: undefined })
  })
})
