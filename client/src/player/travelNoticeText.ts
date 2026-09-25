import type { TravelNotice } from './playerConnection'

/**
 * Enquanto o host confere o passe (pino no modo `passe`). O mesmo texto no
 * cartão do pino e no aviso da tela: o jogador não lê duas coisas diferentes
 * sobre o mesmo pedido.
 */
export const PASS_CHECK_TEXT = 'Conferindo o passe…'

/**
 * O pedido de passagem, em uma linha. Nunca diz para onde o pino leva: o
 * jogador só descobre ao chegar. As recusas do host são genéricas de
 * propósito (`PinTravelRejection`), e a frase também. O motivo do "Não,
 * porque…" é o que o MESTRE escreveu para este jogador: entra como veio.
 */
export function travelNoticeText(notice: TravelNotice): string {
  switch (notice.phase) {
    case 'waiting':
      if (notice.passe) return PASS_CHECK_TEXT
      return notice.direct ? 'Passando…' : 'Aguardando o mestre…'
    case 'arrived':
      return 'Você chegou'
    case 'moved':
      // Nunca diz para onde: o nome da cena é do mestre.
      return 'O mestre levou você para outro lugar'
    case 'gathered':
      // Também sem o nome da cena: só que o grupo está junto de novo.
      return 'O mestre reuniu o grupo'
    case 'denied':
      return notice.text === undefined ? 'O mestre não deixou passar agora' : `O mestre não deixou: ${notice.text}`
    case 'cancelled':
      return notice.reason === 'far' ? 'Você se afastou da passagem. Pedido retirado' : 'Pedido retirado'
    case 'rejected':
      if (notice.reason === 'pending') return 'Seu pedido anterior ainda espera o mestre'
      if (notice.reason === 'too_soon') return 'Espere um pouco antes de pedir de novo'
      return 'Não dá para passar por aqui agora'
  }
}
