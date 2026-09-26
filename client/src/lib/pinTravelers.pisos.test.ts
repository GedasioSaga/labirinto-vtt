import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { pinTravelChoices } from './pinTravelers'

/**
 * PISOS NA MESMA CENA em cima de ESCOLHER FICHAS NO PINO, no lado do jogador:
 * as caixas do "Quem passa?" saem do recorte dele. O pônei no 1º piso, parado
 * em cima da ponte do térreo, não é caixa para quem está no térreo — e a
 * conta é a mesma do host, que recusa o pônei (hostSession.pisosEscolherFichas).
 */
const GRADE = 50
const casa = (coluna: number, linha: number) => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const PONTE = casa(10, 5)

function ficha(id: string, p: { x: number; y: number }, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `Nome ${id}`, x: p.x, y: p.y, size: 1, image: null, ...extra }
}

const ponte: Pin = { id: 'ponte', x: PONTE.x, y: PONTE.y, kind: 'viagem', description: 'Ponte', image: null }

function estrada(tokens: Token[]): MapData {
  return { ...createEmptyMap('estrada', 'Estrada', 40, 12, GRADE), tokens, pins: [ponte] }
}

const DONO = ['bruno', 'coruja', 'ponei']

describe('pinTravelChoices sobre o recorte de um piso', () => {
  it('no térreo: Bruno e a coruja são caixas; o pônei do 1º piso, colado e em cima da ponte, não', () => {
    const map = estrada([ficha('bruno', casa(9, 6)), ficha('coruja', casa(8, 6)), ficha('ponei', PONTE, { piso: 1 })])
    const view = filterMapForPlayer(map, 'p1', { p1: DONO }, 700).map
    expect(view.pins.map((p) => p.id)).toEqual(['ponte'])
    expect(pinTravelChoices(view.tokens, DONO, ponte, GRADE)).toEqual([
      { id: 'bruno', name: 'Nome bruno' },
      { id: 'coruja', name: 'Nome coruja' },
    ])
  })

  it('mapa sem piso nenhum (todo campo opcional ausente): as três fichas perto são caixas, como antes dos pisos', () => {
    const map = estrada([ficha('bruno', casa(9, 6)), ficha('coruja', casa(8, 6)), ficha('ponei', PONTE)])
    const view = filterMapForPlayer(map, 'p1', { p1: DONO }, 700).map
    expect(pinTravelChoices(view.tokens, DONO, ponte, GRADE).map((c) => c.id)).toEqual(['ponei', 'bruno', 'coruja'])
  })
})
