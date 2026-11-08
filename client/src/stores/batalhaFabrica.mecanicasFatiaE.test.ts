// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F2, revisão da fatia E (Ryoko D. Violet e Vincent G.):
 * as correções da revisão na store do app (`criarBatalhaStore`) sobre a mesa
 * em memória do treino, com os cartões e os números REAIS
 * (`fichasDaFatiaE.testkit.ts`). Vincent no lado A (age primeiro), a Ryoko no
 * B. Lei: docs/auditoria-fichas/respostas-do-grilling.md. No máximo 2 testes
 * por situação.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao, PedidoDeReacao } from '../lib/batalha/combate'
import { BALA_DE_PRATA, DESENHAR, RECUPERACAO_DE_FORCAS, ROSA_FUNEBRE, ryokoCom, vincentCom } from '../lib/batalha/fichasDaFatiaE.testkit'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { numeroDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const JOGADOR: AutorDaAcao = { tipo: 'jogador', playerId: 'jogador_1', nome: 'Jogador' }

function batalha(ryoko: Personagem = ryokoCom()): { loja: LojaDaBatalha; mesa: MesaEmMemoria; fila: number[] } {
  const fila: number[] = []
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: vincentCom(), lado: 'a' }, { ficha: ryoko, lado: 'b' }]))
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

function vez(loja: LojaDaBatalha): VezEsperada {
  const { turnos } = cena(loja)
  if (turnos.vez === null) throw new Error('sem vez')
  return { cartaId: turnos.vez, rodada: turnos.rodada }
}

/** Passa a vez até chegar a de `nome` (a vez de agora conta). */
function naVezDe(loja: LojaDaBatalha, nome: string): VezEsperada {
  for (let i = 0; i < 4; i += 1) {
    const atual = vez(loja)
    if (cena(loja).turnos.cartas.find((candidata) => candidata.id === atual.cartaId)?.nome?.startsWith(nome) === true) return atual
    expect(loja.getState().passarVez(CENA, MESTRE, atual)).toBe(true)
  }
  throw new Error(`a vez de ${nome} não chegou`)
}

function carta(loja: LojaDaBatalha, nome: string): { tokenId: string; personagemId: string } {
  const achada = cena(loja).turnos.cartas.find((candidata) => candidata.nome?.startsWith(nome) === true && candidata.extra === undefined)
  if (achada === undefined || achada.personagemId === null) throw new Error(`sem a carta de ${nome}`)
  return { tokenId: achada.tokenId, personagemId: achada.personagemId }
}

const hp = (mesa: MesaEmMemoria, id: string): number => numeroDaFicha(mesa.personagens().find((candidato) => candidato.id === id)?.recursos ?? {}, 'hp')
const ultimaLinha = (loja: LojaDaBatalha): string => cena(loja).registro[cena(loja).registro.length - 1]?.texto ?? ''
const golpeId = (loja: LojaDaBatalha): string => cena(loja).turnos.golpes?.[0]?.id ?? ''
const atacar = (alvo: string, dano: number, surpresa = false): PedidoDeAcao => ({ tipo: 'atacar', armaId: null, alvos: [{ tokenId: alvo, dano }], surpresa, perfurante: false })

describe('revisão da fatia E: o sangramento passa pelos −30% do Ogro', () => {
  it('Ryoko sangrando: o Aplicar do mestre tira 7 (não 10), direto no HP, e a linha diz de quanto', () => {
    const { loja, mesa } = batalha()
    const ryoko = carta(loja, 'Ryoko')
    naVezDe(loja, 'Vincent')
    expect(loja.getState().porSelo(CENA, ryoko.tokenId, { nome: 'Sangrando', turnos: 3 })).toBe(true)
    naVezDe(loja, 'Ryoko')
    const lembrete = (cena(loja).turnos.combate?.[ryoko.personagemId]?.lembretes ?? []).find((candidato) => candidato.chave.endsWith(':sangra'))
    if (lembrete === undefined) throw new Error('o lembrete do Sangramento não saiu')
    expect(loja.getState().passiva(CENA, MESTRE, { tipo: 'lembrete', tokenId: ryoko.tokenId, cartaoId: lembrete.cartaoId, aplicar: true })).toBe(true)
    expect(hp(mesa, ryoko.personagemId)).toBe(693)
    expect(ultimaLinha(loja)).toContain('sangra: -7 HP (direto, sem o Escudo; Superioridade do Ogro -30%: de 10)')
  })
})

