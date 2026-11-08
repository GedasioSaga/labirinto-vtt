// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F2, fatia C (Aira e Alexei, sem os companions): as
 * mecânicas à mão na store do app (`criarBatalhaStore`) sobre a mesa em
 * memória do treino, com os cartões e os números REAIS
 * (`fichasDaFatiaC.testkit.ts`). Aira e Alexei no lado A, a May no B. Lei:
 * docs/auditoria-fichas/respostas-do-grilling.md. No máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao, PedidoDeAlvo } from '../lib/batalha/combate'
import { may } from '../lib/batalha/fichasDaFatiaB.testkit'
import { aira, alexei, ARMADILHAR, BENCAO, DANCA, LUZ_DO_SOL } from '../lib/batalha/fichasDaFatiaC.testkit'
import type { RespostasDoPedido } from '../lib/batalha/perguntaNaHora'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { numeroDaFicha } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

interface Batalha {
  loja: LojaDaBatalha
  mesa: MesaEmMemoria
  /** Os d20 do host, na ordem (acabou a fila, sai 10). Enche depois de ligar. */
  fila: number[]
}

function batalha(): Batalha {
  const fila: number[] = []
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: aira, lado: 'a' }, { ficha: alexei, lado: 'a' }, { ficha: may, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => fila.shift() ?? 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  return { loja, mesa, fila }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

/** Passa a vez até chegar a de `nome`. */
function naVezDe(loja: LojaDaBatalha, nome: string): VezEsperada {
  for (let i = 0; i < 6; i += 1) {
    const { turnos } = cena(loja)
    if (turnos.vez === null) throw new Error('sem vez')
    const vez = { cartaId: turnos.vez, rodada: turnos.rodada }
    if (turnos.cartas.find((carta) => carta.id === turnos.vez)?.nome === nome) return vez
    expect(loja.getState().passarVez(CENA, MESTRE, vez)).toBe(true)
  }
  throw new Error(`a vez de ${nome} não chegou`)
}

function token(loja: LojaDaBatalha, nome: string): string {
  const achada = cena(loja).turnos.cartas.find((carta) => carta.nome === nome)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada.tokenId
}

function recurso(mesa: MesaEmMemoria, nome: string, chave: string): number {
  const achada = mesa.personagens().find((candidato) => candidato.nome === nome)
  if (achada === undefined) throw new Error(`sem ${nome}`)
  return numeroDaFicha(achada.recursos, chave)
}

const textos = (loja: LojaDaBatalha): string[] => cena(loja).registro.map((linha) => linha.texto)
const selosDe = (loja: LojaDaBatalha, tokenId: string) => (cena(loja).turnos.selos ?? []).filter((selo) => selo.tokenId === tokenId)
const golpesEsperando = (loja: LojaDaBatalha): string[] => (cena(loja).turnos.golpes ?? []).map((golpe) => golpe.id)

function tecnica(cartaoId: string, alvos: PedidoDeAlvo[], respostas?: RespostasDoPedido): PedidoDeAcao {
  return { tipo: 'habilidade', cartaoId, armaId: null, alvos, surpresa: false, perfurante: false, custo: null, acao: null, ...(respostas === undefined ? {} : { respostas }) }
}

function naoReagir(loja: LojaDaBatalha, golpeId: string, tokenId: string): void {
  expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'naoReagir', golpeId, tokenId })).toBe(true)
}

describe('a dança da Aira (Em Meio às Alegres Nuvens): sem reação, o app rola o Espírito da May contra CD 13', () => {
  it('a May tira 12 (ESP 1, mod 0): falhou, Atordoado 1, nenhum golpe esperando reação', () => {
    const { loja, fila } = batalha()
    const daMay = token(loja, 'May D. Ark')
    fila.push(12)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Aira'), tecnica(DANCA.id, [{ tokenId: daMay, dano: null }]))).toBe(true)
    expect(golpesEsperando(loja)).toEqual([])
    expect(selosDe(loja, daMay).map((selo) => [selo.nome, selo.turnos])).toEqual([['Atordoado', 1]])
    expect(textos(loja).some((texto) => texto.includes('contra CD 13') && texto.includes('o selo pegou'))).toBe(true)
  })

  it('a May tira 13: passou, sem selo', () => {
    const { loja, fila } = batalha()
    const daMay = token(loja, 'May D. Ark')
    fila.push(13)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Aira'), tecnica(DANCA.id, [{ tokenId: daMay, dano: null }]))).toBe(true)
    expect(selosDe(loja, daMay)).toEqual([])
    expect(textos(loja).some((texto) => texto.includes('o selo não pegou'))).toBe(true)
  })
})

describe('a Bênção de uma Raposa: +8 no físico escolhido e o aliado cura 10% do dano que causa', () => {
  it('Aira abençoa o Alexei (Percepção, 3 turnos); o Alexei bate 100 na May e vai de 365 a 375 de HP', () => {
    const { loja, mesa } = batalha()
    const doAlexei = token(loja, 'Alexei')
    const daMay = token(loja, 'May D. Ark')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Aira'), tecnica(BENCAO.id, [{ tokenId: doAlexei, dano: null }], { turnos: 3, fisico: 'percepcao' }))).toBe(true)
    expect(selosDe(loja, doAlexei).map((selo) => ({ nome: selo.nome, turnos: selo.turnos, mods: selo.mods }))).toEqual([{ nome: 'Bênção de uma Raposa', turnos: 3, mods: [{ alvo: 'percepcao', delta: 8 }] }])
    const ataque: PedidoDeAcao = { tipo: 'atacar', armaId: null, alvos: [{ tokenId: daMay, dano: 100 }], surpresa: false, perfurante: false }
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Alexei'), ataque)).toBe(true)
    naoReagir(loja, golpesEsperando(loja)[0] ?? '', daMay)
    expect(recurso(mesa, 'May D. Ark', 'hp')).toBe(672)
    expect(recurso(mesa, 'Alexei', 'hp')).toBe(375)
  })
})

