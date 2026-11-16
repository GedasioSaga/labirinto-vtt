/**
 * MUNIÇÃO (pedido de 16/11/2026 11h03: "mesmo ele usando balas de prata o
 * número no inventário não tá diminuindo"): o tiro com a bala ligada à
 * mochila tira 1 da ficha, o Desfazer devolve, e com 0 o tiro não sai — no
 * mestre e no tiro do jogador que o host aceita (o mesmo `agir`).
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { BALA_DE_PRATA, ROSA_FUNEBRE, ryokoCom, vincentCom } from '../lib/batalha/fichasDaFatiaE.testkit'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { definirMunicoesDasArmas } from '../lib/batalha/municoesDoAcervo'
import { nomesDeMunicaoIguais } from '../lib/mochila/municao'
import type { Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import type { CarriedItem } from '../types/map'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const JOGADOR: AutorDaAcao = { tipo: 'jogador', playerId: 'jogador_1', nome: 'Jogador' }
const ID_DA_PRATA = 'item_bala-de-prata'

/** O Vincent com `quantas` "Balas de prata" do Acervo na mochila (o subcartão da Rosa Fúnebre diz "Bala de Prata": liga pelo nome). */
function vincentComBalas(quantas: number): Personagem {
  const vaga: CarriedItem = { id: 'vaga_prata', nome: 'Balas de prata', itemId: ID_DA_PRATA, categoria: 'Munição', empilhavel: true, ...(quantas > 1 ? { quantidade: quantas } : {}) }
  return { ...vincentCom(), mochila: [{ id: 'vaga_corda', nome: 'Corda' }, vaga] }
}

function batalha(quantas: number): { loja: LojaDaBatalha; mesa: MesaEmMemoria } {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: vincentComBalas(quantas), lado: 'a' }, { ficha: ryokoCom(), lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  return { loja, mesa }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

/** Passa a vez até chegar a de `nome` (a vez de agora conta). */
function naVezDe(loja: LojaDaBatalha, nome: string): VezEsperada {
  for (let i = 0; i < 4; i += 1) {
    const { turnos } = cena(loja)
    if (turnos.vez === null) throw new Error('sem vez')
    const atual = { cartaId: turnos.vez, rodada: turnos.rodada }
    if (turnos.cartas.find((candidata) => candidata.id === atual.cartaId)?.nome?.startsWith(nome) === true) return atual
    expect(loja.getState().passarVez(CENA, MESTRE, atual)).toBe(true)
  }
  throw new Error(`a vez de ${nome} não chegou`)
}

function tokenDe(loja: LojaDaBatalha, nome: string): string {
  const achada = cena(loja).turnos.cartas.find((candidata) => candidata.nome?.startsWith(nome) === true && candidata.extra === undefined)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada.tokenId
}

const tiro = (alvo: string): PedidoDeAcao => ({ tipo: 'atacar', armaId: ROSA_FUNEBRE.id, balaId: BALA_DE_PRATA.id, alvos: [{ tokenId: alvo, dano: 50 }], surpresa: false, perfurante: false })

function mochilaDoVincent(mesa: MesaEmMemoria): readonly CarriedItem[] {
  return mesa.personagens().find((personagem) => personagem.nome.startsWith('Vincent'))?.mochila ?? []
}

const pratas = (mesa: MesaEmMemoria): number => mochilaDoVincent(mesa).reduce((soma, vaga) => (vaga.itemId === ID_DA_PRATA ? soma + (vaga.quantidade ?? 1) : soma), 0)

describe('munição: a arma do Acervo que declara as munições', () => {
  it('a Garrucha da mochila aceita Balas de prata: o tiro do jogador sem bala escolhida gasta a primeira que há; sem nenhuma, não atira', () => {
    definirMunicoesDasArmas([
      { id: 'item_garrucha', nome: 'Garrucha', municoes: [ID_DA_PRATA] },
      { id: ID_DA_PRATA, nome: 'Balas de prata' },
    ])
    try {
      const garrucha: CarriedItem = { id: 'vaga_garrucha', nome: 'Garrucha', itemId: 'item_garrucha', categoria: 'Arma' }
      const vincent = { ...vincentComBalas(1), mochila: [garrucha, ...(vincentComBalas(1).mochila ?? [])] }
      const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: vincent, lado: 'a' }, { ficha: ryokoCom(), lado: 'b' }]))
      const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
      const tokens = mesa.tokens()
      loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
      const ryoko = tokenDe(loja, 'Ryoko')
      const comAGarrucha: PedidoDeAcao = { tipo: 'atacar', armaId: 'mochila:vaga_garrucha', alvos: [{ tokenId: ryoko, dano: 30 }], surpresa: false, perfurante: false }
      expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), comAGarrucha)).toBe(true)
      expect(pratas(mesa)).toBe(0)
      naVezDe(loja, 'Ryoko')
      expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), comAGarrucha)).toBe(false)
    } finally {
      definirMunicoesDasArmas([])
    }
  })
})

describe('munição: o nome liga a bala à vaga', () => {
  it('"Balas de prata" é a "Bala de Prata" do cartão; "Bala de RPG" não é', () => {
    expect([nomesDeMunicaoIguais('Balas de prata', 'Bala de Prata'), nomesDeMunicaoIguais('Munições', 'munição'), nomesDeMunicaoIguais('Bala de RPG', 'Bala de prata')]).toEqual([true, true, false])
  })
})

describe('munição: o tiro gasta da mochila da ficha', () => {
  it('o tiro com a Bala de Prata tira 1 (3 → 2) e o Desfazer da linha devolve (2 → 3)', () => {
    const { loja, mesa } = batalha(3)
    const ryoko = tokenDe(loja, 'Ryoko')
    naVezDe(loja, 'Vincent')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(true)
    expect(pratas(mesa)).toBe(2)
    const linha = cena(loja).registro.filter((candidata) => candidata.tipo === 'golpe').at(-1)
    expect(loja.getState().desfazer(CENA, linha?.id ?? '', MESTRE)).toBe(true)
    expect([pratas(mesa), mochilaDoVincent(mesa).map((vaga) => vaga.id)]).toEqual([3, ['vaga_corda', 'vaga_prata']])
  })

  it('o tiro do jogador (o host passa pelo mesmo agir) gasta a última; com 0 o próximo é bloqueado, e o Desfazer devolve a vaga no lugar', () => {
    const { loja, mesa } = batalha(1)
    const ryoko = tokenDe(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(true)
    expect(pratas(mesa)).toBe(0)
    const linha = cena(loja).registro.filter((candidata) => candidata.tipo === 'golpe').at(-1)
    // A vaga saiu com a última bala, mas a ligação ficou no cartão: a vez seguinte do Vincent não atira com 0.
    naVezDe(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(false)
    expect(loja.getState().desfazer(CENA, linha?.id ?? '', MESTRE)).toBe(true)
    expect([pratas(mesa), mochilaDoVincent(mesa).map((vaga) => vaga.id)]).toEqual([1, ['vaga_corda', 'vaga_prata']])
  })
})
