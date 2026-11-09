/**
 * Construtor de mecânicas, fatia C8: a arma montada por peças (o Boomerang do
 * Vincent: sem dano, Atordoado no acerto, 3 vezes por batalha) e a arma
 * padrão (o Siegfried). Dados inventados; no máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import type { CartaoDaFicha, Personagem } from '../../personagem'
import { combateVazio, type PedidoDeAcao, type SeloPedido } from '../combate'
import { ficha, may, sistema } from '../fichasDaFatiaB.testkit'
import { lancarGolpe, podeAgir, type ContextoDoGolpe } from '../golpe'
import { novaCarta, type TurnosDaCena } from '../turnos'
import { armaPadraoEntre, comAPadraoNaFrente, mecanicaDoModeloDaArma } from './arma'
import { danoUsaArma, lerMecanica } from './modelo'
import { guardarMecanica } from './modelos'

function arma(id: string, nome: string, extra: Partial<CartaoDaFicha> = {}): CartaoDaFicha {
  return { id, nome, campos: { categoria: 'Arremesso', dano: '30' }, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [], ...extra }
}

const BUMERANGUE = arma('arma_bumerangue', 'Bumerangue de Teste', { mecanica: guardarMecanica(mecanicaDoModeloDaArma('atordoa', sistema)) })
const lancador = ficha('Lançador de Teste', { forca: 20, agilidade: 30 }, { hp: 500, sp: 50, escudo: 0 }, { armas: [BUMERANGUE] })

function contexto(personagem: Personagem, usadas: number): ContextoDoGolpe {
  const carta = novaCarta('tok_lancador', personagem.id, personagem.nome)
  const outra = novaCarta('tok_may', may.id, may.nome)
  const combate = { [personagem.id]: { ...combateVazio(), usos: { [BUMERANGUE.id]: usadas } } }
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

const ATACAR: PedidoDeAcao = { tipo: 'atacar', armaId: BUMERANGUE.id, alvos: [{ tokenId: 'tok_may', dano: 999 }], surpresa: false, perfurante: false }

describe('a arma montada da C8 (bumerangue)', () => {
  it('o Atacar com ela não dá dano, leva o Atordoado e conta 1 uso na batalha', () => {
    expect(podeAgir(contexto(lancador, 0), ATACAR)).toBeNull()
    const lancado = lancarGolpe(contexto(lancador, 0), ATACAR, { golpe: 'g1', linha: 'l1' })
    if (lancado.golpe === null) throw new Error('o golpe não saiu')
    // `null` = golpe sem dano: o 999 que a tela mandasse não entra.
    expect(lancado.golpe.alvos.map((alvo) => alvo.dano)).toEqual([null])
    expect(lancado.golpe.selo?.nome).toBe('Atordoado')
    expect(lancado.combate?.usos[BUMERANGUE.id]).toBe(1)
  })

  it('a 4ª vez na mesma batalha é recusada com o motivo; a arma sem peças segue como antes', () => {
    expect(podeAgir(contexto(lancador, 3), ATACAR)).toBe('Já usada nesta batalha (3/3)')
    const deTexto = ficha('Lançador de Texto', { forca: 20 }, { hp: 500, sp: 50, escudo: 0 }, { armas: [arma(BUMERANGUE.id, 'Bumerangue de Texto')] })
    expect(podeAgir(contexto(deTexto, 3), ATACAR)).toBeNull()
  })
})

describe('a arma de texto só de efeito da C8 ("Nada" no Soma no ataque)', () => {
  it('não dá dano, venha o número que vier; com selo o alvo reage, sem selo não', () => {
    const funda = arma(BUMERANGUE.id, 'Funda de Teste', { campos: { categoria: 'Arremesso', dano: '30', atributoDoAtaque: 'Nada' } })
    const fundeiro = ficha('Fundeiro de Teste', { forca: 20 }, { hp: 500, sp: 50, escudo: 0 }, { armas: [funda] })
    const atacar = (selo: SeloPedido | null): PedidoDeAcao => ({ ...ATACAR, ...(selo === null ? {} : { selo }) })
    const comoFicou = (pedido: PedidoDeAcao) => {
      expect(podeAgir(contexto(fundeiro, 0), pedido)).toBeNull()
      return lancarGolpe(contexto(fundeiro, 0), pedido, { golpe: 'g1', linha: 'l1' }).golpe?.alvos.map((alvo) => ({ dano: alvo.dano, reage: alvo.podeReagir }))
    }
    expect(comoFicou(atacar({ nome: 'Atordoado', turnos: 1 }))).toEqual([{ dano: null, reage: true }])
    expect(comoFicou(atacar(null))).toEqual([{ dano: null, reage: false }])
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
