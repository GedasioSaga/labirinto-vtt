import { describe, expect, it } from 'vitest'
import { PALETA_MEIO_TERMO, TOKENS_DA_PALETA } from './paleta'

/**
 * A PALETA do Meio-Termo: as 38 cores base do protótipo aprovado
 * (`docs/design/vila-meio-termo/prototipo/meio.js`, bloco PALETA), conferidas
 * contra a tabela do `docs/design/vila-meio-termo/README.md`.
 */

const HEX = /^#[0-9a-f]{6}$/

describe('PALETA_MEIO_TERMO', () => {
  it('tem 38 cores base, todas distintas', () => {
    expect(TOKENS_DA_PALETA).toHaveLength(38)
    const bases = TOKENS_DA_PALETA.map((token) => PALETA_MEIO_TERMO[token].base)
    expect(new Set(bases).size).toBe(38)
  })

  it('toda cor é #rrggbb minúsculo', () => {
    for (const token of TOKENS_DA_PALETA) {
      const tom = PALETA_MEIO_TERMO[token]
      expect(tom.base, token).toMatch(HEX)
      if ('realce' in tom) expect(tom.realce, token).toMatch(HEX)
      if ('sombra' in tom) expect(tom.sombra, token).toMatch(HEX)
    }
  })

  it('bate com a tabela do README (vila-meio-termo, linhas 29-39)', () => {
    expect(PALETA_MEIO_TERMO.grama).toEqual({ base: '#8cbf80', realce: '#a2cc92', sombra: '#76ac6d' })
    expect(PALETA_MEIO_TERMO.praca).toEqual({ base: '#dcd0b6', realce: '#ebe2cd', sombra: '#bcae94' })
    expect(PALETA_MEIO_TERMO.terra.base).toBe('#dda56c')
    expect(PALETA_MEIO_TERMO.barranco.base).toBe('#aa745c')
    const telhas = [PALETA_MEIO_TERMO.telhaAzul, PALETA_MEIO_TERMO.telhaAzulClara, PALETA_MEIO_TERMO.telhaTerracota, PALETA_MEIO_TERMO.telhaVerde, PALETA_MEIO_TERMO.telhaMadeira]
    expect(telhas.map((t) => t.base)).toEqual(['#43639a', '#7189a6', '#b56e50', '#7f9a64', '#867a6a'])
    expect(PALETA_MEIO_TERMO.palha.base).toBe('#d6b56a')
    expect(PALETA_MEIO_TERMO.pedra.base).toBe('#c3c0b2')
    const materiais = [PALETA_MEIO_TERMO.carvalho, PALETA_MEIO_TERMO.nogueira, PALETA_MEIO_TERMO.pinho, PALETA_MEIO_TERMO.ferro, PALETA_MEIO_TERMO.latao]
    expect(materiais.map((t) => t.base)).toEqual(['#a07b51', '#775739', '#b9995f', '#5d6164', '#b89552'])
    const flores = [PALETA_MEIO_TERMO.rosa, PALETA_MEIO_TERMO.amarelo, PALETA_MEIO_TERMO.violeta, PALETA_MEIO_TERMO.branco, PALETA_MEIO_TERMO.laranja]
    expect(flores.map((t) => t.base)).toEqual(['#e8a2c4', '#f0d266', '#a87fcb', '#f3efe2', '#e6793f'])
  })
})
