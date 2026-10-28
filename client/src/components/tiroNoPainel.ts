import type { HostBridge } from '../net/hostBridge'
import type { TiroAoVivo } from '../net/tiroNoHost'
import type { EstadoDaVisao } from '../net/visaoDeTeste/visaoDeTeste'
import { PREFIXO_DO_TESTE } from './dancaNoPainel'
import type { JogadorDoTiro, TiroAoVivoProps } from './TiroAoVivo'

/**
 * POR ONDE O PAINEL DO PINO CHAMA A BARRACA DE TIRO (irmão do
 * `pescaNoPainel.ts`): a ponte de TESTE quando a Visão de jogador está
 * aberta, senão a da SALA.
 */

/** Os comandos do tiro que o painel manda. */
export type PonteDoTiro = Pick<HostBridge, 'convidarParaTiro' | 'pausarTiro' | 'retomarTiro' | 'encerrarTiro' | 'reabrirTiro'>

/** O tiro ao vivo como o painel do pino o recebe (`MinigameControls`); a entrada vem do pino. */
export type TiroNoPainel = Omit<TiroAoVivoProps, 'pinId' | 'entrada'>

interface FonteDoTiro {
  players: readonly JogadorDoTiro[]
  /** Cada pino com barraca de tiro (`onTiroChange`). */
  tiros: readonly TiroAoVivo[]
  /** Lida na hora de cada comando: a ponte pode ter fechado. */
  ponte: () => PonteDoTiro | null
}

export interface SalaDoTiro extends FonteDoTiro {
  aberta: boolean
}

/** Sem ponte agora (sala fechada), o convite volta `null` e o resto `false`: o painel diz que não deu. */
function tiroPela(pinId: string, fonte: FonteDoTiro): TiroNoPainel {
  return {
    players: fonte.players,
    tiro: fonte.tiros.find((t) => t.pinId === pinId) ?? null,
    onConvidar: (playerIds) => fonte.ponte()?.convidarParaTiro(pinId, playerIds) ?? null,
    onPausar: () => fonte.ponte()?.pausarTiro(pinId) ?? false,
    onRetomar: () => fonte.ponte()?.retomarTiro(pinId) ?? false,
    onEncerrar: () => fonte.ponte()?.encerrarTiro(pinId) ?? false,
    onReabrir: () => fonte.ponte()?.reabrirTiro(pinId) ?? false,
  }
}

/** A VISÃO DE JOGADOR: o estado do teste e a ponte DELE (outra a cada geração). */
export interface TesteDoTiro {
  estado: EstadoDaVisao
  ponte: () => PonteDoTiro | null
}

/**
 * A barraca ao vivo do painel do pino `pinId`. Com a Visão de jogador
 * aberta, a do TESTE (mesmo com a sala aberta ao lado), com o mesmo prefixo
 * da dança e da pesca. `null` = sala fechada e sem teste (o painel pede para
 * abrir).
 */
export function tiroNoPainel(pinId: string, teste: TesteDoTiro, sala: SalaDoTiro): TiroNoPainel | null {
  if (teste.estado.aberta) {
    const players = teste.estado.jogadores.map(({ playerId, name }) => ({ playerId, name: `${PREFIXO_DO_TESTE}${name}` }))
    return tiroPela(pinId, { players, tiros: teste.estado.tiro, ponte: teste.ponte })
  }
  return sala.aberta ? tiroPela(pinId, sala) : null
}
