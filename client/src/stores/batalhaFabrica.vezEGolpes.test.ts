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
import type { PedidoDeAcao } from '../lib/batalha/combate'
import type { VezEsperada } from '../lib/batalha/ponte'
import { cartaDaVez, combatentesIniciais, type AutorDaAcao, type CartaDaOrdem } from '../lib/batalha/turnos'
import { LIA, lutadoresDe, MARINHEIRO, SISTEMA_DO_TESTE, ze } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const ANA: AutorDaAcao = { tipo: 'jogador', playerId: 'jogador_ana', nome: 'Ana' }
const DANO = 10

/** Lia (Agilidade 70), Zé (40) e Marinheiro (30): sem empate, sem d20 na ordem. */
function batalhaDeTres(): { loja: LojaDaBatalha; mesa: MesaEmMemoria } {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: ze(60), lado: 'a' }, { ficha: LIA, lado: 'a' }, { ficha: MARINHEIRO, lado: 'b' }]))
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

const ataque = (tokenId: string): PedidoDeAcao => ({ tipo: 'atacar', armaId: null, alvos: [{ tokenId, dano: DANO }], surpresa: false, perfurante: false })

function hpDaMesa(mesa: MesaEmMemoria): number {
  return mesa.personagens().reduce((soma, personagem) => soma + (personagem.recursos.hp ?? 0), 0)
}

describe('bug 2: golpe sem resposta', () => {
  it('21 ataques sem resposta em 7 rodadas: todos aceitos; na virada cada golpe vira "Não reagiu" com linha e dano; o Desfazer da linha devolve a espera e o HP', () => {
    const { loja, mesa } = batalhaDeTres()
    const hpAntes = hpDaMesa(mesa)
    let aceitos = 0
    for (let i = 0; i < 21; i += 1) {
      const quem = daVez(loja)
      if (loja.getState().agir(CENA, MESTRE, vez(loja), ataque(alvoDe(loja, quem)))) aceitos += 1
      expect(loja.getState().passarVez(CENA, MESTRE, vez(loja))).toBe(true)
      // Nunca sobra golpe de rodada que já passou.
      const { turnos } = cena(loja)
      expect((turnos.golpes ?? []).every((golpe) => golpe.rodada === turnos.rodada)).toBe(true)
    }
    expect(aceitos).toBe(21)
    expect(cena(loja).turnos.rodada).toBe(8)
    expect(cena(loja).turnos.golpes ?? []).toHaveLength(0)
    const naoReagiram = cena(loja).registro.filter((linha) => linha.tipo === 'reacao' && linha.texto.includes('não reagiu até a virada da rodada'))
    expect(naoReagiram).toHaveLength(21)
    expect(naoReagiram[0]?.texto).toMatch(/^.+ não reagiu até a virada da rodada \(Ataque de .+\)$/)
    expect(hpDaMesa(mesa)).toBe(hpAntes - 21 * DANO)

    const ultima = naoReagiram[naoReagiram.length - 1]
    if (ultima === undefined) throw new Error('sem linha')
    expect(loja.getState().desfazer(CENA, ultima.id, MESTRE)).toBe(true)
    expect(cena(loja).turnos.golpes ?? []).toHaveLength(1)
    expect(hpDaMesa(mesa)).toBe(hpAntes - 20 * DANO)
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
