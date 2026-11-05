/**
 * MOCHILA NA FICHA — a junção da migração (`lib/mochila/juncao.ts`, fatia A2).
 * Dados inventados: nada de ficha real (repo público).
 */
import { describe, expect, it } from 'vitest'
import type { CarriedItem } from '../../types/map'
import { novoPersonagem, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { juntarMochilas, type CenaDaJuncao } from './juncao'

function ficha(id: string, nome: string, extra: Partial<Personagem> = {}): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', nome), id, ...extra }
}

const POCAO_X3: CarriedItem = { id: 'vaga_pocao', nome: 'Poção', itemId: 'acervo_pocao', empilhavel: true, quantidade: 3 }
const POCAO_X1: CarriedItem = { id: 'vaga_pocao', nome: 'Poção', itemId: 'acervo_pocao', empilhavel: true }
const ESPADA: CarriedItem = { id: 'pino_espada', nome: 'Espada Velha' }
const MAPA_DO_TESOURO: CarriedItem = { id: 'pino_mapa', nome: 'Mapa do Tesouro' }

function cena(mapa: string, gravadaEm: number, bonecos: CenaDaJuncao['bonecos']): CenaDaJuncao {
  return { origem: { mapa, cena: 'Praia', gravadaEm }, bonecos }
}

const ANTIGA = 1_000
const RECENTE = 2_000

