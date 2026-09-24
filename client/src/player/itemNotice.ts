import type { ItemNotice } from './playerConnection'

/**
 * O que o jogador lê em cada passo do "Pegar" e do "Dar a…". O pino livre
 * não fala em mestre: ninguém está decidindo. Nenhum texto diz onde o item
 * está nem de que cena é — quem pediu já sabe.
 */
export function itemNoticeText(notice: ItemNotice): string {
  switch (notice.phase) {
    case 'sent':
      return notice.direct ? 'Pegando…' : 'Pedido enviado ao mestre'
    case 'taken':
      return `${notice.nome} está com você`
    case 'denied':
      return 'O mestre disse não'
    case 'rejected':
      if (notice.reason === 'far') return 'Chegue mais perto para pegar'
      if (notice.reason === 'pending') return 'Seu pedido ainda espera o mestre'
      return 'Não dá para pegar isso agora'
    case 'give_rejected':
      return notice.reason === 'far' ? 'Chegue mais perto para dar' : 'Não dá para dar isso agora'
  }
}
