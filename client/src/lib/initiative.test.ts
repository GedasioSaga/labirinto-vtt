import { describe, expect, it } from 'vitest'
import { initiativeOrder, nextTurnTokenId, parseInitiativeInput } from './initiative'

const FICHAS = [
  { id: 'lanterna', name: 'Lanterna' },
  { id: 'machado', name: 'Machado' },
  { id: 'goblin', name: 'Goblin' },
  { id: 'vulto', name: 'Vulto' },
]

describe('initiativeOrder', () => {
  it('só entra quem tem valor, do maior para o menor', () => {
    const ordem = initiativeOrder(FICHAS, { lanterna: 12, machado: 17, goblin: 5 })
    expect(ordem.map((e) => [e.name, e.value])).toEqual([
      ['Machado', 17],
      ['Lanterna', 12],
      ['Goblin', 5],
    ])
  })

  it('empate mantém a ordem do mapa (estável), e valor de ficha que não está na cena não entra', () => {
    const ordem = initiativeOrder(FICHAS, { goblin: 10, lanterna: 10, fantasma: 99 })
    expect(ordem.map((e) => e.id)).toEqual(['lanterna', 'goblin'])
  })

  it('sem valor nenhum, a ordem é vazia', () => {
    expect(initiativeOrder(FICHAS, {})).toEqual([])
  })
})

describe('nextTurnTokenId', () => {
  const ordem = initiativeOrder(FICHAS, { lanterna: 12, machado: 17, goblin: 5 })

  it('passa ao seguinte e, depois do último, volta ao primeiro', () => {
    expect(nextTurnTokenId(ordem, 'machado')).toBe('lanterna')
    expect(nextTurnTokenId(ordem, 'lanterna')).toBe('goblin')
    expect(nextTurnTokenId(ordem, 'goblin')).toBe('machado')
  })

  it('sem vez (ou vez de quem saiu da ordem) começa no primeiro; ordem vazia não tem vez', () => {
    expect(nextTurnTokenId(ordem, null)).toBe('machado')
    expect(nextTurnTokenId(ordem, 'vulto')).toBe('machado')
    expect(nextTurnTokenId([], 'machado')).toBeNull()
  })
})

describe('parseInitiativeInput', () => {
  it('número vira valor; vazio tira da ordem; lixo é recusado', () => {
    expect(parseInitiativeInput('17')).toEqual({ ok: true, value: 17 })
    expect(parseInitiativeInput(' -2 ')).toEqual({ ok: true, value: -2 })
    expect(parseInitiativeInput('')).toEqual({ ok: true, value: null })
    expect(parseInitiativeInput('   ')).toEqual({ ok: true, value: null })
    expect(parseInitiativeInput('abc')).toEqual({ ok: false })
    expect(parseInitiativeInput('1e400')).toEqual({ ok: false })
  })
})
