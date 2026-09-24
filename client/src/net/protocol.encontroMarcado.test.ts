import { describe, expect, it } from 'vitest'
import { ESPERA_MINUTOS_MAX, ESPERA_ONDE_MAX_LENGTH } from '../lib/encontroMarcado'
import { NAME_MAX_LENGTH, parsePlayerMessage, parseWaitHostMessage } from './protocol'

/**
 * ENCONTRO MARCADO no protocolo. Do jogador: `wait.set` (quem, onde, quantos
 * minutos) e `wait.clear`. Do mestre, e só para quem espera: `wait.state` e
 * `wait.ended`. O que chega do jogador é hostil; o que o jogador lê é cortado
 * aos campos conhecidos.
 */
describe('parsePlayerMessage: wait.set e wait.clear', () => {
  it('aceita minutos, colega e lugar, aparados; campo vazio some', () => {
    expect(parsePlayerMessage({ type: 'wait.set', minutes: 15, who: '  Bia ', where: ' no portão ' })).toEqual({
      type: 'wait.set',
      minutes: 15,
      who: 'Bia',
      where: 'no portão',
    })
    expect(parsePlayerMessage({ type: 'wait.set', minutes: 5, who: '   ', where: '' })).toEqual({ type: 'wait.set', minutes: 5 })
    expect(parsePlayerMessage({ type: 'wait.clear' })).toEqual({ type: 'wait.clear' })
  })

  it('campo a mais do jogador não passa adiante (nem um "até" em hora absoluta)', () => {
    expect(parsePlayerMessage({ type: 'wait.set', minutes: 10, until: 99, sceneId: 'cripta' })).toEqual({ type: 'wait.set', minutes: 10 })
  })

  it('recusa prazo fora da faixa, texto que não é texto ou acima do teto', () => {
    expect(parsePlayerMessage({ type: 'wait.set', minutes: 0 })).toBeNull()
    expect(parsePlayerMessage({ type: 'wait.set', minutes: ESPERA_MINUTOS_MAX + 1 })).toBeNull()
    expect(parsePlayerMessage({ type: 'wait.set', minutes: 1.5 })).toBeNull()
    expect(parsePlayerMessage({ type: 'wait.set' })).toBeNull()
    expect(parsePlayerMessage({ type: 'wait.set', minutes: 10, who: 7 })).toBeNull()
    expect(parsePlayerMessage({ type: 'wait.set', minutes: 10, who: 'x'.repeat(NAME_MAX_LENGTH + 20) })).toBeNull()
    expect(parsePlayerMessage({ type: 'wait.set', minutes: 10, where: 'x'.repeat(ESPERA_ONDE_MAX_LENGTH + 1) })).toBeNull()
    expect(parsePlayerMessage({ type: 'wait.set', minutes: 10, where: ['portão'] })).toBeNull()
  })
})

describe('parseWaitHostMessage', () => {
  it('wait.state com a espera, ou null quando acabou', () => {
    expect(parseWaitHostMessage({ type: 'wait.state', wait: { who: 'Bia', where: 'no portão', remainingMs: 60_000, sceneId: 'x' } })).toEqual({
      type: 'wait.state',
      wait: { who: 'Bia', where: 'no portão', remainingMs: 60_000 },
    })
    expect(parseWaitHostMessage({ type: 'wait.state', wait: { remainingMs: 0 } })).toEqual({ type: 'wait.state', wait: { remainingMs: 0 } })
    expect(parseWaitHostMessage({ type: 'wait.state', wait: null })).toEqual({ type: 'wait.state', wait: null })
  })

  it('wait.ended com o motivo; o colega só no "chegou" e no prazo', () => {
    expect(parseWaitHostMessage({ type: 'wait.ended', reason: 'met', who: 'Bia', x: 10, y: 20 })).toEqual({ type: 'wait.ended', reason: 'met', who: 'Bia' })
    expect(parseWaitHostMessage({ type: 'wait.ended', reason: 'expired' })).toEqual({ type: 'wait.ended', reason: 'expired' })
    expect(parseWaitHostMessage({ type: 'wait.ended', reason: 'left' })).toEqual({ type: 'wait.ended', reason: 'left' })
  })

  it('forma errada cai inteira', () => {
    expect(parseWaitHostMessage({ type: 'wait.state', wait: { remainingMs: -1 } })).toBeNull()
    expect(parseWaitHostMessage({ type: 'wait.state', wait: { remainingMs: '10' } })).toBeNull()
    expect(parseWaitHostMessage({ type: 'wait.state' })).toBeNull()
    expect(parseWaitHostMessage({ type: 'wait.ended', reason: 'sumiu' })).toBeNull()
    expect(parseWaitHostMessage({ type: 'wait.ended', reason: 'met' })).toBeNull()
    expect(parseWaitHostMessage({ type: 'wait.ended', reason: 'met', who: 42 })).toBeNull()
    expect(parseWaitHostMessage({ type: 'laser', off: true })).toBeNull()
    expect(parseWaitHostMessage(null)).toBeNull()
  })
})
