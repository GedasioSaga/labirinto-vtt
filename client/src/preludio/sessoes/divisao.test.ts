/**
 * PRELÚDIO F3c: a divisão da sessão lado a lado (roteiro e quadro), guardada
 * por sessão neste PC. O que vem guardado é conferido campo por campo, e o
 * recolher de um lado nunca deixa os dois recolhidos.
 */
import { describe, expect, it } from 'vitest'
import { alternarLado, DIVISAO_PADRAO, lerDivisao, PROPORCAO_MAXIMA, PROPORCAO_MINIMA } from './divisao'

describe('a divisão da sessão lado a lado', () => {
  it('o guardado torto volta ao padrão campo por campo, e a largura fica entre o mínimo e o máximo', () => {
    expect(lerDivisao(null)).toEqual(DIVISAO_PADRAO)
    expect(lerDivisao('meio')).toEqual(DIVISAO_PADRAO)
    expect(lerDivisao({ proporcao: 0.6, recolhido: 'quadro' })).toEqual({ proporcao: 0.6, recolhido: 'quadro' })
    expect(lerDivisao({ proporcao: 0.02, recolhido: 'os dois' })).toEqual({ proporcao: PROPORCAO_MINIMA, recolhido: 'nenhum' })
    expect(lerDivisao({ proporcao: 7, recolhido: 'roteiro' })).toEqual({ proporcao: PROPORCAO_MAXIMA, recolhido: 'roteiro' })
    expect(lerDivisao({ proporcao: Number.NaN })).toEqual(DIVISAO_PADRAO)
  })

  it('recolher um lado com o outro recolhido troca de lado; recolher o mesmo de novo abre os dois', () => {
    expect(alternarLado('nenhum', 'quadro')).toBe('quadro')
    expect(alternarLado('quadro', 'quadro')).toBe('nenhum')
    expect(alternarLado('roteiro', 'quadro')).toBe('quadro')
  })
})
