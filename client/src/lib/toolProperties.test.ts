import { describe, expect, it } from 'vitest'
import { PROPERTY_GROUP_IDS, relevantPropertyGroups, type PropertyGroupId } from './toolProperties'
import { DRAWING_TOOLS } from '../components/labels'
import type { DrawingTool } from '../types/tools'

/** Todos os tools do app (mesma lista de types/tools.ts) — usado só pra
 *  varrer "nenhuma combinação lança exceção" no teste de robustez. */
const ALL_TOOLS: DrawingTool[] = [
  'select', 'wall', 'door', 'light', 'region', 'room', 'roomCircle', 'roomPolygon',
  'stair', 'token', 'prop', 'brush', 'line', 'circle', 'ellipse', 'rect', 'polygon',
  'curve', 'text', 'measure', 'eraser',
]

function groupsOf(tool: DrawingTool, selection?: Parameters<typeof relevantPropertyGroups>[1]): Set<PropertyGroupId> {
  return relevantPropertyGroups(tool, selection)
}

describe('relevantPropertyGroups — duplicação de DRAWING_TOOLS não apodrece', () => {
  it('DRAWING_TOOL_KIND (interno) cobre exatamente os mesmos 7 tools de components/labels.ts DRAWING_TOOLS', () => {
    // Não há como importar DRAWING_TOOL_KIND (não exportado de propósito —
    // é detalhe de implementação). Em vez disso, confere pelo efeito
    // observável: toda ferramenta de DRAWING_TOOLS entra em 'drawingStyle'
    // sem seleção nenhuma — é exatamente a condição que PropertiesPanel.tsx
    // já usa hoje (`DRAWING_TOOLS.includes(activeTool)`).
    for (const tool of DRAWING_TOOLS) {
      expect(groupsOf(tool).has('drawingStyle'), `tool=${tool}`).toBe(true)
    }
    // E nenhuma ferramenta FORA de DRAWING_TOOLS (exceto 'text', tratada à
    // parte) entra em 'drawingStyle' sem seleção.
    for (const tool of ALL_TOOLS) {
      if (DRAWING_TOOLS.includes(tool) || tool === 'text') continue
      expect(groupsOf(tool).has('drawingStyle'), `tool=${tool}`).toBe(false)
    }
  })
})

describe('relevantPropertyGroups — casos concretos do pedido do usuário (F4-N2)', () => {
  it('ferramenta Linha ativa, nada selecionado: mostra lineCap (preferência do próximo desenho)', () => {
    expect(groupsOf('line').has('lineCap')).toBe(true)
  })

  it('ferramenta Pincel (freehand) e Curva também mostram lineCap — mesmo trio do schema F4-0', () => {
    expect(groupsOf('brush').has('lineCap')).toBe(true)
    expect(groupsOf('curve').has('lineCap')).toBe(true)
  })

  it('ferramenta Círculo/Retângulo/Elipse/Polígono NÃO mostram lineCap — essas formas não têm traço com cap', () => {
    expect(groupsOf('circle').has('lineCap')).toBe(false)
    expect(groupsOf('rect').has('lineCap')).toBe(false)
    expect(groupsOf('ellipse').has('lineCap')).toBe(false)
    expect(groupsOf('polygon').has('lineCap')).toBe(false)
  })

  it('ferramenta Selecionar + uma "line" já desenhada selecionada: mostra lineCap (editar a existente)', () => {
    const groups = groupsOf('select', { drawingKind: 'line' })
    expect(groups.has('lineCap')).toBe(true)
  })

  it('ferramenta Selecionar + um "freehand" selecionado: mostra lineCap', () => {
    expect(groupsOf('select', { drawingKind: 'freehand' }).has('lineCap')).toBe(true)
  })

  it('ferramenta Selecionar + um "circle" selecionado: NÃO mostra lineCap, mostra fill (editar forma existente)', () => {
    const groups = groupsOf('select', { drawingKind: 'circle' })
    expect(groups.has('lineCap')).toBe(false)
    expect(groups.has('fill')).toBe(true)
  })

  it('ferramenta Retângulo/Elipse/Polígono ATIVA (nada selecionado ainda): NÃO adiciona fill — já coberto por DrawingStyleControls, não duplica', () => {
    expect(groupsOf('rect').has('fill')).toBe(false)
    expect(groupsOf('ellipse').has('fill')).toBe(false)
    expect(groupsOf('polygon').has('fill')).toBe(false)
  })

  it('ferramenta Região/Sala ativa: mostra fill e regionStyle (preferência da PRÓXIMA região — Region.filled não tinha UI nenhuma)', () => {
    for (const tool of ['region', 'room', 'roomCircle', 'roomPolygon'] as const) {
      const groups = groupsOf(tool)
      expect(groups.has('fill'), `tool=${tool}`).toBe(true)
      expect(groups.has('regionStyle'), `tool=${tool}`).toBe(true)
    }
  })

  it('ferramenta Selecionar + Região selecionada: mostra fill e regionStyle', () => {
    const groups = groupsOf('select', { region: true })
    expect(groups.has('fill')).toBe(true)
    expect(groups.has('regionStyle')).toBe(true)
  })

  it('Região selecionada E é Sala (region.room definido): mostra room também', () => {
    const groups = groupsOf('select', { region: true, regionIsRoom: true })
    expect(groups.has('room')).toBe(true)
  })

  it('Região selecionada mas NÃO é Sala: não mostra room', () => {
    const groups = groupsOf('select', { region: true, regionIsRoom: false })
    expect(groups.has('room')).toBe(false)
  })

  it('Escada selecionada: mostra stairControls (direção, já existe) e stairSize (previsto, P/M/G)', () => {
    const groups = groupsOf('select', { stair: true })
    expect(groups.has('stairControls')).toBe(true)
    expect(groups.has('stairSize')).toBe(true)
  })
})

