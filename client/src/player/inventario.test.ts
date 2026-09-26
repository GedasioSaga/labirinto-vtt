import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import {
  CONDITION_WORDS,
  INVENTORY_COLUMNS,
  INVENTORY_MIN_SLOTS,
  emptySlotCount,
  gridMove,
  inventoryCharacters,
  inventoryCondition,
  inventorySlots,
  itemGlyph,
  payerFor,
  slotLine,
} from './inventario'

/**
 * INVENTÁRIO ESTILO RESIDENT EVIL — as regras puras da tela: a condição sai
 * SÓ do que o jogador já recebe (a proporção da vida, quando o mestre mostra),
 * a grade junta itens de mesmo nome com a quantidade, e as setas andam de vaga
 * em vaga numa grade de 4 colunas.
 */

const FOTO = 'data:image/png;base64,iVBORw0KGgo='

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null, ...extra }
}

function mapa(tokens: Token[]): MapData {
  return { ...createEmptyMap('m1', '', 12, 6, 50), tokens }
}

describe('inventoryCondition: Bem, Cuidado, Perigo, ou oculta', () => {
  it('sem vida no recorte (o mestre esconde) a condição é oculta, nunca um palpite', () => {
    expect(inventoryCondition(ficha('a', 'Jill', 100))).toEqual({ kind: 'hidden' })
    expect(inventoryCondition(ficha('a', 'Jill', 100, { health: null }))).toEqual({ kind: 'hidden' })
  })

  it('vida que chegou sem a marca de "jogadores veem" também fica oculta', () => {
    expect(inventoryCondition(ficha('a', 'Jill', 100, { health: { current: 90, max: 100, shownToPlayers: false } }))).toEqual({ kind: 'hidden' })
  })

  it('os cortes são os mesmos da barra sob a ficha: acima de 50% bem, até 50% cuidado, até 25% perigo', () => {
    const com = (current: number) => inventoryCondition(ficha('a', 'Jill', 100, { health: { current, max: 100, shownToPlayers: true } }))
    expect(com(100)).toEqual({ kind: 'known', state: 'fine' })
    expect(com(51)).toEqual({ kind: 'known', state: 'fine' })
    expect(com(50)).toEqual({ kind: 'known', state: 'caution' })
    expect(com(26)).toEqual({ kind: 'known', state: 'caution' })
    expect(com(25)).toEqual({ kind: 'known', state: 'danger' })
    expect(com(0)).toEqual({ kind: 'known', state: 'danger' })
  })

  it('as palavras são as do RE em português', () => {
    expect(CONDITION_WORDS).toEqual({ fine: 'Bem', caution: 'Cuidado', danger: 'Perigo' })
  })
})

describe('inventorySlots: a bolsa primeiro, depois os itens juntados por nome', () => {
  it('itens de mesmo nome viram uma vaga com a quantidade e os ids na ordem em que chegaram', () => {
    const slots = inventorySlots(
      ficha('a', 'Jill', 100, {
        moedas: 15,
        mochila: [
          { id: 'erva-1', nome: 'Erva verde' },
          { id: 'chave-1', nome: 'Chave do Escudo' },
          { id: 'erva-2', nome: 'Erva verde' },
        ],
      }),
    )
    expect(slots.map((s) => [s.kind, s.nome, s.quantidade, s.itemIds])).toEqual([
      ['moedas', 'Moedas', 15, []],
      ['item', 'Erva verde', 2, ['erva-1', 'erva-2']],
      ['item', 'Chave do Escudo', 1, ['chave-1']],
    ])
    expect(new Set(slots.map((s) => s.key)).size).toBe(3)
  })

  it('sem moedas não há vaga de bolsa; sem nada, a lista é vazia', () => {
    expect(inventorySlots(ficha('a', 'Jill', 100, { mochila: [{ id: 'x', nome: 'Faca' }] })).map((s) => s.kind)).toEqual(['item'])
    expect(inventorySlots(ficha('a', 'Jill', 100, { moedas: 0 }))).toEqual([])
    expect(inventorySlots(ficha('a', 'Jill', 100))).toEqual([])
  })
})

