import { describe, expect, it } from 'vitest'
import { resolveCursor, type GestureMode, type HoverKind, type ResizeCorner, type ResolveCursorInput } from './cursorPolicy'
import type { DrawingTool } from '../types/tools'

/**
 * Cópia local dos 33 literais de `mode` em `PixiCanvas.tsx:385-420` — a
 * MESMA lista que `cursorPolicy.ts` replica como `GestureMode` (ver
 * docstring lá sobre por que a cópia é deliberada). Está redigitada aqui
 * de novo, e não importada de `cursorPolicy.ts`, de propósito: se algum
 * dia um `case` sumir do `switch` de `resolveCursor` sem que ninguém
 * repare, este array — fonte de verdade independente — ainda dispara o
 * `assertNeverMode` em runtime neste teste. Importar `GestureMode` só pra
 * tipar o array (nunca pra copiar os valores) mantém o array e o tipo
 * alinhados no `tsc` sem esconder um `case` esquecido atrás do próprio tipo
 * que o `switch` teria puxado errado.
 */
const ALL_MODES: GestureMode[] = [
  'idle',
  'panning',
  'dragging-token',
  'dragging-prop',
  'drawing-wall',
  'drawing-freehand',
  'drawing-line',
  'drawing-circle',
  'drawing-rect',
  'drawing-ellipse',
  'drawing-polygon',
  'drawing-light',
  'drawing-curve',
  'dragging-curve-point',
  'dragging-curve-body',
  'dragging-light-radius',
  'erasing',
  'drawing-room',
  'drawing-polygon-room',
  'drawing-stair',
  'resizing-room-corner',
  'dragging-wall-point',
  'dragging-region-point',
  'dragging-wall-body',
  'dragging-region-body',
  'dragging-stair-body',
  'dragging-line-point',
  'dragging-line-body',
  'resizing-drawing-corner',
  'resizing-drawing-radius',
  'resizing-token',
  'resizing-prop-corner',
  'area-marquee-drag',
  'dragging-area-selection',
  'drawing-floor',
  'dragging-floor-body',
  'dragging-room-label',
  'drawing-conceal-zone',
]

/** Cópia local dos 23 literais de `DrawingTool` (`types/tools.ts:1-24`). */
const ALL_TOOLS: DrawingTool[] = [
  'select',
  'wall',
  'door',
  'light',
  'region',
  'room',
  'roomCircle',
  'roomPolygon',
  'stair',
  'token',
  'prop',
  'brush',
  'line',
  'circle',
  'ellipse',
  'rect',
  'polygon',
  'curve',
  'text',
  'measure',
  'eraser',
  'floor',
  'concealZone',
]

const ALL_HOVER_KINDS: HoverKind[] = ['none', 'selectable', 'resize-corner', 'vertex', 'radius', 'area-selection']

const ALL_CORNERS: ResizeCorner[] = [0, 1, 2, 3]

const VALID_CSS_CURSORS = new Set([
  'default',
  'crosshair',
  'pointer',
  'move',
  'grab',
  'grabbing',
  'cell',
  'nwse-resize',
  'nesw-resize',
])

const baseInput = (overrides: Partial<ResolveCursorInput> = {}): ResolveCursorInput => ({
  mode: 'idle',
  activeTool: 'select',
  hoverKind: 'none',
  corner: null,
  spaceHeld: false,
  ...overrides,
})

describe('resolveCursor — exaustividade', () => {
  it('cobre TODOS os 38 modos de PixiCanvas.tsx sem lançar e devolve cursor CSS válido', () => {
    expect(ALL_MODES).toHaveLength(38)
    for (const mode of ALL_MODES) {
      const cursor = resolveCursor(baseInput({ mode, corner: 0 }))
      expect(VALID_CSS_CURSORS.has(cursor), `mode "${mode}" devolveu cursor desconhecido: "${cursor}"`).toBe(true)
    }
  })

  it('cobre TODAS as 23 ferramentas (idle) sem lançar e devolve cursor CSS válido', () => {
    expect(ALL_TOOLS).toHaveLength(23)
    for (const activeTool of ALL_TOOLS) {
      const cursor = resolveCursor(baseInput({ activeTool }))
      expect(VALID_CSS_CURSORS.has(cursor), `tool "${activeTool}" devolveu cursor desconhecido: "${cursor}"`).toBe(true)
    }
  })

  it('cobre TODOS os 6 HoverKind (idle + select) sem lançar e devolve cursor CSS válido', () => {
    expect(ALL_HOVER_KINDS).toHaveLength(6)
    for (const hoverKind of ALL_HOVER_KINDS) {
      const cursor = resolveCursor(baseInput({ activeTool: 'select', hoverKind, corner: 0 }))
      expect(VALID_CSS_CURSORS.has(cursor), `hoverKind "${hoverKind}" devolveu cursor desconhecido: "${cursor}"`).toBe(true)
    }
  })
})

