// @vitest-environment node
/**
 * Pedido de 09/11/2026 (item 3): a "Mão nua" está sempre no Atacar, com arma
 * ou sem, e bate só com a Força. Dados inventados; no máximo 2 testes.
 */
import { describe, expect, it } from 'vitest'
import { ficha } from '../../lib/batalha/fichasDaFatiaB.testkit'
import type { CartaoDaFicha } from '../../lib/personagem'
import { SISTEMA_DO_TESTE } from '../../lib/treino/fichasDeTreino.testkit'
import { CHAVE_DA_MAO_NUA, golpesDeAtaque } from './dadosDoMenu'

const ESPADA: CartaoDaFicha = { id: 'cart_espada_de_teste', nome: 'Espada de Teste', campos: { categoria: 'Branca', dano: '10' }, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] }

describe('a Mão nua no Atacar', () => {
  it('quem leva arma tem a arma e, por último, a Mão nua (sem arma, dano = Força)', () => {
    const espadachim = ficha('Espadachim de Teste', { forca: 50 }, { hp: 300, sp: 0, escudo: 0 }, { armas: [ESPADA] })
    const tiras = golpesDeAtaque(espadachim, SISTEMA_DO_TESTE, undefined, null)
    expect(tiras.map((tira) => [tira.chave, tira.nome, tira.armaId, tira.dano.valor])).toEqual([
      [`arma:${ESPADA.id}`, 'Espada de Teste', ESPADA.id, 60],
      [CHAVE_DA_MAO_NUA, 'Mão nua', null, 50],
    ])
  })

  it('quem não leva arma nenhuma tem só a Mão nua (como era o "Ataque desarmado")', () => {
    const lutador = ficha('Lutador de Teste', { forca: 70 }, { hp: 300, sp: 0, escudo: 0 }, {})
    const tiras = golpesDeAtaque(lutador, SISTEMA_DO_TESTE, undefined, null)
    expect(tiras.map((tira) => [tira.chave, tira.nome, tira.armaId, tira.dano.valor])).toEqual([[CHAVE_DA_MAO_NUA, 'Mão nua', null, 70]])
  })
})
