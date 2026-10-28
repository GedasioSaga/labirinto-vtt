import type { DificuldadeTiro } from '../minigames/tiro/tipos'
import type {
  TiroConviteMessage,
  TiroEstadoMessage,
  TiroHostMessage,
  TiroMotivoDaRecusa,
  TiroMotivoDoFim,
} from '../net/protocoloDoTiro'

/**
 * MINIGAME DE TIRO no cliente do jogador: o que chegou do mestre e o que este
 * jogador pediu, como estado puro (o caminho de `estadoDaPesca.ts`). A tela
 * desenha em cima disto; a conexão só guarda o resultado em
 * `PlayerState.tiro` e manda o que o jogador faz. As tentativas são as que o
 * host contou: chegam no convite e em cada `tiro.inicio`.
 */

export interface RodadaDoJogador {
  n: number
  dificuldade: DificuldadeTiro
  semente: string
}

export interface TiroDoJogador {
  sessao: string
  convite: Omit<TiroConviteMessage, 'type'>
  /** Quantos convites chegaram nesta tela: um convite novo (aba nova, reabertura) volta a barraca ao convite. */
  convites: number
  /** O último `tiro.estado`: a fase e o status de cada um. */
  estado?: Omit<TiroEstadoMessage, 'type' | 'sessao'>
  /** Tentativas usadas, contadas pelo host (a rodada de agora conta). */
  usadas: number
  /** O Pronto saiu com esta dificuldade e o início ainda não chegou. */
  pedindo?: DificuldadeTiro
  /** A rodada que o host liberou e ainda não acabou. */
  rodada?: RodadaDoJogador
  /** Pausa do mestre. `pausaMudouEm`: `performance.now()` da última pausa ou retomada. */
  pausada: boolean
  pausaMudouEm?: number
  encerrada?: TiroMotivoDoFim
}

/** O que o host manda DENTRO de uma sessão (a recusa vem antes de haver uma). */
export type TiroDaSessaoMessage = Exclude<TiroHostMessage, { type: 'tiro.recusado' }>

/** Quanto o aviso da recusa fica na tela. */
export const TIRO_RECUSA_AVISO_MS = 4000

/** O aviso curto quando o host não deixou entrar na barraca (o cartão já fechou). */
export function textoDaRecusaDoTiro(motivo: TiroMotivoDaRecusa): string {
  switch (motivo) {
    case 'longe':
      return 'Chegue mais perto do pino para atirar.'
    case 'ocupado':
      return 'Você já está noutra barraca de tiro.'
    case 'indisponivel':
      return 'Não dá para atirar aí agora.'
  }
}

/**
 * A mensagem do tiro aplicada ao estado. Convite de sessão nova recomeça do
 * zero; o convite da mesma sessão (a volta da conexão) troca as tentativas e
 * fecha a rodada que estava na tela (o host já a deu por perdida). O resto só
 * vale para a sessão que está na tela.
 */
export function receberTiro(atual: TiroDoJogador | undefined, msg: TiroDaSessaoMessage, agora: number): TiroDoJogador | undefined {
  if (msg.type === 'tiro.convite') {
    const { type: _type, ...convite } = msg
    const convites = (atual?.convites ?? 0) + 1
    if (atual !== undefined && atual.sessao === msg.sessao) return { ...atual, convite, convites, usadas: msg.usadas, pedindo: undefined, rodada: undefined }
    return { sessao: msg.sessao, convite, convites, usadas: msg.usadas, pausada: false }
  }
  if (atual === undefined || atual.sessao !== msg.sessao) return atual
  switch (msg.type) {
    case 'tiro.estado':
      return { ...atual, estado: { fase: msg.fase, participantes: msg.participantes } }
    case 'tiro.inicio':
      if (atual.encerrada !== undefined) return atual
      return { ...atual, usadas: msg.rodada, pedindo: undefined, rodada: { n: msg.rodada, dificuldade: msg.dificuldade, semente: msg.semente } }
    case 'tiro.pausa':
    case 'tiro.retoma': {
      const pausada = msg.type === 'tiro.pausa'
      if (atual.pausada === pausada) return atual
      return { ...atual, pausada, pausaMudouEm: agora }
    }
    case 'tiro.encerra':
      return { ...atual, encerrada: msg.motivo, pedindo: undefined, rodada: undefined }
  }
}

/** Ainda dá para pedir uma rodada: barraca aberta, sem rodada nem pedido, com tentativa sobrando. */
export function tiroAceitaPronto(tiro: TiroDoJogador | undefined): tiro is TiroDoJogador {
  return tiro !== undefined && tiro.encerrada === undefined && !tiro.pausada && tiro.pedindo === undefined && tiro.rodada === undefined && tiro.usadas < tiro.convite.tentativas
}

/** Numa rodada: o início chegou e nada encerrou — vivo e o fim podem sair. */
export function tiroAtirando(tiro: TiroDoJogador | undefined): tiro is TiroDoJogador & { rodada: RodadaDoJogador } {
  return tiro !== undefined && tiro.rodada !== undefined && tiro.encerrada === undefined
}
