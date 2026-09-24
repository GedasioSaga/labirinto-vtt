import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AreaSelectionControls, type AreaSelectionControlsProps } from './AreaSelectionControls'
import type { AreaSelection } from '../lib/areaSelection'

const CASA: AreaSelection = {
  walls: ['parede-porta'],
  regions: ['sala-casa'],
  lights: [],
  tokens: [],
  props: [],
  stairs: [],
  drawings: ['des-mesa'],
}

describe('AreaSelectionControls — agrupar pelo painel', () => {
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

  const render = (props: AreaSelectionControlsProps) => act(() => root.render(<AreaSelectionControls {...props} />))

  const botao = (nome: string): HTMLButtonElement | undefined =>
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((el) => el.textContent === nome)

  it('seleção de vários solta: botão Agrupar com o atalho escrito, e ele chama onGroup', () => {
    const onGroup = vi.fn<() => void>()
    render({ selection: CASA, onClear: () => {}, grouped: false, onGroup, onUngroup: () => {} })

    const agrupar = botao('Agrupar (Ctrl+G)')
    expect(agrupar).toBeDefined()
    expect(botao('Desagrupar (Ctrl+Shift+G)')).toBeUndefined()
    act(() => agrupar?.click())
    expect(onGroup).toHaveBeenCalledTimes(1)
  })

  it('grupo selecionado: o painel diz que é um grupo e oferece Desagrupar', () => {
    const onUngroup = vi.fn<() => void>()
    render({ selection: CASA, onClear: () => {}, grouped: true, onGroup: () => {}, onUngroup })

    expect(container.textContent).toContain('3 itens selecionados')
    expect(container.textContent).toContain('Grupo')
    const desagrupar = botao('Desagrupar (Ctrl+Shift+G)')
    expect(desagrupar).toBeDefined()
    expect(botao('Agrupar (Ctrl+G)')).toBeUndefined()
    act(() => desagrupar?.click())
    expect(onUngroup).toHaveBeenCalledTimes(1)
  })

  it('sem os callbacks de grupo (chamador antigo), só o resumo e Limpar — nada quebra', () => {
    render({ selection: CASA, onClear: () => {} })

    expect(container.textContent).toContain('3 itens selecionados')
    expect(botao('Agrupar (Ctrl+G)')).toBeUndefined()
    expect(botao('Limpar seleção de área')).toBeDefined()
  })
})
