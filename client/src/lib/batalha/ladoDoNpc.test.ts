// @vitest-environment node
/**
 * Conserto de 09/11/2026 (a Bolha do Tree "não curou nada"): o NPC que luta ao
 * lado dos jogadores vira aliado deles pela equipe de sempre, e os NPCs que
 * ficaram sem equipe seguem aliados entre si. Dados inventados; no máximo 2
 * testes.
 */
import { describe, expect, it } from 'vitest'
import { EQUIPES_MAX, equipesComOLado, ladoDoNpc, mesmoLadoNaBatalha, type Equipe } from './equipes'
import { ficha } from './fichasDaFatiaB.testkit'
import type { Personagem } from '../personagem'

function de(nome: string, tipo: Personagem['tipo']): Personagem {
  return { ...ficha(nome, { forca: 20 }, { hp: 300, sp: 60, escudo: 0 }, {}), tipo }
}

const arvore = de('Árvore de Teste', 'npc')
const ferreiro = de('Ferreiro de Teste', 'npc')
const urso = de('Urso de Teste', 'npc')
const javali = de('Javali de Teste', 'npc')
const capita = de('Capitã de Teste', 'jogador')
const grumete = de('Grumete de Teste', 'jogador')
const personagens = [arvore, ferreiro, urso, javali, capita, grumete]
const lados = (equipes: readonly Equipe[] | undefined) => ({ equipes, personagens, invocados: [] })

describe('o lado do NPC pela equipe de sempre', () => {
  it('sem equipes: "do lado dos jogadores" cria a equipe com os jogadores e ele; os NPCs que sobraram seguem aliados entre si', () => {
    const comAArvore = equipesComOLado(undefined, personagens, arvore.id, 'jogadores', () => 'equipe_de_teste')
    expect(comAArvore).toEqual([{ id: 'equipe_de_teste', nome: 'Jogadores', cor: '#3f7fbf', membros: [capita.id, grumete.id, arvore.id] }])
    const equipes = equipesComOLado(comAArvore ?? [], personagens, ferreiro.id, 'jogadores')
    expect(equipes?.[0]?.membros).toEqual([capita.id, grumete.id, arvore.id, ferreiro.id])
    expect([ladoDoNpc(arvore.id, equipes ?? [], personagens), ladoDoNpc(urso.id, equipes ?? [], personagens)]).toEqual(['jogadores', 'contra'])
    const mesa = lados(equipes ?? [])
    expect([mesmoLadoNaBatalha(arvore.id, capita.id, mesa), mesmoLadoNaBatalha(capita.id, arvore.id, mesa), mesmoLadoNaBatalha(arvore.id, ferreiro.id, mesa)]).toEqual([true, true, true])
    expect([mesmoLadoNaBatalha(urso.id, javali.id, mesa), mesmoLadoNaBatalha(urso.id, arvore.id, mesa), mesmoLadoNaBatalha(urso.id, capita.id, mesa)]).toEqual([true, false, false])
  })

  it('"contra os jogadores" tira da equipe (a equipe fica); o que já está no lado pedido não muda nada; sem vaga para equipe nova, `null`', () => {
    const equipes: Equipe[] = [{ id: 'equipe_do_navio', nome: 'Navio', cor: '#336699', membros: [capita.id, arvore.id] }]
    expect(equipesComOLado(equipes, personagens, arvore.id, 'jogadores')).toBe(equipes)
    expect(equipesComOLado(equipes, personagens, urso.id, 'contra')).toBe(equipes)
    const contra = equipesComOLado(equipes, personagens, arvore.id, 'contra')
    expect(contra).toEqual([{ id: 'equipe_do_navio', nome: 'Navio', cor: '#336699', membros: [capita.id] }])
    expect(mesmoLadoNaBatalha(arvore.id, urso.id, lados(contra ?? []))).toBe(true)
    const cheias: Equipe[] = Array.from({ length: EQUIPES_MAX }, (_, i) => ({ id: `equipe_${i}`, nome: `Bando ${i}`, cor: '#8a7f6e', membros: [] }))
    expect(equipesComOLado(cheias, personagens, arvore.id, 'jogadores')).toBeNull()
  })
})
