import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { PIN_TRAVEL_MAX_TOKENS } from '../net/protocol'
import { pinTravelChoices, pinTravelGroup } from './pinTravelers'

/**
 * ESCOLHER FICHAS NO PINO — a conta pura, a mesma no cartão do jogador (quais
 * caixas ele vê) e no host (o que ele aceita): a ficha dele mais perto do pino
 * e as outras dele a até 2 casas dela. É o grupo que já viajava junto
 * (montaria e familiar); agora o jogador escolhe quem dele passa.
 */

const GRADE = 50
const casa = (coluna: number, linha: number) => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const PINO = casa(10, 5)

function ficha(id: string, p: { x: number; y: number }, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `Nome ${id}`, x: p.x, y: p.y, size: 1, image: null, ...extra }
}

describe('pinTravelGroup: quem pode passar pelo pino', () => {
  it('a mais perto do pino primeiro, depois as que estão a até 2 casas dela, pela distância ao pino; a 3 casas fica de fora', () => {
    const fichas = [ficha('cao', casa(6, 6)), ficha('coruja', casa(11, 8)), ficha('ponei', casa(8, 6)), ficha('bruno', casa(9, 6))]
    expect(pinTravelGroup(fichas, PINO, GRADE).map((t) => t.id)).toEqual(['bruno', 'ponei', 'coruja'])
  })

  it('uma ficha só: o grupo é ela; nenhuma ficha: grupo vazio', () => {
    expect(pinTravelGroup([ficha('bruno', casa(3, 3))], PINO, GRADE).map((t) => t.id)).toEqual(['bruno'])
    expect(pinTravelGroup([], PINO, GRADE)).toEqual([])
  })

  it(`no máximo ${PIN_TRAVEL_MAX_TOKENS} fichas, as mais perto do pino — o pedido com mais que isso seria recusado inteiro`, () => {
    const muitas = Array.from({ length: PIN_TRAVEL_MAX_TOKENS + 3 }, (_, i) => ficha(`f${i}`, { x: PINO.x + 60 + i, y: PINO.y }))
    const grupo = pinTravelGroup(muitas, PINO, GRADE)
    expect(grupo).toHaveLength(PIN_TRAVEL_MAX_TOKENS)
    expect(grupo[0]?.id).toBe('f0')
    expect(grupo.map((t) => t.id)).not.toContain(`f${PIN_TRAVEL_MAX_TOKENS}`)
  })
})

describe('pinTravelChoices: as caixas do cartão "Quem passa?"', () => {
  it('só as fichas DELE no recorte, com o nome de cada uma; ficha de outro jogador colada não entra', () => {
    const tokens = [ficha('bruno', casa(9, 6)), ficha('ponei', casa(8, 6)), ficha('gato', casa(10, 6)), ficha('cao', casa(6, 6))]
    expect(pinTravelChoices(tokens, ['bruno', 'ponei', 'cao'], PINO, GRADE)).toEqual([
      { id: 'bruno', name: 'Nome bruno' },
      { id: 'ponei', name: 'Nome ponei' },
    ])
  })

  it('ajudante contratado (com contrato) não é caixa: ele segue o jogador sozinho, como no host', () => {
    const contrato = { tarefa: 'guiar', ate: null, visao: true }
    const tokens = [ficha('bruno', casa(9, 6)), ficha('guia', casa(10, 6), { contrato }), ficha('ponei', casa(8, 6))]
    expect(pinTravelChoices(tokens, ['bruno', 'guia', 'ponei'], PINO, GRADE).map((c) => c.id)).toEqual(['bruno', 'ponei'])
  })

  it('só com o ajudante na mão, é ele a caixa (quem viaja é ele, como no host)', () => {
    const contrato = { tarefa: 'guiar', ate: null, visao: true }
    const tokens = [ficha('guia', casa(10, 6), { contrato })]
    expect(pinTravelChoices(tokens, ['guia'], PINO, GRADE).map((c) => c.id)).toEqual(['guia'])
  })
})