describe('itemGlyph: o desenho da vaga sai do nome', () => {
  it.each([
    ['Chave do Escudo', 'chave'],
    ['Erva verde', 'erva'],
    ['Poção de cura', 'frasco'],
    ['Carta da mãe', 'papel'],
    ['Mapa do esgoto', 'papel'],
    ['Faca de combate', 'arma'],
    ['Anel de prata', 'item'],
  ])('%s → %s', (nome, glifo) => {
    expect(itemGlyph(nome)).toBe(glifo)
  })
})

describe('grade de 4 colunas', () => {
  it('vagas vazias completam a fileira e a grade nunca tem menos de 8', () => {
    expect(INVENTORY_COLUMNS).toBe(4)
    expect(INVENTORY_MIN_SLOTS).toBe(8)
    expect(emptySlotCount(0)).toBe(8)
    expect(emptySlotCount(3)).toBe(5)
    expect(emptySlotCount(8)).toBe(0)
    expect(emptySlotCount(9)).toBe(3)
  })

  it('setas andam de vaga em vaga; sem vaga embaixo, fica onde está', () => {
    expect(gridMove(0, 'ArrowRight', 6, false)).toBe(1)
    expect(gridMove(3, 'ArrowRight', 6, false)).toBe(4)
    expect(gridMove(5, 'ArrowRight', 6, false)).toBe(5)
    expect(gridMove(4, 'ArrowLeft', 6, false)).toBe(3)
    expect(gridMove(0, 'ArrowLeft', 6, false)).toBe(0)
    expect(gridMove(1, 'ArrowDown', 6, false)).toBe(5)
    expect(gridMove(2, 'ArrowDown', 6, false)).toBe(2)
    expect(gridMove(5, 'ArrowUp', 6, false)).toBe(1)
    expect(gridMove(1, 'ArrowUp', 6, false)).toBe(1)
  })

  it('Home e End vão às pontas da fileira; com Ctrl, às pontas da grade', () => {
    expect(gridMove(6, 'Home', 7, false)).toBe(4)
    expect(gridMove(4, 'End', 6, false)).toBe(5)
    expect(gridMove(1, 'End', 6, false)).toBe(3)
    expect(gridMove(5, 'Home', 6, true)).toBe(0)
    expect(gridMove(0, 'End', 6, true)).toBe(5)
  })

  it('outra tecla não é da grade', () => {
    expect(gridMove(0, 'a', 6, false)).toBeNull()
    expect(gridMove(0, 'Enter', 6, false)).toBeNull()
  })
})

describe('slotLine: a linha que descreve a vaga escolhida', () => {
  it('fala da própria ficha como "sua" e da ficha emprestada pelo nome', () => {
    const [bolsa, erva, chave] = inventorySlots(
      ficha('a', 'Jill', 100, {
        moedas: 1,
        mochila: [
          { id: 'e1', nome: 'Erva verde' },
          { id: 'e2', nome: 'Erva verde' },
          { id: 'c1', nome: 'Chave' },
        ],
      }),
    )
    expect(slotLine(bolsa, { name: 'Jill', editable: true })).toBe('1 moeda na sua bolsa.')
    expect(slotLine(erva, { name: 'Jill', editable: true })).toBe('2 na sua mochila.')
    expect(slotLine(chave, { name: 'Jill', editable: true })).toBe('Na sua mochila.')
    expect(slotLine(chave, { name: 'Carlos', editable: false })).toBe('Na mochila de Carlos.')
  })
})

