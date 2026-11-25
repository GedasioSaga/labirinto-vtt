import type { CarriedItem, LojaItem } from '../types/map'
import { cleanItemName, mochilaComItemDoAcervo } from './items'
import { precoEmMoedas } from './loja'

/**
 * "VENDER" DA BANCA (Fase 5 da melhoria geral: uma porta para criar item, e a
 * venda cobra a bolsa). A mercadoria escolhida do Acervo entra pela MESMA
 * regra do "Dar a…" (`mochilaComItemDoAcervo`: foto, `itemId`, pilha); a
 * digitada à mão, numa vaga nova só com o nome. As duas pagam o mesmo preço
 * que o jogador lê (`precoEmMoedas`, 25/11/2026), na mesma mudança.
 *
 * Arquivo à parte de `lib/loja.ts` porque `lib/items.ts` importa a loja: daqui
 * os dois são importados sem ciclo. Puro: sem store, sem rede.
 */

export interface VendaNaFicha {
  mochila: CarriedItem[]
  /** A bolsa depois de pagar; `null` = a bolsa não muda (mercadoria grátis). */
  moedas: number | null
}

/**
 * A ficha depois de comprar 1 da mercadoria. `semMoedas` = o preço passa da
 * bolsa (nada muda); `null` = nada a vender (nome vazio, a pilha já no teto,
 * ou o preço antigo que o mestre ainda não conferiu, sem preço do Acervo). `freshId` é o id da vaga
 * nova, se abrir uma.
 */
export function vendaNaFicha(mochila: readonly CarriedItem[], moedas: number, item: LojaItem, freshId: string): VendaNaFicha | 'semMoedas' | null {
  const nome = cleanItemName(item.nome)
  const preco = precoEmMoedas(item)
  if (nome === '' || preco === null) return null
  if (preco > moedas) return 'semMoedas'
  const pago = preco > 0 ? moedas - preco : null
  if (item.acervo === undefined) return { mochila: [...mochila, { id: freshId, nome }], moedas: pago }
  const recebeu = mochilaComItemDoAcervo(mochila, { ...item.acervo, nome }, 1, freshId)
  if (recebeu === null || recebeu.entraram === 0) return null
  return { mochila: recebeu.mochila, moedas: pago }
}

/** A bolsa paga a mercadoria? A do preço a conferir paga o do Acervo; sem ele, não se vende (`precoEmMoedas`). */
export function bolsaPaga(moedas: number, item: Pick<LojaItem, 'preco' | 'acervo'>): boolean {
  const preco = precoEmMoedas(item)
  return preco !== null && preco <= moedas
}
