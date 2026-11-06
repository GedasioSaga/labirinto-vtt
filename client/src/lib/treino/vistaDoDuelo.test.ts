// @vitest-environment node
/**
 * A VISTA DE CADA LADO NO FIO DO DUELO (fatia M2): o servidor manda a cada
 * conta o recorte do lado DELA (`dueloParaOsLados`), e o de A não leva o que
 * só B vê, nem na vista nem no resto do frame (o fio recortado). Ambiente
 * node: a vista é montada no DO, sem DOM.
 */
import { describe, expect, it } from 'vitest'
import { combateVazio, type ContraAtaque, type EfeitoDaBatalha, type LembreteDaMarca, type PedidoDeAcao } from '../batalha/combate'
import type { CartaParaJogador, EstadoParaJogador } from '../batalha/vistaDoJogador'
import { cartaDaVez } from '../batalha/turnos'
import type { Personagem, RegistroDaFicha } from '../personagem'
import { lerEstadoParaJogador } from '../../net/protocoloDaBatalha'
import { projetarParaJogador } from '../nuvem/projecao'
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
/** Marcas do que só B guarda (`comOQueSoBGuarda`), procuradas no JSON inteiro de cada frame. */
const RECARGA_DO_MARINHEIRO = 'tec_recarga_so_do_marinheiro'
const MARCA_DO_MARINHEIRO = 'marca_so_do_marinheiro'
const GOLPE_DO_CONTRA = 'golpe_contra_so_do_marinheiro'
const NUMERO_DA_FORMA = 'FOR so do Marinheiro'

function aceita(resultado: ResultadoDaJogada, oQue: string): DueloGravado {
  if (!resultado.ok) throw new Error(`${oQue} recusada: ${resultado.motivo}`)
  return resultado.duelo
}

