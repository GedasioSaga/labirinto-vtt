/**
 * A PERGUNTA ANTES DE VIRAR VARIAÇÃO (pedido de 23/11/2026): a variação não
 * guarda ficha própria (`sincronizarVariacoes` copia a do modelo), então os
 * golpes, as armas e os atributos do NPC somem. `virarVariacaoTrocaAFicha`
 * diz à tela quando perguntar: só quando a ficha muda de verdade.
 */
import { describe, expect, it } from 'vitest'
import { novoCartao, novoPersonagem, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { virarVariacaoTrocaAFicha } from './combate'

function npc(id: string, nome: string): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, 'npc', nome), id }
}

/** O NPC com um golpe próprio na aba das técnicas e um atributo diferente. */
function comFichaPropria(personagem: Personagem, golpe: string, forca: number): Personagem {
  return { ...personagem, abas: { ...personagem.abas, habilidades: [novoCartao(golpe)] }, atributos: { ...personagem.atributos, forca } }
}

describe('virarVariacaoTrocaAFicha: quando a tela pergunta', () => {
  it('golpe e atributo próprios: a ficha some, então pergunta (NPC único sobre NPC único também)', () => {
    const escudo = comFichaPropria(npc('escudo', 'Cavaleiro com Escudo'), 'Escudada', 7)
    const clava = comFichaPropria(npc('clava', 'Cavaleiro com Clava'), 'Clavada', 9)
    const variacaoDaClava: Personagem = { ...clava, id: 'clava-2', nome: 'Clava 2', combate: { forca: 1, modeloId: 'clava' } }
    expect(virarVariacaoTrocaAFicha([escudo, clava], 'escudo', 'clava')).toBe(true)
    // Alvo que é variação conta como o modelo dela: a ficha que chega é a da Clava.
    expect(virarVariacaoTrocaAFicha([escudo, clava, variacaoDaClava], 'escudo', 'clava-2')).toBe(true)
  })

  it('ficha igual à do modelo (até sem `combate`, sem golpes e sem retrato): grava sem perguntar; recusa e NPC que sumiu também não perguntam', () => {
    const modelo = npc('modelo', 'Zumbi')
    // Mesma ficha, outro nome, retrato e vida: o que é dele fica, então nada some.
    const igual: Personagem = { ...modelo, id: 'igual', nome: 'Zumbi Lento', retrato: null, recursos: { hp: 3 } }
    expect(igual.combate).toBeUndefined()
    expect(virarVariacaoTrocaAFicha([igual, modelo], 'igual', 'modelo')).toBe(false)

    const soCenario: Personagem = { ...modelo, soCenario: true }
    const diferente = comFichaPropria(npc('diferente', 'Pirata'), 'Soco', 5)
    expect(virarVariacaoTrocaAFicha([diferente, soCenario], 'diferente', 'modelo')).toBe(false)
    expect(virarVariacaoTrocaAFicha([diferente, modelo], 'nao-existe', 'modelo')).toBe(false)
  })
})
