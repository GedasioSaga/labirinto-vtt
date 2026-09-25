/**
 * LEVAR FICHA JUNTO em mapa com PISOS: a ficha levada é barrada só pela
 * planta do piso DELA. Antes, quem leva era validado no piso dele e a levada
 * no mapa inteiro — no 1º piso, o Ferido parava numa linha invisível que era a
 * parede do térreo, e o jogador lá em cima via um pedaço da planta de baixo.
 *
 * Cena: térreo com uma parede em x=600 de ponta a ponta e chão só à esquerda
 * dela; 1º piso é um salão aberto. Caio (x=475) leva o Ferido (x=525), com uma
 * maca presa ao Ferido. Os dois sobem pela escada e o Caio anda 4 casas a leste.
 */
import { describe, expect, it } from 'vitest'
import type { FloorPiece, MapData, Pin, Token, Wall } from '../types/map'
import { EMPTY_AREA_SELECTION, moveAreaSelection } from './areaSelection'
import { createEmptyMap, setTokenPosition } from './mapFactory'
import { comFichaNoPiso } from './pisos'

const GRID = 50
const LESTE = 4 * GRID

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1: x, y1: 0, x2: x, y2: 1000, blocksLight: true, blocksMove: true, door: null, ...extra }
}

/** Chão do térreo: só a metade oeste (x de 0 a 590). */
const CHAO_TERREO: FloorPiece = { id: 'chao-terreo', shape: { kind: 'rect', cx: 295, cy: 500, w: 590, h: 1000 }, op: 'add', modifiers: {} }

const MACA: Pin = { id: 'maca', x: 525, y: 475, kind: 'exclamacao', description: 'maca', image: null, presoA: 'ferido' }

/** Os dois no térreo, ainda embaixo; `sobem` os leva ao 1º piso pelo caminho real (`comFichaNoPiso`). */
function torre(walls: Wall[], floor: FloorPiece[] = []): MapData {
  return {
    ...createEmptyMap('torre', 'Torre', 40, 20, GRID),
    walls,
    floor,
    tokens: [ficha('caio', 475, 475), ficha('ferido', 525, 475, { levadoPor: 'caio' })],
    pins: [MACA],
  }
}

function sobem(map: MapData): MapData {
  return comFichaNoPiso(map, 'caio', 1)
}

function fichaEm(map: MapData, id: string): Token {
  const t = map.tokens.find((token) => token.id === id)
  if (t === undefined) throw new Error(`sem a ficha ${id}`)
  return t
}

function pino(map: MapData, id: string): Pin {
  const p = map.pins.find((pin) => pin.id === id)
  if (p === undefined) throw new Error(`sem o pino ${id}`)
  return p
}

describe('carry + pisos: a parede do térreo não segura quem está no 1º piso', () => {
  it('Caio anda 4 casas a leste no 1º piso: o Ferido e a maca vão junto, através de onde embaixo há parede', () => {
    const noPrimeiro = sobem(torre([parede('terreo', 600)]))
    expect(fichaEm(noPrimeiro, 'ferido').piso).toBe(1)
    const depois = setTokenPosition(noPrimeiro, 'caio', 475 + LESTE, 475)
    expect(fichaEm(depois, 'caio')).toMatchObject({ x: 675, y: 475, piso: 1 })
    expect(fichaEm(depois, 'ferido')).toMatchObject({ x: 725, y: 475, piso: 1, levadoPor: 'caio' })
    expect(pino(depois, 'maca')).toMatchObject({ x: 725, y: 475 })
  })

  it('o chão do térreo também não conta lá em cima: sem chão no 1º piso, o Ferido anda livre', () => {
    const noPrimeiro = sobem(torre([], [CHAO_TERREO]))
    const depois = setTokenPosition(noPrimeiro, 'caio', 475 + LESTE, 475)
    expect(fichaEm(depois, 'ferido')).toMatchObject({ x: 725, y: 475 })
  })

  it('a parede do PRÓPRIO 1º piso continua segurando o Ferido', () => {
    const noPrimeiro = sobem(torre([parede('primeiro', 600, { piso: 1 })]))
    const depois = setTokenPosition(noPrimeiro, 'caio', 475 + LESTE, 475)
    expect(fichaEm(depois, 'ferido')).toMatchObject({ x: 525, y: 475, levadoPor: 'caio' })
    expect(pino(depois, 'maca')).toMatchObject({ x: 525, y: 475 })
  })

  it('no térreo a parede do térreo segura como antes', () => {
    const depois = setTokenPosition(torre([parede('terreo', 600)]), 'caio', 475 + LESTE, 475)
    expect(fichaEm(depois, 'caio')).toMatchObject({ x: 675, y: 475 })
    expect(fichaEm(depois, 'ferido')).toMatchObject({ x: 525, y: 475 })
  })

  it('arrasto da seleção do mestre no 1º piso: o Ferido também atravessa onde embaixo há parede', () => {
    const noPrimeiro = sobem(torre([parede('terreo', 600)]))
    const depois = moveAreaSelection(noPrimeiro, { ...EMPTY_AREA_SELECTION, tokens: ['caio'] }, LESTE, 0)
    expect(fichaEm(depois, 'caio')).toMatchObject({ x: 675, y: 475 })
    expect(fichaEm(depois, 'ferido')).toMatchObject({ x: 725, y: 475, levadoPor: 'caio' })
  })
})
