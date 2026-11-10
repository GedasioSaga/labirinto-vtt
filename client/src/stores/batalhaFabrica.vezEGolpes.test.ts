// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F1, fatia S1 (docs/planos/conserto-fichas-2026-11-08.md;
 * bugs 2 e 7 de docs/auditoria-fichas/00-bugs-do-sistema.md), na store do app
 * (`criarBatalhaStore`) sobre a mesa em memória do treino:
 * - bug 2 (regra P3 do grilling): o golpe sem resposta vira "Não reagiu" na
 *   virada da rodada, com linha no registro, e o ataque nunca é recusado por
 *   golpes demais esperando;
 * - bug 7: dois "Passar a vez" com a mesma vez esperada passam uma vez só, e o
 *   clique do mestre só vale com a vez assentada.
 */
import { describe, expect, it } from 'vitest'
import { cliqueDoPassarVale, VEZ_ASSENTANDO_MS } from '../components/batalha/dadosDaFaixa'
import type { PedidoDeAcao, SeloPedido } from '../lib/batalha/combate'
import type { VezEsperada } from '../lib/batalha/ponte'
import { cartaDaVez, combatentesIniciais, type AutorDaAcao, type CartaDaOrdem } from '../lib/batalha/turnos'
import { LIA, lutadoresDe, MARINHEIRO, SISTEMA_DO_TESTE, ze } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const ANA: AutorDaAcao = { tipo: 'jogador', playerId: 'jogador_ana', nome: 'Ana' }
const DANO = 10

/** Lia (Agilidade 70), Zé (40) e Marinheiro (30): sem empate, sem d20 na ordem. `rolarD20` = o dado da reação. */
function batalhaDeTres(rolarD20: () => number = () => 10): { loja: LojaDaBatalha; mesa: MesaEmMemoria } {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: ze(60), lado: 'a' }, { ficha: LIA, lado: 'a' }, { ficha: MARINHEIRO, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20, outraBatalhaLigada: () => false })
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

function vez(loja: LojaDaBatalha): VezEsperada {
  const { turnos } = cena(loja)
  if (turnos.vez === null) throw new Error('sem vez')
  return { cartaId: turnos.vez, rodada: turnos.rodada }
}

function daVez(loja: LojaDaBatalha): CartaDaOrdem {
  const carta = cartaDaVez(cena(loja).turnos)
  if (carta === null) throw new Error('sem carta da vez')
  return carta
}

/** Um colega qualquer da ordem que não é quem age. */
function alvoDe(loja: LojaDaBatalha, atacante: CartaDaOrdem): string {
  const alvo = cena(loja).turnos.cartas.find((carta) => carta.tokenId !== atacante.tokenId)
  if (alvo === undefined) throw new Error('sem alvo')
  return alvo.tokenId
}

const ataque = (tokenId: string, dano = DANO, selo?: SeloPedido): PedidoDeAcao => ({ tipo: 'atacar', armaId: null, alvos: [{ tokenId, dano }], surpresa: false, perfurante: false, ...(selo === undefined ? {} : { selo }) })

function hpDaMesa(mesa: MesaEmMemoria): number {
  return mesa.personagens().reduce((soma, personagem) => soma + (personagem.recursos.hp ?? 0), 0)
}

/** O token da carta na posição `indice` da ordem (0 = Lia, 1 = Zé, 2 = Marinheiro). */
function tokenNa(loja: LojaDaBatalha, indice: number): string {
  const carta = cena(loja).turnos.cartas[indice]
  if (carta === undefined) throw new Error(`sem carta ${indice}`)
  return carta.tokenId
}

function hpDoToken(loja: LojaDaBatalha, mesa: MesaEmMemoria, tokenId: string): number {
  const personagemId = cena(loja).turnos.cartas.find((carta) => carta.tokenId === tokenId)?.personagemId
  const personagem = mesa.personagens().find((candidato) => candidato.id === personagemId)
  if (personagem === undefined) throw new Error('sem personagem')
  return personagem.recursos.hp ?? 0
}

