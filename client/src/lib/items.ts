import type { CarriedItem, DadosDoItem, MapData, Pin, PinItem, Prop, Token } from '../types/map'
import { tokenRadiusOf } from './doorReach'
import { venderItem } from './loja'
import { ehRefDeMidia } from './midia'

/**
 * ITEM PEGÁVEL — regras puras, compartilhadas pelo host (validar o "Pegar" e
 * o "Dar a…" do jogador), pelo integrador (aplicar na cena certa), pelo disco
 * e pelas telas. Sem DOM, sem store.
 */

/** Teto do nome do item, em unidades UTF-16: é texto que o jogador lê no cartão e na mochila. */
export const ITEM_NAME_MAX_LENGTH = 60

/** Folga além da borda da ficha, em células: "o item está ao alcance da mão" (mesma régua da porta). */
export const ITEM_REACH_CELLS = 1

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Nome aparado e cortado no teto. Não deixa meia letra: surrogate alto sozinho no fim sai. */
export function cleanItemName(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length <= ITEM_NAME_MAX_LENGTH) return trimmed
  const cut = trimmed.slice(0, ITEM_NAME_MAX_LENGTH)
  const last = cut.charCodeAt(cut.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut
}

/**
 * O item do pino, quando ele é pegável: nome não vazio e pino "!"/"?" (a
 * passagem e a alavanca não vão para a mochila). `null` = pino que só se lê.
 * Sai numa cópia limpa, com os dados do acervo que estiverem bons
 * (`readPinItem`): o host decide e grava a partir dela, nunca do objeto cru.
 */
export function itemOfPin(pin: Pick<Pin, 'kind' | 'item'>): PinItem | null {
  if (pin.kind === 'viagem' || pin.kind === 'alavanca' || pin.item === undefined) return null
  return readPinItem(pin.item) ?? null
}

/**
 * `Pin.item` (e `Prop.item`) como vem do disco. Forma errada (arquivo editado
 * à mão, versão futura) volta AUSENTE — o pino só deixa de ser pegável;
 * `livre` só vale `true`: na dúvida, o pino pede ao mestre. Os dados do acervo
 * passam pela mesma porta da mochila (`dadosDoItemLidos`): o pino "!" de
 * antes, só com o nome, volta igual.
 */
export function readPinItem(value: unknown): PinItem | undefined {
  if (!isRecord(value) || typeof value.nome !== 'string') return undefined
  const nome = cleanItemName(value.nome)
  if (nome === '') return undefined
  const item: PinItem = { nome, ...dadosDoItemLidos(value) }
  if (value.livre === true) item.livre = true
  return item
}

/** Teto da descrição do item: texto que o jogador lê no detalhe do inventário. */
export const ITEM_DESCRICAO_MAX = 2000
/** Teto do nome da categoria ("Consumível"). */
export const ITEM_CATEGORIA_MAX = 40
/** Teto do preço em berries: cabe com folga em `Number.isSafeInteger`, e a tela não desenha "1e+21". */
export const ITEM_PRECO_MAX = 1_000_000_000_000
/** Teto da pilha numa vaga. */
export const ITEM_QUANTIDADE_MAX = 9999
/** Id do item do acervo (`item_<uuid>` tem 41). */
const ITEM_ID_MAX = 80
const FORMA_DO_ITEM_ID = /^[A-Za-z0-9_-]+$/

/** Corta em `max` unidades UTF-16 sem deixar meio emoji no fim. */
function cortado(valor: string, max: number): string {
  if (valor.length <= max) return valor
  const ultima = valor.charCodeAt(max - 1)
  return valor.slice(0, ultima >= 0xd800 && ultima <= 0xdbff ? max - 1 : max)
}

function inteiroEntre(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max ? value : null
}

/**
 * Os dados do acervo que um item traz (`DadosDoItem`), lidos de fora: do
 * disco, do recorte do jogador, do snapshot. Campo torto SAI sozinho e o item
 * fica (com id e nome ele ainda é item); imagem só como referência de mídia —
 * a embutida engordaria todo snapshot e o caminho de disco não sai do mestre.
 */
