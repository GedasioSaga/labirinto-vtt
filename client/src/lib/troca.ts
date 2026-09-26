import type { Token } from '../types/map'
import { carriedItemsOf, cleanItemName, tokensTouch, type ItemChange } from './items'

/**
 * MOEDAS E TROCA ENTRE FICHAS — regras puras, compartilhadas pelo host
 * (validar o "Pagar a…", a oferta do mestre e a resposta do jogador), pelo
 * disco e pelas telas. Sem DOM, sem store.
 *
 * A bolsa é um número na ficha (`Token.moedas`). Pagar tira de uma ficha e
 * põe na outra; a troca do mestre dá itens NOVOS e moedas e cobra itens da
 * mochila e moedas. Tudo vira um `ItemChange` só — o integrador grava as
 * mochilas e as bolsas juntas, e nunca um lado sem o outro.
 */

/** Teto da bolsa: número que cabe na linha do painel e nunca perde precisão. */
export const MOEDAS_MAX = 999_999

/** Teto de itens de cada lado da troca: a oferta é uma linha que se lê, não um inventário. */
export const TRADE_ITEMS_MAX = 10

/** Teto de "quem oferece" (Zulmira, a Botica), em unidades UTF-16. */
export const TRADE_FROM_MAX_LENGTH = 40

/** Quem oferece quando o mestre não diz. */
export const TRADE_FROM_DEFAULT = 'Mestre'

/** Um lado da troca que o mestre DÁ: nomes de itens novos e moedas. */
export interface TradeGive {
  itens: string[]
  moedas: number
}

/** O que se PEDE à ficha: itens da mochila dela (pelo id) e moedas. */
export interface TradeAsk {
  itemIds: string[]
  moedas: number
}

/** A oferta que o mestre monta no Grupo: quem oferece, o que dá e o que pede. */
export interface TradeProposal {
  de: string
  dou: TradeGive
  peco: TradeAsk
}

/** Valor de moedas aceito num pedido: inteiro de 0 ao teto. */
export function isCoinAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MOEDAS_MAX
}

/** A bolsa da ficha; ausente é zero. */
export function moedasDe(token: Pick<Token, 'moedas'>): number {
  const moedas = token.moedas
  return isCoinAmount(moedas) ? moedas : 0
}

/**
 * `Token.moedas` como vem do disco: só inteiro positivo até o teto. Zero,
 * negativo, quebrado ou texto voltam AUSENTE (bolsa vazia), sem migração.
 */
export function readMoedas(value: unknown): number | undefined {
  return isCoinAmount(value) && value > 0 ? value : undefined
}

/** "1 moeda", "3 moedas". */
export function moedasLabel(moedas: number): string {
  return moedas === 1 ? '1 moeda' : `${moedas} moedas`
}