const passar = (loja: LojaDaBatalha): boolean => loja.getState().passarVez(CENA, MESTRE, vez(loja))

function golpeEsperando(loja: LojaDaBatalha): string {
  const golpe = (cena(loja).turnos.golpes ?? [])[0]
  if (golpe === undefined) throw new Error('nenhum golpe esperando')
  return golpe.id
}

const linhasNaoReagiu = (loja: LojaDaBatalha) => cena(loja).registro.filter((linha) => linha.tipo === 'reacao' && linha.texto.includes('não reagiu até a virada da rodada'))

function ultimaVez(loja: LojaDaBatalha): string {
  const linha = [...cena(loja).registro].reverse().find((candidata) => candidata.tipo === 'vez')
  if (linha === undefined) throw new Error('sem linha da vez')
  return linha.id
}

describe('bug 2: golpe sem resposta', () => {
  it('21 ataques sem resposta em 7 rodadas: todos aceitos; na virada cada golpe vira "Não reagiu" com linha e dano, menos o da última vez, que espera a virada seguinte; o Desfazer da linha devolve a espera e o HP', () => {
    const { loja, mesa } = batalhaDeTres()
    const hpAntes = hpDaMesa(mesa)
    let aceitos = 0
    for (let i = 0; i < 21; i += 1) {
      const quem = daVez(loja)
      if (loja.getState().agir(CENA, MESTRE, vez(loja), ataque(alvoDe(loja, quem)))) aceitos += 1
      expect(passar(loja)).toBe(true)
      // Nunca sobra golpe de duas rodadas atrás.
      const { turnos } = cena(loja)
      expect((turnos.golpes ?? []).every((golpe) => golpe.rodada >= turnos.rodada - 1)).toBe(true)
    }
    expect(aceitos).toBe(21)
    expect(cena(loja).turnos.rodada).toBe(8)
    // Fica só o golpe da última vez da rodada 7 (o Marinheiro): 7 viradas x 2 golpes + 6 da última vez = 20 fechados.
    expect(cena(loja).turnos.golpes ?? []).toHaveLength(1)
    const naoReagiram = linhasNaoReagiu(loja)
    expect(naoReagiram).toHaveLength(20)
    expect(naoReagiram[0]?.texto).toMatch(/^.+ não reagiu até a virada da rodada \(Mão nua de .+\)$/)
    expect(hpDaMesa(mesa)).toBe(hpAntes - 20 * DANO)

    const ultima = naoReagiram[naoReagiram.length - 1]
    if (ultima === undefined) throw new Error('sem linha')
    expect(loja.getState().desfazer(CENA, ultima.id, MESTRE)).toBe(true)
    expect(cena(loja).turnos.golpes ?? []).toHaveLength(2)
    expect(hpDaMesa(mesa)).toBe(hpAntes - 19 * DANO)
  })

  it('21 golpes na MESMA vez (20 ações extras): todos aceitos; o mais velho vira "Não reagiu" e ficam 20 esperando', () => {
    const { loja } = batalhaDeTres()
    const quem = daVez(loja)
    expect(loja.getState().darAcoesExtras(CENA, quem.id, { simples: 20, bonus: 0, mov: 0, duracao: 'rodada' })).toBe(true)
    const alvo = alvoDe(loja, quem)
    const respostas = Array.from({ length: 21 }, () => loja.getState().agir(CENA, MESTRE, vez(loja), ataque(alvo)))
    expect(respostas.every((aceito) => aceito)).toBe(true)
    expect(cena(loja).turnos.golpes ?? []).toHaveLength(20)
    expect(cena(loja).registro.filter((linha) => linha.texto.includes('não reagiu a tempo (golpes demais esperando)'))).toHaveLength(1)
  })
})

