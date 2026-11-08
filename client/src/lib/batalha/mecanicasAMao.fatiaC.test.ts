import { describe, expect, it } from 'vitest'
import { sistema } from './fichasDaFatiaB.testkit'
import { aira, alexei, BENCAO, CACADA, DANCA, LUZ_DO_SOL, RIFLE } from './fichasDaFatiaC.testkit'
import { lembreteDoSelo } from './condicoes'
import { cdDaDisputa, quemUsaVence } from './disputa'
import { danoDoAtaque, lerDano } from './formula'
import { danoDaTecnica } from './leituraDaTecnica'
import { mecanicaDoCartao, seloDaMecanica } from './mecanicasAMao'
import { formasNoMenu } from './transformacao'

/**
 * Conserto das fichas F2, fatia C (Aira e Alexei, sem os companions): as
 * contas com os cartões e atributos REAIS (rpg.json de 08/11). Lei:
 * docs/auditoria-fichas/respostas-do-grilling.md. No máximo 2 testes por situação.
 */

const valorNaAira = (formula: string): number | null => {
  const lido = lerDano(formula, { personagem: aira, sistema, arma: null, vidaDoAlvo: null })
  return lido.tipo === 'valor' ? lido.valor : null
}

describe('a dança da Aira: Espírito do alvo contra 12 + mod. de CAR dela, a carga sobe a CD', () => {
  it('CAR 55 (mod +1): CD 13 sem carga, 15 com 1, 17 com 2 e sem teste com 3 (quem usa vence)', () => {
    const disputa = mecanicaDoCartao(DANCA.id)?.disputa
    if (disputa === undefined || disputa.contra.tipo !== 'cd') throw new Error('a dança perdeu a disputa')
    const usa = { personagem: aira }
    expect([0, 1, 2, 3].map((carga) => (disputa.contra.tipo === 'cd' ? cdDaDisputa(disputa.contra.cd, usa, sistema, carga) : null))).toEqual([13, 15, 17, 'acerta'])
    expect(quemUsaVence({ tipo: 'automatico', passou: true }, 'alvo')).toBe(true)
    expect(disputa.rola.atributoId).toBe('espirito')
    expect(mecanicaDoCartao(DANCA.id)?.semReacao).toBe(true)
  })
})

describe('a Bênção de uma Raposa e A Luz do Sol', () => {
  it('Bênção: 20% do Espírito (40) = +8 no físico escolhido, pelos turnos que ela disser', () => {
    expect(seloDaMecanica(BENCAO.id, { turnos: 3, fisico: 'percepcao' }, valorNaAira)).toEqual({ nome: 'Bênção de uma Raposa', turnos: 3, natureza: 'buff', mods: [{ alvo: 'percepcao', delta: 8 }] })
  })

  it('A Luz do Sol dá dano igual ao Espírito (40, não 80) e põe a mesma Bênção, só nos aliados', () => {
    expect(danoDaTecnica(LUZ_DO_SOL, { personagem: aira, sistema, arma: null })).toMatchObject({ tipo: 'valor', valor: 40 })
    expect(seloDaMecanica(LUZ_DO_SOL.id, { turnos: 1, fisico: 'forca' }, valorNaAira)?.mods).toEqual([{ alvo: 'forca', delta: 8 }])
    expect(mecanicaDoCartao(LUZ_DO_SOL.id)?.seloSoNosAliados).toBe(true)
  })
})

describe('Alexei: as armadilhas que o mestre aplica (o selo lembra a regra)', () => {
  it('Enraizado lembra a CD 15 da técnica de movimento; Preso pelo Imã-Gumelo lembra o d20 12 ou mais', () => {
    expect(lembreteDoSelo('Enraizado')).toContain('15')
    expect(lembreteDoSelo('Preso pelo Imã-Gumelo')).toContain('12 ou mais')
  })
})

describe('Alexei: o Rifle e A Caçada Começa', () => {
  it('Rifle 20: o Atacar sugere Percepção 80 + 20 = 100', () => {
    expect(danoDoAtaque({ personagem: alexei, sistema, arma: RIFLE, vidaDoAlvo: null })).toMatchObject({ tipo: 'valor', valor: 100 })
  })

  it('A Caçada como forma (o F0c a move para Transformações): 200 SP com máximo 120 fica bloqueada com o motivo', () => {
    const comACacadaComoForma = { ...alexei, abas: { ...alexei.abas, habilidades: [], transformacoes: [{ ...CACADA, campos: { ...CACADA.campos, acao: 'Completa', ataquesExtras: '1' } }] } }
    const [forma] = formasNoMenu(comACacadaComoForma, sistema, null)
    expect(forma?.motivo).toMatch(/200 SP.*120/)
  })
})
