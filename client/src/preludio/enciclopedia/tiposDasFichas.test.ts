/**
 * O SELO "NPC" OU "JOGADOR" (pedido 6 de 17/11/2026): a loja só lê a pasta das
 * fichas que ainda não conhece, uma vez; e a conta da tela Campanhas e
 * sistemas separa os personagens ligados a ficha de jogador dos NPCs.
 */
import { describe, expect, it } from 'vitest'
import type { TipoDePersonagem } from '../../lib/personagem'
import { verbeteNovo } from '../../lib/preparo/enciclopedia'
import type { TiposDasFichas } from '../../lib/preparo/fichaDoVerbete'
import type { LigaFicha, Verbete } from '../../lib/preparo/tipos'
import { numerosDe } from '../campanhas/CampanhasESistemas'
import { pastasParaLer } from './tiposDasFichas'

const OP = 'pasta_op'
const TIPOS: TiposDasFichas = new Map([
  [
    OP,
    new Map<string, TipoDePersonagem>([
      ['p_ryoko', 'jogador'],
      ['p_lobo', 'npc'],
    ]),
  ],
])

function personagem(titulo: string, ...fichas: LigaFicha[]): Verbete {
  const verbete = verbeteNovo('personagem', titulo, { campanhas: ['c_op'] }, (prefixo) => `${prefixo}_${titulo}`)
  return fichas.length === 0 ? verbete : { ...verbete, liga: { fichas, cenas: [] } }
}

describe('pastasParaLer', () => {
  it('lê só a pasta com ficha desconhecida, e não pede de novo a ficha que a pasta não tem', () => {
    const verbetes = [personagem('Ryoko', { pastaId: OP, personagemId: 'p_ryoko' }), personagem('Goku', { pastaId: 'pasta_db', personagemId: 'p_goku' }), personagem('Nami')]
    const pedidas = new Set<string>()
    expect(pastasParaLer(verbetes, TIPOS, pedidas)).toEqual(['pasta_db'])
    // A Dragon Ball foi lida e a ficha p_goku não estava lá (apagada): não relê a cada render.
    expect(pastasParaLer(verbetes, TIPOS, pedidas)).toEqual([])
    // Ficha nova numa pasta já lida (o jogador fez outra no Lobby): relê aquela pasta.
    expect(pastasParaLer([personagem('Saga', { pastaId: OP, personagemId: 'p_saga' })], TIPOS, pedidas)).toEqual([OP])
  })
})

describe('numerosDe', () => {
  it('conta jogador à parte: personagem com ficha de jogador não é NPC', () => {
    const verbetes = new Map(
      [personagem('Ryoko', { pastaId: OP, personagemId: 'p_ryoko' }), personagem('Lobo', { pastaId: OP, personagemId: 'p_lobo' }), personagem('Nami')].map((verbete): [string, Verbete] => [verbete.id, verbete]),
    )
    expect(numerosDe('c_op', verbetes, [], TIPOS)).toEqual({ personagens: 3, npcs: 1, jogadores: 1, sessoes: 0, eventos: 0 })
  })

  it('o personagem na Lixeira não conta, nem como NPC', () => {
    const lobo: Verbete = { ...personagem('Lobo', { pastaId: OP, personagemId: 'p_lobo' }), lixeira: '2026-11-17T12:00:00.000Z' }
    const verbetes = new Map([lobo, personagem('Nami')].map((verbete): [string, Verbete] => [verbete.id, verbete]))
    expect(numerosDe('c_op', verbetes, [], TIPOS)).toEqual({ personagens: 1, npcs: 0, jogadores: 0, sessoes: 0, eventos: 0 })
  })
})
