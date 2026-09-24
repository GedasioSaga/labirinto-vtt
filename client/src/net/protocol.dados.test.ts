/**
 * DADO ROLADO NA SALA no protocolo: o jogador só PEDE (quantidade, dado,
 * modificador) — resultado, total e nome que ele mandasse são jogados fora,
 * porque quem rola é o host. Na volta, a tela do jogador só aceita rolagem
 * inteira e coerente, e só com os campos conhecidos.
 */
import { describe, expect, it } from 'vitest'
import { parseDiceRolled, parsePlayerMessage } from './protocol'

const ROLAGEM = { id: 'r-1', from: 'Ana', count: 2, sides: 6, modifier: 3, results: [5, 4], total: 12, at: 1000 }

describe('protocolo: dice.roll (jogador -> mestre)', () => {
  it('só o pedido passa: resultado, total e nome inventados ficam para trás', () => {
    expect(parsePlayerMessage({ type: 'dice.roll', count: 2, sides: 6, modifier: 3, results: [6, 6], total: 15, from: 'Mestre', hidden: true })).toEqual({
      type: 'dice.roll',
      count: 2,
      sides: 6,
      modifier: 3,
    })
  })

  it('pedido torto recusa a mensagem inteira', () => {
    expect(parsePlayerMessage({ type: 'dice.roll', count: 2, sides: 100, modifier: 0 })).toBeNull()
    expect(parsePlayerMessage({ type: 'dice.roll', count: -1, sides: 6, modifier: 0 })).toBeNull()
    expect(parsePlayerMessage('{"type":"dice.roll","count":1,"sides":20}')).toBeNull()
  })
})

describe('protocolo: dice.rolled (mestre -> jogador)', () => {
  it('rolagem coerente volta como cópia só com os campos conhecidos', () => {
    const parsed = parseDiceRolled({ type: 'dice.rolled', roll: { ...ROLAGEM, hidden: true, playerId: 'p-1', sceneId: 'cena-secreta' } })
    expect(parsed).toEqual({ type: 'dice.rolled', roll: ROLAGEM })
  })

  it('a rolagem do mestre vem marcada', () => {
    const doMestre = { ...ROLAGEM, from: 'Mestre', master: true }
    expect(parseDiceRolled({ type: 'dice.rolled', roll: doMestre })).toEqual({ type: 'dice.rolled', roll: doMestre })
  })

  it('total que não bate, face fora do dado ou número de faces errado recusam', () => {
    expect(parseDiceRolled({ type: 'dice.rolled', roll: { ...ROLAGEM, total: 13 } })).toBeNull()
    expect(parseDiceRolled({ type: 'dice.rolled', roll: { ...ROLAGEM, results: [7, 4], total: 14 } })).toBeNull()
    expect(parseDiceRolled({ type: 'dice.rolled', roll: { ...ROLAGEM, results: [5], total: 8 } })).toBeNull()
    expect(parseDiceRolled({ type: 'dice.rolled', roll: { ...ROLAGEM, from: '' } })).toBeNull()
    expect(parseDiceRolled({ type: 'dice.rolled', roll: { ...ROLAGEM, master: 'sim' } })).toBeNull()
    expect(parseDiceRolled({ type: 'dice.rolled' })).toBeNull()
    expect(parseDiceRolled({ type: 'signal', roll: ROLAGEM })).toBeNull()
  })
})
