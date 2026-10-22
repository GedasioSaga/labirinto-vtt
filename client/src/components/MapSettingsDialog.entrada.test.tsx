import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MapSettingsButton, type MapSettingsProps } from './MapSettingsDialog'

/**
 * "Configurações do mapa" entra como as outras janelas da casca do Grimório:
 * opacidade e escala curtas, na curva do tema — e quem pediu menos movimento
 * recebe só o esmaecer.
 * A engrenagem que a abre ganha o balão com o próprio nome, como os ícones da
 * barra.
 *
 * O jsdom não tem `Element.animate`: o teste põe um no protótipo para conferir
 * que a janela não o usa mais (a entrada é a do CSS da casca).
 */

function props(): MapSettingsProps {
  const vazio = vi.fn()
  return {
    grid: {
      showGrid: true,
      onShowGridChange: vazio,
      gridShape: 'square',
      onGridShapeChange: vazio,
      snapTargets: { token: true, wall: true, prop: false },
      onSnapTargetChange: vazio,
      gridSettings: { color: '#ffffff', opacity: 0.3, lineWidth: 1, lineStyle: 'solid' },
      onGridSettingsChange: vazio,
    },
    gridAlign: {
      backgroundFilename: null,
      imageWidth: null,
      imageHeight: null,
      cellSize: 64,
      offset: { x: 0, y: 0 },
      onOffsetChange: vazio,
      onApply: vazio,
      onPreviewChange: vazio,
    },
    mapScale: {
      scale: { unitsPerCell: 1.5, unit: 'm', precision: 1 },
      onScaleChange: vazio,
      measurementMode: 'chessboard',
      onMeasurementModeChange: vazio,
      gridShape: 'square',
    },
    scenarioLink: { scenarioLink: null, onScenarioLinkChange: vazio },
    mapSize: { width: 30, height: 10, onApply: vazio },
  }
}

describe('Configurações do mapa — entrada da janela e balão da engrenagem', () => {
  let container: HTMLDivElement
  let root: Root
  let animar: ReturnType<typeof vi.fn>

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    animar = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, writable: true, value: animar })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    vi.unstubAllGlobals()
  })

  const engrenagem = () => {
    const botao = container.querySelector<HTMLButtonElement>('button[aria-label="Configurações do mapa"]')
    if (!botao) throw new Error('engrenagem não renderizada')
    return botao
  }
  // A janela vai por portal para o body, fora do container.
  const janela = () => document.body.querySelector<HTMLElement>('[role="dialog"]')

  function abrir() {
    act(() => root.render(<MapSettingsButton {...props()} />))
    act(() => engrenagem().click())
  }

  // Fatia 20: a entrada saiu do `Element.animate` e é a da casca do Grimório,
  // em CSS (`.gr-dlg`, grimorio.css), a mesma das outras janelas da casca nova.
  const cssDoGrimorio = () =>
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'grimorio', 'grimorio.css'), 'utf8').replace(/\s+/g, ' ')

  it('a janela entra pela casca do Grimório: opacidade e escala curtas, na curva de saída do tema, sem Element.animate', () => {
    abrir()
    expect(janela()?.classList.contains('gr-dlg')).toBe(true)
    expect(animar).not.toHaveBeenCalled()
    const css = cssDoGrimorio()
    expect(css).toContain('animation: gr-dlg 220ms var(--lb-gr-ease-out) both;')
    expect(css).toContain('@keyframes gr-dlg { from { opacity: 0; transform: scale(0.97) translateY(4px); } }')
  })

  it('com movimento reduzido a janela só esmaece, sem escala, e o foco entra nela do mesmo jeito', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    abrir()
    expect(janela()).not.toBeNull()
    expect(janela()?.contains(document.activeElement)).toBe(true)
    const css = cssDoGrimorio()
    const reduzido = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduzido).toMatch(/\.gr-ficha\.gr-e-nova, \.gr-dlg \{ animation-name: gr-fade; \}/)
  })

  it('a engrenagem mostra o próprio nome no balão, e o nome acessível não muda', () => {
    act(() => root.render(<MapSettingsButton {...props()} />))
    const botao = engrenagem()
    expect(botao.classList.contains('lb-tip')).toBe(true)
    expect(botao.getAttribute('data-tip')).toBe('Configurações do mapa')
    expect(botao.getAttribute('aria-label')).toBe('Configurações do mapa')
    // Para baixo: o cabeçalho fica no topo do painel e o balão para cima sairia dele.
    expect(botao.classList.contains('lb-tip--up')).toBe(false)
  })
})
