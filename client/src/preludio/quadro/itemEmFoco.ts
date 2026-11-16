/**
 * O ITEM ESCOLHIDO NA FAIXA DE UM LUGAR (Grimório, `state/faixaItensFoco.ts`):
 * com ele escolhido, o Ctrl+C do cartão copia a imagem do item, e não o
 * retrato do lugar. Vale só enquanto o cartão está selecionado e o item ainda
 * está na faixa (a faixa limpa o foco quando isso muda).
 */

export interface ItemEmFoco {
  /** O cartão do lugar (`shape:…`). */
  readonly formaId: string
  /** O verbete do item (como está no acervo). */
  readonly itemId: string
}

let foco: ItemEmFoco | null = null
const ouvintes = new Set<() => void>()

export function itemEmFoco(): ItemEmFoco | null {
  return foco
}

export function focarItem(novo: ItemEmFoco | null): void {
  if (foco?.formaId === novo?.formaId && foco?.itemId === novo?.itemId) return
  foco = novo
  for (const ouvinte of ouvintes) ouvinte()
}

export function ouvirItemEmFoco(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}
