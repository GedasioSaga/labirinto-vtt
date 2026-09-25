import type { TokenHideRejection } from '../net/protocol'

/** Por que o pedido de esconder-se não valeu, em uma linha curta. */
export const HIDE_NOTICE_TEXT: Record<TokenHideRejection, string> = {
  denied: 'O mestre não deixou você se esconder agora',
  pending: 'Seu pedido já está com o mestre',
  too_soon: 'Espere um instante para pedir de novo',
  // Genérico de propósito: o host não conta por que (ver `TokenHideRejection`).
  unavailable: 'Não dá para se esconder agora',
}
