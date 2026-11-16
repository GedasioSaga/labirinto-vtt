import type { CarriedItem, LojaItem } from '../types/map'
import { cleanItemName, mochilaComItemDoAcervo } from './items'
import { precoEmMoedas } from './loja'

/**
 * "VENDER" DA BANCA (Fase 5 da melhoria geral: uma porta para criar item, e a
 * venda cobra a bolsa). A mercadoria escolhida do Acervo entra pela MESMA
 * regra do "Dar a…" (`mochilaComItemDoAcervo`: foto, `itemId`, pilha) e o
 * preço dela sai da bolsa na mesma mudança. A digitada à mão continua como
 * antes: uma vaga nova só com o nome, e a bolsa não muda.
 *
 * Arquivo à parte de `lib/loja.ts` porque `lib/items.ts` importa a loja: daqui
 * os dois são importados sem ciclo. Puro: sem store, sem rede.
 */

export interface VendaNaFicha {
  mochila: CarriedItem[]
  /** A bolsa depois de pagar; `null` = a bolsa não muda (mercadoria sem preço em moedas). */
  moedas: number | null
}

/**
 * A ficha depois de comprar 1 da mercadoria. `semMoedas` = o preço passa da
 * bolsa (nada muda); `null` = nada a vender (nome vazio, ou a pilha já no
 * teto). `freshId` é o id da vaga nova, se abrir uma.
 */
export function vendaNaFicha(mochila: readonly CarriedItem[], moedas: number, item: LojaItem, freshId: string): VendaNaFicha | 'semMoedas' | null {
  const nome = cleanItemName(item.nome)
  if (nome === '') return null
  if (item.acervo === undefined) return { mochila: [...mochila, { id: freshId, nome }], moedas: null }
  const preco = precoEmMoedas(item) ?? 0
  if (preco > moedas) return 'semMoedas'
  const recebeu = mochilaComItemDoAcervo(mochila, { ...item.acervo, nome }, 1, freshId)
  if (recebeu === null || recebeu.entraram === 0) return null
  return { mochila: recebeu.mochila, moedas: preco > 0 ? moedas - preco : null }
}

/** A bolsa paga a mercadoria? A digitada (sem preço em moedas) sempre. */
export function bolsaPaga(moedas: number, item: Pick<LojaItem, 'acervo'>): boolean {
  return (precoEmMoedas(item) ?? 0) <= moedas
}
