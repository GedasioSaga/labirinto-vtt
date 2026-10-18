import type { HostBridge } from '../net/hostBridge'
import type { PescaAoVivo } from '../net/pescaNoHost'
import type { EstadoDaVisao } from '../net/visaoDeTeste/visaoDeTeste'
import { PREFIXO_DO_TESTE } from './dancaNoPainel'
import type { JogadorDaPesca, PescaAoVivoProps } from './PescaAoVivo'

/**
 * POR ONDE O PAINEL DO PINO CHAMA A PESCA (irmão do `dancaNoPainel.ts`): a
 * ponte de TESTE quando a Visão de jogador está aberta, senão a da SALA.
 */

/** Os comandos da pesca que o painel manda (a ponte da sala; a de teste terá os mesmos). */
export type PonteDaPesca = Pick<HostBridge, 'convidarParaPesca' | 'pausarPesca' | 'retomarPesca' | 'encerrarPesca'>

/** A pesca ao vivo como o painel do pino a recebe (`MinigameControls`); a entrada vem do pino. */
export type PescaNoPainel = Omit<PescaAoVivoProps, 'pinId' | 'entrada'>

interface FonteDaPesca {
  players: readonly JogadorDaPesca[]
  /** Cada pino com pesca (`onPescaChange`). */
  pescas: readonly PescaAoVivo[]
  /** Lida na hora de cada comando: a ponte pode ter fechado. */
  ponte: () => PonteDaPesca | null
}

export interface SalaDaPesca extends FonteDaPesca {
  aberta: boolean
}

/** Sem ponte agora (sala fechada), o convite volta `null` e o resto `false`: o painel diz que não deu. */
function pescaPela(pinId: string, fonte: FonteDaPesca): PescaNoPainel {
  return {
    players: fonte.players,
    pesca: fonte.pescas.find((p) => p.pinId === pinId) ?? null,
    onConvidar: (playerIds) => fonte.ponte()?.convidarParaPesca(pinId, playerIds) ?? null,
    onPausar: () => fonte.ponte()?.pausarPesca(pinId) ?? false,
    onRetomar: () => fonte.ponte()?.retomarPesca(pinId) ?? false,
    onEncerrar: () => fonte.ponte()?.encerrarPesca(pinId) ?? false,
  }
}

/** A VISÃO DE JOGADOR: o estado do teste e a ponte DELE (outra a cada geração). */
export interface TesteDaPesca {
  estado: EstadoDaVisao
  ponte: () => PonteDaPesca | null
}

/**
 * A pesca ao vivo do painel do pino `pinId`. Com a Visão de jogador aberta, a
 * do TESTE (mesmo com a sala aberta ao lado): quem o painel chama é o jogador
 * de teste, com o mesmo prefixo da dança. `null` = sala fechada e sem teste
 * (o painel pede para abrir).
 */
export function pescaNoPainel(pinId: string, teste: TesteDaPesca, sala: SalaDaPesca): PescaNoPainel | null {
  if (teste.estado.aberta) {
    const players = teste.estado.jogadores.map(({ playerId, name }) => ({ playerId, name: `${PREFIXO_DO_TESTE}${name}` }))
    return pescaPela(pinId, { players, pescas: teste.estado.pesca, ponte: teste.ponte })
  }
  return sala.aberta ? pescaPela(pinId, sala) : null
}
