// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F1, fatia S2 (docs/planos/conserto-fichas-2026-11-08.md;
 * bug 3 de docs/auditoria-fichas/00-bugs-do-sistema.md): desfazer a linha
 * "Vez" volta SÓ o que a vez mudou, nunca a foto inteira do combate. Os dois
 * roteiros do relatório, na store do app (`criarBatalhaStore`) sobre a mesa em
 * memória do treino, com fichas inventadas (o atirador e o coveiro).
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import type { VezEsperada } from '../lib/batalha/ponte'
import { cartaDaVez, combatentesIniciais, type AutorDaAcao, type CartaDaOrdem } from '../lib/batalha/turnos'
import { personagemDoArquivo, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

/** Age primeiro (Agilidade 70). "Desenhar o alvo" (Tempo 3, 30 SP) e "Passo de Valsa" (reação, Tempo 3, 35 SP). */
const ATIRADOR = ficha({
  id: 'pers_atirador',
  tipo: 'jogador',
  nome: 'Atirador',
  recursos: { hp: 300, sp: 100 },
  maximos: { hp: 300, sp: 100 },
  atributos: { forca: 30, agilidade: 70 },
  abas: {
    habilidades: [
      { id: 'tec_desenhar', nome: 'Desenhar o alvo', campos: { acao: 'Simples', custo: '30 SP', tempo: '3', dano: '40' } },
      { id: 'tec_valsa', nome: 'Passo de Valsa', campos: { acao: 'Reação', custo: '35 SP', tempo: '3', efeito: 'Esquiva do golpe' } },
    ],
  },
})

const COVEIRO = ficha({
  id: 'pers_coveiro',
  tipo: 'jogador',
  nome: 'Coveiro',
  recursos: { hp: 300, sp: 60 },
  maximos: { hp: 300, sp: 60 },
  atributos: { forca: 50, agilidade: 40 },
  abas: { armas: [{ id: 'arma_pa', nome: 'Pá', campos: { dano: '10' } }] },
})

function batalha(): { loja: LojaDaBatalha; mesa: MesaEmMemoria } {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: ATIRADOR, lado: 'a' }, { ficha: COVEIRO, lado: 'b' }]))
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

/** A carta pelo nome do token (o da ficha, na inclusão). */
function carta(loja: LojaDaBatalha, nome: string): CartaDaOrdem {
  const achada = cena(loja).turnos.cartas.find((candidata) => candidata.nome === nome)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada
}

function sp(loja: LojaDaBatalha, mesa: MesaEmMemoria, nome: string): number {
  const personagem = mesa.personagens().find((candidato) => candidato.id === carta(loja, nome).personagemId)
  if (personagem === undefined) throw new Error(`sem ${nome}`)
  return personagem.recursos.sp ?? 0
}

function recargas(loja: LojaDaBatalha, nome: string): Readonly<Record<string, number>> {
  const personagemId = carta(loja, nome).personagemId
  return personagemId === null ? {} : (cena(loja).turnos.combate?.[personagemId]?.recargas ?? {})
}

function linhaCom(loja: LojaDaBatalha, trecho: string): string {
  const linha = [...cena(loja).registro].reverse().find((candidata) => candidata.desfeita === undefined && candidata.texto.includes(trecho))
  if (linha === undefined) throw new Error(`sem a linha "${trecho}"`)
  return linha.id
}

const desenhar = (alvo: string): PedidoDeAcao => ({ tipo: 'habilidade', cartaoId: 'tec_desenhar', armaId: null, alvos: [{ tokenId: alvo, dano: 40 }], surpresa: false, perfurante: false, custo: null, acao: null })

