import type { FuncaoFogo } from '../minigames/fogo/tipos'
import type {
  FogoComecarMessage,
  FogoConviteMessage,
  FogoDesfechoMessage,
  FogoEstadoMessage,
  FogoHostMessage,
  FogoLotesMessage,
  FogoMotivoDoFim,
  FogoSairMessage,
} from '../net/protocoloDoFogo'

/**
 * FOGO NA FLORESTA no cliente do jogador: o que chegou do mestre, como estado
 * puro (convite, quem está pronto, o começar, pausa, fim). As entradas dos
 * colegas (10 por segundo) e o `fogo.sair` NÃO entram aqui: vão direto ao
 * jogo pelo canal da conexão (`ouvirFogo`), sem redesenhar a tela inteira.
 */

/** O que vai direto ao jogo, sem passar pelo estado da tela. */
export type FogoParaOJogo = FogoLotesMessage | FogoSairMessage

export interface FogoDoJogador {
  sessao: string
  convite: Omit<FogoConviteMessage, 'type'>
  /** O último `fogo.estado`: a fase e o status e a função de cada um. Ausente = ainda nenhum. */
  estado?: Omit<FogoEstadoMessage, 'type' | 'sessao'>
  /** A função que ESTE jogador mandou no Pronto. Fica na volta da conexão com a mesma sessão. */
  pronto?: FuncaoFogo
  /** O "começar": a partida, igual em todos os aparelhos da equipe. */
  comecar?: Omit<FogoComecarMessage, 'type' | 'sessao'>
  pausada: boolean
  /** O `fogo.fim` deste jogador já saiu: nada de entrada nem hash depois dele. */
  fimEnviado: boolean
  encerrada?: FogoMotivoDoFim
  desfecho?: Omit<FogoDesfechoMessage, 'type' | 'sessao'>
}

/**
 * A mensagem do fogo aplicada ao estado. Convite de sessão nova recomeça do
 * zero; o mesmo convite de novo (a volta da conexão) guarda o Pronto. O resto
 * só vale para a sessão que está na tela. Entradas e `sair` não mudam o
 * estado (vão pelo canal): voltam o mesmo objeto.
 */
export function receberFogo(atual: FogoDoJogador | undefined, msg: FogoHostMessage): FogoDoJogador | undefined {
  if (msg.type === 'fogo.convite') {
    const { type: _type, ...convite } = msg
    if (atual !== undefined && atual.sessao === msg.sessao) return { ...atual, convite }
    return { sessao: msg.sessao, convite, pausada: false, fimEnviado: false }
  }
  if (atual === undefined || atual.sessao !== msg.sessao) return atual
  switch (msg.type) {
    case 'fogo.estado':
      return { ...atual, estado: { fase: msg.fase, participantes: msg.participantes } }
    case 'fogo.comecar': {
      // Repetido não recomeça: a partida deste aparelho já foi iniciada.
      if (atual.comecar !== undefined) return atual
      const { type: _type, sessao: _sessao, ...comecar } = msg
      return { ...atual, comecar }
    }
    case 'fogo.pausa':
    case 'fogo.retoma': {
      const pausada = msg.type === 'fogo.pausa'
      return atual.comecar === undefined || atual.pausada === pausada ? atual : { ...atual, pausada }
    }
    case 'fogo.encerra':
      return { ...atual, encerrada: msg.motivo }
    case 'fogo.desfecho': {
      const { type: _type, sessao: _sessao, ...desfecho } = msg
      return { ...atual, desfecho }
    }
    case 'fogo.entradas':
    case 'fogo.sair':
      return atual
  }
}

/** Ainda dá para mandar o Pronto: convite aberto, sem começar, sem fim. */
export function fogoAceitaPronto(fogo: FogoDoJogador | undefined): fogo is FogoDoJogador {
  return fogo !== undefined && fogo.comecar === undefined && fogo.encerrada === undefined && fogo.desfecho === undefined && (fogo.estado?.fase ?? 'convite') === 'convite'
}

/** Ainda dá para mandar entradas, hash e o fim: a partida começou para ESTE aparelho e nada a encerrou. */
export function fogoEmJogo(fogo: FogoDoJogador | undefined): fogo is FogoDoJogador {
  return fogo !== undefined && fogo.comecar !== undefined && fogo.encerrada === undefined && fogo.desfecho === undefined && !fogo.fimEnviado
}
