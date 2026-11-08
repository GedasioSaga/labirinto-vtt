// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F1, fatia S2 (bug 4 de
 * docs/auditoria-fichas/00-bugs-do-sistema.md): na edição, digitar o atual de
 * HP/SP nunca muda o máximo. Ficha inventada, de um número só como as antigas.
 */
import { describe, expect, it } from 'vitest'
import { aplicarAjuste, maximoComposto, trocarAtualNaEdicao, trocarNumero } from './ajusteDaFicha'
import { novoPersonagem, numeroDaFicha, personagemDoArquivo, type Personagem } from './personagem'
import { SISTEMA_ONE_PIECE as OP } from './sistemaOnePiece'

const hp = (personagem: Personagem): string => `${numeroDaFicha(personagem.recursos, 'hp')}/${maximoComposto(personagem, 'hp').total}`

/** O campo passa por cada valor do meio enquanto a pessoa digita. */
function digitar(aberta: Personagem, valores: readonly number[]): Personagem {
  return valores.reduce((ficha, valor) => trocarAtualNaEdicao(ficha, aberta, 'hp', valor), aberta)
}

describe('bug 4: digitar o atual na edição não muda o máximo', () => {
  it('ficha de 700 sem máximo gravado: apagar e digitar 650 dá 650/700, e curar volta a 700/700', () => {
    const antiga = personagemDoArquivo({ id: 'pers_coveiro', tipo: 'jogador', nome: 'Coveiro', recursos: { hp: 700, sp: 60 } })
    if (antiga === null) throw new Error('ficha de teste inválida')
    expect(antiga.maximos.hp).toBeUndefined()

    const editada = digitar(antiga, [70, 7, 0, 6, 65, 650])

    expect(hp(editada)).toBe('650/700')
    expect(editada.maximos.hp).toBe(700)
    expect(hp(aplicarAjuste(editada, OP, { parte: 'recurso', chave: 'hp', valor: 700 }))).toBe('700/700')
  })

  it('ficha nova (0, sem máximo): 600 vira 600/600; com o Máximo digitado junto vale o digitado (1300/1300)', () => {
    const nova = novoPersonagem(OP, 'jogador', 'Nova')
    expect(hp(digitar(nova, [6, 60, 600]))).toBe('600/600')
    const comMaximo = trocarNumero(nova, 'maximo', 'hp', 1300)
    expect(hp(trocarAtualNaEdicao(comMaximo, nova, 'hp', 1300))).toBe('1300/1300')
  })
})
