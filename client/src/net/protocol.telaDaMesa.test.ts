/**
 * A tela da mesa entra pelo MESMO `join` do jogador (o servidor do app só
 * aceita `join` como primeira mensagem), marcada com `role: 'table'`.
 */
import { describe, expect, it } from 'vitest'
import { parsePlayerMessage } from './protocol'

describe('join da tela da mesa', () => {
  it('aceita role table e devolve só os campos conhecidos', () => {
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: 'Mesa', role: 'table', extra: 'x' })).toEqual({
      type: 'join',
      code: 'AB12CD',
      name: 'Mesa',
      role: 'table',
    })
  })

  it('tela da mesa não retoma sessão de jogador: role table com resume é recusado', () => {
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: 'Mesa', role: 'table', resume: 'tok' })).toBeNull()
  })

  it('qualquer outro role é recusado; sem role continua o join de sempre', () => {
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: 'Ana', role: 'mestre' })).toBeNull()
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: 'Ana', role: 1 })).toBeNull()
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: 'Ana' })).toEqual({ type: 'join', code: 'AB12CD', name: 'Ana' })
  })
})
