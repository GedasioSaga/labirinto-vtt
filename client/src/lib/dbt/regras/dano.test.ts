/**
 * Acerto contra CA e estágio de dano do Dragon Ball Tales: a tabela de
 * diferença de EP como impressa (2.3.3, p. 10), crítico e vitória automática.
 */
import { describe, expect, it } from 'vitest'
import {
  LIMIARES_BASE,
  distribuicaoDoAtaque,
  estagioPelaMargem,
  limiaresPelaDiferencaDeEP,
  penalidadeDeEscala,
  resolverAtaque,
  vitoriaAutomatica,
} from './dano'

const KAMEHAMEHA = { minimo: 11, medio: 22, completo: 44 }

describe('faixas sem diferença de EP (6.0.2.1, p. 59)', () => {
  it('margem 0 erra; 1-2 mínimo; 3-5 médio; 6+ completo', () => {
    const estagios = [-3, 0, 1, 2, 3, 5, 6, 12].map((m) => estagioPelaMargem(m, LIMIARES_BASE))
    expect(estagios).toEqual(['erro', 'erro', 'minimo', 'minimo', 'medio', 'medio', 'completo', 'completo'])
  })

  it('atacante mais fraco usa a faixa base', () => {
    expect(limiaresPelaDiferencaDeEP(-3)).toEqual(LIMIARES_BASE)
    expect(limiaresPelaDiferencaDeEP(0)).toEqual(LIMIARES_BASE)
  })
})

describe('tabela de diferença de EP (2.3.3, p. 10), linha por linha', () => {
  // [diferença, mínimo, médio de, médio até, completo a partir de], como impresso.
  const TABELA: [number, number, number, number, number][] = [
    [1, 1, 2, 4, 5],
    [2, 0, 1, 3, 4],
    [3, -1, 0, 2, 3],
    [4, -2, -1, 1, 2],
    [5, -3, -2, -1, 0],
    [6, -4, -3, -2, -1],
    [7, -5, -4, -3, -2],
    [8, -6, -5, -4, -3],
    [9, -7, -6, -5, -4],
    [10, -8, -7, -6, -5],
  ]

  it.each(TABELA)('EP +%i: mínimo %i, médio %i a %i, completo %i+', (diferenca, minimo, medioDe, medioAte, completo) => {
    const limiares = limiaresPelaDiferencaDeEP(diferenca)
    expect(limiares).toEqual({ minimo, medio: medioDe, completo })
    expect(estagioPelaMargem(minimo - 1, limiares)).toBe('erro')
    expect(estagioPelaMargem(minimo, limiares)).toBe('minimo')
    for (let m = medioDe; m <= medioAte; m++) expect(estagioPelaMargem(m, limiares)).toBe('medio')
    expect(estagioPelaMargem(completo, limiares)).toBe('completo')
  })

  it('acima de 10 segue o passo das últimas linhas (−1 por nível)', () => {
    expect(limiaresPelaDiferencaDeEP(12)).toEqual({ minimo: -10, medio: -9, completo: -7 })
  })
})

describe('resolverAtaque', () => {
  it('exemplo da p. 10: CA 15, inimigo com +3 de EP tira 14 e causa dano mínimo', () => {
    // 11 no d20 + mod 0 + EP 3 = 14.
    const r = resolverAtaque({ natural: 11, modificador: 0, epAtacante: 3, epAlvo: 0, caDoAlvo: 15, faixa: KAMEHAMEHA })
    expect(r.total).toBe(14)
    expect(r.margem).toBe(-1)
    expect(r.estagio).toBe('minimo')
    expect(r.dano).toBe(11)
  })

  it('soma o modificador, a EP e os extras; margem 4 sem diferença de EP é dano médio', () => {
    const r = resolverAtaque({ natural: 10, modificador: 2, epAtacante: 1, epAlvo: 1, caDoAlvo: 10, faixa: KAMEHAMEHA, extras: 1 })
    expect(r.total).toBe(14)
    expect(r.estagio).toBe('medio')
    expect(r.dano).toBe(22)
    expect(r.explicacao).toContain('dano médio 22')
  })

  it('alvo com EP maior: −1 no acerto por nível (2.3.2) e faixa base', () => {
    expect(penalidadeDeEscala(1, 3)).toBe(-2)
    expect(penalidadeDeEscala(3, 1)).toBe(0)
    const r = resolverAtaque({ natural: 15, modificador: 0, epAtacante: 1, epAlvo: 3, caDoAlvo: 13, faixa: KAMEHAMEHA })
    expect(r.total).toBe(14)
    expect(r.margem).toBe(1)
    expect(r.estagio).toBe('minimo')
  })

  it('20 natural: acerta sempre, dano completo × 2 (9.4)', () => {
    const r = resolverAtaque({ natural: 20, modificador: 0, epAtacante: 0, epAlvo: 0, caDoAlvo: 60, faixa: KAMEHAMEHA })
    expect(r.critico).toBe(true)
    expect(r.estagio).toBe('completo')
    expect(r.dano).toBe(88)
  })

  it('Exposto baixa a margem de crítico para 16', () => {
    const r = resolverAtaque({ natural: 16, modificador: 0, epAtacante: 0, epAlvo: 0, caDoAlvo: 60, faixa: KAMEHAMEHA, criticoAPartirDe: 16 })
    expect(r.critico).toBe(true)
    expect(r.dano).toBe(88)
  })

  it('1 natural: erro crítico, mesmo contra CA 0', () => {
    const r = resolverAtaque({ natural: 1, modificador: 10, epAtacante: 5, epAlvo: 0, caDoAlvo: 0, faixa: KAMEHAMEHA })
    expect(r.erroCritico).toBe(true)
    expect(r.estagio).toBe('erro')
    expect(r.dano).toBe(0)
  })
})

describe('vitória automática (2.3.4, p. 11)', () => {
  it('EP o dobro ou mais: 10 vence 5; 3 vence 1; 3 contra 2 não; iguais não', () => {
    expect(vitoriaAutomatica(10, 5)).toBe('a')
    expect(vitoriaAutomatica(1, 3)).toBe('b')
    expect(vitoriaAutomatica(3, 2)).toBeNull()
    expect(vitoriaAutomatica(4, 4)).toBeNull()
    expect(vitoriaAutomatica(0, 0)).toBeNull()
  })
})

describe('distribuicaoDoAtaque', () => {
  it('CA 10, sem bônus: metade das faces acerta; dano esperado 17,6 com a faixa do Kamehameha', () => {
    const d = distribuicaoDoAtaque({ modificador: 0, epAtacante: 0, epAlvo: 0, caDoAlvo: 10, faixa: KAMEHAMEHA })
    // 1-10 erra; 11-12 mínimo; 13-15 médio; 16-19 completo; 20 crítico.
    expect(d.chanceDeAcerto).toBe(0.5)
    expect(d.chanceDeCritico).toBe(0.05)
    expect(d.chancePorEstagio).toEqual({ erro: 0.5, minimo: 0.1, medio: 0.15, completo: 0.25 })
    expect(d.danoEsperado).toBeCloseTo((2 * 11 + 3 * 22 + 4 * 44 + 88) / 20)
  })
})
