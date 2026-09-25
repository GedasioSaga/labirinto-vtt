/**
 * LOJA COM PREÇOS — a parte pura: o que volta do disco, o que o jogador pode
 * receber de cada mercadoria e o efeito de "Vender" no estoque do mestre (e na
 * mochila de quem comprou, pela mesma mudança de item do "Pegar").
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'
import { applyItemChange, ITEM_NAME_MAX_LENGTH } from './items'
import { createEmptyMap } from './mapFactory'
import {
  itemAVenda,
  LOJA_ITENS_MAX,
  LOJA_NOME_MAX,
  LOJA_PRECO_MAX,
  lerLojaDoArquivo,
  lojaParaJogador,
  sameLoja,
  textoDoEstoque,
  venderItem,
} from './loja'

function banca(extra: Partial<Pin> = {}): Pin {
  return {
    id: 'banca',
    x: 100,
    y: 100,
    kind: 'exclamacao',
    description: 'Botica de Zulmira',
    image: null,
    loja: [
      { id: 'xarope', nome: 'Xarope de tosse', preco: '1 moeda', estoque: 3 },
      { id: 'atadura', nome: 'Atadura', preco: '2 moedas', estoque: 0 },
      { id: 'agua', nome: 'Água benta', preco: 'uma vela' },
    ],
    ...extra,
  }
}

const ana: Token = { id: 'ana', characterId: null, name: 'Ana', x: 100, y: 100, size: 1, image: null }

function mapaCom(pins: Pin[], tokens: Token[] = []): MapData {
  return { ...createEmptyMap('m', 'M', 10, 10, 50), pins, tokens }
}

describe('lerLojaDoArquivo', () => {
  it('volta só id, nome, preço e estoque, sem campo desconhecido', () => {
    const lida = lerLojaDoArquivo([{ id: 'a', nome: 'Faca', preco: '3 moedas', estoque: 2, custoDoMestre: 'nada' }])
    expect(lida).toEqual([{ id: 'a', nome: 'Faca', preco: '3 moedas', estoque: 2 }])
  })

  it('item sem id ou sem nome em texto cai; preço que não é texto vira vazio; estoque torto volta ausente', () => {
    const lida = lerLojaDoArquivo([
      { nome: 'Sem id', preco: '1' },
      { id: 'b', preco: '1' },
      { id: 'c', nome: 'Corda', preco: 5, estoque: -1 },
      { id: 'd', nome: 'Pão', preco: '1', estoque: 2.5 },
      'lixo',
    ])
    expect(lida).toEqual([
      { id: 'c', nome: 'Corda', preco: '' },
      { id: 'd', nome: 'Pão', preco: '1' },
    ])
  })

  it('corta nome e preço no teto e a lista no máximo de itens', () => {
    const muitos = Array.from({ length: LOJA_ITENS_MAX + 5 }, (_, i) => ({ id: `i${i}`, nome: 'N'.repeat(LOJA_NOME_MAX + 10), preco: 'P'.repeat(LOJA_PRECO_MAX + 10) }))
    const lida = lerLojaDoArquivo(muitos)
    expect(lida).toHaveLength(LOJA_ITENS_MAX)
    expect(lida?.[0]?.nome).toHaveLength(LOJA_NOME_MAX)
    expect(lida?.[0]?.preco).toHaveLength(LOJA_PRECO_MAX)
  })

  it('o teto do nome é o mesmo do item da mochila, para onde a mercadoria vai', () => {
    expect(LOJA_NOME_MAX).toBe(ITEM_NAME_MAX_LENGTH)
  })

  it('ausente, vazio ou que não é lista volta ausente', () => {
    expect(lerLojaDoArquivo(undefined)).toBeUndefined()
    expect(lerLojaDoArquivo([])).toBeUndefined()
    expect(lerLojaDoArquivo({ id: 'a' })).toBeUndefined()
  })

  it('id repetido: fica o primeiro, o segundo cai (o "Quero" acharia o item errado)', () => {
    const lida = lerLojaDoArquivo([
      { id: 'a', nome: 'Faca', preco: '1' },
      { id: 'a', nome: 'Outra faca', preco: '9' },
    ])
    expect(lida).toEqual([{ id: 'a', nome: 'Faca', preco: '1' }])
  })
})

describe('lojaParaJogador', () => {
  it('leva id, nome, preço e estoque, na ordem do mestre', () => {
    expect(lojaParaJogador(banca())).toEqual([
      { id: 'xarope', nome: 'Xarope de tosse', preco: '1 moeda', estoque: 3 },
      { id: 'atadura', nome: 'Atadura', preco: '2 moedas', estoque: 0 },
      { id: 'agua', nome: 'Água benta', preco: 'uma vela' },
    ])
  })

  it('mercadoria sem nome (o mestre ainda está escrevendo) não sai; loja sem nada é null', () => {
    expect(lojaParaJogador(banca({ loja: [{ id: 'x', nome: '   ', preco: '1' }] }))).toBeNull()
    expect(lojaParaJogador(banca({ loja: undefined }))).toBeNull()
  })

  it('campo extra no item do mestre não viaja', () => {
    const comExtra = { id: 'x', nome: 'Faca', preco: '1', segredoDoMestre: 'envenenada' }
    const pin: Pin = { ...banca(), loja: [comExtra] }
    expect(lojaParaJogador(pin)).toEqual([{ id: 'x', nome: 'Faca', preco: '1' }])
    expect(JSON.stringify(lojaParaJogador(pin))).not.toContain('envenenada')
  })

  it('pino de viagem e alavanca não são banca: nada sai', () => {
    expect(lojaParaJogador(banca({ kind: 'viagem' }))).toBeNull()
    expect(lojaParaJogador(banca({ kind: 'alavanca' }))).toBeNull()
  })
})

describe('itemAVenda e textoDoEstoque', () => {
  it('item com estoque, ou sem conta, está à venda; esgotado ou inexistente não', () => {
    expect(itemAVenda(banca(), 'xarope')?.nome).toBe('Xarope de tosse')
    expect(itemAVenda(banca(), 'agua')?.nome).toBe('Água benta')
    expect(itemAVenda(banca(), 'atadura')).toBeNull()
    expect(itemAVenda(banca(), 'inventado')).toBeNull()
  })

  it('o estoque dito ao jogador', () => {
    expect(textoDoEstoque({ id: 'a', nome: 'A', preco: '', estoque: 0 })).toBe('Acabou')
    expect(textoDoEstoque({ id: 'a', nome: 'A', preco: '', estoque: 1 })).toBe('1 em estoque')
    expect(textoDoEstoque({ id: 'a', nome: 'A', preco: '', estoque: 4 })).toBe('4 em estoque')
    expect(textoDoEstoque({ id: 'a', nome: 'A', preco: '' })).toBeNull()
  })
})

describe('venderItem', () => {
  it('tira um do estoque do item vendido, e só dele', () => {
    const vendido = venderItem(mapaCom([banca()]), 'banca', 'xarope')
    expect(vendido.pins[0]?.loja?.map((i) => i.estoque)).toEqual([2, 0, undefined])
  })

  it('item sem conta, esgotado, pino ou item inexistente: o mesmo mapa', () => {
    const mapa = mapaCom([banca()])
    expect(venderItem(mapa, 'banca', 'agua')).toBe(mapa)
    expect(venderItem(mapa, 'banca', 'atadura')).toBe(mapa)
    expect(venderItem(mapa, 'sumiu', 'xarope')).toBe(mapa)
    expect(venderItem(mapa, 'banca', 'sumiu')).toBe(mapa)
  })
})

describe('applyItemChange com venda', () => {
  it('"Vender" baixa o estoque E põe a mercadoria na mochila de quem comprou, na mesma mudança', () => {
    const mapa = mapaCom([banca()], [ana])
    const depois = applyItemChange(mapa, {
      venda: { pinId: 'banca', itemId: 'xarope' },
      mochilas: [{ tokenId: 'ana', mochila: [{ id: 'compra-1', nome: 'Xarope de tosse' }] }],
    })
    expect(depois.pins[0]?.loja?.[0]?.estoque).toBe(2)
    expect(depois.tokens[0]?.mochila).toEqual([{ id: 'compra-1', nome: 'Xarope de tosse' }])
    // A banca continua no mapa: vender não é "Pegar".
    expect(depois.pins.map((p) => p.id)).toEqual(['banca'])
  })

  it('venda de mercadoria sem conta: só a mochila muda', () => {
    const mapa = mapaCom([banca()], [ana])
    const depois = applyItemChange(mapa, {
      venda: { pinId: 'banca', itemId: 'agua' },
      mochilas: [{ tokenId: 'ana', mochila: [{ id: 'compra-1', nome: 'Água benta' }] }],
    })
    expect(depois.pins[0]).toBe(mapa.pins[0])
    expect(depois.tokens[0]?.mochila).toHaveLength(1)
  })
})

describe('sameLoja', () => {
  it('mesma lista é igual; outro preço, outro estoque ou ausente contra lista não', () => {
    const a = [{ id: 'x', nome: 'X', preco: '1', estoque: 2 }]
    expect(sameLoja(a, [{ id: 'x', nome: 'X', preco: '1', estoque: 2 }])).toBe(true)
    expect(sameLoja(undefined, undefined)).toBe(true)
    expect(sameLoja(a, [{ id: 'x', nome: 'X', preco: '2', estoque: 2 }])).toBe(false)
    expect(sameLoja(a, [{ id: 'x', nome: 'X', preco: '1' }])).toBe(false)
    expect(sameLoja(a, undefined)).toBe(false)
  })
})
