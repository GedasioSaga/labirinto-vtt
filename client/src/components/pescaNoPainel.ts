import type { HostBridge } from '../net/hostBridge'
import type { PescaAoVivo } from '../net/pescaNoHost'
import type { JogadorDaPesca, PescaAoVivoProps } from './PescaAoVivo'

/**
 * POR ONDE O PAINEL DO PINO CHAMA A PESCA (irmão do `dancaNoPainel.ts`).
 * Por enquanto só a ponte da SALA de verdade.
 *
 * PONTO DE ENCAIXE DA VISÃO DE JOGADOR (fase 5 do plano da pesca): quando a
 * ponte de teste ganhar a pesca, `pescaNoPainel` recebe um `TesteDaPesca`
 * ({ estado, ponte }) ANTES da sala e, com o teste aberto, devolve
 * `pescaPela(pinId, { players: jogadores do teste com o PREFIXO_DO_TESTE,
 * pescas: estado.pesca, ponte: teste.ponte })` — como `dancaNoPainel` faz.
 * O resto (o painel, os comandos) não muda.
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

/** A pesca ao vivo do painel do pino `pinId`; `null` = sala fechada (o painel pede para abrir). */
export function pescaNoPainel(pinId: string, sala: SalaDaPesca): PescaNoPainel | null {
  return sala.aberta ? pescaPela(pinId, sala) : null
}
