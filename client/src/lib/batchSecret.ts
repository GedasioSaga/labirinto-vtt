import type { MapData } from '../types/map'
import type { SelectionKind } from '../types/tools'
import { setItemSecret, type SecretKind } from './mapFactory'
import type { SelectionSet } from './selectionModel'

/**
 * "Oculto para jogadores" EM LOTE (gestos rápidos do editor, 22/09/2026):
 * revelar 4 guardas era um clique por ficha. O checkbox do painel da seleção
 * tem três estados — nenhum, todos, misturado — e um clique vale para todos.
 */
export type SecretBatchState = 'none' | 'all' | 'mixed'

export interface SelectionSecretSummary {
  state: SecretBatchState
  /** Quantos itens da seleção aceitam "Oculto para jogadores". */
  count: number
}

/** Parede, luz e chão não têm "oculto": ficam fora do lote. */
function secretKindOf(kind: SelectionKind): SecretKind | null {
  switch (kind) {
    case 'token':
    case 'region':
    case 'prop':
    case 'stair':
    case 'drawing':
      return kind
    case 'wall':
    case 'light':
    case 'floor':
      return null
  }
}

/** `null` quando o item não existe mais no mapa (id velho depois de um Ctrl+Z). */
function secretOf(map: MapData, kind: SecretKind, id: string): boolean | null {
  const find = <T extends { id: string; secret?: boolean }>(items: readonly T[]): boolean | null => {
    const item = items.find((i) => i.id === id)
    return item === undefined ? null : item.secret === true
  }
  switch (kind) {
    case 'token':
      return find(map.tokens)
    case 'region':
      return find(map.regions)
    case 'prop':
      return find(map.props)
    case 'stair':
      return find(map.stairs)
    case 'drawing':
      return find(map.drawings)
    case 'pin':
      return find(map.pins)
  }
}

/** Estado do lote, ou `null` quando nada selecionado aceita o controle. */
export function selectionSecretState(map: MapData, selection: SelectionSet): SelectionSecretSummary | null {
  let hidden = 0
  let count = 0
  for (const item of selection) {
    const kind = secretKindOf(item.kind)
    if (kind === null) continue
    const secret = secretOf(map, kind, item.id)
    if (secret === null) continue
    count += 1
    if (secret) hidden += 1
  }
  if (count === 0) return null
  const state: SecretBatchState = hidden === 0 ? 'none' : hidden === count ? 'all' : 'mixed'
  return { state, count }
}

/**
 * Liga/desliga "Oculto para jogadores" em todos os itens da seleção que
 * aceitam. Nada mudando devolve o MESMO `map` — é o que deixa o store não
 * gastar entrada do desfazer num clique sem efeito.
 */
export function setSelectionSecret(map: MapData, selection: SelectionSet, secret: boolean): MapData {
  let next = map
  for (const item of selection) {
    const kind = secretKindOf(item.kind)
    if (kind !== null) next = setItemSecret(next, kind, item.id, secret)
  }
  return next
}
