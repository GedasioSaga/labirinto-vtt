import { describe, expect, it } from 'vitest'
import { ficha, sistema } from '../fichasDaFatiaB.testkit'
import { lerMecanica } from './modelo'
import { guardarMecanica, MODELOS_PRONTOS, mecanicaDoModelo, problemaDaMecanica, trocarQuem } from './modelos'
import { etiquetaDaMecanica, resumoDaMecanica } from './resumo'

/**
 * Construtor de mecânicas, fatia C2 (a tela de montar): os modelos prontos
 * saem aceitos pelo motor, e o resumo em frases diz o que as peças fazem.
 * Dados inventados.
 */

const marinheiro = ficha('Marinheiro de Teste', { forca: 60 }, { hp: 500, sp: 100, escudo: 0 }, {})

describe('modelos prontos e resumo em frases', () => {
  it('os 5 modelos passam na leitura do motor; trocar para aliado tira a área e o selo vira buff', () => {
    for (const modelo of MODELOS_PRONTOS) {
      const mecanica = mecanicaDoModelo(modelo.id, sistema)
      expect(lerMecanica(guardarMecanica(mecanica)).tipo, modelo.nome).toBe('pecas')
      expect(problemaDaMecanica(mecanica), modelo.nome).toBeNull()
    }
    const area = mecanicaDoModelo('area', sistema)
    const emAliado = trocarQuem({ ...area, dano: undefined, efeitos: [{ tipo: 'selo', nome: 'Marcado', duracao: 1, natureza: 'debuff' }] }, 'aliados')
    expect(emAliado.alvo).toEqual({ quem: 'aliados', forma: { tipo: 'um' } })
    expect(emAliado.efeitos).toEqual([{ tipo: 'selo', nome: 'Marcado', duracao: 1, natureza: 'buff' }])
    expect(problemaDaMecanica({ ...emAliado, dano: undefined })).toBeNull()
  })

  it('o resumo da Espadada em frases, com o número da ficha de hoje, e a etiqueta da peça à mão', () => {
    const espadada = {
      ...mecanicaDoModelo('golpe', sistema),
      limite: { recarga: 3 },
      dano: { base: { formula: 'Força + 20' }, multiplicadores: { concentracao: true, surpresa: true } },
      efeitos: [{ tipo: 'selo' as const, nome: 'Atordoado', duracao: 1, natureza: 'debuff' as const }],
    }
    expect(resumoDaMecanica(espadada, { personagem: marinheiro, sistema })).toEqual([
      'Custa 30 SP e gasta a Ação Simples.',
      'Acerta 1 inimigo. O alvo reage normal (o d20 de sempre).',
      'Dano: Força + 20 (= 80 com a ficha de hoje).',
      'Se acertar: Atordoado por 1 vez.',
      'Depois de usar, espera 3 vezes para usar de novo.',
    ])
    expect(etiquetaDaMecanica(espadada)).toBe('O app faz tudo')
    expect(etiquetaDaMecanica(mecanicaDoModelo('buff', sistema))).toBe('1 peça à mão')
  })
})
