import type { CarriedItem, MapData, Pin, PinItem, Token } from '../types/map'
import { tokenRadiusOf } from './doorReach'

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
 * O item do pino, quando ele é pegável: nome não vazio e pino que não é de
 * viagem (a passagem não vai para a mochila). `null` = pino que só se lê.
 */
export function itemOfPin(pin: Pin): PinItem | null {
  if (pin.kind === 'viagem' || pin.item === undefined) return null
  const nome = cleanItemName(pin.item.nome)
  if (nome === '') return null
  return pin.item.livre === true ? { nome, livre: true } : { nome }
}

/**
 * `Pin.item` como vem do disco. Forma errada (arquivo editado à mão, versão
 * futura) volta AUSENTE — o pino só deixa de ser pegável; `livre` só vale
 * `true`: na dúvida, o pino pede ao mestre.
 */
export function readPinItem(value: unknown): PinItem | undefined {
  if (!isRecord(value) || typeof value.nome !== 'string') return undefined
  const nome = cleanItemName(value.nome)
  if (nome === '') return undefined
  return value.livre === true ? { nome, livre: true } : { nome }
}

/** Um item da mochila lido de fora (disco): id e nome de texto, nome não vazio. */
function readCarriedItem(value: unknown): CarriedItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '' || typeof value.nome !== 'string') return null
  const nome = cleanItemName(value.nome)
  return nome === '' ? null : { id: value.id, nome }
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
 * integrador só grava.
 */
export interface ItemChange {
  removePinId?: string
  addPin?: Pin
  mochilas: BackpackUpdate[]
}

/** "Tirar" do mestre: o item sai da mochila da ficha e some (a chave usada). `null` = a ficha não o tem. */
export function removeItemChange(token: Token, itemId: string): ItemChange | null {
  const mochila = carriedItemsOf(token)
  if (!mochila.some((item) => item.id === itemId)) return null
  return { mochilas: [{ tokenId: token.id, mochila: mochila.filter((item) => item.id !== itemId) }] }
}

/**
 * "Devolver ao chão" do mestre: o item sai da mochila e volta a ser pino
 * pegável ("!") onde a ficha está, pedindo ao mestre de novo. O pino usa o id
 * do item (o do pino de onde ele saiu); se já há um pino com esse id no mapa,
 * usa `freshPinId` — nunca sobrescreve outro pino.
 */
export function dropItemChange(map: MapData, token: Token, itemId: string, freshPinId: string): ItemChange | null {
  const item = carriedItemsOf(token).find((carried) => carried.id === itemId)
  const removed = removeItemChange(token, itemId)
  if (item === undefined || removed === null) return null
  const pinId = map.pins.some((pin) => pin.id === item.id) ? freshPinId : item.id
  const addPin: Pin = { id: pinId, x: token.x, y: token.y, kind: 'exclamacao', description: '', image: null, item: { nome: item.nome } }
  return { ...removed, addPin }
}

/** "Dar" do mestre: um item NOVO, com o nome aparado, no fim da mochila da ficha. `null` = nome vazio. */
export function giveNewItemChange(token: Token, nome: string, itemId: string): ItemChange | null {
  const clean = cleanItemName(nome)
  if (clean === '') return null
  return { mochilas: [{ tokenId: token.id, mochila: [...carriedItemsOf(token), { id: itemId, nome: clean }] }] }
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
  const byToken = new Map(change.mochilas.map((update) => [update.tokenId, update.mochila]))
  let tokensChanged = false
  const tokens = map.tokens.map((token) => {
    const mochila = byToken.get(token.id)
    if (mochila === undefined) return token
    tokensChanged = true
    if (mochila.length > 0) return { ...token, mochila }
    const { mochila: _vazia, ...semMochila } = token
    return semMochila
  })
  const removePinId = change.removePinId
  const pinGone = removePinId !== undefined && map.pins.some((p) => p.id === removePinId)
  const addPin = change.addPin
  const pinBack = addPin !== undefined && !map.pins.some((p) => p.id === addPin.id)
  if (!tokensChanged && !pinGone && !pinBack) return map
  const keptPins = pinGone ? map.pins.filter((p) => p.id !== removePinId) : map.pins
  return {
    ...map,
    tokens: tokensChanged ? tokens : map.tokens,
    pins: pinBack ? [...keptPins, addPin] : keptPins,
  }
}
