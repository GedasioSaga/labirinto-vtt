/**
 * HABILIDADE OCULTA na batalha (fatia C7): o mestre usa a técnica oculta e
 * todos veem "???"; o jogador não a usa (nem forjando o pedido). Dados do kit
 * da fatia B (inventados a partir das fichas de teste). No máximo 2 testes.
 */
import { describe, expect, it } from 'vitest'
import { NOME_DO_OCULTO, ocultarCartao } from '../habilidadeOculta'
import type { Personagem } from '../personagem'
import { jimboy, may, QUEBRA_QUEIXO, sistema } from './fichasDaFatiaB.testkit'
import { lancarGolpe, podeAgir, textoDoGolpe, type ContextoDoGolpe } from './golpe'
import type { PedidoDeAcao } from './combate'
import { novaCarta, type AutorDaAcao, type TurnosDaCena } from './turnos'

function contexto(personagem: Personagem, autor: AutorDaAcao): ContextoDoGolpe {
  const carta = novaCarta('tok_jimboy', personagem.id, personagem.nome)
  const outra = novaCarta('tok_may', may.id, may.nome)
  const turnos: TurnosDaCena = { cartas: [carta, outra], vez: carta.id, rodada: 1, desempate: 'd20', d20: {}, empates: {}, extras: {}, gastos: {} }
  return { turnos, carta, personagem, sistema, regras: null, autor, personagens: [personagem, may], personagemDoToken: (tokenId) => (tokenId === 'tok_jimboy' ? personagem.id : tokenId === 'tok_may' ? may.id : undefined) }
}

const PEDIDO: PedidoDeAcao = { tipo: 'habilidade', cartaoId: QUEBRA_QUEIXO.id, armaId: null, alvos: [{ tokenId: 'tok_may', dano: 90 }], surpresa: false, perfurante: false, custo: null, acao: null }

describe('técnica oculta na batalha', () => {
  it('o mestre usa: o golpe e a linha do registro dizem "???"; com "revela ao usar", o nome de verdade', () => {
    const oculto = ocultarCartao(jimboy, QUEBRA_QUEIXO.id, false)
    const golpe = lancarGolpe(contexto(oculto, { tipo: 'mestre' }), PEDIDO, { golpe: 'g1', linha: 'l1' }).golpe
    if (golpe === null) throw new Error('o golpe não saiu')
    expect(golpe.nome).toBe(NOME_DO_OCULTO)
    expect(textoDoGolpe(golpe, (tokenId) => tokenId)).not.toContain('Quebra-Queixo')
    const revela = ocultarCartao(jimboy, QUEBRA_QUEIXO.id, true)
    expect(lancarGolpe(contexto(revela, { tipo: 'mestre' }), PEDIDO, { golpe: 'g2', linha: 'l2' }).golpe?.nome).toBe('Quebra-Queixo')
  })

  it('o jogador não usa a técnica oculta (o pedido forjado é recusado); sem oculta, segue como antes', () => {
    const jogador: AutorDaAcao = { tipo: 'jogador', playerId: 'p1', nome: 'Rui' }
    expect(podeAgir(contexto(ocultarCartao(jimboy, QUEBRA_QUEIXO.id, false), jogador), PEDIDO)).toBe('Essa habilidade está oculta: só o mestre usa')
    expect(podeAgir(contexto(jimboy, jogador), PEDIDO)).not.toBe('Essa habilidade está oculta: só o mestre usa')
  })
})
