/**
 * PRESETS DE LUZ (Luz L3, decisão D4): a ferramenta Luz cria uma `Light`
 * normal, sem vínculo com móvel, que já nasce acesa só à tarde e à noite. Os
 * números da Tocha, do Lampião e da Fogueira vêm do protótipo aprovado
 * (`docs/design/luz/`): calor 55% (`#ffba7b`), lampião 3,5 casas a 85%,
 * fogueira 5 casas a 95%; a tocha, 2,5 casas.
 */
import { describe, expect, it } from 'vitest'
import { buildLightAt } from './drawingFactory'
import { PRESETS_DE_LUZ, luzDoPreset, type PresetDeLuz } from './presetsDeLuz'

const GRID = 64
const PONTO = { x: 320, y: 192 }

describe('luzDoPreset', () => {
  it('Tocha, Lampião e Fogueira: alcance em casas, cor do calor de 55% e acesa à tarde e à noite', () => {
    const esperado: Record<Exclude<PresetDeLuz, 'luz'>, { casas: number; intensidade: number }> = {
      tocha: { casas: 2.5, intensidade: 0.8 },
      lampiao: { casas: 3.5, intensidade: 0.85 },
      fogueira: { casas: 5, intensidade: 0.95 },
    }
    for (const [preset, { casas, intensidade }] of Object.entries(esperado)) {
      const l = luzDoPreset('id-1', PONTO, GRID, preset as PresetDeLuz) // Object.entries perde a chave literal; as chaves são as do Record acima
      expect(l, preset).toEqual({ id: 'id-1', x: PONTO.x, y: PONTO.y, radius: casas * GRID, color: '#ffba7b', intensity: intensidade, acesaEm: ['tarde', 'noite'] })
    }
  })

  it('a Luz de sempre: o mesmo raio, cor e força de hoje, e também acesa à tarde e à noite', () => {
    const hoje = buildLightAt('id-2', PONTO, GRID)
    expect(luzDoPreset('id-2', PONTO, GRID, 'luz')).toEqual({ ...hoje, acesaEm: ['tarde', 'noite'] })
  })

  it('arrastar escolhe o raio, em qualquer preset', () => {
    expect(luzDoPreset('id-3', PONTO, GRID, 'fogueira', 77).radius).toBe(77)
    expect(luzDoPreset('id-3', PONTO, GRID, 'luz', 77).radius).toBe(77)
  })

  it('sem vínculo com móvel nem ficha (D4), e cada luz tem a própria lista', () => {
    const a = luzDoPreset('a', PONTO, GRID, 'lampiao')
    const b = luzDoPreset('b', PONTO, GRID, 'lampiao')
    expect('attachedTokenId' in a).toBe(false)
    expect(a.acesaEm).not.toBe(b.acesaEm)
  })

  it('a lista dos presets tem os quatro, com nome em português', () => {
    expect(PRESETS_DE_LUZ.map((p) => [p.id, p.rotulo])).toEqual([
      ['luz', 'Luz'],
      ['tocha', 'Tocha'],
      ['lampiao', 'Lampião'],
      ['fogueira', 'Fogueira'],
    ])
  })
})
