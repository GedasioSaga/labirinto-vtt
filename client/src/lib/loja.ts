import type { LojaItem, MapData, Pin } from '../types/map'

/**
 * LOJA COM PREÇOS — a banca de um pino: mercadorias com nome, preço e estoque.
 * O jogador toca "Quero" no cartão e o pedido chega ao mestre, que vende (o
 * estoque cai um e a mercadoria vai para a mochila de quem comprou) ou não.
 * Aqui mora a parte pura: ler do disco (ou da rede), o que o jogador pode
 * receber e o efeito de vender. Sem DOM, sem store.
 */

/** Quantas mercadorias uma banca guarda (no disco, no painel e no recorte). */
export const LOJA_ITENS_MAX = 30
/**
 * Teto do nome da mercadoria: o mesmo `ITEM_NAME_MAX_LENGTH` do item da
 * mochila (`lib/items.ts`), para onde ela vai quando vendida. Repetido e não
 * importado: `lib/items.ts` importa este arquivo, e a constante lida na carga
 * de um ciclo de imports chegaria antes de existir. `loja.test.ts` confere.
 */
export const LOJA_NOME_MAX = 60
/** Teto do preço, em texto livre ("3 moedas", "uma vela"). */
export const LOJA_PRECO_MAX = 40
/** Maior estoque que o painel aceita. */
export const LOJA_ESTOQUE_MAX = 999

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Estoque de verdade: inteiro de 0 ao teto. Qualquer outra coisa não é estoque. */
export function isEstoque(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= LOJA_ESTOQUE_MAX
}

/**
 * A loja como veio de fora (disco, ou o mapa que chega pela rede). Item sem
 * `id` ou sem `nome` em texto cai (os bons ficam); id repetido fica só o
 * primeiro — o "Quero" acharia o item errado; preço que não é texto vira
 * vazio; estoque fora da forma volta ausente. Nome e preço são cortados no
 * teto, a lista no máximo de itens. LISTA DO QUE VAI: campo que o item trouxer
 * e o app não conhece nunca é copiado. Nada que preste = ausente: mapa antigo
 * não ganha o campo.
 */
export function lerLojaDoArquivo(value: unknown): LojaItem[] | undefined {
  if (!Array.isArray(value)) return undefined
  const itens: LojaItem[] = []
  for (const bruto of value) {
    if (itens.length >= LOJA_ITENS_MAX) break
    if (!isRecord(bruto)) continue
    const { id, nome, preco, estoque } = bruto
    if (typeof id !== 'string' || id === '' || typeof nome !== 'string') continue
    if (itens.some((item) => item.id === id)) continue
    const item: LojaItem = { id, nome: nome.slice(0, LOJA_NOME_MAX), preco: typeof preco === 'string' ? preco.slice(0, LOJA_PRECO_MAX) : '' }
    if (isEstoque(estoque)) item.estoque = estoque
    itens.push(item)
  }
  return itens.length === 0 ? undefined : itens
}

/**
 * O que o JOGADOR recebe da banca: cada mercadoria com nome escrito, só com
 * id, nome, preço e estoque. Mercadoria sem nome (o mestre ainda escrevendo)
 * não sai; pino de viagem e alavanca não são banca. `null` = nada a mostrar.
 *
 * Quem chama responde por o jogador PODER ver o pino: o recorte da névoa
 * (`lib/fogFilter.ts`) só chama isto para pino que já passou. O cartão do
 * jogador chama de novo sobre o que chegou pela rede: o mapa do snapshot não
 * é conferido campo a campo, e item torto não pode quebrar a tela.
 */
export function lojaParaJogador(pin: Pick<Pin, 'kind' | 'loja'>): LojaItem[] | null {
  if (pin.kind === 'viagem' || pin.kind === 'alavanca') return null
  const itens = (lerLojaDoArquivo(pin.loja) ?? []).filter((item) => item.nome.trim() !== '')
  return itens.length === 0 ? null : itens
}

/** A mercadoria `itemId` que se pode pedir agora: existe no que o jogador recebe e não acabou. */
export function itemAVenda(pin: Pin, itemId: string): LojaItem | null {
  const item = (lojaParaJogador(pin) ?? []).find((i) => i.id === itemId)
  return item === undefined || item.estoque === 0 ? null : item
}

/** O estoque dito ao jogador; `null` = sem conta (não se diz nada). */
export function textoDoEstoque(item: LojaItem): string | null {
  if (item.estoque === undefined) return null
  if (item.estoque === 0) return 'Acabou'
  return `${item.estoque} em estoque`
}

/**
 * "Vender": tira um do estoque da mercadoria `itemId` do pino `pinId`. Item
 * sem conta de estoque, já esgotado, pino ou item que sumiu: o mesmo `map`
 * (nada a mudar). Pura e reaplicável — entra também nos passos do desfazer
 * (`applyItemChange`, `lib/items.ts`).
 */
export function venderItem(map: MapData, pinId: string, itemId: string): MapData {
  const pin = map.pins.find((p) => p.id === pinId)
  const item = pin?.loja?.find((i) => i.id === itemId)
  if (pin === undefined || item === undefined || item.estoque === undefined || item.estoque === 0) return map
  const restante = item.estoque - 1
  const loja = (pin.loja ?? []).map((i) => (i.id === itemId ? { ...i, estoque: restante } : i))
  return { ...map, pins: map.pins.map((p) => (p.id === pinId ? { ...p, loja } : p)) }
}

/** As duas lojas são a mesma? `undefined` só é igual a `undefined`. */
export function sameLoja(a: readonly LojaItem[] | undefined, b: readonly LojaItem[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return (
    a.length === b.length &&
    a.every((item, i) => {
      const outro = b[i]
      return outro !== undefined && item.id === outro.id && item.nome === outro.nome && item.preco === outro.preco && item.estoque === outro.estoque
    })
  )
}

/** A mercadoria em branco que o painel acrescenta. */
export function novaMercadoria(id: string): LojaItem {
  return { id, nome: '', preco: '' }
}
