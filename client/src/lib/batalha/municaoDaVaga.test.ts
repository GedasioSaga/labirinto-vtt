/**
 * MUNIÇÃO NA VAGA (pedido de 16/11/2026): a Garrucha dada do Acervo leva as
 * munições que aceita (`CarriedItem.municoes`). A batalha lê a lista da vaga
 * primeiro, então o app do jogador (sem o Acervo do mestre) também vê "Balas
 * de prata"; a vaga antiga, sem a lista, cai no Acervo de agora.
 */
import { afterEach, describe, expect, it } from 'vitest'
import type { CarriedItem } from '../../types/map'
import type { Personagem } from '../personagem'
import { jimboy } from './fichasDaFatiaB.testkit'
import { armasDe, PREFIXO_DA_MUNICAO } from './leituraDaFicha'
import { definirMunicoesDasArmas } from './municoesDoAcervo'

const PRATA = { itemId: 'item_balas_prata', nome: 'Balas de prata' }
const GARRUCHA: CarriedItem = { id: 'vaga_garrucha', nome: 'Garrucha', itemId: 'item_garrucha', categoria: 'Arma' }

function comMochila(mochila: CarriedItem[]): Personagem {
  return { ...jimboy, abas: { ...jimboy.abas, armas: [] }, mochila }
}

/** As balas da única arma da ficha: nome, quantas na mochila e se a arma exige munição. */
function balasDaGarrucha(personagem: Personagem) {
  const arma = armasDe(personagem)[0]
  return { exige: arma?.exigeMunicao === true, balas: (arma?.balas ?? []).map((bala) => [bala.id, bala.nome, bala.municao?.quantos]) }
}

afterEach(() => definirMunicoesDasArmas([]))

describe('a vaga da arma traz as munições', () => {
  it('sem o Acervo (o app do jogador), a lista da vaga vale: com 0 a bala aparece e o tiro exige munição; com 3, conta 3', () => {
    definirMunicoesDasArmas([])
    const semBala = comMochila([{ ...GARRUCHA, municoes: [PRATA] }])
    expect(balasDaGarrucha(semBala)).toEqual({ exige: true, balas: [[`${PREFIXO_DA_MUNICAO}item_balas_prata`, 'Balas de prata', 0]] })
    const comTres = comMochila([{ ...GARRUCHA, municoes: [PRATA] }, { id: 'vaga_prata', nome: 'Balas de prata', itemId: 'item_balas_prata', quantidade: 3, empilhavel: true }])
    expect(balasDaGarrucha(comTres).balas).toEqual([[`${PREFIXO_DA_MUNICAO}item_balas_prata`, 'Balas de prata', 3]])
  })

  it('a vaga antiga, sem a lista, cai no Acervo de agora; a vaga que declara ganha do Acervo', () => {
    definirMunicoesDasArmas([
      { id: 'item_garrucha', nome: 'Garrucha', municoes: ['item_balas'] },
      { id: 'item_balas', nome: 'Balas' },
    ])
    expect(balasDaGarrucha(comMochila([GARRUCHA])).balas).toEqual([[`${PREFIXO_DA_MUNICAO}item_balas`, 'Balas', 0]])
    expect(balasDaGarrucha(comMochila([{ ...GARRUCHA, municoes: [PRATA] }])).balas).toEqual([[`${PREFIXO_DA_MUNICAO}item_balas_prata`, 'Balas de prata', 0]])
  })
})