export function dadosDoItemLidos(value: Record<string, unknown>): DadosDoItem {
  const dados: DadosDoItem = {}
  if (typeof value.itemId === 'string' && value.itemId.length <= ITEM_ID_MAX && FORMA_DO_ITEM_ID.test(value.itemId)) dados.itemId = value.itemId
  if (ehRefDeMidia(value.imagem)) dados.imagem = value.imagem
  if (typeof value.descricao === 'string' && value.descricao.trim() !== '') dados.descricao = cortado(value.descricao, ITEM_DESCRICAO_MAX)
  if (typeof value.categoria === 'string' && value.categoria.trim() !== '') dados.categoria = cortado(value.categoria.trim(), ITEM_CATEGORIA_MAX)
  const preco = inteiroEntre(value.preco, 0, ITEM_PRECO_MAX)
  if (preco !== null) dados.preco = preco
  const quantidade = inteiroEntre(value.quantidade, 1, ITEM_QUANTIDADE_MAX)
  // 1 é o ausente: a mochila gravada continua igual à de antes do campo.
  if (quantidade !== null && quantidade > 1) dados.quantidade = quantidade
  if (value.empilhavel === true) dados.empilhavel = true
  return dados
}

/** Um item da mochila lido de fora (disco, recorte): id e nome de texto, nome não vazio, e os dados do acervo que vierem bons. */
function readCarriedItem(value: unknown): CarriedItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '' || typeof value.nome !== 'string') return null
  const nome = cleanItemName(value.nome)
  return nome === '' ? null : { id: value.id, nome, ...dadosDoItemLidos(value) }
}

/** Quantos a vaga tem: ausente é 1. */
export function quantidadeDe(item: Pick<CarriedItem, 'quantidade'>): number {
  return item.quantidade ?? 1
}

/** `Token.mochila` como vem do disco: só os itens bons; lista vazia ou lixo volta ausente (mochila vazia). */
export function readCarriedItems(value: unknown): CarriedItem[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.flatMap((item) => {
    const read = readCarriedItem(item)
    return read === null ? [] : [read]
  })
  return items.length === 0 ? undefined : items
}

/** A mochila da ficha; ausente é vazia. */
export function carriedItemsOf(token: Token): CarriedItem[] {
  return token.mochila ?? []
}

/** O pino está ao alcance da ficha: até `ITEM_REACH_CELLS` célula além da borda dela. */
export function tokenReachesPin(token: Pick<Token, 'x' | 'y' | 'size'>, pin: Pick<Pin, 'x' | 'y'>, grid: number): boolean {
  const reach = tokenRadiusOf(token, grid) + grid * ITEM_REACH_CELLS
  return Math.hypot(token.x - pin.x, token.y - pin.y) <= reach
}

/** Duas fichas encostadas: entre as bordas cabe no máximo `ITEM_REACH_CELLS` célula. */
export function tokensTouch(a: Pick<Token, 'x' | 'y' | 'size'>, b: Pick<Token, 'x' | 'y' | 'size'>, grid: number): boolean {
  const reach = tokenRadiusOf(a, grid) + tokenRadiusOf(b, grid) + grid * ITEM_REACH_CELLS
  return Math.hypot(a.x - b.x, a.y - b.y) <= reach
}

/** A mochila nova de uma ficha. */
export interface BackpackUpdate {
  tokenId: string
  mochila: CarriedItem[]
}

/**
 * O que muda no mapa quando um item troca de lugar: o pino pego sai
 * (`removePinId`), o item devolvido ao chão vira pino (`addPin`) e cada ficha
 * envolvida recebe a mochila nova INTEIRA — quem decidiu já calculou, e o
 * integrador só grava. ITEM NO CHÃO (entrega 5): o mesmo para a imagem do
 * item deitada no mapa, que é um objeto (`removePropId`, `addProp`).
 */
