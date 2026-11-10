import type { BolhaAoVivo } from '../net/bolhaNoHost'
import type { HostBridge } from '../net/hostBridge'
import type { BolhaAoVivoProps, JogadorDaBolha } from './BolhaAoVivo'

/**
 * POR ONDE O PAINEL DO PINO CHAMA A BOLHA D'ÁGUA (irmão do `fogoNoPainel.ts`),
 * só pela ponte da SALA: a Visão de jogador (teste sozinho) ainda não a roda.
 */

/** Os comandos da bolha que o painel manda. */
export type PonteDaBolha = Pick<HostBridge, 'convidarParaBolha' | 'comecarBolha' | 'pausarBolha' | 'retomarBolha' | 'encerrarBolha'>

/** A bolha ao vivo como o painel do pino a recebe (`MinigameControls`); a dificuldade permitida vem do pino. */
export type BolhaNoPainel = Omit<BolhaAoVivoProps, 'pinId' | 'permitida'>

export interface SalaDaBolha {
  aberta: boolean
  players: readonly JogadorDaBolha[]
  /** A bolha da sala (`onBolhaChange`): uma por vez. */
  bolha: BolhaAoVivo | null
  /** Lida na hora de cada comando: a ponte pode ter fechado. */
  ponte: () => PonteDaBolha | null
}

/** `null` = sala fechada (o painel pede para abrir). Sem ponte na hora do comando: o convite volta `null` e o resto `false`. */
export function bolhaNoPainel(pinId: string, sala: SalaDaBolha): BolhaNoPainel | null {
  if (!sala.aberta) return null
  return {
    players: sala.players,
    bolha: sala.bolha,
    onConvidar: (playerIds, modo) => sala.ponte()?.convidarParaBolha(pinId, playerIds, modo) ?? null,
    onComecar: (dificuldade) => sala.ponte()?.comecarBolha(dificuldade) ?? false,
    onPausar: () => sala.ponte()?.pausarBolha() ?? false,
    onRetomar: () => sala.ponte()?.retomarBolha() ?? false,
    onEncerrar: () => sala.ponte()?.encerrarBolha() ?? false,
  }
}
