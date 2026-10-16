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
 * "Endireitar" (pedido 5) com o painel DE VERDADE, no lugar da fatia 8 do
 * design consolidado: um item do "Mais ações" da cabeça da ficha, e não mais
 * um botão solto no corpo. Continua só aparecendo quando o clique mudaria
 * alguma coisa (Linha, Parede solta ou Caminho tortos), endireita num passo
 * de Ctrl+Z e ensina a tecla (o Alt tocado faz o mesmo).
 */

const nada = (): void => {}
const TORTA = buildLineDrawing('torta', { x: 300, y: 200 }, { x: 360, y: 420 }, '#ffffff', 2)
const RETA = buildLineDrawing('reta', { x: 0, y: 40 }, { x: 200, y: 40 }, '#ffffff', 2)
const MAPA = { ...createEmptyMap('m1', 'Casa', 30, 20, 64), drawings: [TORTA, RETA] }

/** O painel como o App o monta com Selecionar e UMA linha selecionada (sem a ligação de pisos). */
function painelComUmaLinha(): PainelProps {
  return propsDoPainel(null, {
    groups: relevantPropertyGroups('select', { drawingKind: 'line' }),
    selection: { selection: { kind: 'drawing', count: 1 }, defaultTokenName: 'Token 1', onAddToken: nada, onRemoveSelected: nada },
  })
}

function linhaDoMapa(id: string) {
  const achada = useMapStore.getState().map.drawings.find((d) => d.id === id)
  if (achada === undefined || achada.kind !== 'line') throw new Error(`a linha ${id} sumiu`)
  return achada
}

describe('painel de propriedades — Endireitar no "Mais ações"', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useMapStore.setState({ map: MAPA, camera: { x: 0, y: 0, scale: 1 }, selection: [{ kind: 'drawing', id: 'torta' }], past: [], future: [] })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const render = () => act(() => root.render(<PropertiesPanel {...painelComUmaLinha()} />))
  const maisAcoes = () => container.querySelector<HTMLButtonElement>('button[aria-label="Mais ações"]')
  /** O nome acessível do item: o texto que o `aria-labelledby` aponta (sem o detalhe nem a tecla). */
  const nomeDoItem = (item: Element) => document.getElementById(item.getAttribute('aria-labelledby') ?? '')?.textContent ?? ''
  /** O item "Endireitar" do menu aberto (o menu mora num portal, no `body`). */
  const itemEndireitar = () => Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) => nomeDoItem(item) === 'Endireitar')
  function abrirMenu(): void {
    const botao = maisAcoes()
    if (botao === null) throw new Error('o "Mais ações" não apareceu')
    act(() => botao.click())
  }

  it('linha torta: o item "Endireitar" mora no menu da cabeça, com nome limpo e a tecla Alt à vista; nada solto no corpo', () => {
    render()
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent?.startsWith('Endireitar'))).toBe(false)
    abrirMenu()
    const item = itemEndireitar()
    if (item === undefined) throw new Error('o "Endireitar" não está no menu')
    expect(item.querySelector('kbd')?.textContent).toBe('Alt')
    expect(item.getAttribute('aria-describedby')).not.toBeNull()
  })

  it('o clique endireita num passo de Ctrl+Z e o item some (o menu inteiro, sem outra ação); o Ctrl+Z traz os dois de volta', () => {
    render()
    abrirMenu()
    const item = itemEndireitar()
    if (!(item instanceof HTMLButtonElement)) throw new Error('o "Endireitar" não está no menu')
    act(() => item.click())

    const reta = linhaDoMapa('torta')
    expect(reta.x1).toBe(reta.x2)
    expect(useMapStore.getState().past).toHaveLength(1)
    // Sem pisos e sem nada a endireitar, o menu não tem o que oferecer: o botão some.
    expect(maisAcoes()).toBeNull()

    act(() => useMapStore.getState().undo())
    abrirMenu()
    expect(itemEndireitar()).toBeDefined()
  })

  it('linha já reta ou camada Anotações travada: o menu não oferece Endireitar', () => {
    act(() => useMapStore.setState({ selection: [{ kind: 'drawing', id: 'reta' }] }))
    render()
    expect(maisAcoes()).toBeNull()

    act(() => useMapStore.setState({ map: { ...MAPA, lockedLayers: ['anotacoes'] }, selection: [{ kind: 'drawing', id: 'torta' }] }))
    expect(maisAcoes()).toBeNull()
  })

  it('sem seleção na store, o painel não mostra nada de Endireitar', () => {
    useMapStore.setState({ selection: EMPTY_SELECTION })
    act(() => root.render(<PropertiesPanel {...propsDoPainel(null)} />))
    expect(maisAcoes()).toBeNull()
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent?.startsWith('Endireitar'))).toBe(false)
  })
})
