/**
 * Fase C, item 4: o prazo da mesa NA BATALHA Dragon Ball, pela store real com
 * uma mesa de teste que tem mapa (`fichaDaCena`, `mudarFichaDaCena`). O
 * começo da vez tira a vida por turno; o fim desconta 1 turno; no último a
 * pastilha apaga. O Desfazer da linha volta o prazo descontado.
 */
import { describe, expect, it } from 'vitest'
import type { MesaDaBatalha } from '../../batalha/mesa'
import { novoPersonagem, type Personagem } from '../../personagem'
import { porCondicaoNaFicha, prazoDaCondicao } from '../../prazoDaCondicao'
import { criarBatalhaDBTStore } from '../../../stores/batalhaDBTStore'
import type { Token } from '../../../types/map'
import { fichaDBTVazia } from '../modelo'
import { SISTEMA_DRAGON_BALL } from '../sistemaDragonBall'
import type { AutorDBT } from './tipos'

const MESTRE: AutorDBT = { tipo: 'mestre' }
const CENA = 'cena-1'
/** Abaixo do PV máximo de qualquer ficha nova; 3 x 3 = 9 cabe sem chegar a 0. */
const PV_INICIAL = 10

function personagemDBT(id: string, tipo: 'jogador' | 'npc', nome: string): Personagem {
  const novo = novoPersonagem(SISTEMA_DRAGON_BALL, tipo, nome)
  return { ...novo, id, recursos: { ...novo.recursos, pv: PV_INICIAL, pk: 20 }, dbt: novo.dbt ?? fichaDBTVazia() }
}

function token(id: string, characterId: string): Token {
  return { id, characterId, name: id, x: 125, y: 125, size: 1, image: null }
}

function batalhaComVeneno() {
  const personagens = new Map([personagemDBT('goku', 'jogador', 'Goku'), personagemDBT('raditz', 'npc', 'Raditz')].map((p) => [p.id, p]))
  const tokens = new Map<string, Token>([
    ['t-goku', porCondicaoNaFicha(token('t-goku', 'goku'), 'Envenenado', [], { turnos: 3, porVez: 3 })],
    ['t-raditz', token('t-raditz', 'raditz')],
  ])
  const mesa: MesaDaBatalha = {
    personagens: () => [...personagens.values()],
    sistema: () => SISTEMA_DRAGON_BALL,
    equipes: () => [],
    ajustarPersonagem: (personagemId, ajustar) => {
      const atual = personagens.get(personagemId)
      if (atual === undefined) return false
      personagens.set(personagemId, ajustar(atual))
      return true
    },
    trocarEquipe: () => false,
    fichaDaCena: (_sceneKey, tokenId) => tokens.get(tokenId) ?? null,
    mudarFichaDaCena: (_sceneKey, tokenId, mudar) => {
      const atual = tokens.get(tokenId)
      if (atual !== undefined) tokens.set(tokenId, mudar(atual))
    },
  }
  const loja = criarBatalhaDBTStore(mesa, { rolar: () => 10, agora: () => 1000, posicoes: () => null })
  loja.getState().ligar(CENA, {}, {
    entrantes: [
      { tokenId: 't-goku', personagemId: 'goku', nome: 'Goku', lado: 'pj', npc: false },
      { tokenId: 't-raditz', personagemId: 'raditz', nome: 'Raditz', lado: 'npc', npc: true },
    ],
  })
  expect(loja.getState().comando(CENA, MESTRE, { tipo: 'rolarIniciativa', digitados: { 't-goku': 19, 't-raditz': 2 } }).ok).toBe(true)
  const pv = (): number => personagens.get('goku')?.recursos.pv ?? Number.NaN
  const goku = (): Token => tokens.get('t-goku') ?? token('t-goku', 'goku')
  /** Passa a vez de quem está nela. */
  const passar = (): void => {
    const cena = loja.getState().cenas[CENA]
    const vez = cena.ordem.vez
    if (vez === null) throw new Error('sem vez')
    const resposta = loja.getState().comando(CENA, MESTRE, { tipo: 'passar', vez: { combatenteId: vez, rodada: cena.ordem.rodada, turno: cena.combatentes[vez].turnosJogados } })
    expect(resposta).toEqual({ ok: true })
  }
  return { loja, pv, goku, passar }
}

describe('prazo da mesa na batalha Dragon Ball', () => {
  it('Envenenado 3 x 3: tira 3 no começo de cada vez de Goku, 9 no total, e a gota apaga no fim da terceira', () => {
    const { loja, pv, goku, passar } = batalhaComVeneno()
    expect(loja.getState().comando(CENA, MESTRE, { tipo: 'comecar' }).ok).toBe(true)
    expect(pv()).toBe(PV_INICIAL - 3) // começo da 1ª vez
    passar() // fim da 1ª: faltam 2; vez do Raditz
    expect(prazoDaCondicao(goku(), 'Envenenado')?.turnos).toBe(2)
    passar() // Raditz passa; começo da 2ª de Goku
    expect(pv()).toBe(PV_INICIAL - 6)
    passar()
    passar() // começo da 3ª
    expect(pv()).toBe(PV_INICIAL - 9)
    passar() // fim da 3ª: acabou
    expect(goku().conditions ?? []).not.toContain('envenenado')
    expect(goku().prazosDasCondicoes).toBeUndefined()
    passar() // Raditz; começo da 4ª: nada mais a tirar
    expect(pv()).toBe(PV_INICIAL - 9)
  })

  it('o Desfazer da linha que descontou o prazo devolve o turno', () => {
    const { loja, goku, passar } = batalhaComVeneno()
    expect(loja.getState().comando(CENA, MESTRE, { tipo: 'comecar' }).ok).toBe(true)
    passar()
    expect(prazoDaCondicao(goku(), 'Envenenado')?.turnos).toBe(2)
    const ultima = loja.getState().cenas[CENA].registro.at(-1)
    if (ultima === undefined) throw new Error('sem linha')
    expect(loja.getState().desfazer(CENA, ultima.id, MESTRE)).toBe(true)
    expect(prazoDaCondicao(goku(), 'Envenenado')?.turnos).toBe(3)
  })
})
