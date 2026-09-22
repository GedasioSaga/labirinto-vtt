import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DrawingTool } from '../types/tools'
import { Toolbar } from './Toolbar'
import type { ToolVariantBindings } from './ToolVariantMenu'
import { TOOL_CLUSTERS, TOOL_LABELS } from './labels'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function bindings(activeTool: DrawingTool, onSelectTool: (tool: DrawingTool) => void): ToolVariantBindings {
  return {
    doorKind: { value: 'normal', onChange: vi.fn() },
    wallKind: { value: undefined, onChange: vi.fn() },
    regionFillPattern: { value: 'solid', onChange: vi.fn() },
    polygonSides: { value: 6, onChange: vi.fn() },
    stairSizePreset: { value: 'medium', onChange: vi.fn() },
    drawTexture: { value: 'pen', onChange: vi.fn() },
    eraseMode: { value: 'objeto', onChange: vi.fn() },
    floorShapeKind: { value: 'rect', onChange: vi.fn() },
    floorOp: { value: 'add', onChange: vi.fn() },
    floorPolygonSides: { value: 6, onChange: vi.fn() },
  floorBrushSize: { value: 1, onChange: vi.fn() },
    drawShape: { value: activeTool, onChange: onSelectTool },
  }
}

function render(activeTool: DrawingTool, lastDrawingTool: DrawingTool, onSelectTool = vi.fn()) {
  act(() =>
    root.render(
      <Toolbar
        activeTool={activeTool}
        onSelectTool={onSelectTool}
        lastDrawingTool={lastDrawingTool}
        variantBindings={bindings(activeTool, onSelectTool)}
      />,
    ),
  )
  return onSelectTool
}

const buttonsNamed = (name: string) =>
  Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).filter((b) => b.getAttribute('aria-label') === name)

const desenho = () => {
  const [button] = buttonsNamed('Desenho')
  if (!button) throw new Error('botão Desenho ausente')
  return button
}

describe('Toolbar — botão Desenho', () => {
  it('não existe botão com nome de forma, e existe 1 "Desenho" com 1 setinha', () => {
    render('select', 'brush')
    for (const shape of TOOL_CLUSTERS.drawing.tools) {
      expect(buttonsNamed(TOOL_LABELS[shape] ?? shape), shape).toHaveLength(0)
    }
    expect(buttonsNamed('Desenho')).toHaveLength(1)
    expect(buttonsNamed('Opções de Desenho')).toHaveLength(1)
    // Token escondido (FEATURES.tokenTool) e Texto/Medir/Borracha continuam soltos.
    expect(buttonsNamed('Token')).toHaveLength(0)
    expect(buttonsNamed('Texto')).toHaveLength(1)
  })

  it('activeTool=line: aria-pressed e tip "Desenho: Linha (L)"', () => {
    render('line', 'brush')
    expect(desenho().getAttribute('aria-pressed')).toBe('true')
    expect(desenho().getAttribute('data-tip')).toBe('Desenho: Linha (L)')
  })

  it('com Selecionar ativo e lastDrawingTool=rect, o botão não está pressionado e o clique ativa rect', () => {
    const onSelectTool = render('select', 'rect')
    expect(desenho().getAttribute('aria-pressed')).toBe('false')
    expect(desenho().getAttribute('data-tip')).toBe('Desenho: Retângulo (R)')
    act(() => desenho().click())
    expect(onSelectTool).toHaveBeenCalledWith('rect')
  })

  it('a setinha abre "Opções de Desenho" com Forma (7, com ícone) e, no Pincel, Textura do traço', () => {
    render('brush', 'brush')
    act(() => buttonsNamed('Opções de Desenho')[0].click())
    const menu = document.body.querySelector('[role="group"][aria-label="Opções de Desenho"]')
    expect(menu).not.toBeNull()
    const radiogroups = Array.from(menu?.querySelectorAll('[role="radiogroup"]') ?? []).map((g) => g.getAttribute('aria-label'))
    expect(radiogroups).toEqual(['Forma', 'Textura do traço'])
    const shapes = menu?.querySelectorAll('[role="radiogroup"][aria-label="Forma"] [role="radio"]') ?? []
    expect(Array.from(shapes).map((r) => r.getAttribute('aria-label'))).toEqual([
      'Pincel', 'Linha', 'Curva', 'Círculo', 'Elipse', 'Retângulo', 'Polígono',
    ])
    expect(Array.from(shapes).every((r) => r.querySelector('svg'))).toBe(true)
  })

  it('com a Linha, o menu só tem Forma; escolher Elipse ativa a ferramenta e fecha', () => {
    const onSelectTool = render('line', 'line')
    act(() => buttonsNamed('Opções de Desenho')[0].click())
    const menu = () => document.body.querySelector('[role="group"][aria-label="Opções de Desenho"]')
    expect(Array.from(menu()?.querySelectorAll('[role="radiogroup"]') ?? []).map((g) => g.getAttribute('aria-label'))).toEqual(['Forma'])
    const ellipse = menu()?.querySelector<HTMLButtonElement>('[role="radio"][aria-label="Elipse"]')
    act(() => ellipse?.click())
    expect(onSelectTool).toHaveBeenCalledWith('ellipse')
    expect(menu()).toBeNull()
  })

  it('a descrição da opção vai para aria-describedby, fora do nome acessível (D10)', () => {
    render('line', 'line')
    act(() => buttonsNamed('Opções de Desenho')[0].click())
    const line = document.body.querySelector<HTMLButtonElement>('[role="radio"][aria-label="Linha"]')
    const descId = line?.getAttribute('aria-describedby')
    expect(descId).toBeTruthy()
    expect(document.getElementById(descId ?? '')?.textContent).toBe('Reta entre dois pontos (L)')
  })
})

describe('Toolbar — dica de ferramenta sem atalho', () => {
  // Sala livre e Caminho nasceram sem letra (lib/keymap.ts). A dica dizia
  // "Sala: Sala livre ()": o parêntese vazio sugeria um atalho que não existe.
  it.each<DrawingTool>(['roomFree', 'path'])('%s: a dica não tem parêntese vazio', (tool) => {
    render(tool, 'brush')
    const dicas = Array.from(document.body.querySelectorAll<HTMLElement>('[data-tip]')).map((el) => el.getAttribute('data-tip') ?? '')
    const daFerramenta = dicas.filter((dica) => dica.includes(TOOL_LABELS[tool] ?? tool))
    expect(daFerramenta.length, `nenhuma dica fala de ${tool}: ${dicas.join(' | ')}`).toBeGreaterThan(0)
    for (const dica of daFerramenta) expect(dica).not.toContain('()')
  })

  it('ferramenta com atalho continua com a letra entre parênteses', () => {
    render('line', 'brush')
    expect(desenho().getAttribute('data-tip')).toBe('Desenho: Linha (L)')
  })
})
