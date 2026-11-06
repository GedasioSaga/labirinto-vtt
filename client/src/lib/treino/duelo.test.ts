// @vitest-environment node
/**
 * A REGRA PURA DO DUELO (LOBBY v2, fatia T5; aceite em
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): dois robôs pelo duelo.ts
 * com a semente 7 terminam igual à lutaAutomatica; e os dois anti-trapaça
 * liberados na resposta 12.13: pedido com dano (e custo) forjado = mesmo
 * resultado que dano null; agir repetido com seq velho = recusado. Ambiente
 * node: o duelo roda no DO, sem DOM.
 */
import { describe, expect, it } from 'vitest'
import { DANO_MAX, chaveDaVez, type PedidoDeAcao } from '../batalha/combate'
import type { VezEsperada } from '../batalha/ponte'
import { cartaDaVez } from '../batalha/turnos'
import type { Personagem } from '../personagem'
import { recursoDeVida, vidaDoPersonagem } from '../vidaDaFicha'
import { aplicarJogada, criarDuelo, type DueloGravado, type JogadaDoDuelo, type MotorDoDuelo, type ResultadoDaJogada } from './duelo'
import { LIA, lutadoresDe, MARINHEIRO, SISTEMA_DO_TESTE, ze } from './fichasDeTreino.testkit'
import { lutaAutomatica, type ResumoDaLuta } from './lutaAutomatica'
import { jogadaDoRobo } from './robo'
import { criarSorteio, type Sorteio } from './sorteio'

const CONTA_A = 'conta_a'
const CONTA_B = 'conta_b'
/** As vagas são a1, a2... e b1: o token de cada uma é `treino_tok_<vaga>`. */
const TOKEN_DO_ZE = 'treino_tok_a1'
const TOKEN_DO_MARINHEIRO = 'treino_tok_b1'

/** A ficha como o servidor a guarda: o doc completo, com o dono. */
function daConta(ficha: Personagem, contaId: string): Personagem {
  return { ...ficha, dono: contaId }
}

const ZE = daConta(ze(60), CONTA_A)
const LIA_DA_CONTA = daConta(LIA, CONTA_A)
const MARINHEIRO_DA_CONTA = daConta(MARINHEIRO, CONTA_B)

function motorDaSemente(semente: number): { motor: MotorDoDuelo; sorteio: Sorteio } {
  const sorteio = criarSorteio(semente)
  return { motor: { sistema: SISTEMA_DO_TESTE, rolarD20: () => sorteio.d20() }, sorteio }
}

function dueloDe(a: readonly Personagem[], b: readonly Personagem[], motor: MotorDoDuelo): DueloGravado {
  const criado = criarDuelo({ id: 'duelo_teste', a: { contaId: CONTA_A, nome: 'Ana', fichas: a }, b: { contaId: CONTA_B, nome: 'Bia', fichas: b } }, motor)
  if (!criado.ok) throw new Error(`duelo recusado: ${JSON.stringify(criado)}`)
  return criado.duelo
}

function aceita(resultado: ResultadoDaJogada, oQue: string): DueloGravado {
  if (!resultado.ok) throw new Error(`${oQue} recusada: ${resultado.motivo}`)
  return resultado.duelo
}

function contaDoToken(duelo: DueloGravado, tokenId: string): string {
  const vaga = duelo.lutadores.vagas.find((candidata) => candidata.tokenId === tokenId)
  if (vaga === undefined) throw new Error(`token ${tokenId} sem vaga`)
  return duelo.jogadores[vaga.lado].contaId
}

/**
 * Os dois lados jogados pelo robô (`jogadaDoRobo`), cada jogada mandada pela
 * conta do lado com o `seq` de agora: a reação; ou os golpes do mais forte ao
 * mais fraco até um ser aceito, e senão passar a vez (como `lutaAutomatica`).
 */
function duelarComRobos(inicio: DueloGravado, motor: MotorDoDuelo): DueloGravado {
  let duelo = inicio
  let golpesDaVez: { chave: string; golpes: number } | null = null
  while (duelo.fim === null) {
    const { turnos, regras } = duelo.cena
    const chaveDeAgora = turnos.vez === null ? null : chaveDaVez(turnos.rodada, turnos.vez)
    const golpesNaVez: number = golpesDaVez !== null && golpesDaVez.chave === chaveDeAgora ? golpesDaVez.golpes : 0
    const jogada = jogadaDoRobo({ turnos, regras, vagas: duelo.lutadores.vagas, personagens: duelo.lutadores.personagens, sistema: motor.sistema, golpesNaVez })
    if (jogada === null) throw new Error('o robô ficou sem jogada')
    if (jogada.tipo === 'reagir') {
      duelo = aceita(aplicarJogada(duelo, motor, contaDoToken(duelo, jogada.pedido.tokenId), { tipo: 'reagir', seq: duelo.seq, pedido: jogada.pedido }), 'a reação')
      continue
    }
    const conta = contaDoToken(duelo, jogada.tokenId)
    let depois: DueloGravado | null = null
    for (const pedido of jogada.golpes) {
      const feito = aplicarJogada(duelo, motor, conta, { tipo: 'agir', seq: duelo.seq, vez: jogada.esperado, pedido })
      if (!feito.ok) continue
      depois = feito.duelo
      golpesDaVez = { chave: chaveDaVez(jogada.esperado.rodada, jogada.esperado.cartaId), golpes: golpesNaVez + 1 }
      break
    }
    duelo = depois ?? aceita(aplicarJogada(duelo, motor, conta, { tipo: 'passar', seq: duelo.seq, vez: jogada.esperado }), 'passar a vez')
  }
  return duelo
}

