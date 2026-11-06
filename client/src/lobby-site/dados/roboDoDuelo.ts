import { chaveDaVez } from '../../lib/batalha/combate'
import type { RegrasDaBatalha } from '../../lib/batalha/regrasDoCampo'
import type { TurnosDaCena } from '../../lib/batalha/turnos'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { aplicarJogada, type DueloGravado, type JogadaDoDuelo, type JogadorDoDuelo, type MotorDoDuelo } from '../../lib/treino/duelo'
import type { LadoDoTreino, LutadoresDoTreino } from '../../lib/treino/mesaEmMemoria'
import { jogadaDoRobo, type JogadaDoRobo } from '../../lib/treino/robo'

/**
 * O ROBÔ NO DUELO (fatia T7): o robô do treino (`lib/treino/robo.ts`, T3)
 * jogando um lado de um duelo pela regra do duelo (`lib/treino/duelo.ts`,
 * T5), do mesmo jeito que o teste da T5 (`duelarComRobos`): a reação
 * esperando, ou os golpes do mais forte ao mais fraco até um ser aceito, e
 * senão passar a vez. Serve à luta de treino turno a turno (o inimigo, e o
 * "robô joga por mim") e ao colega inventado do duelo da demonstração.
 */

/** Os golpes que a carta da vez já deu (a mesma conta da `lutaAutomatica`): o teto do robô por vez. */
export interface GolpesDaVez {
  chave: string
  golpes: number
}

/** O que o robô lê de um duelo: o gravado (servidor, treino local) ou o do fio (site). */
export interface VistaDoDuelo {
  turnos: TurnosDaCena
  regras: RegrasDaBatalha | null
  lutadores: LutadoresDoTreino
  jogadores: Readonly<Record<LadoDoTreino, JogadorDoDuelo>>
}

/** A vista de um duelo gravado (o miolo está na cena). */
export function vistaDoGravado(duelo: DueloGravado): VistaDoDuelo {
  return { turnos: duelo.cena.turnos, regras: duelo.cena.regras, lutadores: duelo.lutadores, jogadores: duelo.jogadores }
}

/** O lado do token; `null` = token sem vaga. */
export function ladoDoToken(lutadores: LutadoresDoTreino, tokenId: string): LadoDoTreino | null {
  return lutadores.vagas.find((vaga) => vaga.tokenId === tokenId)?.lado ?? null
}

/** Quantos golpes a carta da vez já deu, pela chave da vez de agora. */
export function golpesNaVezDe(turnos: TurnosDaCena, golpesDaVez: GolpesDaVez | null): number {
  const chave = turnos.vez === null ? null : chaveDaVez(turnos.rodada, turnos.vez)
  return golpesDaVez !== null && golpesDaVez.chave === chave ? golpesDaVez.golpes : 0
}

/** A próxima jogada do robô e o lado de quem a faria; `null` = ninguém tem jogada (a luta não começou ou acabou). */
export function proximaDoRobo(vista: VistaDoDuelo, sistema: SistemaDeRpg, golpesDaVez: GolpesDaVez | null): { lado: LadoDoTreino; jogada: JogadaDoRobo } | null {
  const { turnos, regras, lutadores } = vista
  const jogada = jogadaDoRobo({ turnos, regras, vagas: lutadores.vagas, personagens: lutadores.personagens, sistema, golpesNaVez: golpesNaVezDe(turnos, golpesDaVez) })
  if (jogada === null) return null
  const lado = ladoDoToken(lutadores, jogada.tipo === 'reagir' ? jogada.pedido.tokenId : jogada.tokenId)
  return lado === null ? null : { lado, jogada }
}

/** As jogadas do duelo para a jogada do robô, na ordem de tentar: a reação; ou cada golpe e, no fim, passar a vez. */
export function candidatasDoRobo(jogada: JogadaDoRobo, seq: number): JogadaDoDuelo[] {
  if (jogada.tipo === 'reagir') return [{ tipo: 'reagir', seq, pedido: jogada.pedido }]
  return [...jogada.golpes.map((pedido): JogadaDoDuelo => ({ tipo: 'agir', seq, vez: jogada.esperado, pedido })), { tipo: 'passar', seq, vez: jogada.esperado }]
}

export interface PassoDoRobo {
  duelo: DueloGravado
  golpesDaVez: GolpesDaVez | null
}

/**
 * Um passo do robô pelo lado `lado` num duelo gravado: aplica a primeira
 * candidata aceita. `null` = a jogada esperada não é desse lado, ou nenhuma
 * candidata passou (não deveria: passar a vez na vez dele sempre passa).
 */
export function passoDoRobo(duelo: DueloGravado, motor: MotorDoDuelo, golpesDaVez: GolpesDaVez | null, podeJogar: (lado: LadoDoTreino) => boolean): PassoDoRobo | null {
  if (duelo.fim !== null) return null
  const proxima = proximaDoRobo(vistaDoGravado(duelo), motor.sistema, golpesDaVez)
  if (proxima === null || !podeJogar(proxima.lado)) return null
  const contaId = duelo.jogadores[proxima.lado].contaId
  for (const jogada of candidatasDoRobo(proxima.jogada, duelo.seq)) {
    const feito = aplicarJogada(duelo, motor, contaId, jogada)
    if (!feito.ok) continue
    const deu = jogada.tipo === 'agir' && jogada.vez !== null ? { chave: chaveDaVez(jogada.vez.rodada, jogada.vez.cartaId), golpes: golpesNaVezDe(duelo.cena.turnos, golpesDaVez) + 1 } : golpesDaVez
    return { duelo: feito.duelo, golpesDaVez: deu }
  }
  return null
}
