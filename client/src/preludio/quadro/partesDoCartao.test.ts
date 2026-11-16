/**
 * PRELÚDIO F3c, correções da revisão: a faixa de itens do lugar, as colunas
 * "ao lado" e o enquadramento do retrato, como no Grimório. Dados inventados.
 */
import { describe, expect, it } from 'vitest'
import { escalaDoCartao } from './cartaoCanvas'
import { colunaDaSecao, espessuraDaFaixa, larguraDoConteudo, LADOS_DA_FAIXA, posicaoDoRetrato, proximoLado, tamanhoAoTrocarLado, type LadoDaFaixa } from './partesDoCartao'

describe('a faixa de itens do lugar', () => {
  it('girar pelos quatro lados e esconder devolve o tamanho de partida; a faixa ao lado não aumenta a letra', () => {
    const partida = { w: 240, h: 314 }
    let tamanho = partida
    let lado: LadoDaFaixa = 'oculta'
    const vistos: LadoDaFaixa[] = []
    do {
      const para = proximoLado(lado)
      tamanho = tamanhoAoTrocarLado(tamanho, 1, lado, para)
      lado = para
      vistos.push(lado)
      // Com a faixa ligada, o conteúdo (retrato e texto) fica do mesmo tamanho: a escala é a de antes.
      expect(escalaDoCartao(larguraDoConteudo(tamanho.w, lado, 1), 1)).toBeCloseTo(1, 9)
    } while (lado !== 'oculta')
    expect(vistos).toEqual([...LADOS_DA_FAIXA.slice(1), 'oculta'])
    expect(tamanho.w).toBeCloseTo(partida.w, 9)
    expect(tamanho.h).toBeCloseTo(partida.h, 9)
    // Embaixo, a faixa come altura; à direita, largura (76 na escala 1).
    expect(tamanhoAoTrocarLado(partida, 1, 'oculta', 'baixo')).toEqual({ w: 240, h: 390 })
    expect(espessuraDaFaixa(316, 'direita', 1)).toBeCloseTo(76, 9)
  })
})

describe('as colunas ao lado e o retrato', () => {
  it('acha a coluna pela chave da importação ou pelo título do molde; o foco vira object-position, e o foco inválido fica no centro', () => {
    const chaves = ['informacao', 'eventos', 'itens'] as const
    expect(colunaDaSecao({ id: 'versao-farol-eventos', titulo: 'Eventos' }, chaves)).toBe('eventos')
    expect(colunaDaSecao({ id: 'versao-farol-informacao', titulo: 'Renomeada pelo mestre' }, chaves)).toBe('informacao')
    expect(colunaDaSecao({ id: 'sc-123', titulo: ' itens ' }, chaves)).toBe('itens')
    expect(colunaDaSecao({ id: 'sc-456', titulo: 'Descrição' }, chaves)).toBeNull()
    // Efeito só existe no cartão de item.
    expect(colunaDaSecao({ id: 'item-lamina-forma-efeito', titulo: 'Efeito' }, chaves)).toBeNull()

    expect(posicaoDoRetrato({ x: 50, y: 0 })).toBe('50% 0%')
    expect(posicaoDoRetrato({ x: 120, y: 10 })).toBe('50% 50%')
    expect(posicaoDoRetrato(undefined)).toBe('50% 50%')
    expect(posicaoDoRetrato('topo')).toBe('50% 50%')
  })
})
