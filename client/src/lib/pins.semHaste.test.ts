import { describe, expect, it } from 'vitest'
import type { Pin } from '../types/map'
import { PIN_HEAD_OFFSET, PIN_HEAD_RADIUS, findPinAt, findPinsAt } from './pins'

/**
 * PINO SEM HASTE: o toque acompanha o desenho. Sem a haste, o vão entre a
 * cabeça e a ponta é chão — tocar ali não pode abrir o pino (nem o do mestre
 * no editor, nem o do jogador), senão o alvo volta a ser um retângulo que
 * ninguém vê. A cabeça fica onde estava e continua acertando igual.
 */

function pino(extra: Partial<Pin> = {}): Pin {
  return { id: 'p', x: 200, y: 300, kind: 'exclamacao', description: '', image: null, ...extra }
}

const COM_HASTE = pino()
const SEM_HASTE = pino({ semHaste: true })
/** Metade do caminho entre a ponta e a base da cabeça: só a haste passa ali. */
const MEIO_DA_HASTE = { x: 200, y: 300 - (PIN_HEAD_OFFSET - PIN_HEAD_RADIUS) / 2 }

describe('findPinAt: pino sem haste', () => {
  it('a cabeça acerta no mesmo lugar do pino com haste', () => {
    const centro = { x: 200, y: 300 - PIN_HEAD_OFFSET }
    const bordaDaCabeca = { x: 200 + PIN_HEAD_RADIUS - 1, y: 300 - PIN_HEAD_OFFSET }
    expect(findPinAt([SEM_HASTE], centro)?.id).toBe('p')
    expect(findPinAt([SEM_HASTE], bordaDaCabeca)?.id).toBe('p')
  })

  it('onde a haste estaria, o toque passa direto', () => {
    expect(findPinAt([COM_HASTE], { x: 200, y: 300 })?.id).toBe('p')
    expect(findPinAt([COM_HASTE], MEIO_DA_HASTE)?.id).toBe('p')
    expect(findPinAt([SEM_HASTE], { x: 200, y: 300 })).toBeNull()
    expect(findPinAt([SEM_HASTE], MEIO_DA_HASTE)).toBeNull()
  })

  it('a folga do dedo engorda a cabeça, mas não devolve a haste', () => {
    const folga = 6
    const logoAbaixoDaCabeca = { x: 200, y: 300 - PIN_HEAD_OFFSET + PIN_HEAD_RADIUS + folga - 1 }
    expect(findPinAt([SEM_HASTE], logoAbaixoDaCabeca, folga)?.id).toBe('p')
    expect(findPinAt([SEM_HASTE], { x: 200, y: 300 }, folga)).toBeNull()
  })

  it('pino crescido no zoom afastado: vale a cabeça crescida, com o mesmo fator', () => {
    const fator = 3
    expect(findPinAt([SEM_HASTE], { x: 200, y: 300 - PIN_HEAD_OFFSET * fator }, 0, fator)?.id).toBe('p')
    expect(findPinAt([SEM_HASTE], { x: 200, y: 300 - 4 * fator }, 0, fator)).toBeNull()
  })

  it('o pino de baixo, com haste, continua alcançável pelo vão do pino sem haste por cima', () => {
    const debaixo = pino({ id: 'debaixo' })
    const emCima = pino({ id: 'em-cima', semHaste: true })
    expect(findPinAt([debaixo, emCima], MEIO_DA_HASTE)?.id).toBe('debaixo')
    expect(findPinsAt([debaixo, emCima], MEIO_DA_HASTE).map((p) => p.id)).toEqual(['debaixo'])
  })
})
