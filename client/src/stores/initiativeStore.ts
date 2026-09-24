import { create } from 'zustand'
import { initiativeOrder, nextTurnTokenId, type InitiativeToken, type TurnRef } from '../lib/initiative'

/**
 * INICIATIVA da mesa: o valor de cada ficha e de quem é a vez. Não vai ao
 * arquivo do mapa — é estado da sessão de jogo, como o laser e o seguir. O
 * valor é guardado por mapa (`MapData.id`): a ordem da Ponte não aparece na
 * Cripta, e voltar à Ponte a devolve como estava.
 *
 * O que o JOGADOR recebe disto é só o id da ficha da vez, e só quando ela está
 * no recorte dele (`lib/fogFilter.ts` → `turnForPlayer`).
 */

interface InitiativeState {
  values: Record<string, Record<string, number>>
  turn: TurnRef | null
  /** `null` tira a ficha da ordem. Tirar a ficha da vez encerra a vez. */
  setValue: (mapId: string, tokenId: string, value: number | null) => void
  setTurn: (turn: TurnRef | null) => void
  /**
   * A ficha `fromId` deste mapa passou a se chamar `toId` (ver
   * `adventureStore.transferToken`): o valor e a vez dela vão junto. O mesmo id
   * em outro mapa é outra ficha e fica como está.
   */
  renameToken: (mapId: string, fromId: string, toId: string) => void
  stop: () => void
  reset: () => void
}

export const useInitiativeStore = create<InitiativeState>()((set, get) => ({
  values: {},
  turn: null,

  setValue: (mapId, tokenId, value) => {
    const current = get().values[mapId] ?? {}
    if (value === null && !(tokenId in current)) return
    if (value !== null && current[tokenId] === value) return
    const next = { ...current }
    if (value === null) delete next[tokenId]
    else next[tokenId] = value
    const turn = get().turn
    const lostTurn = value === null && turn !== null && turn.mapId === mapId && turn.tokenId === tokenId
    set({ values: { ...get().values, [mapId]: next }, turn: lostTurn ? null : turn })
  },

  setTurn: (turn) => set({ turn }),

  renameToken: (mapId, fromId, toId) => {
    const { values, turn } = get()
    const current = values[mapId]
    const hasValue = current !== undefined && fromId in current
    const hasTurn = turn !== null && turn.mapId === mapId && turn.tokenId === fromId
    if (!hasValue && !hasTurn) return
    let nextValues = values
    if (hasValue) {
      const { [fromId]: value, ...rest } = current
      nextValues = { ...values, [mapId]: { ...rest, [toId]: value } }
    }
    set({ values: nextValues, turn: hasTurn ? { mapId, tokenId: toId } : turn })
  },

  stop: () => {
    if (get().turn !== null) set({ turn: null })
  },

  reset: () => set({ values: {}, turn: null }),
}))

function orderOf(mapId: string, tokens: readonly InitiativeToken[]) {
  return initiativeOrder(tokens, useInitiativeStore.getState().values[mapId] ?? {})
}

/** "Começar": a vez vai ao primeiro da ordem desta cena. Ordem vazia não começa nada. */
export function startTurn(mapId: string, tokens: readonly InitiativeToken[]): void {
  const first = nextTurnTokenId(orderOf(mapId, tokens), null)
  if (first !== null) useInitiativeStore.getState().setTurn({ mapId, tokenId: first })
}

/**
 * "Próxima vez" (botão ou Shift+N). Só anda quando a vez é DESTA cena: a tecla
 * apertada olhando outra cena não arrasta o combate para cá.
 */
export function advanceTurn(mapId: string, tokens: readonly InitiativeToken[]): void {
  const turn = useInitiativeStore.getState().turn
  if (turn === null || turn.mapId !== mapId) return
  const next = nextTurnTokenId(orderOf(mapId, tokens), turn.tokenId)
  useInitiativeStore.getState().setTurn(next === null ? null : { mapId, tokenId: next })
}
