/**
 * A FICHA LIGADA AO VERBETE (pedido 6 de 17/11/2026): personagem ligado a uma
 * ficha de jogador não é NPC, e a ficha de mesmo nome (o Virar NPC liga a ela
 * em vez de dar "nome repetido") segue a regra de nome das fichas.
 */
import { describe, expect, it } from 'vitest'
import type { TipoDePersonagem } from '../personagem'
import { fichaDeMesmoNome, tipoDaFichaLigada, type TiposDasFichas } from './fichaDoVerbete'
import type { LigaFicha } from './tipos'

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

const comFichas = (...fichas: LigaFicha[]) => ({ liga: { fichas, cenas: [] } })

describe('tipoDaFichaLigada', () => {
  it('é jogador quando uma ficha ligada é de jogador, e NPC quando só há NPC', () => {
    expect(tipoDaFichaLigada(comFichas({ pastaId: OP, personagemId: 'p_ryoko' }), TIPOS)).toBe('jogador')
    expect(tipoDaFichaLigada(comFichas({ pastaId: OP, personagemId: 'p_lobo' }, { pastaId: OP, personagemId: 'p_ryoko' }), TIPOS)).toBe('jogador')
    expect(tipoDaFichaLigada(comFichas({ pastaId: OP, personagemId: 'p_lobo' }), TIPOS)).toBe('npc')
  })

  it('sem ficha é null; ficha de pasta ainda não lida (ou apagada) conta como NPC, o selo de antes', () => {
    expect(tipoDaFichaLigada({}, TIPOS)).toBeNull()
    expect(tipoDaFichaLigada(comFichas(), TIPOS)).toBeNull()
    expect(tipoDaFichaLigada(comFichas({ pastaId: 'pasta_nao_lida', personagemId: 'p_x' }), TIPOS)).toBe('npc')
    expect(tipoDaFichaLigada(comFichas({ pastaId: OP, personagemId: 'p_apagado' }), TIPOS)).toBe('npc')
  })
})

describe('fichaDeMesmoNome', () => {
  it('acha a ficha sem caixa (a regra do nome repetido), e nada para nome vazio ou só parecido', () => {
    const fichas = [
      { id: 'a', nome: 'Harvey Solferino' },
      { id: 'b', nome: 'Siegfried' },
    ]
    expect(fichaDeMesmoNome(fichas, 'SIEGFRIED')?.id).toBe('b')
    expect(fichaDeMesmoNome(fichas, 'Harvey')).toBeNull()
    expect(fichaDeMesmoNome(fichas, '   ')).toBeNull()
  })
})
