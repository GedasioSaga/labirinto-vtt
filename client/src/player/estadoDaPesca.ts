import type { DificuldadePesca } from '../minigames/pesca/tipos'
import type {
  PeixeNoCesto,
  PescaConviteMessage,
  PescaDesfechoDoLance,
  PescaEstadoMessage,
  PescaHostMessage,
  PescaMotivoDoFim,
} from '../net/protocoloDaPesca'

/**
 * MINIGAME DE PESCA no cliente do jogador: o que chegou do mestre e o que
 * este jogador já mandou, como estado puro. A tela (fase seguinte) desenha em
 * cima disto; a conexão só guarda o resultado em `PlayerState.pesca` e manda
 * o que o jogador faz.
 */

export interface PescaDoJogador {
  sessao: string
  convite: Omit<PescaConviteMessage, 'type'>
  /** O último `pesca.estado`: a fase e o status de cada um. Ausente = ainda nenhum. */
  estado?: Omit<PescaEstadoMessage, 'type' | 'sessao'>
  /** A dificuldade que ESTE jogador mandou no Pronto: daí em diante ele está pescando. */
  pronto?: DificuldadePesca
  /** Pausa do mestre. `pausaMudouEm`: `performance.now()` da última pausa ou retomada. */
  pausada: boolean
  pausaMudouEm?: number
  /** Os lances que ESTE jogador já mandou, na ordem. */
  lances: ({ lance: number } & PescaDesfechoDoLance)[]
  /** O que ele pegou: o cesto que o `pesca.fim` leva. */
  cesto: PeixeNoCesto[]
  /** O `pesca.fim` deste jogador já saiu: nada mais sai depois dele. */
  fimEnviado: boolean
  encerrada?: PescaMotivoDoFim
}

/**
 * A mensagem da pesca aplicada ao estado. Convite de sessão nova recomeça do
 * zero; o mesmo convite de novo (a volta da conexão) guarda o que já houve. O
 * resto só vale para a sessão que está na tela — de outra, é atrasada e cai.
 */
export function receberPesca(atual: PescaDoJogador | undefined, msg: PescaHostMessage, agora: number): PescaDoJogador | undefined {
  if (msg.type === 'pesca.convite') {
    const { type: _type, ...convite } = msg
    if (atual !== undefined && atual.sessao === msg.sessao) return { ...atual, convite }
    return { sessao: msg.sessao, convite, pausada: false, lances: [], cesto: [], fimEnviado: false }
  }
  if (atual === undefined || atual.sessao !== msg.sessao) return atual
  switch (msg.type) {
    case 'pesca.estado':
      return { ...atual, estado: { fase: msg.fase, participantes: msg.participantes } }
    case 'pesca.pausa':
    case 'pesca.retoma': {
      const pausada = msg.type === 'pesca.pausa'
      if (atual.pausada === pausada) return atual
      return { ...atual, pausada, pausaMudouEm: agora }
    }
    case 'pesca.encerra':
      return { ...atual, encerrada: msg.motivo }
  }
}

/** Ainda dá para mandar o Pronto: convite aberto, sem Pronto, sem fim e sem encerrar. */
export function pescaAceitaPronto(pesca: PescaDoJogador | undefined): pesca is PescaDoJogador {
  return pesca !== undefined && pesca.pronto === undefined && pesca.encerrada === undefined && !pesca.fimEnviado
}

/** Pescando: o Pronto saiu e nada encerrou — vivo, lances e o fim podem sair. */
export function pescaNaAgua(pesca: PescaDoJogador | undefined): pesca is PescaDoJogador {
  return pesca !== undefined && pesca.pronto !== undefined && pesca.encerrada === undefined && !pesca.fimEnviado
}

/** O lance que terminou, guardado; o peixe do `pegou` entra no cesto. `null` = lance fora da chamada ou repetido. */
export function registrarLance(pesca: PescaDoJogador, lance: { lance: number } & PescaDesfechoDoLance): PescaDoJogador | null {
  if (lance.lance > pesca.convite.lances || pesca.lances.some((l) => l.lance === lance.lance)) return null
  const cesto = lance.resultado === 'pegou' ? [...pesca.cesto, lance.peixe] : pesca.cesto
  return { ...pesca, lances: [...pesca.lances, lance], cesto }
}
