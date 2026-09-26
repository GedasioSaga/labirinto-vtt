// @vitest-environment node
/**
 * CONGELAR FICHA no cartão do pino — a mesma conta do host (`validTravel`),
 * do lado da tela. Ficha congelada não é caixa do "Quem passa?" (o host
 * recusa quem escolhe uma), e a passagem fica apagada quando só fichas
 * congeladas do jogador encostam no pino.
 */
import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { passagemCongelada, pinTravelChoices } from './pinTravelers'

const GRADE = 50
const PINO = { x: 100, y: 100 }

function ficha(id: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y: 100, size: 1, image: null, ...extra }
}

describe('"Quem passa?" sem as congeladas', () => {
  it('a congelada não vira caixa; a solta sim', () => {
    const fichas = [ficha('ana', 150), ficha('ponei', 200, { congelado: true })]
    expect(pinTravelChoices(fichas, ['ana', 'ponei'], PINO, GRADE).map((c) => c.id)).toEqual(['ana'])
  })
})

describe('passagemCongelada', () => {
  it('só a congelada encosta no pino: apagada', () => {
    expect(passagemCongelada([ficha('ana', 150, { congelado: true })], ['ana'], PINO, GRADE)).toBe(true)
  })

  it('uma solta encosta também: acesa (vai a solta)', () => {
    expect(passagemCongelada([ficha('ana', 150, { congelado: true }), ficha('bia', 50)], ['ana', 'bia'], PINO, GRADE)).toBe(false)
  })

  it('ninguém encosta: não é o congelado que segura (é o "Chegue mais perto")', () => {
    expect(passagemCongelada([ficha('ana', 900, { congelado: true })], ['ana'], PINO, GRADE)).toBe(false)
  })

  it('personagem congelado e ajudante solto encostados: apagada — o ajudante não leva a cena sem o personagem', () => {
    const ajudante = ficha('tiziu', 50, { contrato: { tarefa: '', ate: null, visao: false } })
    expect(passagemCongelada([ficha('ana', 150, { congelado: true }), ajudante], ['ana', 'tiziu'], PINO, GRADE)).toBe(true)
  })
})
