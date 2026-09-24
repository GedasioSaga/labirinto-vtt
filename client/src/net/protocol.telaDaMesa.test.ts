/**
 * A tela da mesa entra pelo MESMO `join` do jogador (o servidor do app só
 * aceita `join` como primeira mensagem), marcada com `role: 'table'`.
 */
import { describe, expect, it } from 'vitest'
import { parsePlayerMessage, TABLE_KEY_MAX_LENGTH } from './protocol'

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

  it('a chave da tela (do link da TV, separada do código da sala) segue junto com o role table', () => {
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: 'Mesa', role: 'table', tableKey: 'k'.repeat(TABLE_KEY_MAX_LENGTH) })).toEqual({
      type: 'join',
      code: 'AB12CD',
      name: 'Mesa',
      role: 'table',
      tableKey: 'k'.repeat(TABLE_KEY_MAX_LENGTH),
    })
  })

  it('chave da tela que não é texto curto derruba a mensagem inteira', () => {
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: 'Mesa', role: 'table', tableKey: 42 })).toBeNull()
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: 'Mesa', role: 'table', tableKey: '' })).toBeNull()
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: 'Mesa', role: 'table', tableKey: 'k'.repeat(TABLE_KEY_MAX_LENGTH + 1) })).toBeNull()
  })

  it('jogador não carrega chave da tela: o campo cai sem virar tela', () => {
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: 'Ana', tableKey: 'k' })).toEqual({ type: 'join', code: 'AB12CD', name: 'Ana' })
  })

  it('qualquer outro role é recusado; sem role continua o join de sempre', () => {
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: 'Ana', role: 'mestre' })).toBeNull()
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: 'Ana', role: 1 })).toBeNull()
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: 'Ana' })).toEqual({ type: 'join', code: 'AB12CD', name: 'Ana' })
  })
})