export interface ItemChange {
  removePinId?: string
  addPin?: Pin
  removePropId?: string
  addProp?: Prop
  mochilas: BackpackUpdate[]
  /**
   * LOJA COM PREÇOS — "Vender": a mercadoria `itemId` da banca `pinId` perde
   * um do estoque (`venderItem`, `lib/loja.ts`), na MESMA mudança que põe a
   * mercadoria na mochila de quem comprou — um Ctrl+Z do mestre não desfaz um
   * lado sem o outro. A banca continua no mapa.
   */
  venda?: { pinId: string; itemId: string }
  /**
   * MOEDAS E TROCA: a bolsa nova INTEIRA de cada ficha envolvida, na MESMA
   * mudança das mochilas — pagar e trocar nunca gravam um lado sem o outro.
   * Zero tira o campo (ausente === bolsa vazia). Ausente = nenhuma bolsa muda.
   */
  bolsas?: BolsaUpdate[]
}

/** A bolsa nova de uma ficha (MOEDAS E TROCA). */
export interface BolsaUpdate {
  tokenId: string
  moedas: number
}

/** "Tirar" do mestre: o item sai da mochila da ficha e some (a chave usada). `null` = a ficha não o tem. */
export function removeItemChange(token: Token, itemId: string): ItemChange | null {
  const mochila = carriedItemsOf(token)
  if (!mochila.some((item) => item.id === itemId)) return null
  return { mochilas: [{ tokenId: token.id, mochila: mochila.filter((item) => item.id !== itemId) }] }
}

/** "Dar" do mestre: um item NOVO, com o nome aparado, no fim da mochila da ficha. `null` = nome vazio. */
export function giveNewItemChange(token: Token, nome: string, itemId: string): ItemChange | null {
  const clean = cleanItemName(nome)
  if (clean === '') return null
  return { mochilas: [{ tokenId: token.id, mochila: [...carriedItemsOf(token), { id: itemId, nome: clean }] }] }
}

/** O item do acervo como ele é dado: o nome e os dados que vão para a mochila. */
export type ItemParaDar = DadosDoItem & { nome: string }

/**
 * "Dar a…" do ACERVO DE ITENS (o mestre dá um item do acervo a um
 * personagem). Empilhável com o mesmo `itemId` já na mochila: soma na vaga
 * que existe (até `ITEM_QUANTIDADE_MAX`), com os dados de agora do acervo.
 * O resto abre vaga nova no fim, com `freshId`; o não empilhável vai sempre
 * um por vez. `null` = nome vazio.
 */
export function darDoAcervoChange(token: Token, item: ItemParaDar, quantidade: number, freshId: string): ItemChange | null {
  const nome = cleanItemName(item.nome)
  if (nome === '') return null
  const { nome: _nome, quantidade: _quantidade, ...dados } = item
  const lidos = dadosDoItemLidos(dados)
  const mochila = carriedItemsOf(token)
  const pedida = Number.isSafeInteger(quantidade) ? Math.min(Math.max(quantidade, 1), ITEM_QUANTIDADE_MAX) : 1
  const existente = lidos.empilhavel === true && lidos.itemId !== undefined ? mochila.find((carried) => carried.itemId === lidos.itemId) : undefined
  if (existente !== undefined) {
    const soma = Math.min(quantidadeDe(existente) + pedida, ITEM_QUANTIDADE_MAX)
    const atualizado: CarriedItem = { id: existente.id, nome, ...lidos, ...(soma > 1 ? { quantidade: soma } : {}) }
    return { mochilas: [{ tokenId: token.id, mochila: mochila.map((carried) => (carried === existente ? atualizado : carried)) }] }
  }
  const quantos = lidos.empilhavel === true ? pedida : 1
  const novo: CarriedItem = { id: freshId, nome, ...lidos, ...(quantos > 1 ? { quantidade: quantos } : {}) }
  return { mochilas: [{ tokenId: token.id, mochila: [...mochila, novo] }] }
}

