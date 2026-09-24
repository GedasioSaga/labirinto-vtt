import type { CarriedItem, DoorState, Pin, Token } from '../types/map'
import { carriedItemsOf, cleanItemName } from './items'
import { passageOf } from './pins'

/**
 * CHAVE ABRE PORTA — regras puras, compartilhadas pelo host (que ficha tem a
 * chave desta porta ou deste pino), pelo disco e pelo painel do mestre. Sem
 * DOM, sem store. O "Abre com" e o nome do item se comparam pelo nome
 * aparado, sem diferença de maiúscula: o mestre digita os dois em momentos
 * diferentes.
 */

function comparableName(nome: string): string {
  return cleanItemName(nome).normalize('NFC').toLocaleLowerCase('pt-BR')
}

/** A primeira ficha de `tokens` com o item de nome igual a `abreCom`. `null` = ninguém abre. */
function keyNamed(abreCom: string | undefined, tokens: readonly Token[]): { token: Token; item: CarriedItem } | null {
  if (abreCom === undefined) return null
  const wanted = comparableName(abreCom)
  if (wanted === '') return null
  for (const token of tokens) {
    const item = carriedItemsOf(token).find((carried) => comparableName(carried.nome) === wanted)
    if (item !== undefined) return { token, item }
  }
  return null
}

/** A chave desta porta: a primeira ficha de `tokens` com o item de nome igual ao "Abre com". `null` = ninguém abre. */
export function keyForDoor(door: DoorState, tokens: readonly Token[]): { token: Token; item: CarriedItem } | null {
  return keyNamed(door.abreCom, tokens)
}

/**
 * A chave deste pino de viagem: só no TRANCADO — nos outros modos o jogador
 * já passa (livre) ou pede (pede), e o "Abre com" que sobrou de quando ele era
 * trancado não muda nada. `null` = ninguém passa com item.
 */
export function keyForPin(pin: Pin, tokens: readonly Token[]): { token: Token; item: CarriedItem } | null {
  if (pin.kind !== 'viagem' || passageOf(pin) !== 'trancada') return null
  return keyNamed(pin.abreCom, tokens)
}

/** O "Abre com" que o mestre digitou: nome aparado; vazio tira o campo (a porta volta a abrir só pelo mestre). */
export function setDoorKey(door: DoorState, nome: string): DoorState {
  const clean = cleanItemName(nome)
  const { abreCom: _anterior, ...semChave } = door
  return clean === '' ? semChave : { ...semChave, abreCom: clean }
}

/** `abreCom` (da porta ou do pino) como vem do disco ou do campo: texto não vazio, aparado; qualquer outra coisa volta ausente. */
export function readDoorKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const clean = cleanItemName(value)
  return clean === '' ? undefined : clean
}
