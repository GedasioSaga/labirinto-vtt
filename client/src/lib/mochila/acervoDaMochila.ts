import type { ItemDoCatalogo } from '../acervoDeItens'
import { itemParaDar } from '../itemParaDar'
import type { AcervoDaMochila } from './armaNaMochila'

/**
 * O Acervo de agora como a mochila o consulta (`AcervoDaMochila`): o tipo e o pente do item, e como
 * ele vai para a mochila (a bala do pente que volta). Separado de `armaNaMochila.ts` para as regras
 * puras não puxarem o disco do Acervo.
 */
export function acervoDaMochila(itens: readonly ItemDoCatalogo[]): AcervoDaMochila {
  const porId = new Map(itens.map((item) => [item.id, item]))
  return {
    item: (itemId) => porId.get(itemId),
    paraDar: (itemId) => {
      const item = porId.get(itemId)
      return item === undefined ? undefined : itemParaDar(item, itens)
    },
  }
}

/** O preço de referência do item no Acervo; `undefined` = o item não está no Acervo. */
export function precoNoAcervo(itens: readonly ItemDoCatalogo[]): (itemId: string) => number | null | undefined {
  const porId = new Map(itens.map((item) => [item.id, item.preco]))
  return (itemId) => porId.get(itemId)
}
