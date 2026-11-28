/**
 * BUGS DA BATALHA DBT (testadores de 28/11/2026), na store do app (`criarBatalhaDBTStore`): o Atordoado que
 * acaba no fim da rodada deixa linha, e quem é incluído no meio não passa à frente de um 20 natural (5.3).
 */
import { describe, expect, it } from 'vitest'
import type { MesaDaBatalha } from '../../batalha/mesa'
import { novoPersonagem, type Personagem } from '../../personagem'
import { criarBatalhaDBTStore } from '../../../stores/batalhaDBTStore'
import { fichaDBTVazia } from '../modelo'
import { SISTEMA_DRAGON_BALL } from '../sistemaDragonBall'
import type { AutorDBT } from './tipos'

const MESTRE: AutorDBT = { tipo: 'mestre' }
const CENA = 'cena-dbt'

function personagemDBT(id: string, tipo: 'jogador' | 'npc', nome: string, des?: number): Personagem {
  const novo = novoPersonagem(SISTEMA_DRAGON_BALL, tipo, nome)
  return { ...novo, id, recursos: { ...novo.recursos, pv: 10, pk: 20 }, dbt: novo.dbt ?? fichaDBTVazia(), ...(des === undefined ? {} : { atributos: { ...novo.atributos, des } }) }
}

/** O que muda na batalha de teste: o d20 digitado do Raditz, a DES de cada um e o d20 que o dado rola depois do Começar. */
interface OpcoesDaBatalha {
  doRaditz?: number
  des?: Partial<Record<'goku' | 'raditz' | 'vegeta', number>>
  /** O d20 da rolagem depois do Começar (o "Incluir" sem total rola). */
  rolarDepois?: number
}

/** Goku (d20 `doGoku`) e Raditz (d20 2), e o Vegeta fora da batalha. */
function batalha(doGoku: number, { doRaditz = 2, des = {}, rolarDepois = 10 }: OpcoesDaBatalha = {}) {
  const personagens = new Map([personagemDBT('goku', 'jogador', 'Goku', des.goku), personagemDBT('raditz', 'npc', 'Raditz', des.raditz), personagemDBT('vegeta', 'npc', 'Vegeta', des.vegeta)].map((personagem) => [personagem.id, personagem]))
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
  }
  let d20 = 10
  const loja = criarBatalhaDBTStore(mesa, { rolar: () => d20, agora: () => 1000, posicoes: () => null })
  loja.getState().ligar(CENA, {}, {
    entrantes: [
      { tokenId: 't-goku', personagemId: 'goku', nome: 'Goku', lado: 'pj', npc: false },
      { tokenId: 't-raditz', personagemId: 'raditz', nome: 'Raditz', lado: 'npc', npc: true },
    ],
  })
  expect(loja.getState().comando(CENA, MESTRE, { tipo: 'rolarIniciativa', digitados: { 't-goku': doGoku, 't-raditz': doRaditz } }).ok).toBe(true)
  expect(loja.getState().comando(CENA, MESTRE, { tipo: 'comecar' }).ok).toBe(true)
  d20 = rolarDepois
  return loja
}

describe('DBT: o que acaba no fim da rodada', () => {
  it('o Atordoado do Raditz sai com a linha "Raditz: Atordoado acabou"', () => {
    const loja = batalha(19)
    expect(loja.getState().comando(CENA, MESTRE, { tipo: 'mestre', acao: { tipo: 'porCondicao', combatenteId: 't-raditz', condicao: 'atordoado' } }).ok).toBe(true)
    for (let i = 0; i < 4 && (loja.getState().cenas[CENA]?.ordem.rodada ?? 0) < 2; i += 1) {
      const cena = loja.getState().cenas[CENA]
      const vez = cena?.ordem.vez
      if (cena === undefined || vez === null || vez === undefined) break
      expect(loja.getState().comando(CENA, MESTRE, { tipo: 'passar', vez: { combatenteId: vez, rodada: cena.ordem.rodada, turno: cena.combatentes[vez]?.turnosJogados ?? 0 } }).ok).toBe(true)
    }
    const cena = loja.getState().cenas[CENA]
    expect(cena?.ordem.rodada).toBe(2)
    expect(cena?.combatentes['t-raditz']?.condicoes.map((ativa) => ativa.nome)).not.toContain('Atordoado')
    expect(cena?.registro.some((linha) => [linha.texto, ...(linha.detalhes ?? [])].some((texto) => texto.includes('Raditz: Atordoado acabou')))).toBe(true)
  })
})

describe('DBT: incluir no meio respeita o 20 natural (5.3)', () => {
  it('Goku tirou 20 natural: o Vegeta com total 30 entra depois dele, antes do Raditz', () => {
    const loja = batalha(20)
    expect(loja.getState().comando(CENA, MESTRE, { tipo: 'mestre', acao: { tipo: 'incluir', entrante: { tokenId: 't-vegeta', personagemId: 'vegeta', nome: 'Vegeta', lado: 'npc', npc: true }, total: 30 } }).ok).toBe(true)
    expect(loja.getState().cenas[CENA]?.ordem.cartas).toEqual(['t-goku', 't-vegeta', 't-raditz'])
  })

  it('o Vegeta incluído com 20 natural vai para o grupo dos 20, à frente do Raditz de total maior; entre os 20, a DES desempata', () => {
    const comADes = (doVegeta: number) => {
      const loja = batalha(20, { doRaditz: 19, des: { goku: 14, raditz: 30, vegeta: doVegeta }, rolarDepois: 20 })
      expect(loja.getState().comando(CENA, MESTRE, { tipo: 'mestre', acao: { tipo: 'incluir', entrante: { tokenId: 't-vegeta', personagemId: 'vegeta', nome: 'Vegeta', lado: 'npc', npc: true } } }).ok).toBe(true)
      const cena = loja.getState().cenas[CENA]
      return { ordem: cena?.ordem.cartas, vegeta: cena?.combatentes['t-vegeta']?.iniciativa, raditz: cena?.combatentes['t-raditz']?.iniciativa }
    }
    const menosDes = comADes(12)
    // O Vegeta rolou 20 natural, mas o total do Raditz (19 + DES 30) é maior: pelo total ele ficaria atrás.
    expect(menosDes.vegeta?.d20).toBe(20)
    expect(menosDes.raditz?.total ?? 0).toBeGreaterThan(menosDes.vegeta?.total ?? 0)
    expect(menosDes.ordem).toEqual(['t-goku', 't-vegeta', 't-raditz'])
    // DES 16 contra a 14 do Goku: o Vegeta passa à frente dentro do grupo dos 20.
    expect(comADes(16).ordem).toEqual(['t-vegeta', 't-goku', 't-raditz'])
  })
})