describe('o Atacar da Aira com um aliado abençoado: 3 golpes de +30% do Espírito, Queimando 10 por 1 turno', () => {
  it('Força 1 + 12 = 13 em cada golpe, cada um com a própria reação: o Escudo da May vai de 72 a 33 e ela fica Queimando 1', () => {
    const { loja, mesa } = batalha()
    const doAlexei = token(loja, 'Alexei')
    const daMay = token(loja, 'May D. Ark')
    const daAira = naVezDe(loja, 'Aira')
    expect(loja.getState().agir(CENA, MESTRE, daAira, tecnica(BENCAO.id, [{ tokenId: doAlexei, dano: null }], { turnos: 3, fisico: 'forca' }))).toBe(true)
    expect(loja.getState().passarVez(CENA, MESTRE, daAira)).toBe(true)
    const ataque: PedidoDeAcao = { tipo: 'atacar', armaId: null, alvos: [{ tokenId: daMay, dano: 1 }], surpresa: false, perfurante: false }
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Aira'), ataque)).toBe(true)
    const esperando = golpesEsperando(loja)
    expect(esperando).toHaveLength(3)
    for (const golpeId of esperando) naoReagir(loja, golpeId, daMay)
    expect(recurso(mesa, 'May D. Ark', 'escudo')).toBe(33)
    expect(selosDe(loja, daMay).map((selo) => [selo.nome, selo.turnos])).toEqual([['Queimando', 1]])
    expect(textos(loja).filter((texto) => texto.includes('com a Bênção'))).toHaveLength(3)
  })
})

describe('o Electro da Aira: quando ela quiser, em qualquer golpe, +20 de dano e -10 SP', () => {
  it('no Atacar: 1 + 20 = 21 no Escudo da May (72 → 51) e o SP dela vai de 140 a 130', () => {
    const { loja, mesa } = batalha()
    const daMay = token(loja, 'May D. Ark')
    const ataque: PedidoDeAcao = { tipo: 'atacar', armaId: null, alvos: [{ tokenId: daMay, dano: 1 }], surpresa: false, perfurante: false, respostas: { electro: 'sim' } }
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Aira'), ataque)).toBe(true)
    naoReagir(loja, golpesEsperando(loja)[0] ?? '', daMay)
    expect(recurso(mesa, 'May D. Ark', 'escudo')).toBe(51)
    expect(recurso(mesa, 'Aira', 'sp')).toBe(130)
    expect(textos(loja).some((texto) => texto.includes('eletricidade'))).toBe(true)
  })

  it('numa técnica: A Luz do Sol com Electro dá 60 e cobra 25 + 10 = 35 SP de uma vez (140 → 105)', () => {
    const { loja, mesa } = batalha()
    const daMay = token(loja, 'May D. Ark')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Aira'), tecnica(LUZ_DO_SOL.id, [{ tokenId: daMay, dano: 40 }], { turnos: 1, fisico: 'forca', electro: 'sim' }))).toBe(true)
    naoReagir(loja, golpesEsperando(loja)[0] ?? '', daMay)
    expect(recurso(mesa, 'May D. Ark', 'escudo')).toBe(12)
    expect(recurso(mesa, 'Aira', 'sp')).toBe(105)
  })
})

describe('Armadilhar (Alexei): posiciona a armadilha, sem alvo e sem dano', () => {
  it('Batata-mina: 20 SP (120 → 100), nenhum golpe esperando, a escolhida no registro', () => {
    const { loja, mesa } = batalha()
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Alexei'), tecnica(ARMADILHAR.id, [], { armadilha: 'batata' }))).toBe(true)
    expect(recurso(mesa, 'Alexei', 'sp')).toBe(100)
    expect(golpesEsperando(loja)).toEqual([])
    expect(textos(loja).some((texto) => texto.includes('Armadilhar') && texto.includes('Batata-mina'))).toBe(true)
  })
})

describe('A Luz do Sol: 40 no inimigo, a Bênção só nos aliados marcados', () => {
  it('marcando a May e o Alexei: a May toma 40 (no Escudo) e não ganha a Bênção; o Alexei não toma dano e ganha FOR +8', () => {
    const { loja, mesa } = batalha()
    const doAlexei = token(loja, 'Alexei')
    const daMay = token(loja, 'May D. Ark')
    const alvos = [{ tokenId: daMay, dano: 40 }, { tokenId: doAlexei, dano: 40 }]
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Aira'), tecnica(LUZ_DO_SOL.id, alvos, { turnos: 1, fisico: 'forca' }))).toBe(true)
    expect(recurso(mesa, 'Alexei', 'hp')).toBe(365)
    expect(selosDe(loja, doAlexei).map((selo) => selo.mods)).toEqual([[{ alvo: 'forca', delta: 8 }]])
    naoReagir(loja, golpesEsperando(loja)[0] ?? '', daMay)
    expect(recurso(mesa, 'May D. Ark', 'escudo')).toBe(32)
    expect(selosDe(loja, daMay)).toEqual([])
  })
})
