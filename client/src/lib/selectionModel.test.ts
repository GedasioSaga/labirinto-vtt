import { describe, expect, it } from 'vitest'
import {
  EMPTY_SELECTION,
  selectionOfItem,
  selectionFromItems,
  addSelectionItem,
  removeSelectionItem,
  toggleSelectionItem,
  isSelectionEmpty,
  selectionHas,
  selectionSize,
  selectionKinds,
  selectionSingle,
  selectionFromLegacy,
  selectionToLegacy,
  selectionFromAreaSelection,
  selectionToAreaSelection,
} from './selectionModel'
import type { SelectionItem } from './selectionModel'
import { EMPTY_AREA_SELECTION } from './areaSelection'
import type { AreaSelection } from './areaSelection'
import type { Selection } from '../types/tools'

const token1: SelectionItem = { kind: 'token', id: 't1' }
const token2: SelectionItem = { kind: 'token', id: 't2' }
const wall1: SelectionItem = { kind: 'wall', id: 'w1' }

describe('construir', () => {
  it('EMPTY_SELECTION está vazio', () => {
    expect(EMPTY_SELECTION).toEqual([])
    expect(isSelectionEmpty(EMPTY_SELECTION)).toBe(true)
  })

  it('selectionOfItem cria um conjunto de tamanho 1', () => {
    const selection = selectionOfItem(token1)
    expect(selection).toEqual([token1])
    expect(selectionSize(selection)).toBe(1)
  })

  it('selectionFromItems deduplica por (kind,id), mantendo a primeira ocorrência', () => {
    const selection = selectionFromItems([token1, wall1, { kind: 'token', id: 't1' }, token2])
    expect(selection).toEqual([token1, wall1, token2])
    expect(selectionSize(selection)).toBe(3)
  })

  it('selectionFromItems de lista vazia é EMPTY_SELECTION-like', () => {
    expect(selectionFromItems([])).toEqual([])
  })
})

describe('transformar', () => {
  it('addSelectionItem soma item ausente', () => {
    const selection = addSelectionItem(selectionOfItem(token1), wall1)
    expect(selection).toEqual([token1, wall1])
  })

  it('addSelectionItem com item já presente devolve a MESMA referência (sem realocar)', () => {
    const selection = selectionOfItem(token1)
    expect(addSelectionItem(selection, token1)).toBe(selection)
  })

  it('removeSelectionItem tira item presente', () => {
    const selection = selectionFromItems([token1, wall1])
    expect(removeSelectionItem(selection, token1)).toEqual([wall1])
  })

  it('removeSelectionItem com item ausente devolve a MESMA referência', () => {
    const selection = selectionOfItem(token1)
    expect(removeSelectionItem(selection, wall1)).toBe(selection)
  })

  it('removeSelectionItem em seleção vazia não quebra e continua vazia', () => {
    expect(removeSelectionItem(EMPTY_SELECTION, token1)).toEqual([])
  })

  it('toggleSelectionItem soma quando ausente', () => {
    expect(toggleSelectionItem(EMPTY_SELECTION, token1)).toEqual([token1])
  })

  it('toggleSelectionItem tira quando presente (Shift+clique de novo desmarca)', () => {
    const selection = selectionOfItem(token1)
    expect(toggleSelectionItem(selection, token1)).toEqual([])
  })

  it('toggleSelectionItem preserva os demais itens ao alternar um deles', () => {
    const selection = selectionFromItems([token1, wall1])
    expect(toggleSelectionItem(selection, token1)).toEqual([wall1])
    expect(toggleSelectionItem(selection, token2)).toEqual([token1, wall1, token2])
  })
})

describe('consultar', () => {
  it('isSelectionEmpty', () => {
    expect(isSelectionEmpty(EMPTY_SELECTION)).toBe(true)
    expect(isSelectionEmpty(selectionOfItem(token1))).toBe(false)
  })

  it('selectionHas distingue por kind, não só por id', () => {
    const selection = selectionOfItem(token1)
    expect(selectionHas(selection, token1)).toBe(true)
    expect(selectionHas(selection, { kind: 'wall', id: 't1' })).toBe(false)
  })

  it('selectionSize', () => {
    expect(selectionSize(EMPTY_SELECTION)).toBe(0)
    expect(selectionSize(selectionFromItems([token1, wall1, token2]))).toBe(3)
  })

  it('selectionKinds lista tipos distintos, na ordem de aparição', () => {
    expect(selectionKinds(selectionFromItems([token1, wall1, token2]))).toEqual(['token', 'wall'])
    expect(selectionKinds(EMPTY_SELECTION)).toEqual([])
  })

  it('selectionSingle devolve o item quando o conjunto tem exatamente 1', () => {
    expect(selectionSingle(selectionOfItem(token1))).toEqual(token1)
  })

  it('selectionSingle devolve null quando vazio', () => {
    expect(selectionSingle(EMPTY_SELECTION)).toBeNull()
  })

  it('selectionSingle devolve null quando há múltiplos (nunca escolhe "o primeiro")', () => {
    expect(selectionSingle(selectionFromItems([token1, wall1]))).toBeNull()
  })
})

