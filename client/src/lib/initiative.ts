/**
 * ORDEM DE INICIATIVA — lógica pura, sem store e sem DOM.
 *
 * O mestre dá um valor a cada ficha da cena; quem tem valor entra na ordem, do
 * maior para o menor. A VEZ é uma ficha só, de um mapa só: `TurnRef` leva o id
 * do mapa (`MapData.id`, a mesma chave de cena do host) para a vez de uma cena
 * nunca acender numa ficha de mesmo id em outra.
 */

export interface TurnRef {
  mapId: string
  tokenId: string
}

export interface InitiativeToken {
  id: string
  name: string
}

export interface InitiativeEntry {
  id: string
  name: string
  value: number
}

/**
 * A ficha da vez NESTE mapa, ou `null`. Vez de outro mapa não vale aqui, e vez
 * de ficha que SAIU do mapa (apagada, ou viajou para outra cena) também não:
 * senão ela prenderia todo jogador da cena com "Espere sua vez" enquanto o
 * painel do mestre, que não a acha na ordem, mostra "Começar" como se não
 * houvesse combate. Derivar em vez de apagar a vez deixa o desfazer da ficha
 * apagada devolver a vez junto.
 */
export function turnTokenIdOn(turn: TurnRef | null, map: { id: string; tokens: readonly { id: string }[] }): string | null {
  if (turn === null || turn.mapId !== map.id) return null
  return map.tokens.some((token) => token.id === turn.tokenId) ? turn.tokenId : null
}

/**
 * Fichas com valor, do maior para o menor. Empate fica na ordem do mapa
 * (`sort` é estável): o mestre desempata trocando um valor, não adivinhando a
 * regra do app. Valor guardado de ficha que já não está na cena não entra.
 */
export function initiativeOrder(tokens: readonly InitiativeToken[], values: Readonly<Record<string, number>>): InitiativeEntry[] {
  const entries: InitiativeEntry[] = []
  for (const token of tokens) {
    const value = values[token.id]
    if (value !== undefined) entries.push({ id: token.id, name: token.name, value })
  }
  return entries.sort((a, b) => b.value - a.value)
}

/**
 * Quem vem depois de `current`. Do último volta ao primeiro. Sem vez, ou com a
 * vez de quem saiu da ordem, começa no primeiro. Ordem vazia: ninguém.
 */
export function nextTurnTokenId(order: readonly InitiativeEntry[], current: string | null): string | null {
  const first = order[0]
  if (first === undefined) return null
  const index = current === null ? -1 : order.findIndex((entry) => entry.id === current)
  if (index === -1) return first.id
  return order[(index + 1) % order.length]?.id ?? first.id
}

export type InitiativeInput = { ok: true; value: number | null } | { ok: false }

/** O que o mestre digitou: número finito vale; vazio tira a ficha da ordem; o resto é recusado. */
export function parseInitiativeInput(raw: string): InitiativeInput {
  const text = raw.trim()
  if (text.length === 0) return { ok: true, value: null }
  const value = Number(text)
  return Number.isFinite(value) ? { ok: true, value } : { ok: false }
}