/** "Xarope, Vela e 3 moedas"; lado vazio é "nada". */
export function tradeSideText(itens: readonly string[], moedas: number): string {
  const partes = moedas > 0 ? [...itens, moedasLabel(moedas)] : [...itens]
  if (partes.length === 0) return 'nada'
  if (partes.length === 1) return partes[0] ?? 'nada'
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1] ?? ''}`
}

/** Ids distintos e não vazios, na ordem em que vieram. */
function distinctIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => id !== ''))]
}

/** "Quem oferece" aparado e no teto; vazio é o `TRADE_FROM_DEFAULT`. */
export function cleanTradeFrom(raw: string): string {
  const trimmed = raw.trim().slice(0, TRADE_FROM_MAX_LENGTH).trim()
  return trimmed === '' ? TRADE_FROM_DEFAULT : trimmed
}

/** Os nomes que o mestre dá, aparados; vazios saem. */
function cleanGiveNames(itens: readonly string[]): string[] {
  return itens.map(cleanItemName).filter((nome) => nome !== '')
}

/**
 * Mais de `TRADE_ITEMS_MAX` itens de um lado, contados como a oferta limpa
 * conta (nome vazio e id repetido não entram). O host recusa com motivo
 * próprio, e o formulário do mestre avisa antes de mandar.
 */
export function tradeTooBig(raw: TradeProposal): boolean {
  return cleanGiveNames(raw.dou.itens).length > TRADE_ITEMS_MAX || distinctIds(raw.peco.itemIds).length > TRADE_ITEMS_MAX
}

/**
 * A bolsa que paga `target` no "Pagar a…": a maior entre as fichas `own`
 * encostadas nele — o host só cobra de uma ficha encostada no alvo, nunca da
 * mais rica que está longe. Nenhuma encostada (ou alvo fora do mapa): a maior
 * de todas, e o host responde "longe", que é o motivo certo.
 */
export function purseToward(own: readonly Token[], target: Pick<Token, 'x' | 'y' | 'size'> | undefined, grid: number): number {
  const touching = target === undefined ? [] : own.filter((t) => tokensTouch(t, target, grid))
  const pagantes = touching.length > 0 ? touching : own
  return pagantes.reduce((maior, t) => Math.max(maior, moedasDe(t)), 0)
}

/**
 * A oferta limpa: nomes aparados (vazios saem), no máximo `TRADE_ITEMS_MAX`
 * itens de cada lado, ids pedidos sem repetição. `null` = moeda torta ou
 * troca sem nada dos dois lados — não há o que propor.
 */
export function cleanTradeTerms(raw: TradeProposal): TradeProposal | null {
  if (!isCoinAmount(raw.dou.moedas) || !isCoinAmount(raw.peco.moedas)) return null
  if (tradeTooBig(raw)) return null
  const itens = cleanGiveNames(raw.dou.itens)
  const itemIds = distinctIds(raw.peco.itemIds)
  const vazia = itens.length === 0 && raw.dou.moedas === 0 && itemIds.length === 0 && raw.peco.moedas === 0
  if (vazia) return null
  return { de: cleanTradeFrom(raw.de), dou: { itens, moedas: raw.dou.moedas }, peco: { itemIds, moedas: raw.peco.moedas } }
}

/**
 * A ficha da oferta no mapa que o jogador tem agora, só se é dele. É ela que
 * paga a contraproposta: o host não junta mochilas nem bolsas de fichas
 * diferentes. `undefined` = não é dele, ou não está no mapa dele.
 */
export function ownTradeToken(tokens: readonly Token[], ownTokens: readonly string[], tokenId: string): Token | undefined {
  return ownTokens.includes(tokenId) ? tokens.find((t) => t.id === tokenId) : undefined
}

/** A ficha tem cada item pedido (pelo id) e as moedas pedidas. */
export function canPay(token: Token, ask: TradeAsk): boolean {
  const carried = new Set(carriedItemsOf(token).map((item) => item.id))
  return ask.itemIds.every((id) => carried.has(id)) && isCoinAmount(ask.moedas) && moedasDe(token) >= ask.moedas
}

/**
 * "Pagar a…": `moedas` saem da bolsa de `giver` e entram na de `target`. `null`
 * = valor que não é moeda (zero inclusive), bolsa sem o bastante, pagar a si
 * mesmo ou bolsa de quem recebe acima do teto.
 */
export function payCoinsChange(giver: Token, target: Token, moedas: number): ItemChange | null {
  if (giver.id === target.id || !isCoinAmount(moedas) || moedas === 0) return null
  const tem = moedasDe(giver)
  const recebe = moedasDe(target) + moedas
  if (tem < moedas || recebe > MOEDAS_MAX) return null
  return {
    mochilas: [],
    bolsas: [
      { tokenId: giver.id, moedas: tem - moedas },
      { tokenId: target.id, moedas: recebe },
    ],
  }
}

/**
 * A troca aceita, na ficha `token`: saem os itens e as moedas de `ask`, entram
 * os itens de `give` (id novo cada um, por `freshId`) e as moedas. `null` =
 * a ficha não tem tudo o que é pedido, ou a bolsa passaria do teto — nada muda.
 */
export function tradeChange(token: Token, give: TradeGive, ask: TradeAsk, freshId: () => string): ItemChange | null {
  if (!canPay(token, ask) || !isCoinAmount(give.moedas)) return null
  const moedas = moedasDe(token) - ask.moedas + give.moedas
  if (moedas > MOEDAS_MAX) return null
  const pedidos = new Set(ask.itemIds)
  const fica = carriedItemsOf(token).filter((item) => !pedidos.has(item.id))
  const novos = give.itens.map((nome) => ({ id: freshId(), nome }))
  return { mochilas: [{ tokenId: token.id, mochila: [...fica, ...novos] }], bolsas: [{ tokenId: token.id, moedas }] }
}