describe('junção da mochila: vale a cena gravada por último', () => {
  it('Poção x3 num mapa antigo e x1 no mais recente: fica x1, e a diferença vai ao relatório', () => {
    const luffy = ficha('p_luffy', 'Luffy')
    const juncao = juntarMochilas(
      [luffy],
      // A antiga chega primeiro de propósito: quem decide é a hora, não a ordem.
      [cena('Ilha Antiga', ANTIGA, [{ characterId: 'p_luffy', mochila: [POCAO_X3] }]), cena('Vila Nova', RECENTE, [{ characterId: 'p_luffy', mochila: [POCAO_X1] }])],
    )
    expect(juncao.personagens[0].mochila).toEqual([POCAO_X1])
    expect(juncao.bases).toEqual([{ personagemId: 'p_luffy', personagem: 'Luffy', origem: { mapa: 'Vila Nova', cena: 'Praia', gravadaEm: RECENTE } }])
    expect(juncao.diferencas).toEqual([
      { tipo: 'item-diferente', personagemId: 'p_luffy', personagem: 'Luffy', vale: POCAO_X1, outro: POCAO_X3, origem: { mapa: 'Ilha Antiga', cena: 'Praia', gravadaEm: ANTIGA } },
    ])
  })

  it('a mesma pilha do acervo em vagas diferentes é o mesmo item: não duplica a Poção', () => {
    const luffy = ficha('p_luffy', 'Luffy')
    const pocaoEmOutraVaga: CarriedItem = { ...POCAO_X3, id: 'vaga_outra' }
    const juncao = juntarMochilas([luffy], [cena('Ilha Antiga', ANTIGA, [{ characterId: 'p_luffy', mochila: [pocaoEmOutraVaga] }]), cena('Vila Nova', RECENTE, [{ characterId: 'p_luffy', mochila: [POCAO_X1] }])])
    expect(juncao.personagens[0].mochila).toEqual([POCAO_X1])
    expect(juncao.diferencas.map((diferenca) => diferenca.tipo)).toEqual(['item-diferente'])
  })

  it('item de id diferente: a ficha fica com os dois, e o que veio da cena antiga é listado', () => {
    const luffy = ficha('p_luffy', 'Luffy')
    const juncao = juntarMochilas([luffy], [cena('Vila Nova', RECENTE, [{ characterId: 'p_luffy', mochila: [MAPA_DO_TESOURO] }]), cena('Ilha Antiga', ANTIGA, [{ characterId: 'p_luffy', mochila: [ESPADA] }])])
    expect(juncao.personagens[0].mochila).toEqual([MAPA_DO_TESOURO, ESPADA])
    expect(juncao.diferencas).toEqual([
      { tipo: 'item-de-outra-cena', personagemId: 'p_luffy', personagem: 'Luffy', item: ESPADA, origem: { mapa: 'Ilha Antiga', cena: 'Praia', gravadaEm: ANTIGA } },
    ])
  })

  it('moedas: vale a bolsa da cena mais recente, nunca a soma; a outra vai ao relatório', () => {
    const luffy = ficha('p_luffy', 'Luffy')
    const juncao = juntarMochilas([luffy], [cena('Ilha Antiga', ANTIGA, [{ characterId: 'p_luffy', moedas: 80 }]), cena('Vila Nova', RECENTE, [{ characterId: 'p_luffy', moedas: 50 }])])
    expect(juncao.personagens[0].moedas).toBe(50)
    expect(juncao.diferencas).toEqual([
      { tipo: 'moedas-diferentes', personagemId: 'p_luffy', personagem: 'Luffy', vale: 50, outra: 80, origem: { mapa: 'Ilha Antiga', cena: 'Praia', gravadaEm: ANTIGA } },
    ])
  })

  it('a cena mais recente com o boneco de mãos vazias: a ficha não ganha chave vazia, e o item antigo fica listado', () => {
    const luffy = ficha('p_luffy', 'Luffy')
    const juncao = juntarMochilas([luffy], [cena('Vila Nova', RECENTE, [{ characterId: 'p_luffy' }]), cena('Ilha Antiga', ANTIGA, [{ characterId: 'p_luffy', mochila: [ESPADA], moedas: 10 }])])
    expect(juncao.personagens[0].mochila).toEqual([ESPADA])
    expect('moedas' in juncao.personagens[0]).toBe(false)
    expect(juncao.diferencas.map((diferenca) => diferenca.tipo)).toEqual(['item-de-outra-cena', 'moedas-diferentes'])
  })

  it('NPC sem ficha fica intocado: o boneco dele não entra em ficha nenhuma, e nada da entrada muda', () => {
    const luffy = ficha('p_luffy', 'Luffy')
    const bonecoDoNpc = { characterId: null, mochila: [ESPADA], moedas: 300 }
    const bonecoDeFichaQueNaoEstaNaLista = { characterId: 'p_marinheiro', mochila: [MAPA_DO_TESOURO] }
    const cenas = [cena('Vila Nova', RECENTE, [bonecoDoNpc, bonecoDeFichaQueNaoEstaNaLista, { characterId: 'p_luffy', mochila: [POCAO_X1] }])]
    const antes = JSON.stringify(cenas)
    const juncao = juntarMochilas([luffy], cenas)
    expect(juncao.personagens.map((personagem) => [personagem.id, personagem.mochila, personagem.moedas])).toEqual([['p_luffy', [POCAO_X1], undefined]])
    expect(juncao.diferencas).toEqual([])
    expect(JSON.stringify(cenas)).toBe(antes)
  })

  it('ficha sem boneco em cena nenhuma volta igual (a mesma referência) e é listada', () => {
    const luffy = ficha('p_luffy', 'Luffy')
    const nami = ficha('p_nami', 'Nami')
    const juncao = juntarMochilas([luffy, nami], [cena('Vila Nova', RECENTE, [{ characterId: 'p_luffy', mochila: [POCAO_X1] }])])
    expect(juncao.personagens[1]).toBe(nami)
    expect(juncao.semBoneco).toEqual([{ personagemId: 'p_nami', personagem: 'Nami' }])
  })

  it('ficha que já tinha mochila entra como a fonte mais velha: o item dela fica e é listado', () => {
    const luffy = ficha('p_luffy', 'Luffy', { mochila: [ESPADA] })
    const juncao = juntarMochilas([luffy], [cena('Vila Nova', RECENTE, [{ characterId: 'p_luffy', mochila: [POCAO_X1] }])])
    expect(juncao.personagens[0].mochila).toEqual([POCAO_X1, ESPADA])
    expect(juncao.diferencas).toEqual([expect.objectContaining({ tipo: 'item-de-outra-cena', item: ESPADA, origem: expect.objectContaining({ mapa: 'a própria ficha' }) })])
  })
})
