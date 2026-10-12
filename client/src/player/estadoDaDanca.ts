import type { DificuldadeDanca } from '../minigames/danca/tipos'
import type {
  DancaComecarMessage,
  DancaConviteMessage,
  DancaDesfechoMessage,
  DancaEstadoMessage,
  DancaEvento,
  DancaHostMessage,
  DancaMotivoDoFim,
  DancaPlacarAoVivo,
} from '../net/protocoloDaDanca'

/**
 * MINIGAME DE DANÇA no cliente do jogador: o que chegou do mestre, como
 * estado puro. A tela (fase seguinte) desenha em cima disto; a conexão só
 * guarda o resultado em `PlayerState.danca` e manda o que o jogador faz.
 */

/** Um lote de toques de um colega. `seq` cresce sempre: a tela anda o que ainda não desenhou. */
export interface DancaLoteDoColega {
  seq: number
  playerId: string
  eventos: DancaEvento[]
  placar: DancaPlacarAoVivo
}

/** Quantos lotes de colegas ficam na fila: 16 colegas × 4 lotes por segundo, com folga para um quadro perdido. */
export const DANCA_FILA_DE_COLEGAS_MAX = 64

export interface DancaDoJogador {
  sessao: string
  convite: Omit<DancaConviteMessage, 'type'>
  /** O último `danca.estado`: a fase e o status de cada um. Ausente = ainda nenhum (todos convidados). */
  estado?: Omit<DancaEstadoMessage, 'type' | 'sessao'>
  /** A dificuldade que ESTE jogador mandou no Pronto. Fica na volta da conexão com a mesma sessão. */
  pronto?: DificuldadeDanca
  /**
   * O "começar": a música toca em `recebidoEm + emMs` (`performance.now()` da
   * chegada), em cada aparelho — todos juntos sem relógio comum.
   */
  comecar?: Omit<DancaComecarMessage, 'type' | 'sessao'> & { recebidoEm: number }
  /** Pausa do mestre. `pausaMudouEm`: `performance.now()` da última pausa ou retomada (a retomada conta 3-2-1 dali). */
  pausada: boolean
  pausaMudouEm?: number
  colegas: DancaLoteDoColega[]
  /** O último placar de cada colega, por `playerId`. */
  placares: Record<string, DancaPlacarAoVivo>
  /** O `danca.fim` deste jogador já saiu: nenhum lote depois dele. */
  fimEnviado: boolean
  encerrada?: DancaMotivoDoFim
  desfecho?: Omit<DancaDesfechoMessage, 'type' | 'sessao'>
}

/**
 * A mensagem da dança aplicada ao estado. Convite de sessão nova recomeça do
 * zero; o mesmo convite de novo (a volta da conexão) guarda o Pronto. O resto
 * só vale para a sessão que está na tela — de outra, é atrasada e cai.
 */
export function receberDanca(atual: DancaDoJogador | undefined, msg: DancaHostMessage, agora: number): DancaDoJogador | undefined {
  if (msg.type === 'danca.convite') {
    const { type: _type, ...convite } = msg
    if (atual !== undefined && atual.sessao === msg.sessao) return { ...atual, convite }
    return { sessao: msg.sessao, convite, pausada: false, colegas: [], placares: {}, fimEnviado: false }
  }
  if (atual === undefined || atual.sessao !== msg.sessao) return atual
  switch (msg.type) {
    case 'danca.estado':
      return { ...atual, estado: { fase: msg.fase, participantes: msg.participantes } }
    case 'danca.comecar':
      // Repetido não reinicia a contagem: a música deste aparelho já está marcada.
      if (atual.comecar !== undefined) return atual
      return { ...atual, comecar: { emMs: msg.emMs, participantes: msg.participantes, recebidoEm: agora } }
    case 'danca.pausa':
    case 'danca.retoma': {
      const pausada = msg.type === 'danca.pausa'
      if (atual.comecar === undefined || atual.pausada === pausada) return atual
      return { ...atual, pausada, pausaMudouEm: agora }
    }
    case 'danca.encerra':
      return { ...atual, encerrada: msg.motivo }
    case 'danca.colegas': {
      if (atual.comecar === undefined) return atual
      const seq = (atual.colegas.at(-1)?.seq ?? 0) + 1 // fila vazia: o primeiro lote é o 1
      const lote: DancaLoteDoColega = { seq, playerId: msg.playerId, eventos: msg.eventos, placar: msg.placar }
      return { ...atual, colegas: [...atual.colegas, lote].slice(-DANCA_FILA_DE_COLEGAS_MAX), placares: { ...atual.placares, [msg.playerId]: msg.placar } }
    }
    case 'danca.desfecho': {
      const { type: _type, sessao: _sessao, ...desfecho } = msg
      return { ...atual, desfecho }
    }
  }
}

/** Ainda dá para mandar o Pronto: convite aberto, sem começar, sem fim. */
export function dancaAceitaPronto(danca: DancaDoJogador | undefined): danca is DancaDoJogador {
  return danca !== undefined && danca.comecar === undefined && danca.encerrada === undefined && danca.desfecho === undefined && (danca.estado?.fase ?? 'convite') === 'convite'
}

/** Ainda dá para mandar toques e o fim: a música começou para ESTE aparelho e nada a encerrou. */
export function dancaNaPista(danca: DancaDoJogador | undefined): danca is DancaDoJogador {
  return danca !== undefined && danca.comecar !== undefined && danca.encerrada === undefined && danca.desfecho === undefined && !danca.fimEnviado
}
