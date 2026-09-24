import { selectionFromItems, selectionHas, selectionOfItem, type SelectionItem, type SelectionSet } from './selectionModel'

/**
 * Agrupar objetos (Ctrl+G) — item 18 de `docs/features-candidatas-2026-09-21.md`.
 * Módulo PURO: sem store, sem Pixi.
 *
 * A dor: a seleção de vários só vive enquanto está marcada. Desmarcou, mover a
 * casa volta a ser parede por parede. Um grupo guarda o conjunto; um clique em
 * qualquer membro devolve o conjunto inteiro, e o arrasto leva todos juntos.
 *
 * Sem grupo dentro de grupo (fora da régua): agrupar um item que já é de um
 * grupo FUNDE aquele grupo no novo, então cada item está em no máximo um grupo.
 */
export interface ItemGroup {
  readonly id: string
  readonly members: SelectionSet
}

export type ItemGroups = readonly ItemGroup[]

export const NO_GROUPS: ItemGroups = []

/** Grupos que têm pelo menos um item da seleção. */
function groupsTouching(groups: ItemGroups, selection: SelectionSet): ItemGroups {
  return groups.filter((group) => group.members.some((member) => selectionHas(selection, member)))
}

/**
 * Junta a seleção num grupo `id`. Menos de 2 itens (contando os grupos
 * fundidos) não é grupo: devolve `groups` intacto, mesma referência.
 */
export function groupItems(groups: ItemGroups, selection: SelectionSet, id: string): ItemGroups {
  const touched = groupsTouching(groups, selection)
  const members = selectionFromItems([...selection, ...touched.flatMap((group) => group.members)])
  if (members.length < 2) return groups
  return [...groups.filter((group) => !touched.includes(group)), { id, members }]
}

/** Desfaz todo grupo que tem item na seleção. Nenhum tocado: mesma referência. */
export function ungroupItems(groups: ItemGroups, selection: SelectionSet): ItemGroups {
  const touched = groupsTouching(groups, selection)
  if (touched.length === 0) return groups
  return groups.filter((group) => !touched.includes(group))
}

export function groupOfItem(groups: ItemGroups, item: SelectionItem): ItemGroup | null {
  return groups.find((group) => selectionHas(group.members, item)) ?? null
}

/** 2+ itens selecionados, todos do MESMO grupo — o painel chama isso de "Grupo". */
export function isSingleGroup(groups: ItemGroups, selection: SelectionSet): boolean {
  if (selection.length < 2) return false
  const group = groupOfItem(groups, selection[0])
  return group !== null && selection.every((item) => selectionHas(group.members, item))
}

/**
 * O que um clique em `item` seleciona: o grupo inteiro, ou só ele.
 *
 * `reachable` diz se um membro ainda pode ser pego (existe no mapa, camada não
 * travada). Membro apagado some da expansão em vez de virar id fantasma na
 * seleção. Se o próprio clicado não é alcançável, ou sobra só ele, vale o item
 * sozinho — o comportamento de antes do grupo.
 */
export function expandToGroup(groups: ItemGroups, item: SelectionItem, reachable: (member: SelectionItem) => boolean): SelectionSet {
  const group = groupOfItem(groups, item)
  if (group === null || !reachable(item)) return selectionOfItem(item)
  const members = group.members.filter(reachable)
  return members.length < 2 ? selectionOfItem(item) : selectionFromItems(members)
}