describe('bug 3: desfazer a Vez volta só o que ela mudou', () => {
  it('roteiro A, "o jogador quer trocar a ação": Desenhar → Vez → desfaz o Desenhar → desfaz a Vez: volta a vez do atirador com o SP, a técnica livre e a ação de novo', () => {
    const { loja, mesa } = batalha()
    expect(cartaDaVez(cena(loja).turnos)?.id).toBe(carta(loja, 'Atirador').id)
    const coveiro = carta(loja, 'Coveiro').tokenId
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), desenhar(coveiro))).toBe(true)
    expect(sp(loja, mesa, 'Atirador')).toBe(70)
    expect(recargas(loja, 'Atirador').tec_desenhar).toBeGreaterThan(0)
    expect(loja.getState().passarVez(CENA, MESTRE, vez(loja))).toBe(true)
    const linhaDaVez = linhaCom(loja, 'Vez:')

    expect(loja.getState().desfazer(CENA, linhaCom(loja, 'Desenhar o alvo'), MESTRE)).toBe(true)
    expect(loja.getState().desfazer(CENA, linhaDaVez, MESTRE)).toBe(true)

    expect(cena(loja).turnos.vez).toBe(carta(loja, 'Atirador').id)
    expect(sp(loja, mesa, 'Atirador')).toBe(100)
    expect(recargas(loja, 'Atirador').tec_desenhar).toBeUndefined()
    expect(cena(loja).turnos.gastos[carta(loja, 'Atirador').id]?.simples ?? 0).toBe(0)
    // A prova de que a vez voltou inteira: ele usa a técnica de novo, na mesma vez.
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), desenhar(coveiro))).toBe(true)
  })

  it('roteiro B: Vez → golpe → reação com o Passo de Valsa → selo posto → desfaz só a Vez: a recarga e o SP da reação, a linha dela e o selo novo ficam; o selo que a vez descontou volta', () => {
    const { loja, mesa } = batalha()
    const atirador = carta(loja, 'Atirador').tokenId
    const coveiro = carta(loja, 'Coveiro').tokenId
    // Um selo no atirador, posto na vez do coveiro (posto na vez dele, só desconta na rodada seguinte). Na rodada 2 o
    // atirador passa: a vez desconta (3 → 2), e é a única coisa dos selos que ela mexe.
    expect(loja.getState().passarVez(CENA, MESTRE, vez(loja))).toBe(true)
    expect(loja.getState().porSelo(CENA, atirador, { nome: 'Lento', turnos: 3 })).toBe(true)
    expect(loja.getState().passarVez(CENA, MESTRE, vez(loja))).toBe(true)
    expect(cena(loja).turnos.rodada).toBe(2)
    expect(loja.getState().passarVez(CENA, MESTRE, vez(loja))).toBe(true)
    const linhaDaVez = linhaCom(loja, 'Vez:')
    const selos = () => cena(loja).turnos.selos ?? []
    expect(selos().find((selo) => selo.nome === 'Lento')?.turnos).toBe(2)

    expect(loja.getState().agir(CENA, MESTRE, vez(loja), { tipo: 'atacar', armaId: null, alvos: [{ tokenId: atirador, dano: 20 }], surpresa: false, perfurante: false })).toBe(true)
    const golpe = (cena(loja).turnos.golpes ?? [])[0]
    if (golpe === undefined) throw new Error('sem golpe esperando')
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'tecnica', golpeId: golpe.id, tokenId: atirador, cartaoId: 'tec_valsa', saida: 'esquiva', custo: null })).toBe(true)
    expect(sp(loja, mesa, 'Atirador')).toBe(65)
    const recargaDaValsa = recargas(loja, 'Atirador').tec_valsa
    expect(recargaDaValsa).toBeGreaterThan(0)
    expect(loja.getState().porSelo(CENA, coveiro, { nome: 'Queimado', turnos: 2 })).toBe(true)
    const linhaDaReacao = linhaCom(loja, 'Passo de Valsa')

    expect(loja.getState().desfazer(CENA, linhaDaVez, MESTRE)).toBe(true)

    expect(cena(loja).turnos.vez).toBe(carta(loja, 'Atirador').id)
    expect(recargas(loja, 'Atirador').tec_valsa).toBe(recargaDaValsa)
    expect(sp(loja, mesa, 'Atirador')).toBe(65)
    expect(cena(loja).registro.find((linha) => linha.id === linhaDaReacao)?.desfeita).toBeUndefined()
    expect(selos().find((selo) => selo.nome === 'Queimado')?.turnos).toBe(2)
    expect(selos().find((selo) => selo.nome === 'Lento')?.turnos).toBe(3)
  })
})
