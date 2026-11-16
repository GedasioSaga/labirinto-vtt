/** O MESTRE EDITA A MOCHILA (pedido de 16/11/2026): o "Editar" da vaga e o Desfazer dele, sobre a mochila de agora. */
import { describe, expect, it } from 'vitest'
import type { CarriedItem } from '../../types/map'
import { ITEM_QUANTIDADE_MAX } from '../items'
import { mochilaComAVagaEditada, mochilaSemAMudanca } from './editarVaga'

const POCAO: CarriedItem = { id: 'vaga_pocao', nome: 'Poção', itemId: 'item_pocao', imagem: 'midia:abc', categoria: 'Consumível', empilhavel: true, quantidade: 2 }
const CORDA: CarriedItem = { id: 'vaga_corda', nome: 'Corda' }

describe('o Editar da vaga', () => {
  it('troca quantidade, nome, preço e descrição (o item do Acervo e a imagem ficam); o Desfazer volta a vaga no lugar, sem mexer no resto', () => {
    const editada = mochilaComAVagaEditada([CORDA, POCAO], POCAO.id, { nome: '  Poção grande ', descricao: 'Cura 50.', categoria: 'Consumível', preco: 120, quantidade: 5 })
    expect(editada).toEqual([CORDA, { id: 'vaga_pocao', nome: 'Poção grande', itemId: 'item_pocao', imagem: 'midia:abc', descricao: 'Cura 50.', categoria: 'Consumível', preco: 120, quantidade: 5, empilhavel: true }])
    // Outra vaga entrou depois do Editar: o Desfazer só devolve a Poção.
    const depois = [...(editada ?? []), { id: 'vaga_nova', nome: 'Mapa' }]
    expect(mochilaSemAMudanca(depois, POCAO.id, POCAO)).toEqual([CORDA, POCAO, { id: 'vaga_nova', nome: 'Mapa' }])
  })

  it('recusa nome vazio e quantidade fora de 1 a 9999; a Corda que passa de 1 vira empilhável', () => {
    const base = { descricao: '', categoria: '', preco: null }
    expect([mochilaComAVagaEditada([CORDA], CORDA.id, { ...base, nome: ' ', quantidade: 1 }), mochilaComAVagaEditada([CORDA], CORDA.id, { ...base, nome: 'Corda', quantidade: ITEM_QUANTIDADE_MAX + 1 })]).toEqual([null, null])
    expect(mochilaComAVagaEditada([CORDA], CORDA.id, { ...base, nome: 'Corda', quantidade: 3 })).toEqual([{ id: 'vaga_corda', nome: 'Corda', quantidade: 3, empilhavel: true }])
  })
})
