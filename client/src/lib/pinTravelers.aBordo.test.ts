// @vitest-environment node
/**
 * VEÍCULO no cartão do pino — a mesma conta do host (`validTravel`), do lado
 * da tela, com a marca de fio `aBordo { motorista }` que só a ficha do dono
 * recebe. A passageira que não dirige não é caixa do "Quem passa?" (o host
 * recusa o pedido que a escolhe) e, quando só ela poderia passar, a passagem
 * fica apagada com "A bordo: desça para viajar" em vez de um "Passar" que o
 * host recusaria depois do clique.
 */
import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { passagemABordo, pinTravelChoices } from './pinTravelers'

const GRADE = 50
const PINO = { x: 100, y: 100 }

function ficha(id: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y: 100, size: 1, image: null, ...extra }
}

const passageira = { aBordo: { motorista: false } }
const motorista = { aBordo: { motorista: true } }

describe('"Quem passa?" sem a passageira que não dirige', () => {
  it('a passageira não vira caixa; a motorista e a ficha a pé sim', () => {
    const fichas = [ficha('ana', 150, motorista), ficha('bia', 200, passageira), ficha('caio', 120)]
    expect(pinTravelChoices(fichas, ['ana', 'bia', 'caio'], PINO, GRADE).map((c) => c.id)).toEqual(['caio', 'ana'])
  })
})

describe('passagemABordo', () => {
  it('só a passageira encosta no pino: apagada', () => {
    expect(passagemABordo([ficha('bia', 150, passageira)], ['bia'], PINO, GRADE)).toBe(true)
  })

  it('a passageira longe do pino também: descer vem antes de chegar perto (ela não anda a bordo)', () => {
    expect(passagemABordo([ficha('bia', 900, passageira)], ['bia'], PINO, GRADE)).toBe(true)
  })

  it('a motorista encosta: acesa (ela leva o veículo)', () => {
    expect(passagemABordo([ficha('ana', 150, motorista)], ['ana'], PINO, GRADE)).toBe(false)
  })

  it('uma ficha a pé encosta junto: acesa (vai a de pé)', () => {
    expect(passagemABordo([ficha('bia', 150, passageira), ficha('caio', 50)], ['bia', 'caio'], PINO, GRADE)).toBe(false)
  })

  it('a passageira encosta e a de pé está longe: apagada — o host conta só quem encosta', () => {
    expect(passagemABordo([ficha('bia', 150, passageira), ficha('caio', 900)], ['bia', 'caio'], PINO, GRADE)).toBe(true)
  })

  it('a pé, sem marca: nunca é o "a bordo" que segura', () => {
    expect(passagemABordo([ficha('caio', 150)], ['caio'], PINO, GRADE)).toBe(false)
    expect(passagemABordo([ficha('caio', 900)], ['caio'], PINO, GRADE)).toBe(false)
  })

  it('ficha de outro jogador com a marca não conta (a marca só vem na do dono, mas a conta não confia nisso)', () => {
    expect(passagemABordo([ficha('bia', 150, passageira), ficha('caio', 150)], ['caio'], PINO, GRADE)).toBe(false)
  })
})
