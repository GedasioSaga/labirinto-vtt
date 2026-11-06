// @vitest-environment node
/**
 * O DESFAZER DO MESTRE NA BATALHA ONE PIECE (a store do app,
 * `criarBatalhaStore`, sobre a mesa em memória do treino): nenhum teste
 * cobria a volta de uma linha do registro. Aqui: a ordem que o d20 desempatou
 * não muda com o Desfazer; o texto da linha do golpe em cada passo; o HP e a
 * ação gasta voltam; a linha fica riscada com "Mestre"; só o desfazer do
 * mestre faz o Judge erguer a carta; o jogador não desfaz a linha do mestre;
 * desfazer duas vezes não faz nada.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import type { VezEsperada } from '../lib/batalha/ponte'
import { cartaDaVez, combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { lutadoresDe, MARINHEIRO, SISTEMA_DO_TESTE, ze } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const ANA: AutorDaAcao = { tipo: 'jogador', playerId: 'jogador_ana', nome: 'Ana' }
const TOKEN_DO_ZE = 'treino_tok_a1'

/** Os três com a mesma Agilidade (30): quem decide a ordem é o d20, na ordem em que as cartas nascem (Zé, Marinheiro, Marinheiro 2). */
function batalhaEmpatada(d20: number[]): { loja: LojaDaBatalha; mesa: MesaEmMemoria } {
  const zeLento = { ...ze(60), atributos: { forca: 60, agilidade: 30 } }
  const segundo = { ...MARINHEIRO, id: 'pers_m2', nome: 'Marinheiro 2' }
  const mesa = criarMesaEmMemoria(
    SISTEMA_DO_TESTE,
    lutadoresDe([
      { ficha: zeLento, lado: 'a' },
      { ficha: MARINHEIRO, lado: 'b' },
      { ficha: segundo, lado: 'b' },
    ]),
  )
  const dados = [...d20]
  const loja = criarBatalhaStore(mesa, { rolarD20: () => dados.shift() ?? 1, outraBatalhaLigada: () => false })
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

function hp(mesa: MesaEmMemoria, nome: string): number | undefined {
  return mesa.personagens().find((personagem) => personagem.nome === nome)?.recursos.hp
}

const SABRE_NO_ZE: PedidoDeAcao = { tipo: 'atacar', armaId: 'arma_sabre', alvos: [{ tokenId: TOKEN_DO_ZE, dano: 110 }], surpresa: false, perfurante: false }

/** O Marinheiro (o mestre joga por ele) acerta o Zé com o Sabre e o Zé não reage. */
function golpeDoMestreQueAcertou(): { loja: LojaDaBatalha; mesa: MesaEmMemoria; linhaId: string } {
  const { loja, mesa } = batalhaEmpatada([5, 17, 11])
  expect(loja.getState().agir(CENA, MESTRE, vez(loja), SABRE_NO_ZE)).toBe(true)
  const golpe = cena(loja).turnos.golpes?.[0]
  if (golpe === undefined) throw new Error('o golpe não ficou esperando')
  expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'naoReagir', golpeId: golpe.id, tokenId: TOKEN_DO_ZE })).toBe(true)
  const linha = cena(loja).registro.at(-1)
  if (linha === undefined) throw new Error('sem linha')
  return { loja, mesa, linhaId: linha.id }
}

function gestosDoJudge(loja: LojaDaBatalha): number {
  return (cena(loja).efeitos ?? []).filter((efeito) => efeito.tipo === 'judge').length
}

describe('batalha One Piece: a ordem pelo d20 no empate', () => {
  it('Agilidade igual: o d20 maior vai primeiro (17, 11, 5) e o d20 de cada carta fica guardado para o mestre', () => {
    const { loja } = batalhaEmpatada([5, 17, 11])
    const { turnos } = cena(loja)
    expect(turnos.cartas.map((carta) => carta.nome)).toEqual(['Marinheiro', 'Marinheiro 2', 'Zé'])
    expect(turnos.cartas.map((carta) => turnos.d20[carta.id])).toEqual([17, 11, 5])
    expect(cartaDaVez(turnos)?.nome).toBe('Marinheiro')
  })

  it('o d20 empatado de novo não embaralha: a ordem fica uma só e todos têm d20', () => {
    const { loja } = batalhaEmpatada([9, 9, 9, 4, 12, 7])
    const { turnos } = cena(loja)
    expect(turnos.cartas).toHaveLength(3)
    expect(new Set(turnos.cartas.map((carta) => carta.id)).size).toBe(3)
    for (const carta of turnos.cartas) expect(typeof turnos.d20[carta.id]).toBe('number')
  })
})

