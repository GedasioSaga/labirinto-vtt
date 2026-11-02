/**
 * Store da batalha DBT (docs/planos/dbt-batalha.md, seções 14 e 16) com uma
 * mesa de teste: o Desfazer é LIFO e devolve Ki e PV; o jogador não desfaz a
 * linha do mestre; opção fora de `opcoesDeAcao` é recusada; cada store é
 * isolada. Fica aqui (e não em `stores/`) para o teste morar com o motor.
 */
import { describe, expect, it } from 'vitest'
import type { MesaDaBatalha } from '../../batalha/mesa'
import { novoPersonagem, type Personagem } from '../../personagem'
import { criarBatalhaDBTStore } from '../../../stores/batalhaDBTStore'
import { fichaDBTVazia } from '../modelo'
import { SISTEMA_DRAGON_BALL } from '../sistemaDragonBall'
import type { AutorDBT } from './tipos'

const MESTRE: AutorDBT = { tipo: 'mestre' }
const ANA: AutorDBT = { tipo: 'jogador', playerId: 'ana', nome: 'Ana' }
const CENA = 'cena-1'
/** Abaixo do PV máximo de qualquer ficha nova (o desfazer não esbarra no teto). */
const PV_INICIAL = 10
/** Ki para pagar o voo ("Iniciar voo": 4 Ki, ações de combate p. 118): a ficha nova começa com 0. */
const KI_INICIAL = 20

function personagemDBT(id: string, tipo: 'jogador' | 'npc', nome: string): Personagem {
  const novo = novoPersonagem(SISTEMA_DRAGON_BALL, tipo, nome)
  return { ...novo, id, recursos: { ...novo.recursos, pv: PV_INICIAL, pk: KI_INICIAL }, dbt: novo.dbt ?? fichaDBTVazia() }
}

function mesaDeTeste(iniciais: readonly Personagem[]) {
  const personagens = new Map(iniciais.map((personagem) => [personagem.id, personagem]))
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
  const ler = (id: string): Personagem => {
    const personagem = personagens.get(id)
    if (personagem === undefined) throw new Error(`sem ${id}`)
    return personagem
  }
  return { mesa, ler }
}

function batalhaIniciada() {
  const { mesa, ler } = mesaDeTeste([personagemDBT('goku', 'jogador', 'Goku'), personagemDBT('raditz', 'npc', 'Raditz')])
  const loja = criarBatalhaDBTStore(mesa, { rolar: () => 10, agora: () => 1000, posicoes: () => null })
  loja.getState().ligar(CENA, {}, {
    entrantes: [
      { tokenId: 't-goku', personagemId: 'goku', nome: 'Goku', lado: 'pj', npc: false },
      { tokenId: 't-raditz', personagemId: 'raditz', nome: 'Raditz', lado: 'npc', npc: true },
    ],
  })
  // d20 digitados: Goku 19, Raditz 2 (atributos iguais na ficha nova: Goku vai primeiro).
  expect(loja.getState().comando(CENA, MESTRE, { tipo: 'rolarIniciativa', digitados: { 't-goku': 19, 't-raditz': 2 } }).ok).toBe(true)
  expect(loja.getState().comando(CENA, MESTRE, { tipo: 'comecar' }).ok).toBe(true)
  return { loja, ler, mesa }
}

describe('batalha DBT na store', () => {
  it('a vez começa em quem rolou mais', () => {
    const { loja } = batalhaIniciada()
    const cena = loja.getState().cenas[CENA]
    expect(cena.fase).toBe('combate')
    expect(cena.ordem.vez).toBe('t-goku')
  })

  it('decolar cobra 4 Ki; desfazer (pelo jogador, sem d20) devolve o Ki e o chão', () => {
    const { loja, ler } = batalhaIniciada()
    const kiAntes = ler('goku').recursos.pk
    const voo = loja.getState().comando(CENA, ANA, { tipo: 'agir', combatenteId: 't-goku', vez: { rodada: 1, turno: 1 }, opcao: 'voo:1', alvos: [] })
    expect(voo).toEqual({ ok: true })
    expect(ler('goku').recursos.pk).toBe(kiAntes - 4)
    expect(loja.getState().cenas[CENA].combatentes['t-goku'].voo).toBe(1)

    const ultima = loja.getState().cenas[CENA].registro.at(-1)
    if (ultima === undefined) throw new Error('sem linha')
    expect(loja.getState().desfazer(CENA, ultima.id, ANA)).toBe(true)
    expect(ler('goku').recursos.pk).toBe(kiAntes)
    expect(loja.getState().cenas[CENA].combatentes['t-goku'].voo).toBe(0)
  })

  it('o jogador não desfaz a linha do mestre', () => {
    const { loja } = batalhaIniciada()
    const ultima = loja.getState().cenas[CENA].registro.at(-1)
    if (ultima === undefined) throw new Error('sem linha')
    expect(ultima.autor).toEqual(MESTRE)
    expect(loja.getState().desfazer(CENA, ultima.id, ANA)).toBe(false)
  })

  it('ajuste de PV na ficha vira linha; o mestre desfaz e o PV volta', () => {
    const { loja, ler, mesa } = batalhaIniciada()
    const antes = ler('goku')
    const depois: Personagem = { ...antes, recursos: { ...antes.recursos, pv: PV_INICIAL - 5 } }
    mesa.ajustarPersonagem('goku', () => depois)
    loja.getState().registrarAjuste('goku', antes, depois, MESTRE)
    const ultima = loja.getState().cenas[CENA].registro.at(-1)
    if (ultima === undefined) throw new Error('sem linha')
    expect(ultima.tipo).toBe('ficha')
    expect(loja.getState().desfazer(CENA, ultima.id, MESTRE)).toBe(true)
    expect(ler('goku').recursos.pv).toBe(PV_INICIAL)
  })

  it('opção fora de opcoesDeAcao é recusada e nada muda', () => {
    const { loja } = batalhaIniciada()
    const antes = loja.getState().cenas[CENA]
    const resposta = loja.getState().comando(CENA, ANA, { tipo: 'agir', combatenteId: 't-goku', vez: { rodada: 1, turno: 1 }, opcao: 'inventada', alvos: [] })
    expect(resposta.ok).toBe(false)
    expect(loja.getState().cenas[CENA]).toBe(antes)
  })

  it('agir fora da vez é recusado', () => {
    const { loja } = batalhaIniciada()
    const resposta = loja.getState().comando(CENA, MESTRE, { tipo: 'agir', combatenteId: 't-raditz', vez: { rodada: 1, turno: 0 }, opcao: 'voo:1', alvos: [] })
    expect(resposta).toEqual({ ok: false, motivo: 'Não é a vez dele' })
  })

  it('duas stores não dividem estado', () => {
    const { loja } = batalhaIniciada()
    const { mesa } = mesaDeTeste([])
    const outra = criarBatalhaDBTStore(mesa, { rolar: () => 10, agora: () => 1000, posicoes: () => null })
    expect(Object.keys(loja.getState().cenas)).toEqual([CENA])
    expect(outra.getState().cenas).toEqual({})
  })
})
