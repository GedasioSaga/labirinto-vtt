import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida, vidaDoPersonagem } from '../vidaDaFicha'
import type { LadoDaLuta, LadoDoTreino, LutadoresDaLuta, MesaDaLuta } from './mesaEmMemoria'

/**
 * O FIM DA LUTA DE TREINO (LOBBY v2, fatia T2 de
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): depois de cada passo, a
 * luta acabou? Quatro jeitos de acabar:
 *  - vitória de um lado: o outro não tem ninguém de pé;
 *  - todos caídos: os dois lados ficaram sem ninguém de pé no mesmo passo
 *    (empate);
 *  - tempo: passou do teto de rodadas ou de passos sem ninguém vencer (o
 *    empate por tempo; o teto é quem chama que dá, e é ele que garante que a
 *    luta automática sempre para).
 * Cair vale antes do tempo: o golpe que derruba o último no passo do teto é
 * vitória, não tempo. Relógio torto (rodada ou passos que não são inteiro de
 * 0 em diante, como NaN) também é tempo: com ele as comparações com o teto
 * dariam sempre falso e a luta nunca pararia.
 *
 * Caído = a vida da cópia em 0, pela mesma leitura da barra e do "Passar a
 * vez" (`recursoDeVida` + `vidaDoPersonagem`, como `tokensCaidos` em
 * `lib/batalha/turnos.ts`). Cópia sem vida legível (sistema sem recurso de
 * vida, máximo abaixo de 1) nunca cai: na dúvida ela luta, e a luta acaba por
 * tempo. Cópia que sumiu da mesa não luta: conta como fora; a vaga que saiu
 * da luta (`fora`, a conta sumiu na luta v4) também.
 *
 * N LADOS (Arena multijogador, fatia F2): vence o único lado com alguém de
 * pé; ninguém de pé = todos caídos; o tempo pelos mesmos tetos. Com 2 lados
 * é a mesma conta de sempre.
 *
 * Puro: sem store.
 */

/** Os tetos da luta. Inteiros de 1 em diante. */
export interface TetosDaLuta {
  /** A última rodada que ainda se joga: a rodada seguinte já é tempo. */
  rodadas: number
  /** Quantos passos a luta dá no máximo: com esse tanto dado, é tempo. */
  passos: number
}

/** Onde a luta está: a rodada da ordem (`TurnosDaCena.rodada`) e os passos dados até agora. */
export interface RelogioDaLuta {
  rodada: number
  passos: number
}

export type FimDaLuta<L extends LadoDaLuta = LadoDoTreino> =
  | { tipo: 'vitoria'; vencedor: L }
  | { tipo: 'todosCaidos' }
  | { tipo: 'tempo'; teto: 'rodadas' | 'passos' }

/** O que o fim lê da mesa: as vagas, as cópias de agora e o sistema. */
export type MesaParaOFim<L extends LadoDaLuta = LadoDoTreino> = Pick<MesaDaLuta<L>, 'vagas' | 'personagens' | 'sistema'>

/** A leitura do fim sobre os lutadores guardados (o estado do duelo e da luta v4), sem montar a mesa inteira. */
export function mesaDosLutadores<L extends LadoDaLuta>(sistema: SistemaDeRpg | null, lutadores: LutadoresDaLuta<L>): MesaParaOFim<L> {
  return { vagas: () => lutadores.vagas, personagens: () => lutadores.personagens, sistema: () => sistema }
}

function tetoValido(valor: number): boolean {
  return Number.isSafeInteger(valor) && valor >= 1
}

/** A rodada ou os passos do relógio: inteiro de 0 em diante. */
function contagemValida(valor: number): boolean {
  return Number.isSafeInteger(valor) && valor >= 0
}

/** Quantas cópias de cada lado que tem vaga estão de pé agora, na ordem das vagas. */
export function dePeNosLados<L extends LadoDaLuta>(mesa: MesaParaOFim<L>): Map<L, number> {
  const recurso = recursoDeVida(mesa.sistema())
  const porId = new Map(mesa.personagens().map((personagem) => [personagem.id, personagem]))
  const dePe = new Map<L, number>()
  for (const vaga of mesa.vagas()) {
    const antes = dePe.get(vaga.lado) ?? 0
    dePe.set(vaga.lado, antes)
    const copia = porId.get(vaga.personagemId)
    if (copia === undefined || vaga.fora === true) continue
    const vida = recurso === null ? null : vidaDoPersonagem(copia, recurso)
    if (vida === null || vida.atual > 0) dePe.set(vaga.lado, antes + 1)
  }
  return dePe
}

/** Quantas cópias de cada lado estão de pé agora (o treino e o duelo: os dois lados, 0 no lado sem vaga). */
export function dePePorLado(mesa: MesaParaOFim): Record<LadoDoTreino, number> {
  const dePe = dePeNosLados(mesa)
  return { a: dePe.get('a') ?? 0, b: dePe.get('b') ?? 0 }
}

/**
 * Como a luta acabou, ou `null` se ela continua. Teto que não é inteiro de 1
 * em diante = `RangeError`: com ele a luta automática nunca pararia. Relógio
 * torto = tempo (no teto do campo torto), não erro: o teto vem de quem chama e
 * é conferido antes da luta; o relógio é o estado da luta em curso (no duelo,
 * gravado no servidor), e o erro travaria cada jogada sem nunca acabar a luta.
 */
export function fimDaLuta<L extends LadoDaLuta = LadoDoTreino>(mesa: MesaParaOFim<L>, relogio: RelogioDaLuta, tetos: TetosDaLuta): FimDaLuta<L> | null {
  if (!tetoValido(tetos.rodadas) || !tetoValido(tetos.passos)) throw new RangeError(`tetos da luta inválidos: ${tetos.rodadas} rodadas, ${tetos.passos} passos`)
  const ladosDePe = [...dePeNosLados(mesa)].filter(([, quantos]) => quantos > 0).map(([lado]) => lado)
  const [unico] = ladosDePe
  if (unico === undefined) return { tipo: 'todosCaidos' }
  if (ladosDePe.length === 1) return { tipo: 'vitoria', vencedor: unico }
  if (!contagemValida(relogio.rodada) || relogio.rodada > tetos.rodadas) return { tipo: 'tempo', teto: 'rodadas' }
  if (!contagemValida(relogio.passos) || relogio.passos >= tetos.passos) return { tipo: 'tempo', teto: 'passos' }
  return null
}
