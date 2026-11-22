/**
 * A arma numa fonte só (docs/design/habilidades/ARMAS-FONTE-UNICA.md, aceite da
 * F1): a cópia da regra não mexe no que é da ficha, e o par do Vincent (mesmo
 * Boomerang no livro e na ficha, ligado pela mochila) sai "iguais". Dados
 * inventados no formato do disco; no máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import { mecanicaDoModeloDaArma } from '../batalha/mecanica/arma'
import { guardarMecanica } from '../batalha/mecanica/modelos'
import { novoCartao, novoPersonagem, type CartaoDaFicha, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import type { ItemDoCatalogo } from './catalogo'
import { comARegraDaArma, ensaiarArmas, juntarAsArmas } from './regraDaArma'

const sistema = SISTEMA_ONE_PIECE
const COISA = 'item_teste-bumerangue'
const ATORDOA = guardarMecanica(mecanicaDoModeloDaArma('atordoa', sistema))
const EFEITO_VELHO = 'Não dá dano: ao acertar, atordoa o alvo. 3 usos por combate (à mão até o app ter efeito de arma com usos).'

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

describe('o par do Vincent', () => {
  it('livro e ficha iguais, ligados pela vaga da mochila: caso "iguais"; juntar liga, tira a frase velha e a 2ª rodada muda 0', () => {
    const entrada: ItemDoCatalogo = { id: 'cat_bumerangue', tipo: 'arma', nome: 'Boomerang', texto: '', campos: { categoria: 'Arremesso', dano: '0', efeito: EFEITO_VELHO, atributoDoAtaque: 'Nada' }, mecanica: ATORDOA, acervoId: COISA }
    const cartao: CartaoDaFicha = { ...novoCartao('Boomerang'), campos: { ...entrada.campos }, mecanica: ATORDOA }
    const vincent = fichaCom('Vincent de Teste', [cartao], [{ id: 'vaga_1', nome: 'Boomerang', itemId: COISA, categoria: 'Arma' }])
    const dados = { catalogo: [entrada], personagens: [vincent], sistema }
    const ensaio = ensaiarArmas(dados)
    expect(ensaio.armas.map((arma) => [arma.nome, arma.caso, arma.cartoes.map((par) => par.como)])).toEqual([['Boomerang', 'iguais', ['mochila']]])
    const opcoes = { criarCoisas: true, novoIdDeCoisa: () => 'item_nunca' }
    const juntadas = juntarAsArmas(dados, ensaio, opcoes)
    const ligado = juntadas.personagens[0].abas.armas[0]
    expect([ligado.id, ligado.itemId, ligado.campos.efeito]).toEqual([cartao.id, COISA, 'Não dá dano: ao acertar, atordoa o alvo. 3 usos por combate.'])
    expect(juntadas.catalogo[0].campos.efeito).toBe(ligado.campos.efeito)
    const segunda = { ...dados, catalogo: juntadas.catalogo, personagens: juntadas.personagens }
    expect(juntarAsArmas(segunda, ensaiarArmas(segunda), opcoes).mudancas).toBe(0)
  })
})