describe('batalha One Piece: o Desfazer do mestre', () => {
  it('o texto da linha do golpe muda de "esperando reação" para "não reagiu, recebeu 110"', () => {
    const { loja } = batalhaEmpatada([5, 17, 11])
    loja.getState().agir(CENA, MESTRE, vez(loja), SABRE_NO_ZE)
    expect(cena(loja).registro.map((linha) => linha.texto)).toEqual(['Marinheiro usa Sabre em Zé: 110 · esperando reação'])
    const golpe = cena(loja).turnos.golpes?.[0]
    if (golpe === undefined) throw new Error('sem golpe')
    loja.getState().reagir(CENA, MESTRE, { tipo: 'naoReagir', golpeId: golpe.id, tokenId: TOKEN_DO_ZE })
    expect(cena(loja).registro.map((linha) => linha.texto)).toEqual(['Marinheiro usa Sabre em Zé: 110 · não reagiu, recebeu 110'])
  })

  it('desfazer o golpe devolve o HP, deixa a linha riscada por "Mestre" e o Judge ergue a carta', () => {
    // Arrange
    const { loja, mesa, linhaId } = golpeDoMestreQueAcertou()
    expect(hp(mesa, 'Zé')).toBe(190)
    const textoAntes = cena(loja).registro.find((linha) => linha.id === linhaId)?.texto

    // Act
    const desfez = loja.getState().desfazer(CENA, linhaId, MESTRE)

    // Assert
    expect(desfez).toBe(true)
    expect(hp(mesa, 'Zé')).toBe(300)
    const linha = cena(loja).registro.find((candidata) => candidata.id === linhaId)
    expect(linha?.desfeita?.por).toBe('Mestre')
    // O texto fica (riscado na tela): o registro conta o que houve e que foi desfeito.
    expect(linha?.texto).toBe(textoAntes)
    expect(gestosDoJudge(loja)).toBe(1)
    expect(cena(loja).efeitos?.at(-1)).toMatchObject({ tipo: 'judge', gesto: 'carta' })
  })

  it('a ordem e os d20 ficam como estavam depois do Desfazer (o empate não é rolado de novo)', () => {
    const { loja, linhaId } = golpeDoMestreQueAcertou()
    const antes = cena(loja).turnos
    const ordem = antes.cartas.map((carta) => carta.id)
    const d20 = { ...antes.d20 }

    loja.getState().desfazer(CENA, linhaId, MESTRE)

    const depois = cena(loja).turnos
    expect(depois.cartas.map((carta) => carta.id)).toEqual(ordem)
    expect(depois.d20).toEqual(d20)
    expect(depois.vez).toBe(antes.vez)
    expect(depois.rodada).toBe(antes.rodada)
  })

  it('a ação Simples que o golpe gastou volta: o Marinheiro pode atacar de novo na mesma vez', () => {
    const { loja, linhaId } = golpeDoMestreQueAcertou()
    const cartaId = vez(loja).cartaId
    expect(cena(loja).turnos.gastos[cartaId]?.simples ?? 0).toBeGreaterThan(0)
    loja.getState().desfazer(CENA, linhaId, MESTRE)
    expect(cena(loja).turnos.gastos[cartaId]?.simples ?? 0).toBe(0)
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), SABRE_NO_ZE)).toBe(true)
  })

  it('o jogador não desfaz a linha do mestre, e nada muda', () => {
    const { loja, mesa, linhaId } = golpeDoMestreQueAcertou()
    const antes = structuredClone(cena(loja))
    expect(loja.getState().desfazer(CENA, linhaId, ANA)).toBe(false)
    expect(hp(mesa, 'Zé')).toBe(190)
    expect(cena(loja).registro).toEqual(antes.registro)
    expect(gestosDoJudge(loja)).toBe(0)
  })

  it('desfazer a mesma linha duas vezes: a segunda não faz nada (nem outro gesto do Judge)', () => {
    const { loja, mesa, linhaId } = golpeDoMestreQueAcertou()
    expect(loja.getState().desfazer(CENA, linhaId, MESTRE)).toBe(true)
    expect(loja.getState().desfazer(CENA, linhaId, MESTRE)).toBe(false)
    expect(hp(mesa, 'Zé')).toBe(300)
    expect(gestosDoJudge(loja)).toBe(1)
  })

  it('linha que não existe (id velho de outra batalha) não desfaz nada', () => {
    const { loja } = golpeDoMestreQueAcertou()
    expect(loja.getState().desfazer(CENA, 'linha_que_nao_existe', MESTRE)).toBe(false)
    expect(loja.getState().desfazer('outra_cena', 'linha_que_nao_existe', MESTRE)).toBe(false)
  })

  it('o golpe ainda esperando reação também se desfaz: o golpe sai da espera e ninguém fica para reagir', () => {
    const { loja, mesa } = batalhaEmpatada([5, 17, 11])
    loja.getState().agir(CENA, MESTRE, vez(loja), SABRE_NO_ZE)
    const linha = cena(loja).registro.at(-1)
    if (linha === undefined) throw new Error('sem linha')
    expect(loja.getState().desfazer(CENA, linha.id, MESTRE)).toBe(true)
    expect(cena(loja).turnos.golpes ?? []).toEqual([])
    expect(hp(mesa, 'Zé')).toBe(300)
  })
})
