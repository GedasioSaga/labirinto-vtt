import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildLineDrawing } from '../lib/drawingFactory'
import { createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { relevantPropertyGroups } from '../lib/toolProperties'
import { useMapStore } from '../stores/mapStore'
import { PropertiesPanel } from './PropertiesPanel'
import { propsDoPainel, type PainelProps } from './propertiesPanelTestProps'

/*
 * A costura do botão "Endireitar" (pedido 5, fatia 3) com o painel DE VERDADE:
 * logo depois da faixa da seleção, dentro do corpo e fora das seções de
 * ferramenta — vale para Linha, Parede solta e Caminho, que têm seções
 * diferentes —, e sem título: o primeiro título da coluna continua sendo o do
 * item, que as jornadas leem (`e2e/task-jornada-painel-com-nome-certo.spec.ts`).
 */

const nada = (): void => {}
const TORTA = buildLineDrawing('torta', { x: 300, y: 200 }, { x: 360, y: 420 }, '#ffffff', 2)

/** O painel como o App o monta com Selecionar e UMA linha selecionada. */
function painelComUmaLinha(): PainelProps {
  return propsDoPainel(null, {
    groups: relevantPropertyGroups('select', { drawingKind: 'line' }),
    selection: { selection: { kind: 'drawing', count: 1 }, defaultTokenName: 'Token 1', onAddToken: nada, onRemoveSelected: nada },
  })
}

describe('painel de propriedades — botão Endireitar', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useMapStore.setState({
      map: { ...createEmptyMap('m1', 'Casa', 30, 20, 64), drawings: [TORTA] },
      camera: { x: 0, y: 0, scale: 1 },
      selection: [{ kind: 'drawing', id: 'torta' }],
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
  })

  const botaoEndireitar = () => Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Endireitar'))

  it('com a linha torta selecionada, o botão vem logo depois da faixa da seleção, dentro do corpo', () => {
    act(() => root.render(<PropertiesPanel {...painelComUmaLinha()} />))
    const botao = botaoEndireitar()
    if (botao === undefined) throw new Error('o botão Endireitar não apareceu')
    expect(botao.closest('.lb-inspector__body')).not.toBeNull()
    const faixa = container.querySelector('.lb-selhead')
    expect(faixa?.nextElementSibling?.contains(botao)).toBe(true)
  })

  it('não rouba o primeiro título da coluna: a seção dele não tem título', () => {
    act(() => root.render(<PropertiesPanel {...painelComUmaLinha()} />))
    const secao = botaoEndireitar()?.closest('section')
    if (secao === null || secao === undefined) throw new Error('o botão Endireitar não está numa seção')
    expect(secao.querySelector('h1, h2, h3')).toBeNull()
  })

  it('sem seleção na store, o painel não mostra o botão', () => {
    useMapStore.setState({ selection: EMPTY_SELECTION })
    act(() => root.render(<PropertiesPanel {...propsDoPainel(null)} />))
    expect(botaoEndireitar()).toBeUndefined()
  })
})
