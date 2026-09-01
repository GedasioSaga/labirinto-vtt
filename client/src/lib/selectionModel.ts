/**
 * Modelo CANÔNICO de seleção (item 24 do `docs/PLANO-REFINAMENTO.md`, Frente
 * C da Onda 4). Módulo PURO — sem PixiJS, sem store, sem wiring em nenhum
 * consumidor. Ninguém importa este arquivo ainda; quem liga é o integrador
 * da Onda 4 (ver seção "CONTRATO — migração" no fim deste comentário).
 *
 * PROBLEMA que este arquivo resolve: hoje existem DOIS conceitos de seleção
 * paralelos e incompatíveis —
 *
 *  - `Selection` (`types/tools.ts`): UM item, `{ kind, id } | null`. É o que
 *    clique simples usa.
 *  - `AreaSelection` (`lib/areaSelection.ts`): um CONJUNTO, mas representado
 *    como um record de 7 arrays de id — um campo por `SelectionKind`, no
 *    plural (`walls`, `regions`, `lights`, `tokens`, `props`, `stairs`,
 *    `drawings`). É o que o marquee (arrastar um retângulo) usa.
 *
 * Toda feature de manipulação de seleção (mover, deletar, duplicar, travar)
 * hoje precisa saber de qual das duas está falando — é por isso que unificar
 * as duas é o único refactor estrutural do plano. Este módulo introduz um
 * terceiro tipo, `SelectionSet` = `readonly SelectionItem[]` (sem duplicata
 * de `(kind,id)`), que representa os dois casos com a MESMA forma: seleção
 * de um item é um `SelectionSet` de tamanho 1 (array comum, sem estrutura
 * extra — o caso dominante não paga nada a mais); seleção de área é um
 * `SelectionSet` de tamanho N. Shift+clique — somar/alternar item a item,
 * hoje inexistente no app — vira `toggleSelectionItem` nesta forma.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CONTRATO — migração (para o integrador da Onda 4, ler antes de tocar em
 * `stores/mapStore.ts` / `lib/selectionHitTest.ts` / `lib/areaSelection.ts` /
 * `pixi/PixiCanvas.tsx:1034-1114` / `components/PropertiesPanel.tsx`):
 *
 * 1. `stores/mapStore.ts` — os dois campos de estado, `selection: Selection
 *    | null` e `areaSelection: AreaSelection | null`, viram UM campo:
 *    `selection: SelectionSet` (nunca `null` — vazio é `EMPTY_SELECTION`,
 *    não `null`; isso elimina toda checagem `if (!selection) return` que
 *    hoje existe SÓ por causa do `null`, ver `layerForSelection`,
 *    `cloneSelectedEntity`, `removeSelected` etc.). Migração mecânica:
 *      - todo `set({ selection })` de UM item vira
 *        `set({ selection: selectionOfItem({ kind, id }) })`
 *      - todo `set({ selection: null })` vira `set({ selection:
 *        EMPTY_SELECTION })`
 *      - todo `set({ areaSelection })` (resultado de `selectEntitiesInArea`)
 *        vira `set({ selection: selectionFromAreaSelection(areaSelection) })`
 *      - `setAreaSelection(null)` some — usa a mesma limpeza do item único
 *      - `moveAreaSelectionLive` e o `moveAreaSelection` de
 *        `lib/areaSelection.ts` continuam recebendo `AreaSelection`: chame
 *        `selectionToAreaSelection(get().selection)` na borda, na hora de
 *        montar o argumento — `lib/areaSelection.ts` não precisa mudar.
 *      - todo lugar que hoje lê `selection.kind`/`selection.id` (single) —
 *        `layerForSelection`, `cloneSelectedEntity`, os `Record<SelectionKind,
 *        ...>` de `removeSelected`/`duplicateSelected` — passa a chamar
 *        `selectionSingle(get().selection)` primeiro; `null` cai no mesmo
 *        early-return que já existe hoje para `selection === null`.
 *
 * 2. `lib/selectionHitTest.ts` — NENHUMA mudança de assinatura. Continua
 *    devolvendo `Selection | null` (um único hit por clique); o integrador
 *    decide no callsite (`PixiCanvas.tsx`) se o resultado vira
 *    `selectionOfItem(hit)` (clique simples, substitui) ou
 *    `toggleSelectionItem(get().selection, hit)` (Shift+clique, soma/tira).
 *
 * 3. `lib/areaSelection.ts` — NENHUMA mudança de assinatura.
 *    `selectEntitiesInArea` continua devolvendo `AreaSelection` (é a forma
 *    mais barata pra varrer o mapa por `kind`, já filtrando por camada/lock
 *    dentro de cada bloco); o integrador só some o resultado no
 *    `SelectionSet` existente via `selectionFromAreaSelection`, em vez de
 *    substituir — isso é o que dá suporte a "Shift+arrastar soma uma área
 *    inteira à seleção item-a-item já existente", que hoje não é possível
 *    porque os dois campos são independentes.
 *
 * 4. `pixi/PixiCanvas.tsx:1034-1114` (hit-test de clique) — pointerdown sem
 *    Shift: `set({ selection: selectionOfItem(hit) })` se acertou algo,
 *    `set({ selection: EMPTY_SELECTION })` se não. Pointerdown COM Shift
 *    sobre um item: `set({ selection: toggleSelectionItem(get().selection,
 *    hit) })`. Fim do marquee (Shift+arrastar hoje, ou arrastar puro depois
 *    do item #8 da Onda 1 mudar o gesto padrão): `set({ selection:
 *    selectionFromItems([...get().selection, ...selectionFromAreaSelection(
 *    selectEntitiesInArea(map, rect))]) })` — `selectionFromItems` já
 *    deduplica, então somar a seleção atual com a nova área não duplica item
 *    que já estava nos dois.
 *
 * 5. `components/PropertiesPanel.tsx` — hoje decide o que renderizar a
 *    partir de `selection?.kind`. Passa a chamar `selectionSingle(selection)`
 *    primeiro: item único mostra o painel de propriedades de sempre (mesmo
 *    caminho, `null` no lugar de `undefined`/ausência não muda nada visível);
 *    `selectionSingle` devolvendo `null` com `selection.length > 1` é estado
 *    NOVO (múltiplos itens selecionados) que hoje não existe — decisão de UI
 *    (esconder o painel? mostrar contagem?) fica para quem integra, este
 *    módulo só entrega o jeito de perguntar "é um item só, ou vários?".
 * ─────────────────────────────────────────────────────────────────────────
 */
