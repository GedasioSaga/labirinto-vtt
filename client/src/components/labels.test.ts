import { describe, expect, it } from 'vitest'
import { deleteSelectionLabel, SELECTION_LABELS, TOOLBAR_SLOTS, TOOL_CLUSTERS, TOOL_LABELS, toolsOfSlot } from './labels'
import { DRAWING_SHAPE_GROUP } from '../lib/toolVariants'
import type { DrawingTool, SelectionKind } from '../types/tools'

describe('botão Desenho e posições da barra', () => {
  it('rótulos do grupo Forma são iguais a TOOL_LABELS', () => {
    for (const option of DRAWING_SHAPE_GROUP.options) {
      expect(option.label, option.value).toBe(TOOL_LABELS[option.value])
    }
    expect(DRAWING_SHAPE_GROUP.options.map((o) => o.value)).toEqual(TOOL_CLUSTERS.drawing.tools)
  })

  it('TOOLBAR_SLOTS cobre cada ferramenta visível exatamente 1 vez (token escondido fica fora)', () => {
    const inBar = TOOLBAR_SLOTS.flat().flatMap(toolsOfSlot)
    expect(new Set(inBar).size).toBe(inBar.length)
    const visible = (Object.keys(TOOL_LABELS) as DrawingTool[]).filter((tool) => tool !== 'token')
    expect([...inBar].sort()).toEqual([...visible].sort())
    expect(inBar).not.toContain('token')
  })
})

const ALL_KINDS: SelectionKind[] = ['token', 'wall', 'light', 'region', 'stair', 'prop', 'drawing', 'floor']

describe('deleteSelectionLabel', () => {
  it('escada tem rótulo (antes: "Apagar undefined selecionada(o)")', () => {
    expect(deleteSelectionLabel('stair')).toBe('Apagar escada selecionada')
  })

  it('gênero certo por tipo', () => {
    expect(deleteSelectionLabel('token')).toBe('Apagar token selecionado')
    expect(deleteSelectionLabel('wall')).toBe('Apagar parede selecionada')
    expect(deleteSelectionLabel('light')).toBe('Apagar luz selecionada')
    expect(deleteSelectionLabel('region')).toBe('Apagar região selecionada')
    expect(deleteSelectionLabel('prop')).toBe('Apagar peça selecionada')
    expect(deleteSelectionLabel('drawing')).toBe('Apagar desenho selecionado')
    expect(deleteSelectionLabel('floor')).toBe('Apagar peça de chão selecionada')
  })

  it('todo SelectionKind tem entrada, e nenhum rótulo sai com "undefined" ou "(o)"', () => {
    for (const kind of ALL_KINDS) {
      expect(SELECTION_LABELS[kind], kind).toBeDefined()
      expect(deleteSelectionLabel(kind), kind).not.toMatch(/undefined|\(o\)/)
    }
  })
})
