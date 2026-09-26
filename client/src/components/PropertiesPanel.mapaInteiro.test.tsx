import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { relevantPropertyGroups } from '../lib/toolProperties'
import { useMapStore } from '../stores/mapStore'
import { PropertiesPanel } from './PropertiesPanel'
import { propsDoPainel, type PainelProps } from './propertiesPanelTestProps'
import type { TerritorioControlsProps } from './TerritorioControls'

/*
 * A primeira tela sem seleção (peça mapa-inteiro-enxuto), no painel DE VERDADE:
 * com Selecionar e nada selecionado, "Território" nasce fechado, como Pinos,
 * Objetos do mapa e Locais; "Chão do mapa" e "Camadas" continuam nascendo
 * abertas (e2e/task-panel-sections.spec.ts, teste 1). A escolha do mestre
 * continua lembrada: abriu uma vez, a seção volta aberta.
 */

const nada = (): void => {}

const TERRITORIO: TerritorioControlsProps = {
  filtroLigado: false,
  onFiltroChange: nada,
  legenda: [],
  alerta: 'calmo',
  onAlertaChange: nada,
}

/** O painel como o App monta com Selecionar e nada selecionado. */
function semSelecao(): PainelProps {
  return propsDoPainel(null, { groups: relevantPropertyGroups('select'), territorio: TERRITORIO })
}

function limparSecoesLembradas() {
  for (const chave of Object.keys(window.localStorage)) {
    if (chave.startsWith('lb-section:')) window.localStorage.removeItem(chave)
  }
}

describe('painel de propriedades — mapa inteiro sem seleção', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    limparSecoesLembradas()
    useMapStore.setState({
      map: createEmptyMap('m1', 'Cripta do Farol', 30, 20, 64),
      camera: { x: 0, y: 0, scale: 1 },
      selection: EMPTY_SELECTION,
      past: [],
      future: [],
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    limparSecoesLembradas()
  })

  function renderPainel(props: PainelProps): void {
    act(() => root.render(<PropertiesPanel {...props} />))
  }

  function cabecalho(titulo: string): HTMLButtonElement {
    const botao = [...container.querySelectorAll<HTMLButtonElement>('.lb-inspector__body button[aria-expanded]')].find(
      (b) => b.textContent?.trim() === titulo,
    )
    if (botao === undefined) throw new Error(`o painel não tem a seção "${titulo}"`)
    return botao
  }

  function corpoDa(titulo: string): HTMLElement | null {
    return document.getElementById(cabecalho(titulo).getAttribute('aria-controls') ?? '')
  }

  it('com Selecionar e nada selecionado, Território nasce fechado; Chão do mapa e Camadas nascem abertas', () => {
    renderPainel(semSelecao())
    expect(cabecalho('Território').getAttribute('aria-expanded')).toBe('false')
    expect(corpoDa('Território')?.hidden, 'fechado, o corpo sai da vista e da ordem de Tab').toBe(true)
    expect(cabecalho('Chão do mapa').getAttribute('aria-expanded')).toBe('true')
    expect(cabecalho('Camadas').getAttribute('aria-expanded')).toBe('true')
  })

  it('Território continua antes de Chão do mapa, com o alerta lá dentro para quando o mestre abrir', () => {
    renderPainel(semSelecao())
    const territorio = cabecalho('Território')
    const chao = cabecalho('Chão do mapa')
    expect(territorio.compareDocumentPosition(chao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(corpoDa('Território')?.querySelector('[role="radiogroup"]')).not.toBeNull()
  })

  it('a escolha do mestre continua lembrada: abriu Território uma vez, ele volta aberto', () => {
    renderPainel(semSelecao())
    act(() => cabecalho('Território').click())
    expect(cabecalho('Território').getAttribute('aria-expanded')).toBe('true')

    act(() => root.unmount())
    root = createRoot(container)
    renderPainel(semSelecao())
    expect(cabecalho('Território').getAttribute('aria-expanded')).toBe('true')
  })
})
