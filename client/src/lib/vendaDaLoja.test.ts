/**
 * Fase 5 (uma porta para criar item): a venda da banca e a troca do mestre
 * escolhendo do Acervo. No máximo 2 testes por caso.
 */
import { describe, expect, it } from 'vitest'
import type { LojaItem, Token } from '../types/map'
import { lerLojaDoArquivo } from './loja'
import { cleanTradeTerms, tradeChange } from './troca'
import { vendaNaFicha } from './vendaDaLoja'

const FOTO = `midia:${'b'.repeat(64)}.webp`
const POCAO = { itemId: 'item_pocao', imagem: FOTO, categoria: 'Consumível', preco: 30, empilhavel: true as const }

describe('a venda da banca', () => {
  it('a Poção do Acervo chega com foto, empilha com a que ele já tem e a bolsa paga; a leitura do disco guarda a coisa', () => {
    const [lida] = lerLojaDoArquivo([{ id: 'm1', nome: 'Poção', preco: '30 berries', estoque: 2, acervo: { ...POCAO, lixo: 'x' } }]) ?? []
    if (lida === undefined) throw new Error('a mercadoria sumiu na leitura')
    expect(lida.acervo).toEqual(POCAO)
    const mochila = [{ id: 'vaga_pocao', nome: 'Poção', itemId: 'item_pocao', imagem: FOTO, empilhavel: true as const }]
    const vendida = vendaNaFicha(mochila, 100, lida, 'nova')
    expect(vendida).toEqual({ mochila: [{ ...mochila[0], categoria: 'Consumível', preco: 30, quantidade: 2 }], moedas: 70 })
  })

  it('sem moedas a venda não sai; a mercadoria digitada continua como antes (vaga nova, bolsa igual)', () => {
    const doAcervo: LojaItem = { id: 'm1', nome: 'Poção', preco: '30 berries', acervo: POCAO }
    expect(vendaNaFicha([], 29, doAcervo, 'nova')).toBe('semMoedas')
    expect(vendaNaFicha([], 0, { id: 'm2', nome: 'Vela', preco: 'uma moeda' }, 'nova')).toEqual({ mochila: [{ id: 'nova', nome: 'Vela' }], moedas: null })
  })
})

describe('a troca do mestre com coisa do Acervo', () => {
  it('o item de mesmo nome chega inteiro (foto, itemId) e empilha; o nome solto continua só nome', () => {
    const token = { id: 'tok', name: 'Aira', x: 0, y: 0, size: 1, mochila: [{ id: 'v1', nome: 'Poção', itemId: 'item_pocao', empilhavel: true as const }] } as unknown as Token // só os campos que a troca lê; o resto do token não importa aqui
    const termos = cleanTradeTerms({ de: 'Zulmira', dou: { itens: ['Poção', 'Vela'], moedas: 0, doAcervo: [{ nome: 'Poção', ...POCAO }] }, peco: { itemIds: [], moedas: 0 } })
    if (termos === null) throw new Error('a oferta foi recusada')
    let n = 0
    const change = tradeChange(token, termos.dou, termos.peco, () => `novo_${++n}`)
    const mochila = change?.mochilas[0]?.mochila ?? []
    expect(mochila.map((item) => [item.nome, item.itemId, item.quantidade])).toEqual([
      ['Poção', 'item_pocao', 2],
      ['Vela', undefined, undefined],
    ])
  })
})