describe('resolveCursor — ferramentas de criação (idle): crosshair', () => {
  const creationTools: DrawingTool[] = [
    'wall', 'door', 'light', 'region', 'room', 'roomCircle', 'roomPolygon',
    'stair', 'prop', 'brush', 'line', 'circle', 'ellipse', 'rect', 'polygon',
    'curve', 'text', 'measure', 'floor', 'concealZone',
  ]

  it.each(creationTools)('%s ocioso é crosshair — mira de precisão pra colocar algo novo', (activeTool) => {
    expect(resolveCursor(baseInput({ activeTool }))).toBe('crosshair')
  })

  it('as 20 ferramentas de criação são exatamente DrawingTool menos select/token/eraser', () => {
    const naoCriacao = new Set(['select', 'token', 'eraser'])
    const criacaoDoModulo = ALL_TOOLS.filter((tool) => !naoCriacao.has(tool))
    expect(criacaoDoModulo.sort()).toEqual([...creationTools].sort())
  })
})

describe('resolveCursor — Borracha: cursor próprio, distinto de criação', () => {
  it('eraser ocioso é "cell", não "crosshair" — não confunde criar com apagar', () => {
    expect(resolveCursor(baseInput({ activeTool: 'eraser' }))).toBe('cell')
  })

  it('mode "erasing" (meio do apagão) também é "cell"', () => {
    expect(resolveCursor(baseInput({ mode: 'erasing', activeTool: 'eraser' }))).toBe('cell')
  })
})

describe('resolveCursor — Selecionar (idle): tabela de hover', () => {
  it('sem nada sob o cursor é "default"', () => {
    expect(resolveCursor(baseInput({ activeTool: 'select', hoverKind: 'none' }))).toBe('default')
  })

  it('sobre item selecionável é "pointer"', () => {
    expect(resolveCursor(baseInput({ activeTool: 'select', hoverKind: 'selectable' }))).toBe('pointer')
  })

  it('sobre alça de vértice é "pointer"', () => {
    expect(resolveCursor(baseInput({ activeTool: 'select', hoverKind: 'vertex' }))).toBe('pointer')
  })

  it('sobre alça de raio (luz) é "pointer"', () => {
    expect(resolveCursor(baseInput({ activeTool: 'select', hoverKind: 'radius' }))).toBe('pointer')
  })

  it('sobre grupo de área-seleção fechado é "pointer"', () => {
    expect(resolveCursor(baseInput({ activeTool: 'select', hoverKind: 'area-selection' }))).toBe('pointer')
  })
})

describe('resolveCursor — 🪙 "token" (sem branch própria em pointerdown) herda a tabela de "select"', () => {
  it('idle, nada sob o cursor: "default", igual a select', () => {
    expect(resolveCursor(baseInput({ activeTool: 'token', hoverKind: 'none' }))).toBe('default')
  })

  it('idle, sobre item selecionável: "pointer", igual a select — PixiCanvas.tsx:1034 seleciona/arrasta independente da ferramenta', () => {
    expect(resolveCursor(baseInput({ activeTool: 'token', hoverKind: 'selectable' }))).toBe('pointer')
  })

  it('NÃO é ferramenta de criação (crosshair) nem usa o cursor da Borracha', () => {
    const cursor = resolveCursor(baseInput({ activeTool: 'token', hoverKind: 'none' }))
    expect(cursor).not.toBe('crosshair')
    expect(cursor).not.toBe('cell')
  })
})

