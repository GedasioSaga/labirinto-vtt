/**
 * ACERVO DE ITENS na mochila (`lib/items.ts`): a mochila de antes abre igual
 * (migração tolerante), os dados do acervo atravessam limpos, o "Dar a…" do
 * acervo empilha, e o recorte do jogador só leva a mochila ao DONO.
 */
import { describe, expect, it } from 'vitest'
import type { CarriedItem, MapData, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { darDoAcervoChange, ITEM_QUANTIDADE_MAX, podeLargarNoChao, readCarriedItems, type ItemParaDar } from './items'
import { createEmptyMap } from './mapFactory'

const IMAGEM = `midia:${'d'.repeat(64)}.webp`
const POCAO: ItemParaDar = { nome: 'Poção', itemId: 'item_pocao', imagem: IMAGEM, descricao: 'Cura 50 HP.', categoria: 'Consumível', preco: 120, empilhavel: true }
const ESPADA: ItemParaDar = { nome: 'Espada', itemId: 'item_espada', categoria: 'Arma' }

function token(mochila?: CarriedItem[]): Token {
  return { id: 'luffy', characterId: 'pers_luffy', name: 'Luffy', x: 100, y: 100, size: 1, image: null, ...(mochila === undefined ? {} : { mochila }) }
}

function mochilaDepois(base: Token, item: ItemParaDar, quantidade: number, freshId = 'novo'): CarriedItem[] {
  const change = darDoAcervoChange(base, item, quantidade, freshId)
  if (change === null) throw new Error('o "Dar" foi recusado')
  return change.mochilas[0]?.mochila ?? []
}

describe('migração tolerante da mochila', () => {
  it('a mochila de antes ({ id, nome }) abre exatamente igual', () => {
    expect(readCarriedItems([{ id: 'p1', nome: 'Chave de Rubi' }])).toEqual([{ id: 'p1', nome: 'Chave de Rubi' }])
  })

  it('os dados do acervo atravessam; quantidade 1 é o ausente', () => {
    const lidos = readCarriedItems([
      { id: 'a', nome: 'Poção', itemId: 'item_pocao', imagem: IMAGEM, descricao: 'Cura.', categoria: ' Consumível ', preco: 120, quantidade: 3, empilhavel: true },
      { id: 'b', nome: 'Espada', itemId: 'item_espada', quantidade: 1 },
    ])
    expect(lidos).toEqual([
      { id: 'a', nome: 'Poção', itemId: 'item_pocao', imagem: IMAGEM, descricao: 'Cura.', categoria: 'Consumível', preco: 120, quantidade: 3, empilhavel: true },
      { id: 'b', nome: 'Espada', itemId: 'item_espada' },
    ])
  })

  it('campo torto sai e o item fica', () => {
    const lidos = readCarriedItems([
      {
        id: 'a',
        nome: 'Poção',
        itemId: '../segredo',
        imagem: 'data:image/png;base64,iVBORw0KGgo=',
        descricao: 42,
        categoria: '',
        preco: -1,
        quantidade: 2.5,
        empilhavel: 'sim',
        segredoDoMestre: 'x',
      },
      { id: 'b', nome: 'Faca', imagem: 'C:/Users/mestre/faca.png', preco: 1e21, quantidade: ITEM_QUANTIDADE_MAX + 1 },
    ])
    expect(lidos).toEqual([
      { id: 'a', nome: 'Poção' },
      { id: 'b', nome: 'Faca' },
    ])
  })
})

describe('"Dar a…" do acervo', () => {
  it('abre vaga nova no fim com os dados do acervo', () => {
    expect(mochilaDepois(token([{ id: 'p1', nome: 'Chave' }]), POCAO, 2)).toEqual([
      { id: 'p1', nome: 'Chave' },
      { id: 'novo', nome: 'Poção', itemId: 'item_pocao', imagem: IMAGEM, descricao: 'Cura 50 HP.', categoria: 'Consumível', preco: 120, empilhavel: true, quantidade: 2 },
    ])
  })

  it('empilhável que já está na mochila soma na mesma vaga, com os dados de agora do acervo', () => {
    const antes = mochilaDepois(token(), POCAO, 2, 'vaga-pocao')
    const depois = mochilaDepois(token(antes), { ...POCAO, preco: 150 }, 3, 'nao-usado')
    expect(depois).toHaveLength(1)
    expect(depois[0]).toMatchObject({ id: 'vaga-pocao', quantidade: 5, preco: 150 })
  })

  it('a pilha para no teto', () => {
    const antes = mochilaDepois(token(), POCAO, ITEM_QUANTIDADE_MAX - 1, 'vaga')
    expect(mochilaDepois(token(antes), POCAO, 10)[0]?.quantidade).toBe(ITEM_QUANTIDADE_MAX)
  })

  it('não empilhável vai um por vez, sempre em vaga nova', () => {
    const uma = mochilaDepois(token(), ESPADA, 5, 'e1')
    const duas = mochilaDepois(token(uma), ESPADA, 1, 'e2')
    expect(duas).toEqual([
      { id: 'e1', nome: 'Espada', itemId: 'item_espada', categoria: 'Arma' },
      { id: 'e2', nome: 'Espada', itemId: 'item_espada', categoria: 'Arma' },
    ])
  })

  it('nome vazio não dá nada', () => {
    expect(darDoAcervoChange(token(), { nome: '   ' }, 1, 'x')).toBeNull()
  })

  it('largar no chão só o item simples: o do acervo perderia imagem e pilha', () => {
    expect(podeLargarNoChao({ id: 'p1', nome: 'Chave' })).toBe(true)
    expect(podeLargarNoChao({ id: 'a', nome: 'Poção', itemId: 'item_pocao' })).toBe(false)
    expect(podeLargarNoChao({ id: 'b', nome: 'Pedra', quantidade: 3 })).toBe(false)
  })
})

describe('recorte do jogador: o inventário só vai ao dono', () => {
  const pilha: CarriedItem = { id: 'a', nome: 'Poção', itemId: 'item_pocao', imagem: IMAGEM, descricao: 'Cura 50 HP.', quantidade: 3, empilhavel: true }
  const mapa: MapData = {
    ...createEmptyMap('m', 'Porto', 30, 10, 50),
    tokens: [
      { id: 'arco', characterId: 'pers_duda', name: 'Arco', x: 100, y: 100, size: 1, image: null, mochila: [pilha] },
      { id: 'zoro', characterId: 'pers_zoro', name: 'Zoro', x: 200, y: 100, size: 1, image: null, mochila: [{ ...pilha, id: 'b', descricao: 'Segredo do Zoro' }] },
    ],
  }

  it('o dono recebe a mochila com imagem, descrição e pilha; a do colega não atravessa', () => {
    const recorte = filterMapForPlayer(mapa, 'duda', { duda: ['arco'], ze: ['zoro'] }, 700).map.tokens
    expect(recorte.find((t) => t.id === 'arco')?.mochila).toEqual([pilha])
    const colega = recorte.find((t) => t.id === 'zoro')
    expect(colega).toBeDefined()
    expect(colega?.mochila).toBeUndefined()
    expect(JSON.stringify(recorte)).not.toContain('Segredo do Zoro')
  })
})
