/**
 * Construtor de mecânicas, fatia C8: a arma montada por peças (o Boomerang do
 * Vincent: sem dano, Atordoado no acerto, 3 vezes por batalha) e a arma
 * padrão (o Siegfried). Dados inventados; no máximo 2 testes por situação.
 *
 * Itens refeitos (E6a, decisões 5 e 6): o Atacar lê só as armas EQUIPADAS da
 * mochila; o cartão da aba Armas (com a mecânica montada, o "Nada" no Soma e a
 * marca Padrão) não vale mais na batalha. O bumerangue passa a ser o item de
 * Arremesso que volta, com o Atordoado no "Ao acertar".
 */
import { describe, expect, it } from 'vitest'
import type { CarriedItem } from '../../../types/map'
import { pecasDoItemGuardadas } from '../../itens/editorDoItem'
import type { CartaoDaFicha, Personagem } from '../../personagem'
import { combateVazio, type PedidoDeAcao } from '../combate'
import { ficha, may, sistema } from '../fichasDaFatiaB.testkit'
import { danoDoAtaque } from '../formula'
import { lancarGolpe, MOTIVO_ARMA_NAO_EQUIPADA, podeAgir, sugestaoParaNpc, type ContextoDoGolpe } from '../golpe'
import { armasDe, PREFIXO_DA_ARMA_DA_MOCHILA } from '../leituraDaFicha'
import { danoDaTecnica } from '../leituraDaTecnica'
import { novaCarta, type TurnosDaCena } from '../turnos'
import { armaPadraoEntre, comAPadraoNaFrente, mecanicaDoModeloDaArma } from './arma'
import { danoUsaArma, lerMecanica } from './modelo'
import { guardarMecanica } from './modelos'

function arma(id: string, nome: string, extra: Partial<CartaoDaFicha> = {}): CartaoDaFicha {
  return { id, nome, campos: { categoria: 'Arremesso', dano: '30' }, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [], ...extra }
}

/** O Boomerang como item: Arremesso que volta, dano 0 sem atributo (só o efeito) e o Atordoado de 1 turno no acerto. */
const BUMERANGUE: CarriedItem = {
  id: 'vaga_bumerangue',
  nome: 'Bumerangue de Teste',
  itemId: 'item_bumerangue',
  tipo: 'arremesso',
  equipado: true,
  regra: {
    ataque: { dano: 0, soma: '', acao: 'Ação Simples', alvos: 1 },
    arremesso: { volta: true },
    aoAcertar: pecasDoItemGuardadas([{ tipo: 'condicao', nome: 'Atordoado', duracao: 1 }], 'acerto'),
  },
}
const ID_DO_BUMERANGUE = `${PREFIXO_DA_ARMA_DA_MOCHILA}${BUMERANGUE.id}`
const lancador: Personagem = { ...ficha('Lançador de Teste', { forca: 20, agilidade: 30 }, { hp: 500, sp: 50, escudo: 0 }, {}), mochila: [BUMERANGUE] }

/** `espera` = as rodadas até o bumerangue voltar para a mão (a recarga da arma no combate). */
function contexto(personagem: Personagem, espera = 0): ContextoDoGolpe {
  const carta = novaCarta('tok_lancador', personagem.id, personagem.nome)
  const outra = novaCarta('tok_may', may.id, may.nome)
  const combate = { [personagem.id]: { ...combateVazio(), recargas: { [ID_DO_BUMERANGUE]: espera } } }
  const turnos: TurnosDaCena = { cartas: [carta, outra], vez: carta.id, rodada: 1, desempate: 'd20', d20: {}, empates: {}, extras: {}, gastos: {}, combate }
  return {
    turnos,
    carta,
    personagem,
    sistema,
    regras: null,
    autor: { tipo: 'jogador', playerId: 'p1', nome: 'Rui' },
    personagens: [personagem, may],
    personagemDoToken: (tokenId) => (tokenId === 'tok_lancador' ? personagem.id : tokenId === 'tok_may' ? may.id : undefined),
  }
}

const ATACAR: PedidoDeAcao = { tipo: 'atacar', armaId: ID_DO_BUMERANGUE, alvos: [{ tokenId: 'tok_may', dano: 0 }], surpresa: false, perfurante: false }

