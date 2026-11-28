/**
 * MUNIÇÃO NA VAGA (pedido de 16/11/2026), refeita nos itens (E6a): a Garrucha
 * equipada leva na `regra` da vaga o pente e as munições que aceita
 * (`regra.pente.aceita`, no lugar da lista `CarriedItem.municoes`). A batalha
 * lê o Acervo de agora e, sem ele (o app do jogador, o Worker), a regra da
 * vaga: então o jogador também atira com as "Balas de prata" do pente.
 */
import { afterEach, describe, expect, it } from 'vitest'
import type { CarriedItem } from '../../types/map'
import type { Personagem } from '../personagem'
import { jimboy } from './fichasDaFatiaB.testkit'
import { armasDe, motivoDoPente, PREFIXO_DA_MUNICAO, type ArmaDaFicha } from './leituraDaFicha'
import { definirMunicoesDasArmas } from './municoesDoAcervo'

const PRATA = 'item_balas_prata'
const ATAQUE = { dano: 20, soma: 'forca', acao: 'Ação Simples', alvos: 1 }
/** A vaga de antes da regra (só o tipo e o equipado): quem diz o pente é o Acervo de agora. */
const GARRUCHA_SEM_REGRA: CarriedItem = { id: 'vaga_garrucha', nome: 'Garrucha', itemId: 'item_garrucha', categoria: 'Arma', tipo: 'fogo', equipado: true }
const GARRUCHA: CarriedItem = { ...GARRUCHA_SEM_REGRA, regra: { ataque: ATAQUE, pente: { capacidade: 2, aceita: [PRATA] } } }

function balas(id: string, nome: string, itemId: string, quantidade: number): CarriedItem {
  return { id, nome, itemId, tipo: 'municao', quantidade, empilhavel: true }
}

function comMochila(mochila: CarriedItem[]): Personagem {
  return { ...jimboy, abas: { ...jimboy.abas, armas: [] }, mochila }
}

function garruchaDe(personagem: Personagem): ArmaDaFicha {
  const arma = armasDe(personagem)[0]
  if (arma === undefined) throw new Error('a Garrucha equipada não está no Atacar')
  return arma
}

/** O pente da única arma da ficha: se exige munição, a capacidade, as balas do pente (id, nome, quantas) e as que a mochila guarda fora dele. */
function penteDaGarrucha(personagem: Personagem) {
  const arma = garruchaDe(personagem)
  return { exige: arma.exigeMunicao === true, capacidade: arma.pente?.capacidade, balas: arma.balas.map((bala) => [bala.id, bala.nome, bala.municao?.quantos]), naMochila: arma.pente?.naMochila }
}

afterEach(() => definirMunicoesDasArmas([]))

describe('a vaga da arma traz as munições', () => {
  it('sem o Acervo (o app do jogador), a regra da vaga vale: com o pente vazio o tiro exige munição e diz por quê; com 3 no pente, conta 3', () => {
    definirMunicoesDasArmas([])
    const semBala = comMochila([GARRUCHA])
    expect(penteDaGarrucha(semBala)).toEqual({ exige: true, capacidade: 2, balas: [], naMochila: 0 })
    expect(motivoDoPente(garruchaDe(semBala), 0)).toBe('Pente vazio e nenhuma bala que Garrucha aceita na mochila')
    const comTres = comMochila([{ ...GARRUCHA, pente: { balaId: PRATA, n: 3 } }, balas('vaga_prata', 'Balas de prata', PRATA, 5)])
    expect(penteDaGarrucha(comTres)).toEqual({ exige: true, capacidade: 2, balas: [[`${PREFIXO_DA_MUNICAO}${PRATA}`, 'Balas de prata', 3]], naMochila: 5 })
  })

  it('a vaga antiga, sem a regra, cai no Acervo de agora; com o Acervo, o pente dele vence o instantâneo da vaga', () => {
    definirMunicoesDasArmas([
      { id: 'item_garrucha', nome: 'Garrucha', tipo: 'fogo', ataque: ATAQUE, pente: { capacidade: 6, aceita: ['item_balas'] } },
      { id: 'item_balas', nome: 'Balas', tipo: 'municao' },
    ])
    // A vaga das Balas também é de antes (sem tipo): o Acervo diz que é munição.
    const vagaDasBalas: CarriedItem = { id: 'vaga_balas', nome: 'Balas', itemId: 'item_balas', quantidade: 4 }
    const naMochila = [vagaDasBalas, balas('vaga_prata', 'Balas de prata', PRATA, 5)]
    expect(penteDaGarrucha(comMochila([GARRUCHA_SEM_REGRA, ...naMochila]))).toEqual({ exige: true, capacidade: 6, balas: [], naMochila: 4 })
    // Decisão A1 dos itens refeitos: a regra da vaga é o retrato para quem não tem o Acervo; no mestre, vale o Acervo de agora.
    expect(penteDaGarrucha(comMochila([GARRUCHA, ...naMochila]))).toEqual({ exige: true, capacidade: 6, balas: [], naMochila: 4 })
  })
})
