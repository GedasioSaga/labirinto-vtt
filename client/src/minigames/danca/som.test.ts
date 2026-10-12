import { describe, expect, it } from 'vitest'
import { BPM_DEMO, COMPASSO_DEMO, DURACAO_DEMO, eventosDaDemo, PASSO_DEMO, secaoDoCompasso, ULTIMO_COMPASSO_DEMO } from './som'

describe('faixa demo', () => {
  const ev = eventosDaDemo()

  it('116 BPM, 21 compassos e o acorde final, 2,2 s de cauda', () => {
    expect(BPM_DEMO).toBe(116)
    expect(PASSO_DEMO * 4).toBeCloseTo(60 / 116, 12)
    expect(DURACAO_DEMO).toBeCloseTo(ULTIMO_COMPASSO_DEMO * COMPASSO_DEMO + 2.2, 12)
    expect(ev[ev.length - 1].t).toBeCloseTo(ULTIMO_COMPASSO_DEMO * COMPASSO_DEMO, 12)
  })

  it('é a mesma lista em toda chamada, em ordem de tempo', () => {
    expect(eventosDaDemo()).toEqual(ev)
    for (let i = 1; i < ev.length; i += 1) expect(ev[i].t).toBeGreaterThanOrEqual(ev[i - 1].t)
  })

  it('abre com a contagem de 4 baquetas e nada mais no compasso 0', () => {
    const contagem = ev.filter((e) => e.c === 0)
    expect(contagem.map((e) => e.inst)).toEqual(['baqueta', 'baqueta', 'baqueta', 'baqueta'])
    expect(contagem.map((e) => e.p)).toEqual([0, 4, 8, 12])
  })

  it('seções: contagem, entrada, balanço, pausa, final e fim', () => {
    expect([0, 1, 4, 5, 12, 13, 16, 17, 20, 21].map(secaoDoCompasso)).toEqual([
      'contagem', 'entrada', 'entrada', 'balanco', 'balanco', 'pausa', 'pausa', 'final', 'final', 'fim',
    ])
  })

  it('prato no começo das seções (5, 9, 17) e no acorde final', () => {
    expect(ev.filter((e) => e.inst === 'prato').map((e) => e.c)).toEqual([5, 9, 17, 21])
  })

  it('a pausa (13-16) tem notas longas e o tapete', () => {
    const pausa = ev.filter((e) => e.c >= 13 && e.c <= 16)
    expect(pausa.filter((e) => e.inst === 'tapete')).toHaveLength(4)
    expect(pausa.some((e) => e.inst === 'melodia')).toBe(false)
    const longa = pausa.find((e) => e.inst === 'baixo' && e.c === 14)
    expect(longa?.inst === 'baixo' ? longa.dur : 0).toBeCloseTo(16 * PASSO_DEMO * 0.96, 12)
  })

  it('intensidades entre 0 e 1', () => {
    for (const e of ev) {
      expect(e.v).toBeGreaterThan(0)
      expect(e.v).toBeLessThanOrEqual(1)
    }
  })
})
