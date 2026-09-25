// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parsePlayerMessage } from './protocol'

/**
 * PACOTE COMPRIMIDO: o jogador diz no `join` o que sabe abrir
 * (`accept: ['gzip']`). O mestre só lê o que conhece; o resto do `accept` é
 * ignorado, e um `accept` malformado nunca derruba a entrada.
 */

const JOIN = { type: 'join', code: 'ABC123', name: 'Ana' }

describe('parsePlayerMessage: join com accept', () => {
  it('guarda o gzip que o jogador declarou', () => {
    expect(parsePlayerMessage({ ...JOIN, accept: ['gzip'] })).toEqual({ ...JOIN, accept: ['gzip'] })
  })

  it('com resume ou como tela da mesa, o accept vem junto', () => {
    expect(parsePlayerMessage({ ...JOIN, resume: 'tok', accept: ['gzip'] })).toEqual({ ...JOIN, resume: 'tok', accept: ['gzip'] })
    expect(parsePlayerMessage({ ...JOIN, role: 'table', tableKey: 'k', accept: ['gzip'] })).toEqual({ ...JOIN, role: 'table', tableKey: 'k', accept: ['gzip'] })
  })

  it('compressão que o mestre não conhece fica de fora', () => {
    expect(parsePlayerMessage({ ...JOIN, accept: ['br', 'gzip'] })).toEqual({ ...JOIN, accept: ['gzip'] })
    expect(parsePlayerMessage({ ...JOIN, accept: ['br'] })).toEqual(JOIN)
  })

  it('accept malformado é ignorado, e o join continua valendo', () => {
    expect(parsePlayerMessage({ ...JOIN, accept: 'gzip' })).toEqual(JOIN)
    expect(parsePlayerMessage({ ...JOIN, accept: [1, null] })).toEqual(JOIN)
  })

  it('sem accept, o join é o de sempre', () => {
    expect(parsePlayerMessage(JOIN)).toEqual(JOIN)
  })
})