describe('resolveCursor — alças de resize: nwse-resize / nesw-resize por canto', () => {
  it.each([
    [0, 'nwse-resize'], // topo-esquerda ↔ baixo-direita
    [1, 'nesw-resize'], // topo-direita ↔ baixo-esquerda
    [2, 'nwse-resize'],
    [3, 'nesw-resize'],
  ] as const)('hover em resize-corner, corner=%i → %s', (corner, expected) => {
    expect(resolveCursor(baseInput({ activeTool: 'select', hoverKind: 'resize-corner', corner }))).toBe(expected)
  })

  const resizeModes: GestureMode[] = ['resizing-room-corner', 'resizing-drawing-corner', 'resizing-token', 'resizing-prop-corner']

  it.each(resizeModes)('mode "%s" com corner=0 (topo-esquerda) é nwse-resize', (mode) => {
    expect(resolveCursor(baseInput({ mode, corner: 0 }))).toBe('nwse-resize')
  })

  it.each(resizeModes)('mode "%s" com corner=1 (topo-direita) é nesw-resize', (mode) => {
    expect(resolveCursor(baseInput({ mode, corner: 1 }))).toBe('nesw-resize')
  })

  it('canto ausente (corner: null) em modo de resize não lança — cai num fallback defensivo válido', () => {
    const cursor = resolveCursor(baseInput({ mode: 'resizing-token', corner: null }))
    expect(VALID_CSS_CURSORS.has(cursor)).toBe(true)
  })

  it('os 4 ResizeCorner cobertos são exatamente 0,1,2,3', () => {
    expect(ALL_CORNERS).toEqual([0, 1, 2, 3])
  })
})

describe('resolveCursor — arrastando corpo inteiro: "move"', () => {
  const bodyDragModes: GestureMode[] = [
    'dragging-token', 'dragging-prop', 'dragging-wall-body', 'dragging-region-body',
    'dragging-stair-body', 'dragging-curve-body', 'dragging-line-body', 'dragging-area-selection',
    'dragging-room-label',
  ]

  it.each(bodyDragModes)('mode "%s" é "move"', (mode) => {
    expect(resolveCursor(baseInput({ mode }))).toBe('move')
  })
})

describe('resolveCursor — arrastando um ponto/alça específica: "grabbing" (distingue de "move" de corpo inteiro)', () => {
  const pointDragModes: GestureMode[] = [
    'dragging-wall-point', 'dragging-region-point', 'dragging-curve-point', 'dragging-line-point', 'dragging-light-radius',
    // Onda 3, item 18 — alça de raio do Drawing 'circle', mesma leitura de
    // dragging-light-radius (mão fechada num ponto específico, não "move").
    'resizing-drawing-radius',
  ]

  it.each(pointDragModes)('mode "%s" é "grabbing"', (mode) => {
    expect(resolveCursor(baseInput({ mode }))).toBe('grabbing')
  })
})

describe('resolveCursor — pan (item #2/#8 do plano): grab disponível, grabbing em andamento', () => {
  it('mode "panning" é "grabbing"', () => {
    expect(resolveCursor(baseInput({ mode: 'panning' }))).toBe('grabbing')
  })

  it('idle com Espaço pressionado é "grab", MESMO com ferramenta de desenho ativa (pan universal, item #8)', () => {
    expect(resolveCursor(baseInput({ activeTool: 'wall', spaceHeld: true }))).toBe('grab')
  })

  it('Espaço pressionado tem prioridade sobre hover de alça de resize', () => {
    expect(
      resolveCursor(baseInput({ activeTool: 'select', hoverKind: 'resize-corner', corner: 0, spaceHeld: true })),
    ).toBe('grab')
  })
})

describe('resolveCursor — gesto de desenho em andamento: crosshair do início ao fim', () => {
  const drawingModes: GestureMode[] = [
    'drawing-wall', 'drawing-freehand', 'drawing-line', 'drawing-circle', 'drawing-rect',
    'drawing-ellipse', 'drawing-polygon', 'drawing-light', 'drawing-curve', 'drawing-room',
    'drawing-polygon-room', 'drawing-stair',
  ]

  it.each(drawingModes)('mode "%s" é "crosshair"', (mode) => {
    expect(resolveCursor(baseInput({ mode }))).toBe('crosshair')
  })

  it('marquee de área (arrastando o retângulo de seleção) também é "crosshair"', () => {
    expect(resolveCursor(baseInput({ mode: 'area-marquee-drag' }))).toBe('crosshair')
  })
})

describe('resolveCursor — função total (contrato de tipo)', () => {
  it('não lança para nenhuma combinação do produto cartesiano mode × hoverKind × corner × spaceHeld', () => {
    for (const mode of ALL_MODES) {
      for (const hoverKind of ALL_HOVER_KINDS) {
        for (const corner of [...ALL_CORNERS, null]) {
          for (const spaceHeld of [true, false]) {
            expect(() => resolveCursor({ mode, activeTool: 'select', hoverKind, corner, spaceHeld })).not.toThrow()
          }
        }
      }
    }
  })
})