/** O duelo acabado no formato do resumo da luta automática (mesma leitura da vida). */
function resumoDoDuelo(duelo: DueloGravado, sorteio: Sorteio): ResumoDaLuta {
  const { fim } = duelo
  if (fim === null || fim.tipo === 'ausencia') throw new Error(`duelo sem fim de luta: ${JSON.stringify(fim)}`)
  const recurso = recursoDeVida(SISTEMA_DO_TESTE)
  const porId = new Map(duelo.lutadores.personagens.map((personagem) => [personagem.id, personagem]))
  return {
    semente: sorteio.estado().semente,
    fim,
    rodada: duelo.cena.turnos.rodada,
    passos: duelo.passos,
    d20: sorteio.estado().jogadas,
    lutadores: duelo.lutadores.vagas.map((vaga) => {
      const copia = porId.get(vaga.personagemId)
      return { vaga: vaga.id, lado: vaga.lado, nome: copia?.nome ?? vaga.id, vida: copia === undefined || recurso === null ? null : vidaDoPersonagem(copia, recurso) }
    }),
    registro: duelo.cena.registro.map((linha) => linha.texto),
  }
}

function vezDe(duelo: DueloGravado): VezEsperada {
  const { vez, rodada } = duelo.cena.turnos
  if (vez === null) throw new Error('duelo sem vez')
  return { cartaId: vez, rodada }
}

/** O 1×1 Zé contra Marinheiro na vez do Zé (se a ordem deu a vez ao Marinheiro, ele passa). */
function umContraUmNaVezDoZe(motor: MotorDoDuelo): DueloGravado {
  const duelo = dueloDe([ZE], [MARINHEIRO_DA_CONTA], motor)
  if (cartaDaVez(duelo.cena.turnos)?.tokenId === TOKEN_DO_ZE) return duelo
  return aceita(aplicarJogada(duelo, motor, CONTA_B, { tipo: 'passar', seq: duelo.seq, vez: vezDe(duelo) }), 'o Marinheiro passar a vez')
}

/** O que o golpe fez: o dano de cada alvo, o registro e os recursos das cópias (o histórico da ficha leva a hora). */
function oQueOGolpeFez(duelo: DueloGravado): unknown {
  return {
    alvos: (duelo.cena.turnos.golpes ?? []).flatMap((golpe) => golpe.alvos.map(({ tokenId, dano }) => ({ tokenId, dano }))),
    registro: duelo.cena.registro.map((linha) => linha.texto),
    recursos: duelo.lutadores.personagens.map((personagem) => ({ id: personagem.id, recursos: personagem.recursos })),
  }
}

describe('duelo', () => {
  it('dois robôs pelo duelo.ts com a semente 7 terminam igual à lutaAutomatica', () => {
    const { motor, sorteio } = motorDaSemente(7)
    const duelo = duelarComRobos(dueloDe([ZE, LIA_DA_CONTA], [MARINHEIRO_DA_CONTA], motor), motor)
    const lutadores = lutadoresDe([
      { ficha: ZE, lado: 'a' },
      { ficha: LIA_DA_CONTA, lado: 'a' },
      { ficha: MARINHEIRO_DA_CONTA, lado: 'b' },
    ])
    const automatica = lutaAutomatica({ sistema: SISTEMA_DO_TESTE, lutadores, semente: 7 })
    expect(automatica.fim.tipo).toBe('vitoria')
    expect(resumoDoDuelo(duelo, sorteio)).toEqual(automatica)
  })

  it('pedido com dano e custo forjados = mesmo resultado que dano e custo null', () => {
    const { motor } = motorDaSemente(7)
    const duelo = umContraUmNaVezDoZe(motor)
    // Corte Duplo: Força + 60 (o Zé tem 60) e 30 SP na ficha.
    const corte = (dano: number | null, custo: number | null): JogadaDoDuelo => ({
      tipo: 'agir',
      seq: duelo.seq,
      vez: vezDe(duelo),
      pedido: { tipo: 'habilidade', cartaoId: 'tec_corte', armaId: null, alvos: [{ tokenId: TOKEN_DO_MARINHEIRO, dano }], surpresa: false, perfurante: false, custo, acao: null },
    })
    const comNull = aceita(aplicarJogada(duelo, motor, CONTA_A, corte(null, null)), 'o Corte com dano null')
    const forjado = aceita(aplicarJogada(duelo, motor, CONTA_A, corte(DANO_MAX, 0)), 'o Corte forjado')
    expect(oQueOGolpeFez(forjado)).toEqual(oQueOGolpeFez(comNull))
    expect(oQueOGolpeFez(comNull)).toMatchObject({
      alvos: [{ tokenId: TOKEN_DO_MARINHEIRO, dano: 120 }],
      recursos: [{ id: 'treino_a1', recursos: { sp: 70 } }, { id: 'treino_b1' }],
    })
  })

  it('agir repetido com seq velho = recusado', () => {
    const { motor } = motorDaSemente(7)
    const duelo = umContraUmNaVezDoZe(motor)
    const ataque: PedidoDeAcao = { tipo: 'atacar', armaId: 'arma_espada', alvos: [{ tokenId: TOKEN_DO_MARINHEIRO, dano: null }], surpresa: false, perfurante: false }
    const jogada: JogadaDoDuelo = { tipo: 'agir', seq: duelo.seq, vez: vezDe(duelo), pedido: ataque }
    const primeira = aceita(aplicarJogada(duelo, motor, CONTA_A, jogada), 'o primeiro Atacar')
    expect(primeira.seq).toBe(duelo.seq + 1)
    expect(aplicarJogada(primeira, motor, CONTA_A, jogada)).toEqual({ ok: false, motivo: 'seqVelho' })
  })
})
