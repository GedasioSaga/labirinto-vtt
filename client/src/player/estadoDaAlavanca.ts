import type {
  AlavancaComecarMessage,
  AlavancaConviteMessage,
  AlavancaDaSessaoMessage,
  AlavancaEstadoMessage,
  AlavancaFimMessage,
  AlavancaMotivoDaRecusa,
  AlavancaMotivoDoFim,
} from '../net/protocoloDaAlavanca'

/**
 * A ALAVANCA DA PONTE como o JOGADOR a guarda: o convite e o que chegou
 * depois (estado, começo, fim, encerramento). Estado puro, como o da bolha.
 * A ponte ao vivo (`alavanca.vivo`, 20 por segundo) NÃO passa por aqui: vai
 * direto à tela (`ouvirAlavanca`), para não redesenhar a página inteira a
 * cada repasse.
 */
export interface AlavancaDoJogador {
  sessao: string
  convite: AlavancaConviteMessage
  estado?: AlavancaEstadoMessage
  /** Este jogador já mandou o Começar. */
  pronto: boolean
  comecar?: AlavancaComecarMessage
  fim?: AlavancaFimMessage
  /** Fechou sem rodada (o mestre encerrou, ou ficou de fora). */
  encerrada?: AlavancaMotivoDoFim
}

/** O aviso do "Girar a alavanca" que o host recusou some sozinho. */
export const ALAVANCA_RECUSA_AVISO_MS = 4000

/** O convite novo troca a alavanca inteira; mensagem de outra sessão é ignorada. */
export function receberAlavanca(atual: AlavancaDoJogador | undefined, msg: AlavancaDaSessaoMessage): AlavancaDoJogador | undefined {
  if (msg.type === 'alavanca.convite') return { sessao: msg.sessao, convite: msg, pronto: false }
  if (atual === undefined || atual.sessao !== msg.sessao) return atual
  switch (msg.type) {
    case 'alavanca.estado':
      return { ...atual, estado: msg }
    case 'alavanca.comecar':
      return { ...atual, comecar: msg, fim: undefined }
    case 'alavanca.fim':
      return { ...atual, fim: msg }
    case 'alavanca.encerra':
      return { ...atual, encerrada: msg.motivo }
    case 'alavanca.vivo':
      return atual
  }
}

/** O Começar só sai do convite aberto e uma vez. */
export function alavancaAceitaPronto(alavanca: AlavancaDoJogador | undefined): alavanca is AlavancaDoJogador {
  return alavanca !== undefined && !alavanca.pronto && alavanca.comecar === undefined && alavanca.encerrada === undefined && alavanca.estado?.fase !== 'fim'
}

/** Gira, pausa e continua só com a rodada aberta (começou, não acabou). */
export function alavancaEmRodada(alavanca: AlavancaDoJogador | undefined): alavanca is AlavancaDoJogador {
  return alavanca !== undefined && alavanca.comecar !== undefined && alavanca.fim === undefined && alavanca.encerrada === undefined
}

/** Fechar antes do fim avisa o mestre (no convite, "Agora não"; na rodada, sai). */
export function alavancaAceitaDesistir(alavanca: AlavancaDoJogador | undefined): alavanca is AlavancaDoJogador {
  return alavanca !== undefined && alavanca.fim === undefined && alavanca.encerrada === undefined
}

/** O aviso curto quando o host não deixou girar sozinho (o cartão já fechou). */
export function textoDaRecusaDaAlavanca(motivo: AlavancaMotivoDaRecusa): string {
  switch (motivo) {
    case 'longe':
      return 'Chegue mais perto da alavanca para girar.'
    case 'ocupado':
      return 'Já tem alguém girando uma alavanca nesta mesa online. Espere acabar.'
    case 'indisponivel':
      return 'Não dá para girar a alavanca aí agora.'
  }
}