function fichaDe(personagens: readonly Personagem[], id: string): Personagem {
  const ficha = personagens.find((candidata) => candidata.id === id)
  if (ficha === undefined) throw new Error(`o duelo não tem a ficha ${id}`)
  return ficha
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

/**
 * O mesmo duelo com o que só B guarda e a jogada acima não criou: o combate
 * da cópia dele, um contra-ataque, um lembrete da marca e a forma dele com os
 * números. E o Escudo no máximo e no histórico da ficha, que NÃO é só de B: a
 * ficha é pública no duelo e vai inteira aos dois.
 */
function comOQueSoBGuarda(duelo: DueloGravado): DueloGravado {
  const { turnos } = duelo.cena
  const ajusteDoEscudo: RegistroDaFicha = { quem: 'Mestre', parte: 'recurso', chave: 'escudo', rotulo: 'Escudo', de: 0, para: ESCUDO_DO_MARINHEIRO, quando: 0 }
  const contra: ContraAtaque = { golpeId: GOLPE_DO_CONTRA, tokenId: TOKEN_DO_MARINHEIRO, personagemId: COPIA_DO_MARINHEIRO, atacanteTokenId: TOKEN_DO_ZE, rodada: turnos.rodada }
  const lembrete: LembreteDaMarca = { id: MARCA_DO_MARINHEIRO, linhaId: 'linha_da_marca', golpeId: GOLPE_DO_CONTRA, cartaoId: 'pas_olhar', tokenId: TOKEN_DO_MARINHEIRO, personagemId: COPIA_DO_MARINHEIRO, alvoTokenId: TOKEN_DO_ZE, rodada: turnos.rodada }
  const forma: EfeitoDaBatalha = { seq: 999, tipo: 'transformacao', tokenId: TOKEN_DO_MARINHEIRO, forma: 'Forma do Mar', imagem: null, numeros: [{ rotulo: NUMERO_DA_FORMA, de: 80, para: 120 }] }
  const personagens = duelo.lutadores.personagens.map((ficha) =>
    ficha.id === COPIA_DO_MARINHEIRO ? { ...ficha, maximos: { ...ficha.maximos, escudo: ESCUDO_DO_MARINHEIRO }, historico: [ajusteDoEscudo] } : ficha,
  )
  return {
    ...duelo,
    lutadores: { ...duelo.lutadores, personagens },
    cena: {
      ...duelo.cena,
      turnos: {
        ...turnos,
        combate: { ...turnos.combate, [COPIA_DO_MARINHEIRO]: { ...combateVazio(), recargas: { [RECARGA_DO_MARINHEIRO]: 2 }, overload: true } },
        contras: [...(turnos.contras ?? []), contra],
        lembretesDaMarca: [...(turnos.lembretesDaMarca ?? []), lembrete],
      },
      efeitos: [...(duelo.cena.efeitos ?? []), forma],
    },
  }
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
    // O Escudo de B chega a A pela ficha do fio, como a Vida dele; a carta "outro" não o leva (o leitor do app a recusaria).
    expect(marinheiroParaA.escudo).toBeUndefined()
    expect(lados.a.lutadores.personagens.find((ficha) => ficha.id === COPIA_DO_MARINHEIRO)?.recursos.escudo).toBe(ESCUDO_DO_MARINHEIRO)

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

  it('o frame inteiro de A (o fio recortado e a vista) não leva o que só B guarda; o de B leva, e as fichas e os golpes esperando ficam inteiros nos dois', () => {
    const gravado = comOQueSoBGuarda(corteEsperandoAReacao())
    const lados = dueloParaOsLados(gravado, SISTEMA_DO_TESTE)
    // O JSON inteiro do frame, como o DO o manda a cada conta.
    const frameDeA = JSON.stringify({ t: 'duelo.estado', duelo: lados.a })
    const frameDeB = JSON.stringify({ t: 'duelo.estado', duelo: lados.b })
    for (const soDeB of [RECARGA_DO_MARINHEIRO, MARCA_DO_MARINHEIRO, GOLPE_DO_CONTRA, NUMERO_DA_FORMA]) {
      expect(frameDeA, soDeB).not.toContain(soDeB)
      expect(frameDeB, soDeB).toContain(soDeB)
    }
    expect(frameDeA).toContain(`"escudo":${ESCUDO_DO_MARINHEIRO}`)

    // Campo a campo: o combate, os contra-ataques e os lembretes só das fichas do lado; o de A segue inteiro para A.
    expect(lados.a.turnos.combate?.[COPIA_DO_MARINHEIRO]).toBeUndefined()
    expect(lados.a.turnos.combate?.[COPIA_DO_ZE]).toEqual(gravado.cena.turnos.combate?.[COPIA_DO_ZE])
    expect(lados.b.turnos.combate?.[COPIA_DO_ZE]).toBeUndefined()
    expect(lados.a.turnos.contras).toEqual([])
    expect(lados.b.turnos.contras?.map((contra) => contra.golpeId)).toEqual([GOLPE_DO_CONTRA])
    expect(lados.a.turnos.lembretesDaMarca).toEqual([])
    // A ficha é pública no duelo: a de B chega a A inteira (Vida, Escudo atual e máximo, histórico), igual à que B recebe.
    // Cortar só o Escudo não escondia nada: o dano do golpe e a queda da Vida contam quanto ele absorveu.
    // A comparação é com a ficha guardada como o fio de sempre a projeta (sem o dono nem o que é do mestre).
    const marinheiroParaA = fichaDe(lados.a.lutadores.personagens, COPIA_DO_MARINHEIRO)
    expect(marinheiroParaA).toEqual(projetarParaJogador(fichaDe(gravado.lutadores.personagens, COPIA_DO_MARINHEIRO)))
    expect(marinheiroParaA.maximos.escudo).toBe(ESCUDO_DO_MARINHEIRO)
    expect(marinheiroParaA.historico.map((ajuste) => ajuste.chave)).toEqual(['escudo'])
    expect(lados.a.lutadores.personagens).toEqual(lados.b.lutadores.personagens)
    // A forma de B chega a A só com o nome.
    expect(lados.a.efeitos.find((efeito) => efeito.tipo === 'transformacao')).toEqual({ seq: 999, tipo: 'transformacao', tokenId: TOKEN_DO_MARINHEIRO, forma: 'Forma do Mar', imagem: null })

    // O golpe esperando a reação de B fica inteiro nos dois: a vista de A também o mostra (o alvo dele, sem saída ainda).
    expect(lados.a.turnos.golpes).toEqual(lados.b.turnos.golpes)
    expect(lados.a.vista.golpes?.some((golpe) => golpe.alvos.some((alvo) => alvo.tokenId === TOKEN_DO_MARINHEIRO && alvo.saida === undefined))).toBe(true)
  })
})