describe('revisão da fatia E: o Marcado só esquiva com desvantagem', () => {
  it('d20 13 e 4 (+2): Defender vale com o 13; Esquivar é recusado (4 + 2 = 6)', () => {
    const { loja, fila } = batalha()
    const ryoko = carta(loja, 'Ryoko')
    expect(loja.getState().porSelo(CENA, ryoko.tokenId, { nome: 'Marcado', turnos: 2 })).toBe(true)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Vincent'), atacar(ryoko.tokenId, 50))).toBe(true)
    fila.push(13, 4)
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'rolar', golpeId: golpeId(loja), tokenId: ryoko.tokenId, modificador: 2 })).toBe(true)
    expect(cena(loja).turnos.golpes?.[0]?.alvos[0]?.rolagem).toMatchObject({ d20: 13, total: 15, d20DaEsquiva: 4 })
    const escolher = (saida: 'esquiva' | 'metade'): PedidoDeReacao => ({ tipo: 'escolher', golpeId: golpeId(loja), tokenId: ryoko.tokenId, saida })
    expect(loja.getState().reagir(CENA, MESTRE, escolher('esquiva'))).toBe(false)
    expect(loja.getState().reagir(CENA, MESTRE, escolher('metade'))).toBe(true)
  })
})

describe('revisão da fatia E: Recuperação de forças contra Surpresa, só pelo mestre', () => {
  it('Surpresa de 100 (150) na Ryoko: o golpe espera; o d20 e o jogador são recusados; o mestre usa e ela cura 30', () => {
    const { loja, mesa } = batalha(ryokoCom([], { hp: 500, sp: 240, escudo: 12 }))
    const ryoko = carta(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Vincent'), atacar(ryoko.tokenId, 100, true))).toBe(true)
    expect(cena(loja).turnos.golpes?.[0]?.alvos[0]).toMatchObject({ dano: 150, podeReagir: true })
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'rolar', golpeId: golpeId(loja), tokenId: ryoko.tokenId, modificador: 0 })).toBe(false)
    const comer: PedidoDeReacao = { tipo: 'tecnica', golpeId: golpeId(loja), tokenId: ryoko.tokenId, cartaoId: RECUPERACAO_DE_FORCAS.id, saida: 'esquiva', custo: null }
    expect(loja.getState().reagir(CENA, JOGADOR, comer)).toBe(false)
    expect(loja.getState().reagir(CENA, MESTRE, comer)).toBe(true)
    expect(hp(mesa, ryoko.personagemId)).toBe(530)
    expect(ultimaLinha(loja)).toContain('come o golpe e cura 30 (o mestre confirmou: fogo ou explosão)')
  })
})

describe('revisão da fatia E: a Bala de Prata no Desenhar o alvo', () => {
  it('o tiro acerta: a Ryoko fica Marcada E Ferida por prata', () => {
    const { loja, fila } = batalha()
    const ryoko = carta(loja, 'Ryoko')
    const desenhar: PedidoDeAcao = { tipo: 'habilidade', cartaoId: DESENHAR.id, armaId: ROSA_FUNEBRE.id, balaId: BALA_DE_PRATA.id, alvos: [{ tokenId: ryoko.tokenId, dano: 72 }], surpresa: false, perfurante: true, custo: null, acao: null }
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Vincent'), desenhar)).toBe(true)
    fila.push(5)
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'rolar', golpeId: golpeId(loja), tokenId: ryoko.tokenId, modificador: 0 })).toBe(true)
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'escolher', golpeId: golpeId(loja), tokenId: ryoko.tokenId, saida: 'cheio' })).toBe(true)
    const nomes = (cena(loja).turnos.selos ?? []).filter((selo) => selo.tokenId === ryoko.tokenId).map((selo) => selo.nome)
    expect(nomes).toEqual(expect.arrayContaining(['Ferido por prata']))
    expect(nomes.some((nome) => nome.startsWith('Marcad'))).toBe(true)
  })
})