import type { Selection, SelectionKind } from '../types/tools'
import type { AreaSelection } from './areaSelection'

/** Um item selecionado, identificado por tipo + id — mesmo par que
 *  `Selection` (`types/tools.ts`) já usa para o caso de um item só. */
export interface SelectionItem {
  readonly kind: SelectionKind
  readonly id: string
}

/**
 * Conjunto canônico de seleção: array imutável de `SelectionItem`, sem
 * duplicata de `(kind,id)`. SEM ordem semântica imposta por este módulo além
 * de "ordem de inserção, preservada" — que é o que dá ao integrador um jeito
 * barato de saber "qual foi selecionado por último" (`selection.at(-1)`) sem
 * precisar de um campo extra.
 *
 * Caso de UM item — o dominante, ver diagnóstico do item 24 no plano — é só
 * um array de tamanho 1: nenhuma estrutura extra, nenhum campo a mais,
 * nenhuma alocação além do próprio array. Todas as operações abaixo são
 * O(n) sobre o TAMANHO DA SELEÇÃO (quantos objetos o usuário selecionou ao
 * mesmo tempo), nunca sobre o tamanho do mapa — não existe cenário de uso em
 * que isso pese (uma sessão de mesa não seleciona milhares de objetos de
 * uma vez).
 */
export type SelectionSet = readonly SelectionItem[]

/** Seleção vazia. Serve tanto de valor inicial ("criar vazio") quanto de
 *  resultado de "limpar seleção" — as duas operações produzem o mesmo valor,
 *  então não existe uma função `clearSelection` separada: `set({ selection:
 *  EMPTY_SELECTION })` já É o "limpar". */
export const EMPTY_SELECTION: SelectionSet = []

function sameItem(a: SelectionItem, b: SelectionItem): boolean {
  return a.kind === b.kind && a.id === b.id
}

// ─────────────────────────────────────────────────────────────
// Construir
// ─────────────────────────────────────────────────────────────

/** "A partir de um item" — o caminho de clique simples. */
export function selectionOfItem(item: SelectionItem): SelectionSet {
  return [item]
}

/**
 * "A partir de uma lista" — deduplica por `(kind,id)`, preservando a
 * primeira ocorrência de cada item na ordem em que aparece em `items`.
 * Usada tanto pra construir uma seleção do zero quanto pra somar seleções
 * (`selectionFromItems([...a, ...b])`), o que é o mecanismo por trás de
 * "Shift+arrastar soma uma área à seleção item-a-item existente" (ver
 * CONTRATO item 4 acima).
 */
export function selectionFromItems(items: readonly SelectionItem[]): SelectionSet {
  const result: SelectionItem[] = []
  for (const item of items) {
    if (!result.some((existing) => sameItem(existing, item))) result.push(item)
  }
  return result
}

// ─────────────────────────────────────────────────────────────
// Transformar (sempre imutável — devolve um SelectionSet novo)
// ─────────────────────────────────────────────────────────────

/** Somar: item já presente devolve a MESMA referência (sem no-op de
 *  alocação); item ausente devolve um array novo com ele no fim. */
export function addSelectionItem(selection: SelectionSet, item: SelectionItem): SelectionSet {
  if (selectionHas(selection, item)) return selection
  return [...selection, item]
}

/** Remover: item ausente devolve a MESMA referência; item presente devolve
 *  um array novo sem ele. */
export function removeSelectionItem(selection: SelectionSet, item: SelectionItem): SelectionSet {
  if (!selectionHas(selection, item)) return selection
  return selection.filter((existing) => !sameItem(existing, item))
}

/** Alternar — é o Shift+clique (item 24 do plano, hoje inexistente):
 *  presente → sai da seleção; ausente → entra. */
