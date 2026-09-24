/**
 * LEVAR FICHA JUNTO e o PINO PRESO: a ficha levada que tem um pino preso a ela
 * (a carroça com o pino de viagem em cima) leva o pino junto. Antes, só o pino
 * da ficha que o mestre arrastava andava: a carroça ia com a Ana e o pino dela
 * ficava para trás — a viagem valia de onde a carroça não estava mais.
 *
 * Cena: Ana em (225, 225), a carroça (levada pela Ana) uma casa a leste, em
 * (275, 225), e o pino de viagem preso à carroça em (275, 225). Uma parede
 * corre em y=200 de x=250 a x=400: em cima da carroça, não da Ana.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Token, Wall } from '../types/map'
import { EMPTY_AREA_SELECTION, moveAreaSelection } from './areaSelection'
import { createEmptyMap, setTokenPosition } from './mapFactory'

const GRID = 50

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function viagem(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: `pino-${id}`, image: null, ...extra }
}

const PAREDE_NORTE_DA_CARROCA: Wall = { id: 'parede', x1: 250, y1: 200, x2: 400, y2: 200, blocksLight: true, blocksMove: true, door: null }

function estrada(walls: Wall[], pins: Pin[] = [viagem('pino-carroca', 275, 225, { presoA: 'carroca' })]): MapData {
  return {
    ...createEmptyMap('estrada', 'Estrada', 40, 20, GRID),
    walls,
    tokens: [ficha('ana', 225, 225), ficha('carroca', 275, 225, { levadoPor: 'ana' })],
    pins,
  }
}

function lugar(itens: ReadonlyArray<{ id: string; x: number; y: number }>, id: string): { x: number; y: number } {
  const achado = itens.find((item) => item.id === id)
  if (achado === undefined) throw new Error(`sem ${id}`)
  return { x: achado.x, y: achado.y }
}

describe('carry: o pino preso à ficha LEVADA anda com ela (setTokenPosition)', () => {
  it('Ana anda uma casa a leste: a carroça vem junto e o pino dela também', () => {
    const depois = setTokenPosition(estrada([]), 'ana', 275, 225)
    expect(lugar(depois.tokens, 'carroca')).toEqual({ x: 325, y: 225 })
    expect(lugar(depois.pins, 'pino-carroca')).toEqual({ x: 325, y: 225 })
  })

  it('a parede barra a carroça: o pino fica com ela, não vai com a Ana', () => {
    const depois = setTokenPosition(estrada([PAREDE_NORTE_DA_CARROCA]), 'ana', 225, 125)
    expect(lugar(depois.tokens, 'ana')).toEqual({ x: 225, y: 125 })
    expect(lugar(depois.tokens, 'carroca')).toEqual({ x: 275, y: 225 })
    expect(lugar(depois.pins, 'pino-carroca')).toEqual({ x: 275, y: 225 })
  })

  it('pino preso à Ana e pino preso à carroça: cada um anda UMA vez, pelo passo da sua ficha', () => {
    const pins = [viagem('pino-ana', 225, 225, { presoA: 'ana' }), viagem('pino-carroca', 275, 225, { presoA: 'carroca' }), viagem('solto', 500, 500)]
    const depois = setTokenPosition(estrada([], pins), 'ana', 225, 275)
    expect(lugar(depois.pins, 'pino-ana')).toEqual({ x: 225, y: 275 })
    expect(lugar(depois.pins, 'pino-carroca')).toEqual({ x: 275, y: 275 })
    expect(lugar(depois.pins, 'solto')).toEqual({ x: 500, y: 500 })
  })

  it('sem nenhum pino preso: a lista de pinos é a MESMA (nenhum render acorda)', () => {
    const antes = estrada([], [])
    const depois = setTokenPosition(antes, 'ana', 275, 225)
    expect(lugar(depois.tokens, 'carroca')).toEqual({ x: 325, y: 225 })
    expect(depois.pins).toBe(antes.pins)
  })
})

describe('carry: o pino preso à ficha LEVADA anda com ela (seta e arrasto da seleção)', () => {
  const soAna = { ...EMPTY_AREA_SELECTION, tokens: ['ana'] }

  it('seta para a direita com a Ana selecionada: a carroça e o pino dela vêm junto', () => {
    const depois = moveAreaSelection(estrada([]), soAna, GRID, 0)
    expect(lugar(depois.tokens, 'carroca')).toEqual({ x: 325, y: 225 })
    expect(lugar(depois.pins, 'pino-carroca')).toEqual({ x: 325, y: 225 })
  })

  it('arrasto para o norte: a parede barra a carroça e o pino fica com ela', () => {
    const depois = moveAreaSelection(estrada([PAREDE_NORTE_DA_CARROCA]), soAna, 0, -100)
    expect(lugar(depois.tokens, 'carroca')).toEqual({ x: 275, y: 225 })
    expect(lugar(depois.pins, 'pino-carroca')).toEqual({ x: 275, y: 225 })
  })

  it('as duas selecionadas: o pino da carroça anda UMA vez só, não duas', () => {
    const depois = moveAreaSelection(estrada([]), { ...EMPTY_AREA_SELECTION, tokens: ['ana', 'carroca'] }, GRID, 0)
    expect(lugar(depois.pins, 'pino-carroca')).toEqual({ x: 325, y: 225 })
  })
})
