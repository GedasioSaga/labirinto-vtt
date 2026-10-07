import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import { useArrivalTextSettings } from '../stores/useArrivalTextSettings'
import { MapSettingsButton, type MapSettingsProps } from './MapSettingsDialog'

/**
 * TEXTO DE CHEGADA no editor do mestre, de ponta a ponta: a engrenagem
 * "Configurações do mapa" abre a janela com o campo mostrando o texto da cena
 * aberta (store), e o que o mestre escreve volta para a cena. É a mesma
 * ligação que o `App.tsx` passa ao painel (`arrivalText={arrivalTextSettings}`).
 */
const RESTO: MapSettingsProps = {
  grid: {
    showGrid: false,
    onShowGridChange: vi.fn(),
    gridShape: 'square',
    onGridShapeChange: vi.fn(),
    snapTargets: { token: true, wall: true, prop: false },
    onSnapTargetChange: vi.fn(),
    gridSettings: { color: '#ffffff', opacity: 0.3, lineWidth: 1, lineStyle: 'solid' },
    onGridSettingsChange: vi.fn(),
  },
  gridAlign: {
    backgroundFilename: null,
    imageWidth: null,
    imageHeight: null,
    cellSize: 50,
    offset: { x: 0, y: 0 },
    onOffsetChange: vi.fn(),
    onApply: vi.fn(),
    onPreviewChange: vi.fn(),
  },
  mapScale: {
    scale: { unitsPerCell: 1.5, unit: 'm', precision: 1 },
    onScaleChange: vi.fn(),
    measurementMode: 'chessboard',
    onMeasurementModeChange: vi.fn(),
    gridShape: 'square',
  },
  scenarioLink: { scenarioLink: null, onScenarioLinkChange: vi.fn() },
  mapSize: { width: 10, height: 10, onApply: vi.fn() },
}

/** O pedaço do editor que importa aqui: a engrenagem do painel ligada à cena aberta. */
function Editor() {
  return <MapSettingsButton {...RESTO} arrivalText={useArrivalTextSettings()} />
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useMapStore.setState({ map: { ...createEmptyMap('m', 'Cripta', 10, 10, 50), textoChegada: 'Cheiro de enxofre.' }, past: [], future: [] })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function abreConfiguracoes(): HTMLElement {
  const engrenagem = container.querySelector<HTMLButtonElement>('button[aria-label="Configurações do mapa"]')
  if (engrenagem === null) throw new Error('engrenagem Configurações do mapa não apareceu')
  act(() => engrenagem.click())
  // A janela vai por portal para o body.
  const janela = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (janela === null) throw new Error('janela Configurações do mapa não abriu')
  return janela
}

function campoDeChegada(janela: HTMLElement): HTMLTextAreaElement {
  const rotulo = Array.from(janela.querySelectorAll('label')).find((label) => label.textContent?.trim() === 'Texto de chegada')
  if (rotulo === undefined) throw new Error('rótulo "Texto de chegada" ausente da janela')
  const campo = document.getElementById(rotulo.htmlFor)
  if (!(campo instanceof HTMLTextAreaElement) || !janela.contains(campo)) throw new Error('rótulo não aponta para o campo de texto da janela')
  return campo
}

describe('texto de chegada na janela Configurações do mapa', () => {
  it('o campo aparece na janela com o texto da cena aberta', () => {
    act(() => root.render(<Editor />))
    const janela = abreConfiguracoes()
    expect(campoDeChegada(janela).value).toBe('Cheiro de enxofre.')
  })

  it('o que o mestre escreve volta para a cena, e reabrir mostra o texto novo', () => {
    act(() => root.render(<Editor />))
    const campo = campoDeChegada(abreConfiguracoes())
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    if (setter === undefined) throw new Error('jsdom sem setter de value')
    act(() => {
      campo.focus()
      setter.call(campo, 'Frio e silêncio.')
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => campo.blur())
    expect(useMapStore.getState().map.textoChegada).toBe('Frio e silêncio.')
    expect(useMapStore.getState().past).toHaveLength(1)

    // Desfazer na cena: o campo aberto acompanha.
    act(() => useMapStore.getState().undo())
    expect(campo.value).toBe('Cheiro de enxofre.')
  })

  it('cena sem texto: o campo aparece vazio', () => {
    useMapStore.setState({ map: createEmptyMap('m2', 'Torre', 10, 10, 50), past: [], future: [] })
    act(() => root.render(<Editor />))
    expect(campoDeChegada(abreConfiguracoes()).value).toBe('')
  })
})