/** Revisão da fatia S1: a virada fecha os golpes ANTES de a vez andar, sem fuga do crítico, e o Desfazer da vez leva os fechamentos junto. */
describe('bug 2, revisão: a virada da rodada', () => {
  it('quem rolou 1 natural e não escolheu toma o crítico (x1,5) na virada, não o dano normal', () => {
    let d20 = 10
    const { loja, mesa } = batalhaDeTres(() => d20)
    const doZe = tokenNa(loja, 1)
    const hpAntes = hpDoToken(loja, mesa, doZe)
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), ataque(doZe))).toBe(true)
    d20 = 1
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'rolar', golpeId: golpeEsperando(loja), tokenId: doZe, modificador: 0 })).toBe(true)
    for (let i = 0; i < 3; i += 1) expect(passar(loja)).toBe(true)
    expect(cena(loja).turnos.golpes ?? []).toHaveLength(0)
    expect(hpDoToken(loja, mesa, doZe)).toBe(hpAntes - DANO * 1.5)
  })

  it('o golpe letal fecha antes de a vez andar: a carta que caiu nele não ganha a vez; ela vai à próxima de pé', () => {
    const { loja, mesa } = batalhaDeTres()
    const ordem = cena(loja).turnos.cartas.map((carta) => carta.id)
    const lia = tokenNa(loja, 0)
    expect(passar(loja)).toBe(true)
    // O Zé derruba a Lia (a primeira da ordem) e ninguém responde; o Marinheiro, último da ordem, passa.
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), ataque(lia, 1000))).toBe(true)
    expect(passar(loja)).toBe(true)
    expect(passar(loja)).toBe(true)
    expect(hpDoToken(loja, mesa, lia)).toBe(0)
    expect(cena(loja).turnos.rodada).toBe(2)
    expect(cena(loja).turnos.vez).toBe(ordem[1])
    // A linha "Não reagiu" vem antes da linha da vez.
    const registro = cena(loja).registro
    expect(registro[registro.length - 1]?.tipo).toBe('vez')
    expect(registro[registro.length - 2]?.texto).toContain('não reagiu até a virada da rodada')
  })

  it('o golpe da última vez da rodada espera a virada seguinte: pode ser respondido na rodada nova e só fecha na outra virada', () => {
    const { loja, mesa } = batalhaDeTres()
    const lia = tokenNa(loja, 0)
    const hpAntes = hpDoToken(loja, mesa, lia)
    expect(passar(loja)).toBe(true)
    expect(passar(loja)).toBe(true)
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), ataque(lia))).toBe(true)
    expect(passar(loja)).toBe(true)
    expect(cena(loja).turnos.rodada).toBe(2)
    expect(cena(loja).turnos.golpes ?? []).toHaveLength(1)
    expect(linhasNaoReagiu(loja)).toHaveLength(0)
    expect(hpDoToken(loja, mesa, lia)).toBe(hpAntes)
    for (let i = 0; i < 3; i += 1) expect(passar(loja)).toBe(true)
    expect(cena(loja).turnos.rodada).toBe(3)
    expect(cena(loja).turnos.golpes ?? []).toHaveLength(0)
    expect(linhasNaoReagiu(loja)).toHaveLength(1)
    expect(hpDoToken(loja, mesa, lia)).toBe(hpAntes - DANO)
  })

  it('Desfazer a Vez que virou a rodada desfaz junto os "Não reagiu" dela: a rodada, o HP e os golpes esperando voltam', () => {
    const { loja, mesa } = batalhaDeTres()
    const ordem = cena(loja).turnos.cartas.map((carta) => carta.id)
    const hpAntes = hpDaMesa(mesa)
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), ataque(tokenNa(loja, 1)))).toBe(true)
    expect(passar(loja)).toBe(true)
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), ataque(tokenNa(loja, 0)))).toBe(true)
    expect(passar(loja)).toBe(true)
    expect(passar(loja)).toBe(true)
    expect(linhasNaoReagiu(loja)).toHaveLength(2)
    expect(hpDaMesa(mesa)).toBe(hpAntes - 2 * DANO)

    expect(loja.getState().desfazer(CENA, ultimaVez(loja), MESTRE)).toBe(true)
    expect(cena(loja).turnos.rodada).toBe(1)
    expect(cena(loja).turnos.vez).toBe(ordem[2])
    expect(cena(loja).turnos.golpes ?? []).toHaveLength(2)
    expect(hpDaMesa(mesa)).toBe(hpAntes)
    expect(linhasNaoReagiu(loja).every((linha) => linha.desfeita !== undefined)).toBe(true)
  })

  it('o "Não reagiu" desfeito sozinho não volta com o Desfazer da Vez: o selo dele fica fora e o HP não muda de novo', () => {
    const { loja, mesa } = batalhaDeTres()
    const lia = tokenNa(loja, 0)
    const marinheiro = tokenNa(loja, 2)
    const hpDaLia = hpDoToken(loja, mesa, lia)
    // O Marinheiro (último da ordem) leva um selo de 3 turnos: a vez dele que acaba desconta, e a linha "Vez" guarda a foto dos selos.
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), ataque(marinheiro, DANO, { nome: 'Lento', turnos: 3 }))).toBe(true)
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'naoReagir', golpeId: golpeEsperando(loja), tokenId: marinheiro })).toBe(true)
    expect(passar(loja)).toBe(true)
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), ataque(lia, DANO, { nome: 'Queimado', turnos: 2 }))).toBe(true)
    expect(passar(loja)).toBe(true)
    expect(passar(loja)).toBe(true)
    const selos = () => cena(loja).turnos.selos ?? []
    expect(selos().find((selo) => selo.nome === 'Lento')?.turnos).toBe(2)
    expect(selos().some((selo) => selo.tokenId === lia && selo.nome === 'Queimado')).toBe(true)

    const fechado = linhasNaoReagiu(loja)[0]
    if (fechado === undefined) throw new Error('sem linha')
    expect(loja.getState().desfazer(CENA, fechado.id, MESTRE)).toBe(true)
    expect(selos().some((selo) => selo.nome === 'Queimado')).toBe(false)
    expect(hpDoToken(loja, mesa, lia)).toBe(hpDaLia)

    expect(loja.getState().desfazer(CENA, ultimaVez(loja), MESTRE)).toBe(true)
    expect(cena(loja).turnos.rodada).toBe(1)
    expect(selos().some((selo) => selo.nome === 'Queimado')).toBe(false)
    expect(selos().find((selo) => selo.nome === 'Lento')?.turnos).toBe(3)
    expect(hpDoToken(loja, mesa, lia)).toBe(hpDaLia)
    expect(cena(loja).turnos.golpes ?? []).toHaveLength(1)
  })
})

describe('bug 7: a vez não pula ninguém', () => {
  it('o jogador encerra a vez e o mestre clica junto (ou o duplo clique): o 2º pedido com a mesma vez volta false e a próxima carta joga', () => {
    const { loja } = batalhaDeTres()
    const ordem = cena(loja).turnos.cartas.map((carta) => carta.id)
    const esperada = vez(loja)
    expect(esperada.cartaId).toBe(ordem[0])
    expect(loja.getState().passarVez(CENA, ANA, esperada)).toBe(true)
    expect(loja.getState().passarVez(CENA, MESTRE, esperada)).toBe(false)
    expect(cena(loja).turnos.vez).toBe(ordem[1])
  })

  it('o clique no Passar a vez do mestre só vale com a vez assentada', () => {
    const trocou = 1_000
    expect(cliqueDoPassarVale(trocou, trocou + 120)).toBe(false)
    expect(cliqueDoPassarVale(trocou, trocou + VEZ_ASSENTANDO_MS)).toBe(true)
  })
})
