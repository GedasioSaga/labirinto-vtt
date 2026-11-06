import { recursoDeVida, vidaDoPersonagem } from '../vidaDaFicha'
import type { LadoDoTreino, MesaEmMemoria } from './mesaEmMemoria'

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
 * vitória, não tempo.
 *
 * Caído = a vida da cópia em 0, pela mesma leitura da barra e do "Passar a
 * vez" (`recursoDeVida` + `vidaDoPersonagem`, como `tokensCaidos` em
 * `lib/batalha/turnos.ts`). Cópia sem vida legível (sistema sem recurso de
 * vida, máximo abaixo de 1) nunca cai: na dúvida ela luta, e a luta acaba por
 * tempo. Cópia que sumiu da mesa não luta: conta como fora.
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

export type FimDaLuta =
  | { tipo: 'vitoria'; vencedor: LadoDoTreino }
  | { tipo: 'todosCaidos' }
  | { tipo: 'tempo'; teto: 'rodadas' | 'passos' }

/** O que o fim lê da mesa: as vagas, as cópias de agora e o sistema. */
export type MesaParaOFim = Pick<MesaEmMemoria, 'vagas' | 'personagens' | 'sistema'>

function tetoValido(valor: number): boolean {
  return Number.isSafeInteger(valor) && valor >= 1
}

/** Quantas cópias de cada lado estão de pé agora. */
export function dePePorLado(mesa: MesaParaOFim): Record<LadoDoTreino, number> {
  const recurso = recursoDeVida(mesa.sistema())
  const porId = new Map(mesa.personagens().map((personagem) => [personagem.id, personagem]))
  const dePe: Record<LadoDoTreino, number> = { a: 0, b: 0 }
  for (const vaga of mesa.vagas()) {
    const copia = porId.get(vaga.personagemId)
    if (copia === undefined) continue
    const vida = recurso === null ? null : vidaDoPersonagem(copia, recurso)
    if (vida === null || vida.atual > 0) dePe[vaga.lado] += 1
  }
  return dePe
}

/**
 * Como a luta acabou, ou `null` se ela continua. Teto que não é inteiro de 1
 * em diante = `RangeError`: com ele a luta automática nunca pararia.
 */
export function fimDaLuta(mesa: MesaParaOFim, relogio: RelogioDaLuta, tetos: TetosDaLuta): FimDaLuta | null {
  if (!tetoValido(tetos.rodadas) || !tetoValido(tetos.passos)) throw new RangeError(`tetos da luta inválidos: ${tetos.rodadas} rodadas, ${tetos.passos} passos`)
  const { a, b } = dePePorLado(mesa)
  if (a === 0 && b === 0) return { tipo: 'todosCaidos' }
  if (b === 0) return { tipo: 'vitoria', vencedor: 'a' }
  if (a === 0) return { tipo: 'vitoria', vencedor: 'b' }
  if (relogio.rodada > tetos.rodadas) return { tipo: 'tempo', teto: 'rodadas' }
  if (relogio.passos >= tetos.passos) return { tipo: 'tempo', teto: 'passos' }
  return null
}
