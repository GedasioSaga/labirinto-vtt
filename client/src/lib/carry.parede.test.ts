/**
 * LEVAR FICHA JUNTO e a parede: a ficha levada anda o mesmo tanto de quem a
 * leva SÓ se o trajeto DELA é livre. Antes, só o passo de quem leva era
 * validado, e a ficha de outro jogador atravessava parede sólida — e passava
 * a enxergar de dentro de uma sala que o grupo nunca alcançou.
 *
 * Cena: Ana na coluna x=225, Bia (levada) uma casa a leste, em x=275. Uma
 * parede corre em y=200 de x=250 a x=400: está em cima da Bia, não da Ana.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token, Wall } from '../types/map'
import { moveAreaSelection, EMPTY_AREA_SELECTION } from './areaSelection'
import { followStep } from './carry'
import { createEmptyMap, setTokenPosition } from './mapFactory'

const GRID = 50

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

const PAREDE_NORTE_DA_BIA: Wall = { id: 'parede', x1: 250, y1: 200, x2: 400, y2: 200, blocksLight: true, blocksMove: true, door: null }

function corredor(walls: Wall[]): MapData {
  return {
    ...createEmptyMap('torre', 'Torre', 40, 20, GRID),
    walls,
    tokens: [ficha('ana', 225, 225), ficha('bia', 275, 225, { levadoPor: 'ana' })],
  }
}

function posicao(map: MapData, id: string): { x: number; y: number } {
  const t = map.tokens.find((token) => token.id === id)
  if (t === undefined) throw new Error(`sem a ficha ${id}`)
  return { x: t.x, y: t.y }
}

describe('carry: a ficha levada não atravessa parede', () => {
  it('Ana sobe 2 casas pelo corredor; Bia, barrada pela parede norte, fica onde estava', () => {
    const depois = setTokenPosition(corredor([PAREDE_NORTE_DA_BIA]), 'ana', 225, 125)
    expect(posicao(depois, 'ana')).toEqual({ x: 225, y: 125 })
    expect(posicao(depois, 'bia')).toEqual({ x: 275, y: 225 })
    // O vínculo continua: o mestre solta com o botão, não a parede.
    expect(depois.tokens.find((t) => t.id === 'bia')?.levadoPor).toBe('ana')
  })

  it('controle: sem a parede, Bia sobe as mesmas 2 casas', () => {
    const depois = setTokenPosition(corredor([]), 'ana', 225, 125)
    expect(posicao(depois, 'bia')).toEqual({ x: 275, y: 125 })
  })

  it('porta fechada barra; porta aberta deixa passar', () => {
    const fechada: Wall = { ...PAREDE_NORTE_DA_BIA, door: { kind: 'normal', open: false, locked: false } }
    expect(posicao(setTokenPosition(corredor([fechada]), 'ana', 225, 125), 'bia')).toEqual({ x: 275, y: 225 })
    const aberta: Wall = { ...fechada, door: { kind: 'normal', open: true, locked: false } }
    expect(posicao(setTokenPosition(corredor([aberta]), 'ana', 225, 125), 'bia')).toEqual({ x: 275, y: 125 })
  })

  it('para fora do mapa a ficha levada também não vai', () => {
    const map: MapData = { ...corredor([]), tokens: [ficha('ana', 225, 75), ficha('bia', 275, 25, { levadoPor: 'ana' })] }
    const depois = setTokenPosition(map, 'ana', 225, 25)
    expect(posicao(depois, 'ana')).toEqual({ x: 225, y: 25 })
    expect(posicao(depois, 'bia')).toEqual({ x: 275, y: 25 })
  })

  it('followStep: passo livre anda, passo barrado devolve a MESMA ficha', () => {
    const map = corredor([PAREDE_NORTE_DA_BIA])
    const bia = map.tokens[1]
    expect(followStep(map, bia, 0, -100)).toBe(bia)
    expect(followStep(map, bia, 50, 0)).toMatchObject({ id: 'bia', x: 325, y: 225 })
  })
})

describe('carry: seta e arrasto da seleção levam a ficha junto', () => {
  const soAna = { ...EMPTY_AREA_SELECTION, tokens: ['ana'] }

  it('a seta para a direita com a Ana selecionada: a Ana anda uma casa e a Bia vem junto', () => {
    const depois = moveAreaSelection(corredor([]), soAna, GRID, 0)
    expect(posicao(depois, 'ana')).toEqual({ x: 275, y: 225 })
    expect(posicao(depois, 'bia')).toEqual({ x: 325, y: 225 })
  })

  it('arrasto da seleção para o norte: a Bia, barrada pela parede, fica', () => {
    const depois = moveAreaSelection(corredor([PAREDE_NORTE_DA_BIA]), soAna, 0, -100)
    expect(posicao(depois, 'ana')).toEqual({ x: 225, y: 125 })
    expect(posicao(depois, 'bia')).toEqual({ x: 275, y: 225 })
  })

  it('as duas selecionadas: a Bia anda UMA vez só, não duas', () => {
    const depois = moveAreaSelection(corredor([]), { ...EMPTY_AREA_SELECTION, tokens: ['ana', 'bia'] }, GRID, 0)
    expect(posicao(depois, 'bia')).toEqual({ x: 325, y: 225 })
  })

  it('só a Bia selecionada: a Ana fica (quem é levado não arrasta quem leva)', () => {
    const depois = moveAreaSelection(corredor([]), { ...EMPTY_AREA_SELECTION, tokens: ['bia'] }, GRID, 0)
    expect(posicao(depois, 'ana')).toEqual({ x: 225, y: 225 })
    expect(posicao(depois, 'bia')).toEqual({ x: 325, y: 225 })
  })
})
