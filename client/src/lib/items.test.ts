import { describe, expect, it } from 'vitest'
import { buildPin, createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import {
  ITEM_NAME_MAX_LENGTH,
  applyItemChange,
  carriedItemsOf,
  cleanItemName,
  itemOfPin,
  readCarriedItems,
  readPinItem,
  tokenReachesPin,
  tokensTouch,
} from './items'
import type { MapData, Pin, Token } from '../types/map'

/**
 * ITEM PEGÁVEL — as regras puras: o que é um pino pegável, o que a mochila
 * aceita do disco, o alcance da mão e a mudança que o host manda aplicar.
 */

const GRID = 40

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function chave(extra: Partial<Pin> = {}): Pin {
  return { ...buildPin('pino-chave', { x: 200, y: 200 }, 'exclamacao'), item: { nome: 'Chave do Escudo' }, ...extra }
}

function mapa(): MapData {
  return {
    ...createEmptyMap('m', 'Mansão', 20, 20, GRID),
    pins: [chave(), buildPin('pino-so-leitura', { x: 300, y: 300 }, 'interrogacao')],
    tokens: [token('diego', 180, 200), token('bruno', 230, 200)],
  }
}

describe('itemOfPin: o que é pegável', () => {
  it('pino com nome é pegável; sem campo, com nome vazio ou de viagem não é', () => {
    expect(itemOfPin(chave())).toEqual({ nome: 'Chave do Escudo' })
    expect(itemOfPin(buildPin('p', { x: 0, y: 0 }, 'exclamacao'))).toBeNull()
    expect(itemOfPin(chave({ item: { nome: '   ' } }))).toBeNull()
    expect(itemOfPin(chave({ kind: 'viagem' }))).toBeNull()
  })

  it('livre só quando o campo diz true', () => {
    expect(itemOfPin(chave({ item: { nome: 'Chave', livre: true } }))).toEqual({ nome: 'Chave', livre: true })
  })
})

describe('leitura do disco', () => {
  it('readPinItem: forma certa passa aparada; lixo volta ausente', () => {
    expect(readPinItem({ nome: '  Chave  ', livre: true })).toEqual({ nome: 'Chave', livre: true })
    expect(readPinItem({ nome: 'Chave', livre: 'sim' })).toEqual({ nome: 'Chave' })
    expect(readPinItem({ nome: '' })).toBeUndefined()
    expect(readPinItem('Chave')).toBeUndefined()
    expect(readPinItem(null)).toBeUndefined()
    expect(readPinItem(undefined)).toBeUndefined()
    expect(readPinItem({ nome: 'x'.repeat(ITEM_NAME_MAX_LENGTH + 10) })?.nome).toHaveLength(ITEM_NAME_MAX_LENGTH)
  })

  it('readCarriedItems: só itens com id e nome; lista vazia ou lixo volta ausente', () => {
    expect(readCarriedItems([{ id: 'a', nome: 'Chave' }, { id: 7, nome: 'x' }, null, { id: 'b', nome: '' }])).toEqual([{ id: 'a', nome: 'Chave' }])
    expect(readCarriedItems([])).toBeUndefined()
    expect(readCarriedItems('mochila')).toBeUndefined()
    expect(readCarriedItems(undefined)).toBeUndefined()
  })

  it('mapa gravado com item e mochila volta igual do disco', () => {
    const antes: MapData = { ...mapa(), tokens: [token('diego', 180, 200, { mochila: [{ id: 'velho', nome: 'Lanterna' }] })] }
    const depois = deserializeMap(serializeMap(antes))
    expect(depois.pins.find((p) => p.id === 'pino-chave')?.item).toEqual({ nome: 'Chave do Escudo' })
    expect(depois.tokens[0]?.mochila).toEqual([{ id: 'velho', nome: 'Lanterna' }])
  })

  it('mapa de antes do campo abre sem item e com mochila vazia', () => {
    const cru = JSON.parse(serializeMap(mapa())) as Record<string, unknown>
    const pins = (cru.pins as Record<string, unknown>[]).map(({ item: _item, ...resto }) => resto)
    const depois = deserializeMap(JSON.stringify({ ...cru, pins }))
    expect(depois.pins.every((p) => p.item === undefined)).toBe(true)
    expect(carriedItemsOf(depois.tokens[0] ?? token('x', 0, 0))).toEqual([])
  })
})

describe('alcance da mão', () => {
  it('a ficha pega o pino encostado (até uma casa além da borda), não o do outro lado da sala', () => {
    expect(tokenReachesPin(token('d', 180, 200), chave(), GRID)).toBe(true)
    expect(tokenReachesPin(token('d', 100, 200), chave(), GRID)).toBe(false)
  })

  it('duas fichas se tocam até uma casa de folga entre as bordas', () => {
    expect(tokensTouch(token('a', 180, 200), token('b', 260, 200), GRID)).toBe(true)
    expect(tokensTouch(token('a', 180, 200), token('b', 400, 200), GRID)).toBe(false)
  })
})

describe('applyItemChange: o que o host manda aplicar', () => {
  it('pegar: o pino sai do mapa e o item entra na mochila da ficha', () => {
    const depois = applyItemChange(mapa(), { removePinId: 'pino-chave', mochilas: [{ tokenId: 'diego', mochila: [{ id: 'pino-chave', nome: 'Chave do Escudo' }] }] })
    expect(depois.pins.map((p) => p.id)).toEqual(['pino-so-leitura'])
    expect(depois.tokens.find((t) => t.id === 'diego')?.mochila).toEqual([{ id: 'pino-chave', nome: 'Chave do Escudo' }])
    expect(depois.tokens.find((t) => t.id === 'bruno')?.mochila).toBeUndefined()
  })

  it('dar: as duas mochilas trocam no mesmo passo; mochila vazia some do token', () => {
    const inicio: MapData = { ...mapa(), tokens: [token('diego', 180, 200, { mochila: [{ id: 'c', nome: 'Chave' }] }), token('bruno', 230, 200)] }
    const depois = applyItemChange(inicio, {
      mochilas: [
        { tokenId: 'diego', mochila: [] },
        { tokenId: 'bruno', mochila: [{ id: 'c', nome: 'Chave' }] },
      ],
    })
    expect(depois.tokens.find((t) => t.id === 'diego')).not.toHaveProperty('mochila')
    expect(depois.tokens.find((t) => t.id === 'bruno')?.mochila).toEqual([{ id: 'c', nome: 'Chave' }])
  })

  it('ficha ou pino que não existem mais: nada muda, mesmo objeto', () => {
    const inicio = mapa()
    expect(applyItemChange(inicio, { removePinId: 'nao-existe', mochilas: [{ tokenId: 'fantasma', mochila: [] }] })).toBe(inicio)
  })
})

describe('cleanItemName', () => {
  it('apara e corta no teto', () => {
    expect(cleanItemName('  Chave  ')).toBe('Chave')
    expect(cleanItemName('y'.repeat(ITEM_NAME_MAX_LENGTH + 1))).toHaveLength(ITEM_NAME_MAX_LENGTH)
  })
})
