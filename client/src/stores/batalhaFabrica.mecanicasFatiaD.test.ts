// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F2, fatia D (Vagn Kane e Guilherme): as mecânicas à
 * mão na store do app (`criarBatalhaStore`) sobre a mesa em memória do
 * treino, com os cartões e os números REAIS (`fichasDaFatiaD.testkit.ts`).
 * Guilherme no lado A, o Vagn no B. Lei:
 * docs/auditoria-fichas/respostas-do-grilling.md. No máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao, PedidoDeAlvo } from '../lib/batalha/combate'
import { ARMADURA, EXPLOSAO, guilherme, REVIGORAR, vagnCom } from '../lib/batalha/fichasDaFatiaD.testkit'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { numeroDaFicha } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

function batalha(): { loja: LojaDaBatalha; mesa: MesaEmMemoria; fila: number[] } {
  const fila: number[] = []
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: guilherme, lado: 'a' }, { ficha: vagnCom(), lado: 'b' }]))
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

function naVezDe(loja: LojaDaBatalha, nome: string): VezEsperada {
  for (let i = 0; i < 4; i += 1) {
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

function recursos(mesa: MesaEmMemoria, nome: string): { hp: number; sp: number; escudo: number } {
  const achada = mesa.personagens().find((candidato) => candidato.nome === nome)
  if (achada === undefined) throw new Error(`sem ${nome}`)
  return { hp: numeroDaFicha(achada.recursos, 'hp'), sp: numeroDaFicha(achada.recursos, 'sp'), escudo: numeroDaFicha(achada.recursos, 'escudo') }
}

function tecnica(cartaoId: string, alvos: PedidoDeAlvo[]): PedidoDeAcao {
  return { tipo: 'habilidade', cartaoId, armaId: null, alvos, surpresa: false, perfurante: false, custo: null, acao: null }
}

const textos = (loja: LojaDaBatalha): string[] => cena(loja).registro.map((linha) => linha.texto)

describe('Explosão do Guilherme no Vagn (RES 50, mod +1, contra CD 11)', () => {
  it('o Vagn tira 5 (6): falhou, 10% da vida atual (1000 → 100) direto no HP; o Guilherme paga 40 SP', () => {
    const { loja, mesa, fila } = batalha()
    const doVagn = token(loja, 'Vagn Kane')
    fila.push(5)
    // O dano da mira (0) não vale: o host calcula pela vida do alvo.
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Guilherme'), tecnica(EXPLOSAO.id, [{ tokenId: doVagn, dano: 0 }]))).toBe(true)
    expect(recursos(mesa, 'Vagn Kane')).toMatchObject({ hp: 900, escudo: 100 })
    expect(recursos(mesa, 'Guilherme').sp).toBe(25)
    expect(cena(loja).turnos.golpes ?? []).toEqual([])
    expect(textos(loja).some((texto) => texto.includes('contra CD 11') && texto.includes('pegou'))).toBe(true)
  })

  it('o Vagn tira 10 (11): passou, nada acontece e a Explosão não gasta (SP 65, 0 de 2 usos)', () => {
    const { loja, mesa, fila } = batalha()
    const doVagn = token(loja, 'Vagn Kane')
    fila.push(10)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Guilherme'), tecnica(EXPLOSAO.id, [{ tokenId: doVagn, dano: 0 }]))).toBe(true)
    expect(recursos(mesa, 'Vagn Kane')).toMatchObject({ hp: 1000, escudo: 100 })
    expect(recursos(mesa, 'Guilherme').sp).toBe(65)
    expect(cena(loja).turnos.combate?.[guilherme.id]?.usos[EXPLOSAO.id] ?? 0).toBe(0)
    expect(textos(loja).some((texto) => texto.includes('não gastou'))).toBe(true)
  })
})

describe('Armadura Humana do Vagn contra o Atacar do Guilherme (110)', () => {
  it('Atacar: o Vagn toma os 110 (Escudo 100 e HP 10) e devolve 15 (110 ÷ 7) no Guilherme, sem reação', () => {
    const { loja, mesa } = batalha()
    const doVagn = token(loja, 'Vagn Kane')
    const ataque: PedidoDeAcao = { tipo: 'atacar', armaId: null, alvos: [{ tokenId: doVagn, dano: 110 }], surpresa: false, perfurante: false }
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Guilherme'), ataque)).toBe(true)
    const golpeId = cena(loja).turnos.golpes?.[0]?.id ?? ''
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'tecnica', golpeId, tokenId: doVagn, cartaoId: ARMADURA.id, saida: 'contra', custo: null })).toBe(true)
    expect(recursos(mesa, 'Vagn Kane')).toMatchObject({ hp: 990, escudo: 0, sp: 95 })
    expect(recursos(mesa, 'Guilherme').escudo).toBe(65)
    expect(cena(loja).turnos.contras ?? []).toEqual([])
    expect(textos(loja).some((texto) => texto.includes('devolveu 15'))).toBe(true)
  })
})

describe('Revigorar do Guilherme', () => {
  it('nele: cura o Espírito (900 → 1000, máximo 1100); no Vagn (inimigo) é recusado', () => {
    const { loja, mesa } = batalha()
    const vez = naVezDe(loja, 'Guilherme')
    expect(loja.getState().agir(CENA, MESTRE, vez, tecnica(REVIGORAR.id, [{ tokenId: token(loja, 'Vagn Kane'), dano: null }]))).toBe(false)
    expect(loja.getState().agir(CENA, MESTRE, vez, tecnica(REVIGORAR.id, [{ tokenId: token(loja, 'Guilherme'), dano: null }]))).toBe(true)
    expect(recursos(mesa, 'Guilherme')).toMatchObject({ hp: 1000, sp: 15 })
    expect(textos(loja).some((texto) => texto.includes('tirou 0 debuffs, curou 100'))).toBe(true)
  })
})
