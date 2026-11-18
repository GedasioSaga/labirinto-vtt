import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { luzesDosItens } from './luzDoItem'
import { itemDoCatalogoLido, itemParaDar } from './acervoDeItens'
import { readCarriedItems } from './items'
import type { LuzDoItem, MapData, Prop, Token } from '../types/map'

// ITEM QUE ILUMINA (pedido de 18/11/2026): a luz nasce na leitura — do item no
// chão e da vaga acesa na mochila —, nunca do baú fechado; e a luz do item
// atravessa o Acervo, a cópia dada e a leitura da mochila sem se perder.

const TOCHA: LuzDoItem = { cor: '#ffd29c', alcanceEmCasas: 3, forca: 0.8, crepita: true }
const GRADE = 50

function objeto(id: string, extra: Partial<Prop> = {}): Prop {
  return { id, src: '', x: 200, y: 300, width: 50, height: 50, linkedMapPath: null, ...extra }
}

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: 'Herói', x: 500, y: 600, size: 1, image: null, ...extra }
}

function mapa(props: Prop[], tokens: Token[]): MapData {
  return { ...createEmptyMap('m1', 'Mesa', 40, 40, GRADE), props, tokens }
}

describe('luzesDosItens: no chão e na mão acesa, nunca no baú', () => {
  it('o item no chão clareia no lugar dele e a vaga acesa clareia presa à ficha, com piso, camada e crepitar', () => {
    const chao = objeto('p-tocha', { item: { nome: 'Tocha', luz: TOCHA }, piso: 1, camada: 'objetos' })
    const levando = ficha('t-ana', { piso: 1, mochila: [{ id: 'v1', nome: 'Lampião', luz: { cor: '#ffe2b0', alcanceEmCasas: 2, forca: 0.6 }, acesa: true }] })

    const luzes = luzesDosItens(mapa([chao], [levando]))

    expect(luzes).toEqual([
      { id: 'item:p-tocha', x: 200, y: 300, radius: 3 * GRADE, color: '#ffd29c', intensity: 0.8, piso: 1, camada: 'objetos', crepita: true },
      { id: 'item:t-ana:v1', x: 500, y: 600, radius: 2 * GRADE, color: '#ffe2b0', intensity: 0.6, piso: 1, attachedTokenId: 't-ana' },
    ])
  })

  it('apagada na mochila, dentro do baú e oculta para o jogador não clareiam (o mestre vê a oculta)', () => {
    const bau = objeto('p-bau', { conteudo: { itens: [{ item: { nome: 'Tocha', luz: TOCHA }, quantidade: 1 }], moedas: 0, armadilha: null } })
    const oculta = objeto('p-oculta', { item: { nome: 'Vela', luz: TOCHA }, secret: true })
    const apagada = ficha('t-beto', { mochila: [{ id: 'v2', nome: 'Lampião', luz: TOCHA }] })
    const map = mapa([bau, oculta], [apagada])

    expect(luzesDosItens(map, { doJogador: true })).toEqual([])
    expect(luzesDosItens(map).map((l) => l.id)).toEqual(['item:p-oculta'])
  })
})

describe('a luz do item vai e volta sem se perder', () => {
  it('Acervo → cópia dada → mochila lida: a luz chega igual, com o alcance e a força presos nos tetos', () => {
    const lido = itemDoCatalogoLido({ id: 'item_tocha', nome: 'Tocha', imagem: null, descricao: '', categoria: '', preco: null, empilhavel: false, luz: { cor: '#FFD29C', alcanceEmCasas: 99, forca: 0, crepita: true } })
    expect(lido?.luz).toEqual({ cor: '#ffd29c', alcanceEmCasas: 20, forca: 0.1, crepita: true })
    if (lido === null) throw new Error('item não lido')

    const dado = itemParaDar(lido, [])
    const mochila = readCarriedItems([{ id: 'v1', ...dado, acesa: true }])

    expect(mochila).toEqual([{ id: 'v1', nome: 'Tocha', itemId: 'item_tocha', luz: { cor: '#ffd29c', alcanceEmCasas: 20, forca: 0.1, crepita: true }, acesa: true }])
  })

  it('luz torta sai e o item fica; aceso sem luz não vale', () => {
    const mochila = readCarriedItems([
      { id: 'v1', nome: 'Pedra', luz: { cor: 'vermelho', alcanceEmCasas: 3, forca: 0.5 }, acesa: true },
      { id: 'v2', nome: 'Vela', luz: { cor: '#ffe9c2', alcanceEmCasas: '3', forca: 0.5 } },
    ])

    expect(mochila).toEqual([
      { id: 'v1', nome: 'Pedra' },
      { id: 'v2', nome: 'Vela' },
    ])
  })
})
