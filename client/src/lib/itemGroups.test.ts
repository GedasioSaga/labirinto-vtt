import { describe, expect, it } from 'vitest'
import { expandToGroup, groupItems, groupOfItem, isSingleGroup, NO_GROUPS, ungroupItems, type ItemGroups } from './itemGroups'
import type { SelectionItem } from './selectionModel'

const SALA: SelectionItem = { kind: 'region', id: 'sala-casa' }
const MESA: SelectionItem = { kind: 'drawing', id: 'des-mesa' }
const PORTA: SelectionItem = { kind: 'wall', id: 'parede-porta' }
const ARVORE: SelectionItem = { kind: 'drawing', id: 'des-arvore' }

const tudoExiste = (): boolean => true

describe('groupItems — Ctrl+G junta a seleção num grupo', () => {
  it('3 itens selecionados viram UM grupo com os 3', () => {
    const grupos = groupItems(NO_GROUPS, [SALA, PORTA, MESA], 'g1')
    expect(grupos).toHaveLength(1)
    expect(grupos[0].id).toBe('g1')
    expect(grupos[0].members).toEqual([SALA, PORTA, MESA])
  })

  it('um item só não vira grupo (grupo de um é só o item)', () => {
    expect(groupItems(NO_GROUPS, [MESA], 'g1')).toBe(NO_GROUPS)
    expect(groupItems(NO_GROUPS, [], 'g1')).toBe(NO_GROUPS)
  })

  it('agrupar de novo um item de grupo existente funde o grupo antigo no novo (sem grupo dentro de grupo)', () => {
    const antes = groupItems(NO_GROUPS, [SALA, PORTA], 'g1')
    const depois = groupItems(antes, [MESA, PORTA], 'g2')
    expect(depois).toHaveLength(1)
    expect(depois[0].id).toBe('g2')
    expect(new Set(depois[0].members.map((m) => m.id))).toEqual(new Set(['des-mesa', 'parede-porta', 'sala-casa']))
  })

  it('grupos que não tocam a seleção ficam intactos', () => {
    const antes = groupItems(NO_GROUPS, [SALA, PORTA], 'g1')
    const depois = groupItems(antes, [MESA, ARVORE], 'g2')
    expect(depois.map((g) => g.id)).toEqual(['g1', 'g2'])
  })
})

describe('ungroupItems — Ctrl+Shift+G desfaz o grupo de quem está selecionado', () => {
  it('desfaz o grupo que contém qualquer item da seleção', () => {
    const grupos = groupItems(NO_GROUPS, [SALA, PORTA, MESA], 'g1')
    expect(ungroupItems(grupos, [MESA])).toEqual([])
  })

  it('seleção sem item de grupo devolve os grupos iguais (mesma referência)', () => {
    const grupos = groupItems(NO_GROUPS, [SALA, PORTA], 'g1')
    expect(ungroupItems(grupos, [ARVORE])).toBe(grupos)
  })
})

describe('isSingleGroup — o painel diz "Grupo" e oferece Desagrupar', () => {
  const grupos: ItemGroups = groupItems(NO_GROUPS, [SALA, PORTA, MESA], 'g1')

  it('a seleção inteira dentro de um grupo só', () => {
    expect(isSingleGroup(grupos, [SALA, PORTA, MESA])).toBe(true)
  })

  it('seleção que mistura grupo e item solto não é um grupo', () => {
    expect(isSingleGroup(grupos, [SALA, PORTA, MESA, ARVORE])).toBe(false)
  })

  it('um item só, ou nada, não é grupo', () => {
    expect(isSingleGroup(grupos, [MESA])).toBe(false)
    expect(isSingleGroup(grupos, [])).toBe(false)
  })
})

describe('groupOfItem / expandToGroup — um clique num membro pega o grupo', () => {
  const grupos: ItemGroups = groupItems(NO_GROUPS, [SALA, PORTA, MESA], 'g1')

  it('clique na mesa agrupada devolve a casa inteira, com o clicado incluso', () => {
    const expandido = expandToGroup(grupos, MESA, tudoExiste)
    expect(expandido).toHaveLength(3)
    expect(expandido).toContainEqual(MESA)
    expect(expandido).toContainEqual(SALA)
    expect(expandido).toContainEqual(PORTA)
  })

  it('clique em item fora de grupo devolve só ele', () => {
    expect(expandToGroup(grupos, ARVORE, tudoExiste)).toEqual([ARVORE])
    expect(groupOfItem(grupos, ARVORE)).toBeNull()
  })

  it('sem grupo nenhum (mapa recém-aberto), devolve só o item', () => {
    expect(expandToGroup(NO_GROUPS, MESA, tudoExiste)).toEqual([MESA])
  })

  it('membro apagado ou fora de alcance (camada travada) sai da expansão', () => {
    const semPorta = (item: SelectionItem): boolean => item.id !== PORTA.id
    const expandido = expandToGroup(grupos, MESA, semPorta)
    expect(expandido).toHaveLength(2)
    expect(expandido).not.toContainEqual(PORTA)
  })

  it('grupo que ficou com um membro alcançável só vale como o item sozinho', () => {
    const soAMesa = (item: SelectionItem): boolean => item.id === MESA.id
    expect(expandToGroup(grupos, MESA, soAMesa)).toEqual([MESA])
  })

  it('clicado fora de alcance não arrasta os irmãos (o clique vale para ele só)', () => {
    const semMesa = (item: SelectionItem): boolean => item.id !== MESA.id
    expect(expandToGroup(grupos, MESA, semMesa)).toEqual([MESA])
  })
})
