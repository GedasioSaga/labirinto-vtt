/**
 * A BIBLIOTECA ORGANIZADA (protótipo aprovado em 23/11): o grupo de cada
 * entrada, quem tem cada uma (a coluna Fichas e o "Quem tem"), a ordem e a
 * contagem do menu Ferramentas. Dados inventados no formato do disco; no
 * máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import { novoItemDoCatalogo } from '../acervoDeItens'
import { SEM_ARQUIVO as SEM_ALCANCE } from '../batalha/alcance/antigos'
import { SEM_ARQUIVO as SEM_REQUISITOS } from '../batalha/requisitos/antigos'
import { novoCartao, novoPersonagem, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { entradaDoAcervo } from './acervoNoLivro'
import { abaDeDestino, type EntradaDoLivro, type ItemDoCatalogo } from './catalogo'
import { donosDasEntradas, grupoNaBiblioteca, ordenarNaBiblioteca, vagaDaEntrada } from './gruposDaBiblioteca'
import { pendenciasDasFerramentas } from './pendenciasDasFerramentas'

const sistema = SISTEMA_ONE_PIECE
const SEM_ACERVO = new Map<string, { categoria: string }>()

function habilidade(id: string, nome: string, campos: Record<string, string> = {}): ItemDoCatalogo {
  return { id, tipo: 'habilidade', nome, texto: '', campos }
}

function doLivro(tipo: EntradaDoLivro['tipo'], nome: string): EntradaDoLivro {
  return { id: `livro-${tipo}-${nome}`, tipo, nome, texto: '', campos: {}, atributos: [] }
}

function fichaCom(nome: string, cartoes: { abaId: string; nome: string }[], mochila?: Personagem['mochila']): Personagem {
  const ficha = novoPersonagem(sistema, 'jogador', nome)
  const abas = { ...ficha.abas }
  for (const { abaId, nome: doCartao } of cartoes) abas[abaId] = [...(abas[abaId] ?? []), novoCartao(doCartao)]
  return { ...ficha, abas, ...(mochila === undefined ? {} : { mochila }) }
}

describe('grupoNaBiblioteca', () => {
  it('as do livro caem no grupo do tipo; a arma em Armas; a habilidade sem peças e sem tipo é Ataque', () => {
    const arma: ItemDoCatalogo = { id: 'cat_sabre', tipo: 'arma', nome: 'Sabre de Teste', texto: '', campos: { dano: '10' } }
    expect(grupoNaBiblioteca(doLivro('pericia', 'Furtividade'), SEM_ACERVO)).toBe('pericia')
    expect(grupoNaBiblioteca(doLivro('vantagem', 'Sorte'), SEM_ACERVO)).toBe('vantagem')
    expect(grupoNaBiblioteca(doLivro('desvantagem', 'Medo de altura'), SEM_ACERVO)).toBe('desvantagem')
    expect(grupoNaBiblioteca(arma, SEM_ACERVO)).toBe('arma')
    expect(grupoNaBiblioteca(habilidade('cat_golpe', 'Golpe de Teste'), SEM_ACERVO)).toBe('ataque')
  })
})

describe('quem tem cada entrada', () => {
  it('cartão de mesmo nome (sem acento nem caixa), coisa do Acervo pelo itemId, item solto pelo nome; ficha sem mochila nem cartão não tem nada', () => {
    const abaDasHabilidades = abaDeDestino(sistema, 'habilidade')
    if (abaDasHabilidades === undefined) throw new Error('o sistema de teste precisa da aba de habilidades')
    const coisa = { ...novoItemDoCatalogo('Consumível'), id: 'item_pocao', nome: 'Poção de Teste' }
    const golpe = habilidade('cat_golpe', 'Golpe Ígneo')
    const corda: ItemDoCatalogo = { id: 'cat_corda', tipo: 'item', nome: 'Corda de Teste', texto: '', campos: {} }
    const entradas = [golpe, entradaDoAcervo(coisa), corda]
    const aira = fichaCom('Aira', [{ abaId: abaDasHabilidades.id, nome: 'golpe igneo' }], [
      { id: 'vaga_1', nome: 'Poção de Teste', itemId: 'item_pocao' },
      { id: 'vaga_2', nome: 'CORDA DE TESTE' },
    ])
    const vazia = novoPersonagem(sistema, 'jogador', 'Sem Nada')
    const donos = donosDasEntradas(entradas, [aira, vazia], sistema)
    expect(entradas.map((entrada) => (donos.get(entrada.id) ?? []).map((ficha) => ficha.nome))).toEqual([['Aira'], ['Aira'], ['Aira']])
  })

  it('o item solto não é a vaga de uma coisa do Acervo de mesmo nome; habilidade nunca é vaga de mochila', () => {
    const corda: ItemDoCatalogo = { id: 'cat_corda', tipo: 'item', nome: 'Corda de Teste', texto: '', campos: {} }
    expect(vagaDaEntrada(corda, { nome: 'Corda de Teste', itemId: 'item_corda' })).toBe(false)
    expect(vagaDaEntrada(corda, { nome: 'Corda de Teste' })).toBe(true)
    expect(vagaDaEntrada({ ...corda, acervoId: 'item_corda' }, { nome: 'Outro nome', itemId: 'item_corda' })).toBe(true)
    expect(vagaDaEntrada(habilidade('cat_golpe', 'Corda de Teste'), { nome: 'Corda de Teste' })).toBe(false)
  })
})

describe('ordenarNaBiblioteca', () => {
  it('"Como no livro" mantém a ordem; "Mais SP" lê o Custo escrito e põe quem não diz no fim', () => {
    const lista = [habilidade('a', 'Zarpar'), habilidade('b', 'Brisa', { custo: '35 de SP' }), habilidade('c', 'Corte', { custo: '10 SP' })]
    expect(ordenarNaBiblioteca(lista, 'livro', () => 0).map((entrada) => entrada.id)).toEqual(['a', 'b', 'c'])
    expect(ordenarNaBiblioteca(lista, 'sp', () => 0).map((entrada) => entrada.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('pendenciasDasFerramentas', () => {
  it('sem pasta, sem Acervo e sem livro: tudo em dia', () => {
    const dados = { sistema, catalogo: [], acervo: [], pastasDoAcervo: [], pastaId: null, personagens: [], propostasDoAlcance: SEM_ALCANCE, propostasDosRequisitos: SEM_REQUISITOS }
    expect(pendenciasDasFerramentas(dados)).toEqual({ juntar: 0, ligar: 0, armas: 0, alcance: 0, requisitos: 0 })
  })

  it('conta o que o Juntar traria das fichas e o que o Ligar ligaria pelo nome', () => {
    const abaDasHabilidades = abaDeDestino(sistema, 'habilidade')
    if (abaDasHabilidades === undefined) throw new Error('o sistema de teste precisa da aba de habilidades')
    const aira = fichaCom('Aira', [{ abaId: abaDasHabilidades.id, nome: 'Golpe Só da Ficha' }])
    const garrucha: ItemDoCatalogo = { id: 'cat_garrucha', tipo: 'arma', nome: 'Garrucha de Teste', texto: '', campos: { dano: '10' } }
    const coisa = { ...novoItemDoCatalogo('Arma'), id: 'item_garrucha', nome: 'Garrucha de Teste' }
    const dados = { sistema, catalogo: [garrucha], acervo: [coisa], pastasDoAcervo: [], pastaId: null, personagens: [aira], propostasDoAlcance: SEM_ALCANCE, propostasDosRequisitos: SEM_REQUISITOS }
    const pendencias = pendenciasDasFerramentas(dados)
    expect([pendencias.juntar, pendencias.ligar, pendencias.requisitos]).toEqual([1, 1, 0])
  })
})