describe('inventoryCharacters: só as fichas do próprio jogador, com o que ele já recebe', () => {
  const jill = ficha('jill', 'Jill', 100, {
    imageData: FOTO,
    color: '#ff8800',
    health: { current: 40, max: 100, shownToPlayers: true },
    conditions: ['envenenado'],
    moedas: 15,
    mochila: [{ id: 'chave-1', nome: 'Chave do Escudo' }],
  })
  const diego = ficha('diego', 'Diego', 150)
  const npc = ficha('guarda', 'Guarda', 150, { y: 150 })
  const longe = ficha('bruno', 'Bruno', 500)
  const carlos = ficha('carlos', 'Carlos', 600, { emprestada: true })

  it('uma entrada por ficha dele que está no mapa, a própria primeiro', () => {
    const lista = inventoryCharacters(mapa([carlos, jill, diego, npc, longe]), ['carlos', 'jill', 'sumida'], ['diego', 'bruno'], '#4ea1ff')
    expect(lista.map((c) => [c.tokenId, c.editable])).toEqual([
      ['jill', true],
      ['carlos', false],
    ])
  })

  it('foto, cor, condição, condições de mesa, vagas e bolsa vêm da ficha que chegou', () => {
    const [eu] = inventoryCharacters(mapa([jill, diego]), ['jill'], ['diego'], '#4ea1ff')
    expect(eu.name).toBe('Jill')
    expect(eu.photo).toBe(FOTO)
    expect(eu.color).toBe('#ff8800')
    expect(eu.condition).toEqual({ kind: 'known', state: 'caution' })
    expect(eu.conditions).toEqual(['envenenado'])
    expect(eu.moedas).toBe(15)
    expect(eu.slots.map((s) => s.nome)).toEqual(['Moedas', 'Chave do Escudo'])
  })

  it('sem foto nem cor: foto nula e a cor de "este é o seu"', () => {
    const [eu] = inventoryCharacters(mapa([ficha('jill', 'Jill', 100)]), ['jill'], [], '#4ea1ff')
    expect(eu.photo).toBeNull()
    expect(eu.color).toBe('#4ea1ff')
    expect(eu.condition).toEqual({ kind: 'hidden' })
  })

  it('colegas são fichas de OUTROS jogadores encostadas NESTA ficha: NPC e colega longe ficam de fora', () => {
    const [eu] = inventoryCharacters(mapa([jill, diego, npc, longe]), ['jill'], ['diego', 'bruno'], '#4ea1ff')
    expect(eu.colleagues.map((c) => ({ tokenId: c.tokenId, name: c.name }))).toEqual([{ tokenId: 'diego', name: 'Diego' }])
  })

  it('SEGURANÇA: nada de pontos de vida sai daqui — só o estado', () => {
    const [eu] = inventoryCharacters(mapa([jill]), ['jill'], [], '#4ea1ff')
    expect(eu).not.toHaveProperty('health')
    expect(JSON.stringify(eu)).not.toMatch(/"current"|"max"|shownToPlayers/)
  })
})

describe('quem paga o "Pagar a…": a mesma escolha do host', () => {
  // O host (`handleCoinsGive`, net/hostSession.ts) cobra da PRIMEIRA ficha do
  // jogador, na ordem do mapa, encostada no colega e com moedas bastantes — o
  // `coins.give` não diz de qual ficha sai. Aqui: o ajudante Carlos (20)
  // vem ANTES da Jill (5) no mapa, e os dois encostam no Diego.
  const carlos = ficha('carlos', 'Carlos', 100, { y: 150, emprestada: true, moedas: 20 })
  const jill = ficha('jill', 'Jill', 100, { moedas: 5 })
  const diego = ficha('diego', 'Diego', 150, { y: 125 })

  function colegaDaJill(tokens: Token[]) {
    const eu = inventoryCharacters(mapa(tokens), ['jill', 'carlos'], ['diego'], '#4ea1ff').find((c) => c.tokenId === 'jill')
    const colega = eu?.colleagues[0]
    if (colega === undefined) throw new Error('a Jill deveria ter o Diego como colega')
    return colega
  }

  it('cada colega traz as fichas DELE que o pagam, na ordem do mapa — também as que não são a aberta', () => {
    expect(colegaDaJill([carlos, jill, diego]).payers).toEqual([
      { tokenId: 'carlos', name: 'Carlos', editable: false, moedas: 20 },
      { tokenId: 'jill', name: 'Jill', editable: true, moedas: 5 },
    ])
  })

  it('paga a primeira com o bastante; sem ninguém com o bastante, ninguém paga', () => {
    expect(payerFor(colegaDaJill([carlos, jill, diego]), 3)?.tokenId).toBe('carlos')
    expect(payerFor(colegaDaJill([carlos, jill, diego]), 21)).toBeUndefined()
    expect(payerFor(colegaDaJill([{ ...carlos, moedas: 2 }, jill, diego]), 3)?.tokenId).toBe('jill')
  })
})
