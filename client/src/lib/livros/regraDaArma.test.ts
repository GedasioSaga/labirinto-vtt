/**
 * A arma numa fonte só (docs/design/habilidades/ARMAS-FONTE-UNICA.md, aceite da
 * F1): a cópia da regra não mexe no que é da ficha. O par do Vincent saiu com o
 * "Juntar as armas" (itens refeitos, E7). Dados inventados no formato do disco;
 * no máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import { mecanicaDoModeloDaArma } from '../batalha/mecanica/arma'
import { guardarMecanica } from '../batalha/mecanica/modelos'
import { novoCartao, novoPersonagem, type CartaoDaFicha, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import type { ItemDoCatalogo } from './catalogo'
import { comARegraDaArma, entradaNovaDaCoisa } from './regraDaArma'

const sistema = SISTEMA_ONE_PIECE
const COISA = 'item_teste-bumerangue'
const ATORDOA = guardarMecanica(mecanicaDoModeloDaArma('atordoa', sistema))

function fichaCom(nome: string, armas: CartaoDaFicha[], mochila: Personagem['mochila'] = undefined): Personagem {
  const ficha = novoPersonagem(sistema, 'jogador', nome)
  return { ...ficha, abas: { ...ficha.abas, armas }, ...(mochila === undefined ? {} : { mochila }) }
}

describe('comARegraDaArma', () => {
  it('troca campos, balas e mecânica, mas mantém id, arma padrão, munição pelo nome e os ids das balas', () => {
    const bala: CartaoDaFicha = { ...novoCartao('Bala de Teste'), campos: { dano: '+5' }, municaoPeloNome: true }
    const cartao: CartaoDaFicha = { ...novoCartao('Garrucha de Teste'), campos: { dano: '10', capacidade: '2' }, armaPadrao: true, municaoPeloNome: true, subcartoes: [bala] }
    const entrada: ItemDoCatalogo = { id: 'cat_garrucha', tipo: 'arma', nome: 'Garrucha de Teste', texto: 'Velha', campos: { dano: '20' }, balas: [{ nome: 'bala de teste', campos: { dano: '+15' } }], mecanica: ATORDOA, acervoId: 'item_garrucha' }
    const novo = comARegraDaArma(cartao, entrada, sistema)
    expect(novo).toMatchObject({ id: cartao.id, nome: 'Garrucha de Teste', armaPadrao: true, municaoPeloNome: true, itemId: 'item_garrucha', mecanica: ATORDOA, campos: { dano: '20', descricao: 'Velha' } })
    expect(novo.campos.capacidade).toBeUndefined()
    expect(novo.subcartoes.map((sub) => [sub.id, sub.campos.dano, sub.municaoPeloNome])).toEqual([[bala.id, '+15', true]])
    expect(comARegraDaArma(novo, entrada, sistema)).toBe(novo)
  })
})

describe('a coisa do Acervo sem entrada no livro (a entrada foi apagada)', () => {
  it('a entrada nova nasce do cartão ligado e o Salvar não apaga dano, descrição nem categoria; cópias que discordam = conflito', () => {
    const cartao: CartaoDaFicha = { ...novoCartao('Boomerang'), itemId: COISA, campos: { categoria: 'Arremesso', dano: '30', descricao: 'Volta para a mão.' }, mecanica: ATORDOA }
    const nova: ItemDoCatalogo = { id: 'cat_nova', tipo: 'arma', nome: 'Boomerang', texto: '', campos: {}, acervoId: COISA }
    const entrada = entradaNovaDaCoisa(nova, [fichaCom('Vincent de Teste', [cartao])], sistema)
    expect(entrada).toMatchObject({ id: 'cat_nova', acervoId: COISA, texto: 'Volta para a mão.', campos: { categoria: 'Arremesso', dano: '30' } })
    if (entrada === 'conflito') throw new Error('não devia ser conflito')
    expect(comARegraDaArma(cartao, entrada, sistema).campos).toEqual(cartao.campos)
    const outra: CartaoDaFicha = { ...cartao, id: 'outro', campos: { ...cartao.campos, dano: '40' } }
    expect([entradaNovaDaCoisa(nova, [fichaCom('A', [cartao]), fichaCom('B', [outra])], sistema), entradaNovaDaCoisa(nova, null, sistema)]).toEqual(['conflito', nova])
  })
})