describe('migração — Selection (types/tools.ts)', () => {
  it('selectionFromLegacy(null) é vazio', () => {
    expect(selectionFromLegacy(null)).toEqual([])
  })

  it('selectionFromLegacy de um item vira conjunto de tamanho 1', () => {
    const legacy: Selection = { kind: 'prop', id: 'p1' }
    expect(selectionFromLegacy(legacy)).toEqual([{ kind: 'prop', id: 'p1' }])
  })

  it('selectionToLegacy de conjunto vazio é null', () => {
    expect(selectionToLegacy(EMPTY_SELECTION)).toBeNull()
  })

  it('selectionToLegacy de conjunto com 1 item devolve esse item', () => {
    expect(selectionToLegacy(selectionOfItem(token1))).toEqual(token1)
  })

  it('selectionToLegacy de conjunto com múltiplos itens é null (não escolhe o primeiro)', () => {
    expect(selectionToLegacy(selectionFromItems([token1, wall1]))).toBeNull()
  })

  it('round-trip Selection -> SelectionSet -> Selection preserva o item único', () => {
    const legacy: Selection = { kind: 'stair', id: 's1' }
    expect(selectionToLegacy(selectionFromLegacy(legacy))).toEqual(legacy)
  })
})

describe('migração — AreaSelection (lib/areaSelection.ts)', () => {
  it('selectionFromAreaSelection(EMPTY_AREA_SELECTION) é vazio — todo campo ausente/vazio ao mesmo tempo', () => {
    expect(selectionFromAreaSelection(EMPTY_AREA_SELECTION)).toEqual([])
  })

  it('selectionFromAreaSelection cobre os 7 kinds, um por campo', () => {
    const area: AreaSelection = {
      walls: ['w1'],
      regions: ['r1'],
      lights: ['l1'],
      tokens: ['t1'],
      props: ['p1'],
      stairs: ['s1'],
      drawings: ['d1'],
    }
    const selection = selectionFromAreaSelection(area)
    expect(selection).toEqual([
      { kind: 'wall', id: 'w1' },
      { kind: 'region', id: 'r1' },
      { kind: 'light', id: 'l1' },
      { kind: 'token', id: 't1' },
      { kind: 'prop', id: 'p1' },
      { kind: 'stair', id: 's1' },
      { kind: 'drawing', id: 'd1' },
    ])
  })

  it('selectionFromAreaSelection com múltiplos ids no mesmo campo preserva todos', () => {
    const area: AreaSelection = { ...EMPTY_AREA_SELECTION, tokens: ['t1', 't2', 't3'] }
    expect(selectionFromAreaSelection(area)).toEqual([
      { kind: 'token', id: 't1' },
      { kind: 'token', id: 't2' },
      { kind: 'token', id: 't3' },
    ])
  })

  it('selectionToAreaSelection de conjunto vazio devolve o equivalente de EMPTY_AREA_SELECTION', () => {
    expect(selectionToAreaSelection(EMPTY_SELECTION)).toEqual(EMPTY_AREA_SELECTION)
  })

  it('selectionToAreaSelection agrupa itens de kinds diferentes nos campos certos', () => {
    const selection = selectionFromItems([token1, wall1, token2, { kind: 'drawing', id: 'd1' }])
    expect(selectionToAreaSelection(selection)).toEqual({
      walls: ['w1'],
      regions: [],
      lights: [],
      tokens: ['t1', 't2'],
      props: [],
      stairs: [],
      drawings: ['d1'],
    })
  })

  it('round-trip AreaSelection -> SelectionSet -> AreaSelection preserva o conjunto (sem duplicata por campo)', () => {
    const area: AreaSelection = {
      walls: ['w1', 'w2'],
      regions: [],
      lights: ['l1'],
      tokens: [],
      props: ['p1'],
      stairs: [],
      drawings: [],
    }
    expect(selectionToAreaSelection(selectionFromAreaSelection(area))).toEqual(area)
  })

  it('selectionToAreaSelection nunca muta EMPTY_AREA_SELECTION (arrays novos, não a mesma referência)', () => {
    const result = selectionToAreaSelection(EMPTY_SELECTION)
    result.tokens.push('intruso')
    expect(EMPTY_AREA_SELECTION.tokens).toEqual([])
  })
})
