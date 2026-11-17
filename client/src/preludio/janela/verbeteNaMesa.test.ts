/**
 * "PÔR NO MAPA" DE UM JOGADOR (pedido 6 de 17/11/2026): quando o mapa aberto é
 * de outra pasta, o mestre lê de quem é a ficha, onde ela mora e qual mapa abrir.
 */
import { describe, expect, it } from 'vitest'
import { motivoDaOutraPasta } from './verbeteNaMesa'

describe('motivoDaOutraPasta', () => {
  it('diz que é ficha de jogador, a pasta dela e a do mapa aberto', () => {
    expect(motivoDaOutraPasta({ tipo: 'jogador', nome: 'Ryoko D. Violet' }, 'One Piece', { nome: 'Dragon Ball', proprio: false })).toBe(
      'A ficha de jogador de Ryoko D. Violet mora na pasta One Piece, e o mapa aberto é da pasta Dragon Ball. Abra um mapa de One Piece e tente de novo.',
    )
  })

  it('sem mapa de pasta aberto, ou com fichas só do mapa, e sem a ficha na pasta', () => {
    expect(motivoDaOutraPasta({ tipo: 'npc', nome: 'Lobo' }, 'One Piece', null)).toBe('A ficha de NPC de Lobo mora na pasta One Piece, e nenhum mapa de pasta está aberto. Abra um mapa de One Piece e tente de novo.')
    expect(motivoDaOutraPasta(null, 'One Piece', { nome: 'One Piece', proprio: true })).toBe(
      'A ficha ligada a este verbete mora na pasta One Piece, e o mapa aberto usa fichas só dele. Abra um mapa que use as fichas da pasta One Piece e tente de novo.',
    )
  })
})
