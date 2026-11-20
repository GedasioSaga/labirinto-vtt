import type { HostBridge } from '../net/hostBridge'
import type { AlavancaAoVivo } from '../net/alavancaNoHost'
import type { AlavancaAoVivoProps, JogadorDaAlavanca } from './AlavancaAoVivo'

/**
 * POR ONDE O PAINEL DO DESAFIO CHAMA A ALAVANCA DA PONTE (irmão do
 * `bolhaNoPainel.ts`): a ponte da SALA. Sem sala, o painel pede para abrir.
 */

/** Os comandos da alavanca que o painel manda. */
export type PonteDaAlavanca = Pick<HostBridge, 'convidarParaAlavanca' | 'comecarAlavanca' | 'pausarAlavanca' | 'retomarAlavanca' | 'encerrarAlavanca' | 'vivoDaAlavanca'>

/** A alavanca ao vivo como o painel do desafio a recebe (`MinigameControls`). */
export type AlavancaNoPainel = Omit<AlavancaAoVivoProps, 'pinId'>

export interface SalaDaAlavanca {
  aberta: boolean
  players: readonly JogadorDaAlavanca[]
  alavanca: AlavancaAoVivo | null
  /** Lida na hora de cada comando: a ponte pode ter fechado. */
  ponte: () => PonteDaAlavanca | null
}

/** A alavanca ao vivo do painel do desafio `pinId`. `null` = sala fechada (o painel pede para abrir). */
export function alavancaNoPainel(pinId: string, sala: SalaDaAlavanca): AlavancaNoPainel | null {
  if (!sala.aberta) return null
  return {
    players: sala.players,
    alavanca: sala.alavanca,
    lerVivo: () => sala.ponte()?.vivoDaAlavanca() ?? null,
    onConvidar: (playerIds) => sala.ponte()?.convidarParaAlavanca(pinId, playerIds) ?? null,
    onComecar: () => sala.ponte()?.comecarAlavanca() ?? false,
    onPausar: () => sala.ponte()?.pausarAlavanca() ?? false,
    onRetomar: () => sala.ponte()?.retomarAlavanca() ?? false,
    onEncerrar: () => sala.ponte()?.encerrarAlavanca() ?? false,
  }
}
