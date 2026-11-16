/**
 * COISA x REGRA na batalha (Fase 5): a Garrucha do Acervo, só na MOCHILA,
 * ataca (sem regra no livro, com o dano digitado); o Kit Médico conta pela
 * coisa (`itemId`), com o nome como reserva. Dados do kit da fatia B. No
 * máximo 2 testes por caso.
 */
import { describe, expect, it } from 'vitest'
import type { Personagem } from '../personagem'
import { jimboy, may, sistema } from './fichasDaFatiaB.testkit'
import { lancarGolpe, podeAgir, type ContextoDoGolpe } from './golpe'
import type { PedidoDeAcao } from './combate'
import { armasDe, PREFIXO_DA_ARMA_DA_MOCHILA } from './leituraDaFicha'
import { quantosDoConsumivel } from './mecanicasAMao'
import { novaCarta, type TurnosDaCena } from './turnos'

function contexto(personagem: Personagem): ContextoDoGolpe {
  const carta = novaCarta('tok_jimboy', personagem.id, personagem.nome)
  const outra = novaCarta('tok_may', may.id, may.nome)
  const turnos: TurnosDaCena = { cartas: [carta, outra], vez: carta.id, rodada: 1, desempate: 'd20', d20: {}, empates: {}, extras: {}, gastos: {} }
  return { turnos, carta, personagem, sistema, regras: null, autor: { tipo: 'mestre' }, personagens: [personagem, may], personagemDoToken: (tokenId) => (tokenId === 'tok_jimboy' ? personagem.id : tokenId === 'tok_may' ? may.id : undefined) }
}

const GARRUCHA = { id: 'vaga_garrucha', nome: 'Garrucha', itemId: 'item_garrucha', categoria: 'Arma' }
/** Jimboy sem nenhum cartão na aba Armas: a Garrucha está só na mochila. */
const comGarrucha: Personagem = { ...jimboy, abas: { ...jimboy.abas, armas: [] }, mochila: [GARRUCHA, { id: 'vaga_pao', nome: 'Pão', categoria: 'Consumível' }] }

function ataque(armaId: string): PedidoDeAcao {
  return { tipo: 'atacar', armaId, alvos: [{ tokenId: 'tok_may', dano: 35 }], surpresa: false, perfurante: false }
}

describe('a arma da mochila na batalha', () => {
  it('a Garrucha do Acervo, só na mochila, aparece nas armas e ataca; o Pão não é arma', () => {
    const armas = armasDe(comGarrucha)
    expect(armas.map((arma) => [arma.id, arma.nome, arma.itemId, arma.aMao])).toEqual([[`${PREFIXO_DA_ARMA_DA_MOCHILA}vaga_garrucha`, 'Garrucha', 'item_garrucha', true]])
    const armaId = armas[0]?.id ?? ''
    expect(podeAgir(contexto(comGarrucha), ataque(armaId))).toBeNull()
    const golpe = lancarGolpe(contexto(comGarrucha), ataque(armaId), { golpe: 'g1', linha: 'l1' }).golpe
    expect(golpe).not.toBeNull()
  })

  it('arma que não está na ficha nem na mochila é recusada; a mesma leitura volta enquanto a ficha não muda', () => {
    expect(podeAgir(contexto(comGarrucha), ataque(`${PREFIXO_DA_ARMA_DA_MOCHILA}vaga_que_nao_existe`))).not.toBeNull()
    expect(armasDe(comGarrucha)).toBe(armasDe(comGarrucha))
  })
})

describe('o consumível pela coisa do Acervo', () => {
  it('conta pelo itemId: a vaga da mesma coisa com outro nome conta junto; a de outro itemId com outro nome, não', () => {
    const mochila = [
      { id: 'a', nome: 'Kit Médico', itemId: 'item_kit', quantidade: 2 },
      { id: 'b', nome: 'Kit de campanha', itemId: 'item_kit' },
      { id: 'c', nome: 'Bandagem', itemId: 'item_bandagem' },
    ]
    expect(quantosDoConsumivel(mochila, 'Kit Médico')).toBe(3)
    // Sem nenhuma vaga com o nome, quem sabe a coisa (Acervo ou regra ligada do livro) diz o id.
    expect(quantosDoConsumivel([{ nome: 'Kit de campanha', itemId: 'item_kit' }], 'Kit Médico', new Set(['item_kit']))).toBe(1)
  })

  it('a vaga sem itemId (pino, ficha de antes) conta pelo nome, sem acento e sem caixa', () => {
    expect(quantosDoConsumivel([{ nome: 'kit medico' }, { nome: 'Kit Médico', quantidade: 2 }], 'Kit Médico')).toBe(3)
  })
})
