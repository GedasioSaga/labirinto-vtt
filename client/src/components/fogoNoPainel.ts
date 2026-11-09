import type { FogoAoVivo } from '../net/fogoNoHost'
import type { HostBridge } from '../net/hostBridge'
import type { FogoAoVivoProps, JogadorDoFogo } from './FogoAoVivo'

/**
 * POR ONDE O PAINEL DO PINO CHAMA O FOGO NA FLORESTA (irmão do
 * `tiroNoPainel.ts`), só pela ponte da SALA: o jogo é de equipe ao vivo e a
 * Visão de jogador (teste sozinho) ainda não o roda.
 */

/** Os comandos do fogo que o painel manda. */
export type PonteDoFogo = Pick<HostBridge, 'convidarParaFogo' | 'mudarFerramentaNoFogo' | 'comecarFogo' | 'pausarFogo' | 'retomarFogo' | 'encerrarFogo'>

/** O fogo ao vivo como o painel do pino o recebe (`MinigameControls`); a dificuldade permitida vem do pino. */
export type FogoNoPainel = Omit<FogoAoVivoProps, 'pinId' | 'permitida'>

export interface SalaDoFogo {
  aberta: boolean
  players: readonly JogadorDoFogo[]
  /** O fogo da sala (`onFogoChange`): um por vez. */
  fogo: FogoAoVivo | null
  /** Lida na hora de cada comando: a ponte pode ter fechado. */
  ponte: () => PonteDoFogo | null
}

/** `null` = sala fechada (o painel pede para abrir). Sem ponte na hora do comando: o convite volta `null` e o resto `false`. */
export function fogoNoPainel(pinId: string, sala: SalaDoFogo): FogoNoPainel | null {
  if (!sala.aberta) return null
  return {
    players: sala.players,
    fogo: sala.fogo,
    onConvidar: (convidados, modo) => sala.ponte()?.convidarParaFogo(pinId, convidados, modo) ?? null,
    onMudarFerramenta: (playerId, ferramenta) => sala.ponte()?.mudarFerramentaNoFogo(playerId, ferramenta) ?? false,
    onComecar: (dificuldade) => sala.ponte()?.comecarFogo(dificuldade) ?? false,
    onPausar: () => sala.ponte()?.pausarFogo() ?? false,
    onRetomar: () => sala.ponte()?.retomarFogo() ?? false,
    onEncerrar: () => sala.ponte()?.encerrarFogo() ?? false,
  }
}
