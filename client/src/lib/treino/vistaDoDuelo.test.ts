// @vitest-environment node
/**
 * A VISTA DE CADA LADO NO FIO DO DUELO (fatia M2): o servidor manda a cada
 * conta o recorte do lado DELA (`dueloParaOsLados`), e o de A não leva o que
 * só B vê. Ambiente node: a vista é montada no DO, sem DOM.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../batalha/combate'
import type { CartaParaJogador, EstadoParaJogador } from '../batalha/vistaDoJogador'
import { cartaDaVez } from '../batalha/turnos'
import type { Personagem } from '../personagem'
import { lerEstadoParaJogador } from '../../net/protocoloDaBatalha'
import { aplicarJogada, criarDuelo, type DueloGravado, type MotorDoDuelo, type ResultadoDaJogada } from './duelo'
import { MARINHEIRO, SISTEMA_DO_TESTE, ze } from './fichasDeTreino.testkit'
import { criarSorteio } from './sorteio'
import { dueloParaOsLados } from './vistaDoDuelo'

const CONTA_A = 'conta_a'
const CONTA_B = 'conta_b'
/** As vagas são a1 e b1: o token de cada uma é `treino_tok_<vaga>`, a cópia `treino_<vaga>`. */
const TOKEN_DO_ZE = 'treino_tok_a1'
const TOKEN_DO_MARINHEIRO = 'treino_tok_b1'
const COPIA_DO_ZE = 'treino_a1'
const COPIA_DO_MARINHEIRO = 'treino_b1'
const ESCUDO_DO_MARINHEIRO = 40

function aceita(resultado: ResultadoDaJogada, oQue: string): DueloGravado {
  if (!resultado.ok) throw new Error(`${oQue} recusada: ${resultado.motivo}`)
  return resultado.duelo
}

function cartaDoToken(vista: EstadoParaJogador, tokenId: string): CartaParaJogador {
  const carta = vista.cartas.find((candidata) => candidata.tokenId === tokenId)
  if (carta === undefined) throw new Error(`a vista não tem a carta de ${tokenId}`)
  return carta
}

/** Zé (conta A) contra o Marinheiro com Escudo (conta B), o Zé na vez dele e com o Corte Duplo esperando a reação do Marinheiro. */
function corteEsperandoAReacao(): DueloGravado {
  const sorteio = criarSorteio(7)
  const motor: MotorDoDuelo = { sistema: SISTEMA_DO_TESTE, rolarD20: () => sorteio.d20() }
  const zeDaConta: Personagem = { ...ze(60), dono: CONTA_A }
  const marinheiroDaConta: Personagem = { ...MARINHEIRO, dono: CONTA_B, recursos: { ...MARINHEIRO.recursos, escudo: ESCUDO_DO_MARINHEIRO } }
  const criado = criarDuelo({ id: 'duelo_vista', a: { contaId: CONTA_A, nome: 'Ana', fichas: [zeDaConta] }, b: { contaId: CONTA_B, nome: 'Bia', fichas: [marinheiroDaConta] } }, motor)
  if (!criado.ok) throw new Error(`duelo recusado: ${JSON.stringify(criado)}`)
  let duelo = criado.duelo
  const vez = (): { cartaId: string; rodada: number } => {
    const { vez: cartaId, rodada } = duelo.cena.turnos
    if (cartaId === null) throw new Error('duelo sem vez')
    return { cartaId, rodada }
  }
  if (cartaDaVez(duelo.cena.turnos)?.tokenId !== TOKEN_DO_ZE) duelo = aceita(aplicarJogada(duelo, motor, CONTA_B, { tipo: 'passar', seq: duelo.seq, vez: vez() }), 'o Marinheiro passar a vez')
  const corte: PedidoDeAcao = { tipo: 'habilidade', cartaoId: 'tec_corte', armaId: null, alvos: [{ tokenId: TOKEN_DO_MARINHEIRO, dano: null }], surpresa: false, perfurante: false, custo: null, acao: null }
  return aceita(aplicarJogada(duelo, motor, CONTA_A, { tipo: 'agir', seq: duelo.seq, vez: vez(), pedido: corte }), 'o Corte do Zé')
}

describe('vista de cada lado no fio do duelo', () => {
  it('a vista de A não leva o que só B vê (e a de B não leva o de A); as duas passam pelo leitor do site', () => {
    const lados = dueloParaOsLados(corteEsperandoAReacao(), SISTEMA_DO_TESTE)
    const deA = lados.a.vista
    const deB = lados.b.vista

    // Só B: o golpe que espera a reação da ficha dele, o combate da cópia dele e o Escudo dela.
    expect(deB.reacoes?.map((reacao) => reacao.tokenId)).toEqual([TOKEN_DO_MARINHEIRO])
    expect(deA.reacoes).toBeUndefined()
    expect(deB.meus?.map((meu) => meu.personagemId)).toEqual([COPIA_DO_MARINHEIRO])
    expect(cartaDoToken(deB, TOKEN_DO_MARINHEIRO)).toMatchObject({ lado: 'eu', personagemId: COPIA_DO_MARINHEIRO, escudo: ESCUDO_DO_MARINHEIRO })
    const marinheiroParaA = cartaDoToken(deA, TOKEN_DO_MARINHEIRO)
    expect(marinheiroParaA.lado).toBe('outro')
    expect(marinheiroParaA.personagemId).toBeUndefined()
    expect(marinheiroParaA.escudo).toBeUndefined()

    // Só A: a vez e as ações dela, o combate da cópia dela; o Zé é "outro" para B.
    expect(deA.minhaVez).toBe(true)
    expect(deA.acoes).toBeDefined()
    expect(deB.minhaVez).toBe(false)
    expect(deB.acoes).toBeUndefined()
    expect(deA.meus?.map((meu) => meu.personagemId)).toEqual([COPIA_DO_ZE])
    expect(cartaDoToken(deB, TOKEN_DO_ZE)).toMatchObject({ lado: 'outro' })
    expect(cartaDoToken(deB, TOKEN_DO_ZE).personagemId).toBeUndefined()

    // O registro é a cauda do fio, e ninguém desfaz no duelo (o Corte é do Zé, na vez dele).
    expect(deA.registro.length).toBeGreaterThan(0)
    expect(deA.registro).toEqual(lados.a.registro)
    expect([...deA.registro, ...deB.registro].every((linha) => !linha.podeDesfazer)).toBe(true)

    // A vista vai a JSON e o leitor do site (o mesmo do `batalha.estado` do app) a devolve igual.
    expect(lerEstadoParaJogador(JSON.parse(JSON.stringify(deA)))).toEqual(deA)
    expect(lerEstadoParaJogador(JSON.parse(JSON.stringify(deB)))).toEqual(deB)
  })
})