/** Uma ficha a quem o jogador pode dar um item. */
export interface GiveTarget {
  tokenId: string
  name: string
}

/**
 * O "Dar a…" do jogador: só as fichas de COLEGAS (`partyTokenIds`, que o host
 * manda no snapshot) encostadas numa ficha dele. NPC e monstro do mestre não
 * entram — o host recusaria, e a opção nunca funcionaria.
 */
export function giveTargets(map: MapData, ownTokenIds: readonly string[], partyTokenIds: readonly string[]): GiveTarget[] {
  const mine = map.tokens.filter((t) => ownTokenIds.includes(t.id))
  return map.tokens
    .filter((t) => !ownTokenIds.includes(t.id) && partyTokenIds.includes(t.id) && mine.some((m) => tokensTouch(m, t, map.grid)))
    .map((t) => ({ tokenId: t.id, name: t.name }))
}

/**
 * Aplica a mudança num mapa. Mochila vazia some do token (ausente === vazia,
 * o mapa gravado continua igual ao de antes do campo). Pino ou ficha que não
 * existem mais não mudam nada, pino devolvido que já está lá não duplica — e
 * nada mudando devolve o MESMO mapa.
 */
export function applyItemChange(map: MapData, change: ItemChange): MapData {
  const venda = change.venda
  const vendido = venda === undefined ? map : venderItem(map, venda.pinId, venda.itemId)
  return applyBackpacksAndPins(vendido, change)
}

/** A ficha com a mochila nova; vazia tira o campo. */
function withBackpack(token: Token, mochila: CarriedItem[]): Token {
  if (mochila.length > 0) return { ...token, mochila }
  const { mochila: _vazia, ...semMochila } = token
  return semMochila
}

/** A ficha com a bolsa nova; zero (ou valor que não é moeda) tira o campo. */
function withPurse(token: Token, moedas: number): Token {
  if (Number.isInteger(moedas) && moedas > 0) return { ...token, moedas }
  const { moedas: _vazia, ...semBolsa } = token
  return semBolsa
}

/** As mochilas, as bolsas e o pino (ou o objeto no chão) que sai ou volta; nada mudando, o MESMO mapa. */
function applyBackpacksAndPins(map: MapData, change: ItemChange): MapData {
  const byToken = new Map(change.mochilas.map((update) => [update.tokenId, update.mochila]))
  const bolsaByToken = new Map((change.bolsas ?? []).map((update) => [update.tokenId, update.moedas]))
  let tokensChanged = false
  const tokens = map.tokens.map((token) => {
    const mochila = byToken.get(token.id)
    const moedas = bolsaByToken.get(token.id)
    if (mochila === undefined && moedas === undefined) return token
    tokensChanged = true
    const comMochila = mochila === undefined ? token : withBackpack(token, mochila)
    return moedas === undefined ? comMochila : withPurse(comMochila, moedas)
  })
  const removePinId = change.removePinId
  const pinGone = removePinId !== undefined && map.pins.some((p) => p.id === removePinId)
  const addPin = change.addPin
  const pinBack = addPin !== undefined && !map.pins.some((p) => p.id === addPin.id)
  const removePropId = change.removePropId
  const propGone = removePropId !== undefined && map.props.some((p) => p.id === removePropId)
  const addProp = change.addProp
  const propBack = addProp !== undefined && !map.props.some((p) => p.id === addProp.id)
  if (!tokensChanged && !pinGone && !pinBack && !propGone && !propBack) return map
  const keptPins = pinGone ? map.pins.filter((p) => p.id !== removePinId) : map.pins
  const keptProps = propGone ? map.props.filter((p) => p.id !== removePropId) : map.props
  return {
    ...map,
    tokens: tokensChanged ? tokens : map.tokens,
    pins: pinBack ? [...keptPins, addPin] : keptPins,
    props: propBack ? [...keptProps, addProp] : keptProps,
  }
}
