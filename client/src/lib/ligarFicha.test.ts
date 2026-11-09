import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { mapaComAsLigacoes, planejarLigacao } from './ligarFicha'
import { novoPersonagem, type Personagem } from './personagem'
import { SISTEMA_ONE_PIECE } from './sistemaOnePiece'
import type { Token } from '../types/map'

function ficha(tipo: 'jogador' | 'npc', nome: string, id: string): Personagem {
  const base = novoPersonagem(SISTEMA_ONE_PIECE, tipo, nome)
  return { ...base, id, recursos: { ...base.recursos, hp: 40 }, maximos: { hp: 40 } }
}

const token = (id: string, name: string, characterId: string | null = null) => ({ id, name, characterId })

describe('planejarLigacao: cada token com a própria vida', () => {
  it('NPC: o primeiro token usa a própria ficha, os outros ganham cópias com o nome do token e o HP cheio; quem já usa fica', () => {
    const urso = ficha('npc', 'Urso', 'p-urso')
    const plano = planejarLigacao(urso, [token('t1', 'Urso'), token('t2', 'Urso grande'), token('t3', 'Urso', 'p-urso')], [], [urso])
    expect(plano.jaLigados).toBe(1)
    // t3 já usava a ficha e fica: ela não está livre, então t1 e t2 ganham cópias.
    expect(plano.ligacoes.map((l) => l.tokenId)).toEqual(['t1', 't2'])
    expect(plano.copias.map((c) => [c.nome, c.combate?.modeloId, c.recursos.hp])).toEqual([
      ['Urso', 'p-urso', 40],
      ['Urso grande', 'p-urso', 40],
    ])
    expect(plano.ligacoes.map((l) => l.personagemId)).toEqual(plano.copias.map((c) => c.id))

    const livre = planejarLigacao(urso, [token('t1', 'Urso'), token('t2', 'Urso')], [token('t1', 'Urso'), token('t2', 'Urso')], [urso])
    expect(livre.ligacoes[0].personagemId).toBe('p-urso')
    expect(livre.copias).toHaveLength(1)
  })

  it('jogador é um só: todo token aponta para a mesma ficha, sem cópia', () => {
    const harvey = ficha('jogador', 'Harvey', 'p-harvey')
    const plano = planejarLigacao(harvey, [token('t1', 'A'), token('t2', 'B')], [token('t9', 'C', 'p-harvey')], [harvey])
    expect(plano.copias).toEqual([])
    expect(plano.ligacoes).toEqual([
      { tokenId: 't1', personagemId: 'p-harvey' },
      { tokenId: 't2', personagemId: 'p-harvey' },
    ])
  })
})

describe('mapaComAsLigacoes: um passo só', () => {
  it('liga vários tokens; a foto só entra onde veio; sem mudança devolve o MESMO mapa', () => {
    const base = createEmptyMap('m1', 'Floresta', 10, 10, 50)
    const t = (id: string, extra: Partial<Token> = {}): Token => ({ id, characterId: null, name: id, x: 0, y: 0, size: 1, image: null, ...extra })
    const map = { ...base, tokens: [t('a'), t('b', { imageData: 'data:image/png;base64,EU' }), t('c')] }
    const ligado = mapaComAsLigacoes(map, [
      { tokenId: 'a', characterId: 'p1', npc: true, imageData: 'data:image/png;base64,RETRATO' },
      { tokenId: 'b', characterId: 'p2', npc: true },
    ])
    expect(ligado.tokens.map((tk) => [tk.id, tk.characterId, tk.npc, tk.imageData])).toEqual([
      ['a', 'p1', true, 'data:image/png;base64,RETRATO'],
      ['b', 'p2', true, 'data:image/png;base64,EU'],
      ['c', null, undefined, undefined],
    ])
    expect(mapaComAsLigacoes(ligado, [{ tokenId: 'a', characterId: 'p1', npc: true }])).toBe(ligado)
    expect(mapaComAsLigacoes(ligado, [])).toBe(ligado)
  })
})
