import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConcealBrushControls } from './ConcealBrushControls'
import { TOOLBAR_SLOTS, TOOL_HINTS, TOOL_LABELS } from './labels'
import { relevantPropertyGroups } from '../lib/toolProperties'

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

const radio = (nome: string): HTMLButtonElement => {
  const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find((b) => b.textContent?.trim() === nome)
  if (!achado) throw new Error(`rádio "${nome}" ausente`)
  return achado
}

describe('Pincel de revelar na barra e no painel', () => {
  it('a barra tem a ferramenta com o nome que a régua procura, ao lado da Zona oculta', () => {
    expect(TOOL_LABELS.revealBrush).toMatch(/pincel de revelar/i)
    expect(TOOL_HINTS.revealBrush).toMatch(/Alt/)
    const grupo = TOOLBAR_SLOTS.find((g) => g.includes('concealZone'))
    expect(grupo).toBeDefined()
    expect(grupo?.indexOf('revealBrush')).toBe((grupo?.indexOf('concealZone') ?? -2) + 1)
  })

  it('com a ferramenta na mão, o painel mostra a seção do pincel', () => {
    expect(relevantPropertyGroups('revealBrush').has('revealBrush')).toBe(true)
    expect(relevantPropertyGroups('concealZone').has('revealBrush')).toBe(false)
  })

  it('"Revelar" e "Esconder" são rádios; clicar em Esconder troca o modo', () => {
    const onModeChange = vi.fn()
    act(() => root.render(<ConcealBrushControls mode="revelar" onModeChange={onModeChange} width={1} onWidthChange={vi.fn()} />))
    expect(radio('Revelar').getAttribute('aria-checked')).toBe('true')
    expect(radio('Esconder').getAttribute('aria-checked')).toBe('false')
    act(() => radio('Esconder').click())
    expect(onModeChange).toHaveBeenCalledWith('esconder')
  })

  it('a largura do pincel é escolhida em quadrados da grade', () => {
    const onWidthChange = vi.fn()
    act(() => root.render(<ConcealBrushControls mode="esconder" onModeChange={vi.fn()} width={1} onWidthChange={onWidthChange} />))
    expect(radio('Esconder').getAttribute('aria-checked')).toBe('true')
    act(() => radio('Largo').click())
    expect(onWidthChange).toHaveBeenCalledWith(4)
  })
})
