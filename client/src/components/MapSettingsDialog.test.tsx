import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MeasurementMode } from '../types/map'
import { MapSettingsButton, type MapSettingsProps } from './MapSettingsDialog'
import { MEASUREMENT_MODE_DESCRIPTIONS } from './MapScaleControls'

function makeProps(overrides: { measurementMode?: MeasurementMode; withImage?: boolean } = {}) {
  const onMeasurementModeChange = vi.fn()
  const props: MapSettingsProps = {
    grid: {
      showGrid: true,
      onShowGridChange: vi.fn(),
      gridShape: 'square',
      onGridShapeChange: vi.fn(),
      snapTargets: { token: true, wall: true, prop: false },
      onSnapTargetChange: vi.fn(),
      gridSettings: { color: '#ffffff', opacity: 0.3, lineWidth: 1, lineStyle: 'solid' },
      onGridSettingsChange: vi.fn(),
    },
    gridAlign: {
      backgroundFilename: overrides.withImage ? 'masmorra.png' : null,
      imageWidth: overrides.withImage ? 1280 : null,
      imageHeight: overrides.withImage ? 960 : null,
      cellSize: 64,
      offset: { x: 0, y: 0 },
      onOffsetChange: vi.fn(),
      onApply: vi.fn(),
      onPreviewChange: vi.fn(),
    },
    mapScale: {
      scale: { unitsPerCell: 1.5, unit: 'm', precision: 1 },
      onScaleChange: vi.fn(),
      measurementMode: overrides.measurementMode ?? 'chessboard',
      onMeasurementModeChange,
      gridShape: 'square',
    },
    scenarioLink: { scenarioLink: null, onScenarioLinkChange: vi.fn() },
  }
  return { props, onMeasurementModeChange }
}

describe('MapSettingsButton / MapSettingsDialog', () => {
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
    vi.restoreAllMocks()
  })

  const render = (props: MapSettingsProps) => act(() => root.render(<MapSettingsButton {...props} />))
  const gear = () => {
    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Configurações do mapa"]')
    if (!button) throw new Error('engrenagem não renderizada')
    return button
  }
  // A janela vai por portal para o body, fora do container.
  const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
  const modeSelect = () => {
    const select = document.body.querySelector<HTMLSelectElement>('#lb-scale-mode')
    if (!select) throw new Error('select de modo de medição ausente')
    return select
  }
  const openDialog = () => {
    gear().focus()
    act(() => gear().click())
  }

  it('a engrenagem abre a janela modal com título e foco no primeiro campo', () => {
    render(makeProps().props)
    expect(dialog()).toBeNull()
    expect(gear().getAttribute('aria-expanded')).toBe('false')

    openDialog()

    const opened = dialog()
    expect(opened).not.toBeNull()
    expect(opened?.getAttribute('aria-modal')).toBe('true')
    const titleId = opened?.getAttribute('aria-labelledby') ?? ''
    expect(document.getElementById(titleId)?.textContent).toBe('Configurações do mapa')
    expect(gear().getAttribute('aria-expanded')).toBe('true')
    // Primeiro campo = primeira opção do formato da grade, não o botão Fechar.
    const active = document.activeElement
    expect(active?.getAttribute('role')).toBe('radio')
    expect(active?.closest('[aria-label="Formato da grade"]')).not.toBeNull()
  })

  it('Esc fecha a janela e devolve o foco à engrenagem', () => {
    render(makeProps().props)
    openDialog()
    const opened = dialog()
    if (!opened) throw new Error('janela não abriu')

    act(() => {
      opened.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(gear())
    expect(gear().getAttribute('aria-expanded')).toBe('false')
  })

  it('Esc não chega aos atalhos do editor (window)', () => {
    const onWindowKey = vi.fn()
    window.addEventListener('keydown', onWindowKey)
    try {
      render(makeProps().props)
      openDialog()
      act(() => {
        dialog()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })
      expect(onWindowKey).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', onWindowKey)
    }
  })

  it('clique no fundo fecha; clique dentro da janela não fecha', () => {
    render(makeProps().props)
    openDialog()
    const backdrop = document.body.querySelector<HTMLElement>('.lb-dialog-backdrop')
    const opened = dialog()
    if (!backdrop || !opened) throw new Error('janela não abriu')

    act(() => {
      opened.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      opened.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(dialog()).not.toBeNull()

    act(() => {
      backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(dialog()).toBeNull()
  })

  it('o select de medição mostra só os modos da grade quadrada e chama o callback com o modo escolhido', () => {
    const { props, onMeasurementModeChange } = makeProps()
    render(props)
    openDialog()

    const select = modeSelect()
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      'chessboard',
      'alternating',
      'euclidean',
      'manhattan',
    ])
    expect(select.value).toBe('chessboard')

    act(() => {
      select.value = 'manhattan'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onMeasurementModeChange).toHaveBeenCalledTimes(1)
    expect(onMeasurementModeChange).toHaveBeenCalledWith('manhattan')
  })

  it('a explicação abaixo do select acompanha o modo escolhido', () => {
    render(makeProps({ measurementMode: 'chessboard' }).props)
    openDialog()
    const hint = () => document.body.querySelector('#lb-scale-mode-hint')?.textContent
    expect(hint()).toBe(MEASUREMENT_MODE_DESCRIPTIONS.chessboard)
    expect(modeSelect().getAttribute('aria-describedby')).toBe('lb-scale-mode-hint')

    render(makeProps({ measurementMode: 'manhattan' }).props)
    expect(hint()).toBe(MEASUREMENT_MODE_DESCRIPTIONS.manhattan)
    expect(MEASUREMENT_MODE_DESCRIPTIONS.manhattan).not.toBe(MEASUREMENT_MODE_DESCRIPTIONS.chessboard)
  })

  it('grade hex oferece só Hexagonal e Euclidiana', () => {
    const { props } = makeProps()
    render({ ...props, mapScale: { ...props.mapScale, gridShape: 'hex', measurementMode: 'hex' } })
    openDialog()
    expect(Array.from(modeSelect().options).map((option) => option.value)).toEqual(['hex', 'euclidean'])
  })

  it('Alinhar grade: sem imagem mostra só a explicação; com imagem mostra os campos', () => {
    render(makeProps({ withImage: false }).props)
    openDialog()
    expect(document.body.querySelector('#lb-gridalign-cols')).toBeNull()
    expect(dialog()?.textContent).toContain('Importe uma imagem de fundo')

    act(() => dialog()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    render(makeProps({ withImage: true }).props)
    openDialog()
    expect(document.body.querySelector('#lb-gridalign-cols')).not.toBeNull()
  })

  it('sem a prop showScenarioLink o Link de cenário não aparece (FEATURES.scenarioLink)', () => {
    render(makeProps().props)
    openDialog()
    expect(dialog()).not.toBeNull()
    expect(document.body.querySelector('#lb-scenario-link')).toBeNull()
    expect(dialog()?.textContent).not.toContain('Link de cenário')
    expect(dialog()?.textContent).not.toContain('Endereço do cenário')
  })

  it('Link de cenário tem nome acessível e frase explicando o campo', () => {
    act(() => root.render(<MapSettingsButton {...makeProps().props} showScenarioLink />))
    openDialog()
    const input = document.body.querySelector<HTMLInputElement>('#lb-scenario-link')
    const label = document.body.querySelector('label[for="lb-scenario-link"]')
    expect(input).not.toBeNull()
    expect(label?.textContent).toBe('Endereço do cenário')
    expect(document.body.querySelector('#lb-scenario-link-hint')?.textContent).toContain('não vai para os jogadores')
  })
})