describe('relevantPropertyGroups — as 6 seções "sempre visíveis" hoje (bug real do painel, DOSSIE-FEEDBACK-F4.md)', () => {
  it('ferramenta Selecionar, nada selecionado: grid/mapScale/gridAlign/layers/scenarioLink aparecem (momento de mapa)', () => {
    const groups = groupsOf('select')
    for (const g of ['grid', 'mapScale', 'gridAlign', 'layers', 'scenarioLink'] as const) {
      expect(groups.has(g), g).toBe(true)
    }
  })

  it('ferramenta Parede ativa, NADA selecionado: NÃO mostra grid/mapScale/gridAlign/layers/scenarioLink — é o bug que "Medição fica cortada embaixo"', () => {
    const groups = groupsOf('wall')
    for (const g of ['grid', 'mapScale', 'gridAlign', 'layers', 'scenarioLink'] as const) {
      expect(groups.has(g), g).toBe(false)
    }
  })

  it('ferramenta Parede ativa MAS já existe uma Parede selecionada: volta a mostrar (momento de mapa por causa da seleção)', () => {
    const groups = groupsOf('wall', { wall: true })
    for (const g of ['grid', 'mapScale', 'gridAlign', 'layers', 'scenarioLink'] as const) {
      expect(groups.has(g), g).toBe(true)
    }
  })

  it('ferramenta Medir: mapScale aparece mesmo sem seleção (é a configuração que a régua usa), mas grid/gridAlign/layers/scenarioLink não', () => {
    const groups = groupsOf('measure')
    expect(groups.has('mapScale')).toBe(true)
    expect(groups.has('grid')).toBe(false)
    expect(groups.has('gridAlign')).toBe(false)
  })

  it('selection (SelectionControls) aparece SEMPRE, em qualquer ferramenta, com ou sem seleção — tem o botão "Adicionar token"', () => {
    for (const tool of ALL_TOOLS) {
      expect(groupsOf(tool).has('selection'), `tool=${tool}`).toBe(true)
    }
    expect(groupsOf('wall', { wall: true }).has('selection')).toBe(true)
  })
})

describe('relevantPropertyGroups — condições existentes intactas (não regride PropertiesPanel.tsx de hoje)', () => {
  it('ferramenta Porta ativa: doorKind aparece mesmo sem parede selecionada', () => {
    expect(groupsOf('door').has('doorKind')).toBe(true)
  })

  it('Parede selecionada SEM porta: doorKind não aparece', () => {
    const groups = groupsOf('select', { wall: true, wallHasDoor: false })
    expect(groups.has('doorKind')).toBe(false)
    expect(groups.has('wallDoor')).toBe(true) // WallDoorControls sempre acompanha parede selecionada
  })

  it('Parede selecionada COM porta: doorKind aparece', () => {
    const groups = groupsOf('select', { wall: true, wallHasDoor: true })
    expect(groups.has('doorKind')).toBe(true)
  })

  it('ferramenta Texto ativa sem rótulo selecionado: drawingStyle aparece (estilo do PRÓXIMO texto)', () => {
    expect(groupsOf('text').has('drawingStyle')).toBe(true)
  })

  it('ferramenta Texto ativa COM rótulo já selecionado: drawingStyle NÃO aparece (evita duplicar Cor/Tamanho com TextLabelControls)', () => {
    expect(groupsOf('text', { textLabel: true }).has('drawingStyle')).toBe(false)
    expect(groupsOf('text', { textLabel: true }).has('textLabel')).toBe(true)
  })

  it('Token selecionado: tokenImage e itemTransform aparecem; Objeto (prop) selecionado: portal e itemTransform aparecem', () => {
    expect(groupsOf('select', { token: true }).has('tokenImage')).toBe(true)
    expect(groupsOf('select', { token: true }).has('itemTransform')).toBe(true)
    expect(groupsOf('select', { prop: true }).has('portal')).toBe(true)
    expect(groupsOf('select', { prop: true }).has('itemTransform')).toBe(true)
  })
})

describe('relevantPropertyGroups — robustez', () => {
  it('nenhuma combinação tool × seleção lança exceção, e o resultado é sempre um subconjunto de PROPERTY_GROUP_IDS', () => {
    const selections: Array<Parameters<typeof relevantPropertyGroups>[1]> = [
      undefined,
      {},
      { wall: true, wallHasDoor: true },
      { prop: true },
      { token: true },
      { textLabel: true },
      { region: true, regionIsRoom: true },
      { light: true },
      { stair: true },
      { drawingKind: 'line' },
      { drawingKind: 'circle' },
    ]
    for (const tool of ALL_TOOLS) {
      for (const selection of selections) {
        const groups = relevantPropertyGroups(tool, selection)
        for (const g of groups) {
          expect(PROPERTY_GROUP_IDS.includes(g), `grupo inesperado: ${g}`).toBe(true)
        }
      }
    }
  })

  it('chamar sem segundo argumento é equivalente a chamar com seleção vazia', () => {
    for (const tool of ALL_TOOLS) {
      expect(relevantPropertyGroups(tool)).toEqual(relevantPropertyGroups(tool, {}))
    }
  })
})