describe('o bumerangue do item (o equivalente da arma montada da C8)', () => {
  it('o Atacar com ele sai, o dano dele é 0 (sem a Força) e o Atordoado vai no acerto', () => {
    const [lido] = armasDe(lancador)
    if (lido === undefined) throw new Error('o bumerangue equipado não está no Atacar')
    expect([lido.id, lido.arremesso?.volta]).toEqual([ID_DO_BUMERANGUE, true])
    expect(danoDoAtaque({ personagem: lancador, sistema, arma: lido, vidaDoAlvo: null })).toMatchObject({ tipo: 'valor', valor: 0 })
    expect(podeAgir(contexto(lancador), ATACAR)).toBeNull()
    const lancado = lancarGolpe(contexto(lancador), ATACAR, { golpe: 'g1', linha: 'l1' })
    if (lancado.golpe === null) throw new Error('o golpe não saiu')
    expect(lancado.golpe.aoAcertar?.condicoes.map((condicao) => condicao.nome)).toEqual(['Atordoado'])
  })

  it('enquanto ele volta para a mão, o Atacar é recusado com o motivo; o bumerangue só no cartão da aba Armas não vale mais', () => {
    // A C8 contava 3 usos por batalha; o item não tem usos: o que volta fica fora da mão até a próxima vez (decisão 7).
    expect(podeAgir(contexto(lancador, 1), ATACAR)).toBe('Bumerangue de Teste está voltando para a mão: volta no começo da próxima vez')
    const deCartao = ficha('Lançador de Texto', { forca: 20 }, { hp: 500, sp: 50, escudo: 0 }, { armas: [arma('arma_bumerangue', 'Bumerangue de Texto')] })
    expect(podeAgir(contexto(deCartao), { ...ATACAR, armaId: 'arma_bumerangue' })).toBe(MOTIVO_ARMA_NAO_EQUIPADA)
  })

  // Saíram com a E6a, sem equivalente no item: "com 2 alvos, acerta um inimigo só" (o Atacar não confere o `ataque.alvos` do item),
  // a espada montada sem peça de dano (a tira e o encontro sem número) e o "Nada" no Soma como arma só de efeito (no item, Soma vazia
  // é só o dano da arma, bug de 28/11; o só de efeito é o dano 0 com o "Ao acertar", provado acima).
})

describe('o modelo "Golpe com efeito" da C8', () => {
  it('numa arma de Percepção, o Atacar dá o mesmo número de antes do modelo', () => {
    const rosa = arma('arma_rosa', 'Rosa de Teste', { campos: { categoria: 'Fogo', dano: '30', atributoDoAtaque: 'Percepção' } })
    const atirador = ficha('Atirador de Teste', { forca: 20, percepcao: 50 }, { hp: 500, sp: 50, escudo: 0 }, { armas: [rosa] })
    const montada = { ...rosa, mecanica: guardarMecanica(mecanicaDoModeloDaArma('golpeComSelo', sistema, rosa)) }
    const antes = danoDoAtaque({ personagem: atirador, sistema, arma: rosa, vidaDoAlvo: null })
    const depois = danoDaTecnica(montada, { personagem: atirador, sistema, arma: montada })
    expect([antes, depois].map((lido) => (lido.tipo === 'valor' ? lido.valor : lido.tipo))).toEqual([80, 80])
  })
})

describe('a arma padrão da C8', () => {
  it('a padrão vai na frente e é a escolhida; sem padrão, a primeira', () => {
    const espada = arma('arma_espada', 'Espada de Teste')
    const lanca = arma('arma_lanca', 'Lança de Teste', { armaPadrao: true })
    expect(comAPadraoNaFrente([espada, lanca]).map((item) => item.id)).toEqual(['arma_lanca', 'arma_espada'])
    expect(armaPadraoEntre([espada, lanca])?.id).toBe('arma_lanca')
    expect(armaPadraoEntre([espada])?.id).toBe('arma_espada')
    expect(armaPadraoEntre([])).toBeNull()
  })

  it('o NPC: a sugestão do painel traz a arma equipada da mochila, não a primeira vaga', () => {
    // E6a: a marca Padrão era do cartão da aba Armas; o item não tem marca, e a sugestão fica com a primeira EQUIPADA.
    const ataque = { dano: 30, soma: 'forca', acao: 'Ação Simples', alvos: 1 }
    const espada: CarriedItem = { id: 'vaga_espada', nome: 'Espada de Teste', tipo: 'corpo', regra: { ataque } }
    const lanca: CarriedItem = { id: 'vaga_lanca', nome: 'Lança de Teste', tipo: 'corpo', equipado: true, regra: { ataque } }
    const npc: Personagem = { ...ficha('NPC de Teste', { forca: 20 }, { hp: 500, sp: 50, escudo: 0 }, {}), tipo: 'npc', mochila: [espada, lanca] }
    const carta = novaCarta('tok_npc', npc.id, npc.nome)
    const turnos: TurnosDaCena = { cartas: [carta, novaCarta('tok_may', may.id, may.nome)], vez: carta.id, rodada: 1, desempate: 'd20', d20: {}, empates: {}, extras: {}, gastos: {} }
    const sugestao = sugestaoParaNpc(npc, { turnos, registro: [], regras: null }, { personagens: [npc, may], sistema, equipes: undefined, caidos: new Set() })
    expect(sugestao.armaId).toBe(`${PREFIXO_DA_ARMA_DA_MOCHILA}vaga_lanca`)
  })

  it('o dano "perguntar qual arma" é lido e usa a arma; valor desconhecido invalida a mecânica', () => {
    const base = { versao: 1, acao: 'simples', custos: [], alvo: { quem: 'inimigos', forma: { tipo: 'um' } }, teste: { tipo: 'reacao' }, efeitos: [] }
    const dano = (arma: string) => ({ ...base, dano: { base: { formula: 'Força + Dano da Arma' }, multiplicadores: { concentracao: true, surpresa: true }, arma } })
    const lida = lerMecanica(dano('perguntar'))
    expect(lida.tipo).toBe('pecas')
    expect(lida.tipo === 'pecas' && danoUsaArma(lida.mecanica.dano)).toBe(true)
    expect(danoUsaArma({ arma: 'nenhuma' })).toBe(false)
    expect(lerMecanica(dano('qualquer')).tipo).toBe('invalida')
  })
})
