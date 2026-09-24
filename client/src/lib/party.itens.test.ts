import { describe, expect, it } from 'vitest'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import type { MapData, Token } from '../types/map'
import { applyItemChange } from './items'
import { buildPin, createEmptyMap } from './mapFactory'
import { partyItemChange, partyMembers } from './party'

/**
 * ITEM PEGÁVEL no Grupo do mestre: ele VÊ quem tem o quê (e em que ficha),
 * TIRA o item (a chave usada), DEVOLVE ao chão (vira pino pegável ao lado da
 * ficha) e DÁ um item novo a um jogador — sem papel ao lado da mesa.
 */

const CHAVE = { id: 'pino-chave', nome: 'Chave do Escudo' }

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 200, y: 120, size: 1, image: null, ...extra }
}

function mansao(tokens: Token[], pins = [buildPin('outro', { x: 10, y: 10 }, 'exclamacao')]): MapData {
  return { ...createEmptyMap('mapa-mansao', 'Mansão', 1000, 1000, 40), tokens, pins }
}

/** Salão aberto no editor; Diego (com a chave) na Mansão, de fundo. */
function mundo(tokens: Token[] = [ficha('diego', { mochila: [CHAVE] })], pins?: MapData['pins']): HostWorld {
  return {
    open: { sceneId: 'cena-salao', name: 'Salão', map: createEmptyMap('mapa-salao', 'Salão', 1000, 1000, 40) },
    background: [{ sceneId: 'cena-mansao', name: 'Mansão', map: mansao(tokens, pins) }],
  }
}

const DIEGO: PlayerInfo = {
  clientId: 'c1',
  playerId: 'p-diego',
  name: 'Diego',
  status: 'playing',
  connected: true,
  tokenIds: ['diego'],
  visionRadius: 700,
  sceneId: 'cena-mansao',
  sceneName: 'Mansão',
}

function membroDiego(world: HostWorld) {
  const [membro] = partyMembers([DIEGO], world)
  if (membro === undefined) throw new Error('sem membro')
  return membro
}

describe('Grupo: a mochila diz em que ficha e cena está cada item', () => {
  it('cada item leva a ficha e a cena, para o mestre poder agir nele', () => {
    expect(membroDiego(mundo()).mochila).toEqual([{ ...CHAVE, tokenId: 'diego', sceneId: 'cena-mansao' }])
  })
})

describe('partyItemChange', () => {
  it('Tirar: a chave usada sai da mochila e não volta ao mapa', () => {
    const world = mundo()
    const [item] = membroDiego(world).mochila
    if (item === undefined) throw new Error('sem item')
    const change = partyItemChange(world, { kind: 'tirar', item }, 'novo-id')
    expect(change).toEqual({ sceneId: 'cena-mansao', mochilas: [{ tokenId: 'diego', mochila: [] }] })
  })

  it('Devolver ao chão: sai da mochila e vira pino pegável, com o mesmo nome, onde a ficha está', () => {
    const world = mundo()
    const [item] = membroDiego(world).mochila
    if (item === undefined) throw new Error('sem item')
    const change = partyItemChange(world, { kind: 'devolver', item }, 'novo-id')
    if (change === null) throw new Error('esperava mudança')
    const [cena] = world.background
    if (cena === undefined) throw new Error('sem cena')
    const depois = applyItemChange(cena.map, change)
    expect(change.sceneId).toBe('cena-mansao')
    expect(depois.tokens.find((t) => t.id === 'diego')?.mochila).toBeUndefined()
    const pino = depois.pins.find((p) => p.id === CHAVE.id)
    expect(pino).toMatchObject({ x: 200, y: 120, kind: 'exclamacao', item: { nome: CHAVE.nome } })
    // Aplicar de novo (um passo do desfazer que já tem o pino) não o duplica.
    expect(applyItemChange(depois, change).pins.filter((p) => p.id === CHAVE.id)).toHaveLength(1)
  })

  it('Devolver quando já existe pino com o id do item: o pino novo ganha outro id, não some nem sobrescreve', () => {
    const world = mundo(undefined, [buildPin(CHAVE.id, { x: 10, y: 10 }, 'interrogacao')])
    const [item] = membroDiego(world).mochila
    if (item === undefined) throw new Error('sem item')
    const change = partyItemChange(world, { kind: 'devolver', item }, 'novo-id')
    expect(change?.addPin?.id).toBe('novo-id')
  })

  it('Dar: o mestre dá um item novo, com o nome aparado, à ficha do jogador na cena dele', () => {
    const world = mundo([ficha('diego')])
    const change = partyItemChange(world, { kind: 'dar', member: membroDiego(world), nome: '  Mapa do Porão  ' }, 'item-1')
    expect(change).toEqual({ sceneId: 'cena-mansao', mochilas: [{ tokenId: 'diego', mochila: [{ id: 'item-1', nome: 'Mapa do Porão' }] }] })
  })

  it('Dar sem nome, a jogador sem ficha, ou item de ficha que já não está lá: nada muda', () => {
    const world = mundo([ficha('diego')])
    expect(partyItemChange(world, { kind: 'dar', member: membroDiego(world), nome: '   ' }, 'x')).toBeNull()
    expect(partyItemChange(world, { kind: 'dar', member: { ...membroDiego(world), token: null }, nome: 'Tocha' }, 'x')).toBeNull()
    expect(partyItemChange(world, { kind: 'tirar', item: { ...CHAVE, tokenId: 'diego', sceneId: 'cena-mansao' } }, 'x')).toBeNull()
    expect(partyItemChange(world, { kind: 'tirar', item: { ...CHAVE, tokenId: 'sumiu', sceneId: 'cena-mansao' } }, 'x')).toBeNull()
  })

  it('item na cena ABERTA: a mudança vem sem sceneId (é o editor que grava)', () => {
    const world: HostWorld = { open: { sceneId: 'cena-mansao', name: 'Mansão', map: mansao([ficha('diego', { mochila: [CHAVE] })]) }, background: [] }
    const [item] = membroDiego(world).mochila
    if (item === undefined) throw new Error('sem item')
    expect(partyItemChange(world, { kind: 'tirar', item }, 'x')).toEqual({ mochilas: [{ tokenId: 'diego', mochila: [] }] })
  })
})
