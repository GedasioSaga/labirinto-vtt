import type { CompraNotice } from './playerConnection'

/**
 * LOJA COM PREÇOS: o que o jogador lê em cada passo do "Quero". A recusa do
 * host é genérica de propósito ("Não dá para pedir isso agora" vale para
 * banca sumida, mercadoria que acabou e inventada): nenhum texto diz o que
 * existe fora da vista dele, nem de que cena é a banca.
 */
export function compraNoticeText(notice: CompraNotice): string {
  switch (notice.phase) {
    case 'sent':
      return `Pedido enviado ao mestre: ${notice.nome}`
    case 'sold':
      return `${notice.nome} está com você`
    case 'denied':
      return `O mestre não vendeu ${notice.nome}`
    case 'far':
      return 'Chegue mais perto da banca para pedir'
    case 'pending':
      return 'Seu pedido ainda espera o mestre'
    case 'too_soon':
      return 'Espere um instante antes de pedir de novo'
    case 'unavailable':
      return 'Não dá para pedir isso agora'
  }
}
