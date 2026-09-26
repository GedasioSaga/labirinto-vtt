import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SelectionHeader, deleteLabelFor } from './SelectionHeader'
import { WallDoorControls } from './WallDoorControls'
import { StairControls } from './StairControls'
import { DrawingStyleControls, type DrawingStyleControlsProps } from './DrawingStyleControls'
import { WallLineStyleField, WallStyleControls } from './WallStyleControls'
import { RegionJoinField, RegionStyleControls } from './RegionStyleControls'

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

function render(node: React.ReactNode) {
  act(() => root.render(node))
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((b) => b.textContent === text)
}

// O "Apagar" saiu de SelectionControls para a faixa da seleção (SelectionHeader):
// o texto do botão continua o mesmo, letra por letra.
describe('SelectionHeader — botão Apagar', () => {
  const renderHeader = (kind: 'stair' | 'token') =>
    render(
      <SelectionHeader
        identity={{ icon: kind, type: kind === 'stair' ? 'Escada' : 'Token', name: null }}
        deleteLabel={deleteLabelFor({ kind, count: 1 })}
        onDelete={vi.fn()}
        actions={[]}
        actionsHint={null}
      />,
    )

  it('escada: "Apagar escada selecionada"', () => {
    renderHeader('stair')
    expect(buttonByText('Apagar escada selecionada')).toBeDefined()
  })

  it('token: "Apagar token selecionado"', () => {
    renderHeader('token')
    expect(buttonByText('Apagar token selecionado')).toBeDefined()
  })
})

describe('Ponta e canto — mora no Avançado (fatia 3)', () => {
  it('fora de WallStyleControls', () => {
    render(<WallStyleControls wallKind="exterior" onWallKindChange={vi.fn()} lineStyle="round" onLineStyleChange={vi.fn()} />)
    expect(container.textContent).not.toContain('Ponta e canto')
    expect(container.querySelector('[aria-label="Ponta e canto da parede"]')).toBeNull()
  })

  it('dentro de WallLineStyleField, com o radiogroup ligado à frase', () => {
    const onLineStyleChange = vi.fn()
    render(<WallLineStyleField lineStyle="round" onLineStyleChange={onLineStyleChange} describedBy="dica" />)
    expect(container.textContent).toContain('Ponta e canto')
    const group = container.querySelector('[role="radiogroup"][aria-label="Ponta e canto da parede"]')
    expect(group?.getAttribute('aria-describedby')).toBe('dica')
    act(() => buttonByText('Reta')?.click())
    expect(onLineStyleChange).toHaveBeenCalledWith('straight')
  })

  it('Cantos do contorno e Suavizar contorno saíram de RegionStyleControls', () => {
    render(
      <RegionStyleControls
        color="#ffffff" onColorChange={vi.fn()} pattern="solid" onPatternChange={vi.fn()}
        strokeJoin="round" onStrokeJoinChange={vi.fn()} onSmoothRegion={vi.fn()}
      />,
    )
    expect(container.textContent).not.toContain('Cantos do contorno')
    expect(container.textContent).not.toContain('Suavizar contorno')
    expect(container.textContent).not.toContain('Um contorno fechado não tem ponta solta')
    render(<RegionJoinField strokeJoin="miter" onStrokeJoinChange={vi.fn()} />)
    expect(container.textContent).toContain('Cantos do contorno')
  })
})

describe('WallDoorControls — rótulos fixos', () => {
  it.each([
    [false, false],
    [true, true],
  ])('open=%s locked=%s: sempre "Aberta" e "Trancada"', (open, locked) => {
    render(<WallDoorControls door={{ open, locked, kind: 'normal' }} onToggleDoor={vi.fn()} onToggleOpen={vi.fn()} onToggleLocked={vi.fn()} onToggleSecret={vi.fn()} onRevealPassage={vi.fn()} onOpensFromChange={vi.fn()} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Aberta')
    expect(text).toContain('Trancada')
    expect(text).not.toContain('Fechada')
    expect(text).not.toContain('Destrancada')
  })
})

describe('StairControls — sentido como segmento Sobe | Desce', () => {
  it('marca o sentido atual e troca ao clicar', () => {
    const onDirectionChange = vi.fn()
    render(<StairControls direction="up" onDirectionChange={onDirectionChange} shape="straight" onShapeChange={vi.fn()} stepWidth={32} onStepWidthChange={vi.fn()} grid={64} travel={null} />)
    const group = container.querySelector('[role="radiogroup"][aria-label="Sentido da escada"]')
    expect(group).not.toBeNull()
    const up = buttonByText('Sobe')
    const down = buttonByText('Desce')
    expect(up?.getAttribute('aria-checked')).toBe('true')
    expect(down?.getAttribute('aria-checked')).toBe('false')
    act(() => down?.click())
    expect(onDirectionChange).toHaveBeenCalledWith('down')
    expect(container.textContent).not.toContain('desmarcado')
  })
})

describe('DrawingStyleControls — alvo', () => {
  const base: DrawingStyleControlsProps = {
    color: '#ff0000', onColorChange: vi.fn(), width: 3, onWidthChange: vi.fn(),
    filled: false, onFilledChange: vi.fn(), fillAlpha: 0.5, onFillAlphaChange: vi.fn(),
    showFilled: false, showWidth: true, fontSize: 14, onFontSizeChange: vi.fn(),
    fontFamily: 'Arial', onFontFamilyChange: vi.fn(), showFontSize: false,
  }

  it('sem target: título do próximo desenho', () => {
    render(<DrawingStyleControls {...base} />)
    expect(container.querySelector('h2')?.textContent).toBe('Estilo de desenho')
  })

  it('target "selected": título do desenho selecionado, e os controles editam o valor recebido', () => {
    const onWidthChange = vi.fn()
    render(<DrawingStyleControls {...base} target="selected" width={7} onWidthChange={onWidthChange} />)
    expect(container.querySelector('h2')?.textContent).toBe('Estilo do desenho selecionado')
    const range = container.querySelector<HTMLInputElement>('#lb-draw-width')
    expect(range?.value).toBe('7')
  })
})
