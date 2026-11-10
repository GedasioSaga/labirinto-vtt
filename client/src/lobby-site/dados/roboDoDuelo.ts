import { chaveDaVez } from '../../lib/batalha/combate'
import type { RegrasDaBatalha } from '../../lib/batalha/regrasDoCampo'
import type { TurnosDaCena } from '../../lib/batalha/turnos'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { aplicarJogada, type DueloGravado, type JogadaDoDuelo, type JogadorDoDuelo, type MotorDoDuelo } from '../../lib/treino/duelo'
import type { LadoDoTreino, LutadoresDoTreino } from '../../lib/treino/mesaEmMemoria'
import { jogadaDoRobo, marcaDoRobo, passivasDoRobo, type JogadaDoRobo } from '../../lib/treino/robo'

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

/** A ficha `tokenId` é de um lado que o robô joga? */
function tokenDoRobo(duelo: DueloGravado, podeJogar: (lado: LadoDoTreino) => boolean): (tokenId: string) => boolean {
  return (tokenId) => {
    const lado = ladoDoToken(duelo.lutadores, tokenId)
    return lado !== null && podeJogar(lado)
  }
}

/**
 * R2 e R4 da unificação do combate (10/11/2026): a passiva de uma ficha do
 * robô (`passivasDoRobo`: o lembrete que espera resposta, ou a passiva pronta
 * de quem está na vez), pela jogada `passiva`. Tenta na ordem e fica com a
 * primeira aceita; `null` = nada a fazer (ou tudo recusado: a luta segue).
 */
function passivaPeloRobo(duelo: DueloGravado, motor: MotorDoDuelo, podeJogar: (lado: LadoDoTreino) => boolean): DueloGravado | null {
  const { vagas, personagens } = duelo.lutadores
  for (const pedido of passivasDoRobo({ turnos: duelo.cena.turnos, vagas, personagens, sistema: motor.sistema }, tokenDoRobo(duelo, podeJogar))) {
    const lado = ladoDoToken(duelo.lutadores, pedido.tokenId)
    if (lado === null) continue
    const feito = aplicarJogada(duelo, motor, duelo.jogadores[lado].contaId, { tipo: 'passiva', seq: duelo.seq, pedido })
    if (feito.ok) return feito.duelo
  }
  return null
}

/**
 * O lembrete da marca de uma ficha do robô respondido (`marcaDoRobo`: o teste,
 * o SP ou "Agora não"); `null` = nenhum esperando. Vem antes da reação e da
 * vez: o lembrete não segura a luta, mas o segundo golpe da vez já dobra.
 */
function marcaPeloRobo(duelo: DueloGravado, motor: MotorDoDuelo, podeJogar: (lado: LadoDoTreino) => boolean): DueloGravado | null {
  const marca = marcaDoRobo(duelo.cena.turnos, tokenDoRobo(duelo, podeJogar))
  const lado = marca === null ? null : ladoDoToken(duelo.lutadores, marca.tokenId)
  if (marca === null || lado === null) return null
  for (const pedido of marca.pedidos) {
    const feito = aplicarJogada(duelo, motor, duelo.jogadores[lado].contaId, { tipo: 'marcar', seq: duelo.seq, pedido })
    if (feito.ok) return feito.duelo
  }
  return null
}

/**
 * Um passo do robô pelo lado `lado` num duelo gravado: o lembrete da marca
 * dele, se houver; senão aplica a primeira candidata aceita. `null` = a jogada esperada não é desse lado, ou nenhuma
 * candidata passou (não deveria: passar a vez na vez dele sempre passa).
 */
export function passoDoRobo(duelo: DueloGravado, motor: MotorDoDuelo, golpesDaVez: GolpesDaVez | null, podeJogar: (lado: LadoDoTreino) => boolean): PassoDoRobo | null {
  if (duelo.fim !== null) return null
  const marcou = marcaPeloRobo(duelo, motor, podeJogar)
  if (marcou !== null) return { duelo: marcou, golpesDaVez }
  const ligou = passivaPeloRobo(duelo, motor, podeJogar)
  if (ligou !== null) return { duelo: ligou, golpesDaVez }
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