export function toggleSelectionItem(selection: SelectionSet, item: SelectionItem): SelectionSet {
  return selectionHas(selection, item) ? removeSelectionItem(selection, item) : addSelectionItem(selection, item)
}

// ─────────────────────────────────────────────────────────────
// Consultar
// ─────────────────────────────────────────────────────────────

export function isSelectionEmpty(selection: SelectionSet): boolean {
  return selection.length === 0
}

export function selectionHas(selection: SelectionSet, item: SelectionItem): boolean {
  return selection.some((existing) => sameItem(existing, item))
}

export function selectionSize(selection: SelectionSet): number {
  return selection.length
}

/** Tipos distintos presentes no conjunto, na ordem em que aparecem — usa
 *  `SelectionKind` (`types/tools.ts`), não os nomes plurais de campo de
 *  `AreaSelection` (`walls`, `regions`, ...). */
export function selectionKinds(selection: SelectionSet): SelectionKind[] {
  const kinds: SelectionKind[] = []
  for (const item of selection) {
    if (!kinds.includes(item.kind)) kinds.push(item.kind)
  }
  return kinds
}

/**
 * Caso de UM item: devolve o item quando `selection.length === 1`; `null`
 * nos outros dois casos (vazio OU múltiplos). Nunca escolhe "o primeiro"
 * silenciosamente quando há mais de um — isso perderia os outros itens sem
 * avisar quem chamou. É a função que `PropertiesPanel.tsx` e os `Record<
 * SelectionKind, ...>` de `stores/mapStore.ts` (`removeSelected`,
 * `duplicateSelected`) chamam antes de ler `.kind`/`.id` (ver CONTRATO
 * itens 1 e 5).
 */
export function selectionSingle(selection: SelectionSet): SelectionItem | null {
  return selection.length === 1 ? selection[0] : null
}

// ─────────────────────────────────────────────────────────────
// Migração — `Selection` (types/tools.ts), o formato de UM item
// ─────────────────────────────────────────────────────────────

export function selectionFromLegacy(selection: Selection | null): SelectionSet {
  return selection ? selectionOfItem(selection) : EMPTY_SELECTION
}

/** Inverso de `selectionFromLegacy`. `null` quando vazio OU quando há mais
 *  de um item — mesma regra de `selectionSingle`, pelo mesmo motivo:
 *  `Selection` não tem forma pra representar múltiplos, então não existe
 *  conversão fiel possível além desses dois casos. */
export function selectionToLegacy(selection: SelectionSet): Selection | null {
  return selectionSingle(selection)
}

// ─────────────────────────────────────────────────────────────
// Migração — `AreaSelection` (lib/areaSelection.ts), o formato de conjunto
// por campo plural
// ─────────────────────────────────────────────────────────────

/**
 * `AreaSelection` nunca tem duplicata dentro de cada campo (`selectEntitiesInArea`
 * filtra sobre a lista de entidades do mapa, que já não repete id por
 * `kind`), e os 7 campos são mutuamente exclusivos por tipo — então a
 * concatenação abaixo já sai sem duplicata, sem precisar passar por
 * `selectionFromItems`.
 */
export function selectionFromAreaSelection(area: AreaSelection): SelectionSet {
  return [
    ...area.walls.map((id): SelectionItem => ({ kind: 'wall', id })),
    ...area.regions.map((id): SelectionItem => ({ kind: 'region', id })),
    ...area.lights.map((id): SelectionItem => ({ kind: 'light', id })),
    ...area.tokens.map((id): SelectionItem => ({ kind: 'token', id })),
    ...area.props.map((id): SelectionItem => ({ kind: 'prop', id })),
    ...area.stairs.map((id): SelectionItem => ({ kind: 'stair', id })),
    ...area.drawings.map((id): SelectionItem => ({ kind: 'drawing', id })),
  ]
}

/** Inverso de `selectionFromAreaSelection` — sempre fiel (ao contrário da
 *  migração de `Selection`), porque `AreaSelection` representa conjunto de
 *  qualquer tamanho, igual `SelectionSet`. Usado na borda de
 *  `moveAreaSelectionLive`/`moveAreaSelection` (ver CONTRATO item 1): esses
 *  dois continuam recebendo `AreaSelection`, então o integrador converte
 *  aqui na hora de montar o argumento, em vez de mudar a assinatura deles. */
export function selectionToAreaSelection(selection: SelectionSet): AreaSelection {
  const walls: string[] = []
  const regions: string[] = []
  const lights: string[] = []
  const tokens: string[] = []
  const props: string[] = []
  const stairs: string[] = []
  const drawings: string[] = []

  for (const item of selection) {
    switch (item.kind) {
      case 'wall':
        walls.push(item.id)
        break
      case 'region':
        regions.push(item.id)
        break
      case 'light':
        lights.push(item.id)
        break
      case 'token':
        tokens.push(item.id)
        break
      case 'prop':
        props.push(item.id)
        break
      case 'stair':
        stairs.push(item.id)
        break
      case 'drawing':
        drawings.push(item.id)
        break
    }
  }

  return { walls, regions, lights, tokens, props, stairs, drawings }
}
