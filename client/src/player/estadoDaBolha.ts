import type {
  BolhaComecarMessage,
  BolhaConviteMessage,
  BolhaDaSessaoMessage,
  BolhaDesfechoMessage,
  BolhaEstadoMessage,
  BolhaMotivoDaRecusa,
  BolhaMotivoDoFim,
} from '../net/protocoloDaBolha'

/**
 * BOLHA D'ÁGUA no cliente do jogador: o que chegou do mestre, como estado
 * puro (convite, quem está pronto, o começar, pausa, fim). Sem lockstep, nada
 * vai direto ao jogo pela rede: cada aparelho joga a própria cópia, e só o
 * placar do fim volta ao mestre.
 */

export interface BolhaDoJogador {
  sessao: string
  convite: Omit<BolhaConviteMessage, 'type'>
  /** O último `bolha.estado`: a fase e o status de cada um. Ausente = ainda nenhum. */
  estado?: Omit<BolhaEstadoMessage, 'type' | 'sessao'>
  /** O Pronto DESTE jogador já saiu. Fica na volta da conexão com a mesma sessão. */
  pronto: boolean
  /** O "começar": a partida, igual em todos os aparelhos da equipe. */
  comecar?: Omit<BolhaComecarMessage, 'type' | 'sessao'>
  pausada: boolean
  /** O `bolha.fim` deste jogador já saiu: o placar mandado é o que vale. */
  fimEnviado: boolean
  encerrada?: BolhaMotivoDoFim
  desfecho?: Omit<BolhaDesfechoMessage, 'type' | 'sessao'>
}

/**
 * A mensagem da bolha aplicada ao estado. Convite de sessão nova recomeça do
 * zero; o mesmo convite de novo (a volta da conexão) guarda o Pronto. O resto
 * só vale para a sessão que está na tela.
 */
export function receberBolha(atual: BolhaDoJogador | undefined, msg: BolhaDaSessaoMessage): BolhaDoJogador | undefined {
  if (msg.type === 'bolha.convite') {
    const { type: _type, ...convite } = msg
    if (atual !== undefined && atual.sessao === msg.sessao) return { ...atual, convite }
    return { sessao: msg.sessao, convite, pronto: false, pausada: false, fimEnviado: false }
  }
  if (atual === undefined || atual.sessao !== msg.sessao) return atual
  switch (msg.type) {
    case 'bolha.estado':
      return { ...atual, estado: { fase: msg.fase, participantes: msg.participantes } }
    case 'bolha.comecar': {
      // Repetido não recomeça: a partida deste aparelho já foi iniciada.
      if (atual.comecar !== undefined) return atual
      const { type: _type, sessao: _sessao, ...comecar } = msg
      return { ...atual, comecar }
    }
    case 'bolha.pausa':
    case 'bolha.retoma': {
      const pausada = msg.type === 'bolha.pausa'
      return atual.comecar === undefined || atual.pausada === pausada ? atual : { ...atual, pausada }
    }
    case 'bolha.encerra':
      return { ...atual, encerrada: msg.motivo }
    case 'bolha.desfecho': {
      const { type: _type, sessao: _sessao, ...desfecho } = msg
      return { ...atual, desfecho }
    }
  }
}

/** Ainda dá para mandar o Pronto: convite aberto, sem Pronto, sem começar, sem fim. */
export function bolhaAceitaPronto(bolha: BolhaDoJogador | undefined): bolha is BolhaDoJogador {
  return (
    bolha !== undefined &&
    !bolha.pronto &&
    bolha.comecar === undefined &&
    bolha.encerrada === undefined &&
    bolha.desfecho === undefined &&
    (bolha.estado?.fase ?? 'convite') === 'convite'
  )
}

/**
 * Ainda vale avisar o mestre que este jogador saiu (`bolha.desistir`): nada
 * encerrou a bolha e o fim deste aparelho não saiu (depois dele, o placar
 * mandado é o que vale).
 */
export function bolhaAceitaDesistir(bolha: BolhaDoJogador | undefined): bolha is BolhaDoJogador {
  return bolha !== undefined && bolha.encerrada === undefined && bolha.desfecho === undefined && !bolha.fimEnviado
}

/** Ainda dá para mandar o placar: a partida começou para ESTE aparelho e nada a encerrou. */
export function bolhaEmJogo(bolha: BolhaDoJogador | undefined): bolha is BolhaDoJogador {
  return bolha !== undefined && bolha.comecar !== undefined && bolha.encerrada === undefined && bolha.desfecho === undefined && !bolha.fimEnviado
}

/** Quanto o aviso da recusa do "Apagar com bolhas" fica na tela. */
export const BOLHA_RECUSA_AVISO_MS = 4000

/** O aviso curto quando o host não deixou começar sozinho (o cartão já fechou). */
export function textoDaRecusaDaBolha(motivo: BolhaMotivoDaRecusa): string {
  switch (motivo) {
    case 'longe':
      return 'Chegue mais perto do pino para apagar com bolhas.'
    case 'ocupado':
      return 'Já tem um fogo sendo apagado com bolhas nesta mesa online. Espere ele acabar.'
    case 'indisponivel':
      return 'Não dá para apagar com bolhas aí agora.'
  }
}
