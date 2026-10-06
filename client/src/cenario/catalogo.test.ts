import { describe, expect, it } from 'vitest'
import { CENARIO_PADRAO, MOVIMENTOS, parseCenario, sameCenario } from './catalogo'

describe('animação do cenário: catálogo', () => {
  it('cada movimento aparece uma vez e começa num lugar diferente de onde termina', () => {
    expect(new Set(MOVIMENTOS.map((m) => m.id)).size).toBe(MOVIMENTOS.length)
    for (const m of MOVIMENTOS) expect(m.inicio).not.toEqual(m.fim)
  })

  it('parseCenario lê o que vem do disco e descarta o resto', () => {
    expect(parseCenario(CENARIO_PADRAO)).toEqual(CENARIO_PADRAO)
    expect(parseCenario({ ...CENARIO_PADRAO, duracaoS: 8 })).toEqual({ ...CENARIO_PADRAO, duracaoS: 8 })
    expect(parseCenario({ ...CENARIO_PADRAO, duracaoS: 1 })).toEqual(CENARIO_PADRAO)
    expect(parseCenario({ ...CENARIO_PADRAO, duracaoS: 99 })).toEqual(CENARIO_PADRAO)
    expect(parseCenario({ ...CENARIO_PADRAO, quando: 'nunca' })).toBeUndefined()
    expect(parseCenario({ ...CENARIO_PADRAO, movimento: 'gira' })).toBeUndefined()
    expect(parseCenario({ ...CENARIO_PADRAO, nevoa: 'sim' })).toEqual({ ...CENARIO_PADRAO, nevoa: false })
    expect(parseCenario(null)).toBeUndefined()
    expect(parseCenario('sobe')).toBeUndefined()
  })

  it('sameCenario compara todos os campos; ausente só é igual a ausente', () => {
    expect(sameCenario(CENARIO_PADRAO, { ...CENARIO_PADRAO })).toBe(true)
    expect(sameCenario(CENARIO_PADRAO, { ...CENARIO_PADRAO, raios: false })).toBe(false)
    expect(sameCenario(undefined, undefined)).toBe(true)
    expect(sameCenario(undefined, CENARIO_PADRAO)).toBe(false)
  })
})
