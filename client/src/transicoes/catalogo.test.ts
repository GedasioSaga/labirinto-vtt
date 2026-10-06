import { describe, expect, it } from 'vitest'
import { TRANSICOES, duracaoEfetivaS, isTransicaoId, parseTransicao, transicaoInfo } from './catalogo'
import { PORTA_FIM_S } from './cenas/porta'
import { ESCADA_PEDRA_FIM_S } from './cenas/escadaPedra'

describe('catálogo de transições', () => {
  it('a duração natural de cada entrada bate com o fim da cena', () => {
    expect(transicaoInfo('porta').duracaoNaturalS).toBeCloseTo(PORTA_FIM_S)
    expect(transicaoInfo('escada-pedra').duracaoNaturalS).toBeCloseTo(ESCADA_PEDRA_FIM_S)
    expect(transicaoInfo('escada-pedra-descendo').duracaoNaturalS).toBeCloseTo(ESCADA_PEDRA_FIM_S)
  })

  it('cada id aparece uma vez só', () => {
    const ids = TRANSICOES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('isTransicaoId aceita só ids do catálogo', () => {
    expect(isTransicaoId('porta')).toBe(true)
    expect(isTransicaoId('Porta')).toBe(false)
    expect(isTransicaoId(42)).toBe(false)
  })

  it('parseTransicao lê o que vem do disco e descarta o resto', () => {
    expect(parseTransicao({ id: 'porta' })).toEqual({ id: 'porta' })
    expect(parseTransicao({ id: 'porta', duracaoS: 5 })).toEqual({ id: 'porta', duracaoS: 5 })
    expect(parseTransicao({ id: 'porta', duracaoS: 1 })).toEqual({ id: 'porta' })
    expect(parseTransicao({ id: 'porta', duracaoS: 31 })).toEqual({ id: 'porta' })
    expect(parseTransicao({ id: 'porta', duracaoS: Number.NaN })).toEqual({ id: 'porta' })
    expect(parseTransicao({ id: 'porta', duracaoS: '5' })).toEqual({ id: 'porta' })
    expect(parseTransicao({ id: 'helicoptero' })).toBeUndefined()
    expect(parseTransicao('porta')).toBeUndefined()
    expect(parseTransicao(null)).toBeUndefined()
  })

  it('duracaoEfetivaS usa a escolhida ou a natural', () => {
    expect(duracaoEfetivaS({ id: 'porta', duracaoS: 4 })).toBe(4)
    expect(duracaoEfetivaS({ id: 'porta' })).toBe(transicaoInfo('porta').duracaoNaturalS)
  })
})
