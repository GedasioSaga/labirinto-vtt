import type { CarriedItem, DoorState, Token } from '../types/map'
import { carriedItemsOf, cleanItemName } from './items'

/**
 * CHAVE ABRE PORTA — regras puras, compartilhadas pelo host (que ficha tem a
 * chave desta porta), pelo disco e pelo painel do mestre. Sem DOM, sem store.
 * O nome da porta ("Abre com") e o do item se comparam pelo nome aparado, sem
 * diferença de maiúscula: o mestre digita os dois em momentos diferentes.
 */

function comparableName(nome: string): string {
  return cleanItemName(nome).normalize('NFC').toLocaleLowerCase('pt-BR')
}

/** A chave desta porta: a primeira ficha de `tokens` com o item de nome igual ao "Abre com". `null` = ninguém abre. */
export function keyForDoor(door: DoorState, tokens: readonly Token[]): { token: Token; item: CarriedItem } | null {
  if (door.abreCom === undefined) return null
  const wanted = comparableName(door.abreCom)
  if (wanted === '') return null
  for (const token of tokens) {
    const item = carriedItemsOf(token).find((carried) => comparableName(carried.nome) === wanted)
    if (item !== undefined) return { token, item }
  }
  return null
}

/** O "Abre com" que o mestre digitou: nome aparado; vazio tira o campo (a porta volta a abrir só pelo mestre). */
export function setDoorKey(door: DoorState, nome: string): DoorState {
  const clean = cleanItemName(nome)
  const { abreCom: _anterior, ...semChave } = door
  return clean === '' ? semChave : { ...semChave, abreCom: clean }
}

/** `DoorState.abreCom` como vem do disco: texto não vazio, aparado; qualquer outra coisa volta ausente. */
export function readDoorKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const clean = cleanItemName(value)
  return clean === '' ? undefined : clean
}
