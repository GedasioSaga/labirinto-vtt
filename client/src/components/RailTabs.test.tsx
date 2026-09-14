import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RailTabs, type RailTab } from './RailTabs'

function Harness() {
  const [active, setActive] = useState<RailTab>('map')
  return <RailTabs active={active} onChange={setActive} mapPanel={<p>painel mapa</p>} roomPanel={<p>painel sala</p>} />
}

describe('RailTabs', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<Harness />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const tab = (name: string) => {
    const found = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((el) => el.textContent === name)
    if (found === undefined) throw new Error(`sem aba ${name}`)
    return found
  }
  const panelOf = (button: HTMLButtonElement) => {
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '')
    if (panel === null) throw new Error('aria-controls sem painel')
    return panel
  }

  it('começa em Mapa com o painel da sala escondido', () => {
    expect(container.querySelector('[role="tablist"]')).not.toBeNull()
    expect(tab('Mapa').getAttribute('aria-selected')).toBe('true')
    expect(tab('Sala').getAttribute('aria-selected')).toBe('false')
    expect(panelOf(tab('Mapa')).hidden).toBe(false)
    expect(panelOf(tab('Sala')).hidden).toBe(true)
    expect(panelOf(tab('Sala')).getAttribute('aria-labelledby')).toBe(tab('Sala').id)
  })

  it('clique troca o painel e o aria-selected', () => {
    act(() => tab('Sala').click())
    expect(tab('Sala').getAttribute('aria-selected')).toBe('true')
    expect(tab('Mapa').getAttribute('aria-selected')).toBe('false')
    expect(panelOf(tab('Sala')).hidden).toBe(false)
    expect(panelOf(tab('Sala')).textContent).toBe('painel sala')
    expect(panelOf(tab('Mapa')).hidden).toBe(true)
  })

  it('setas trocam de aba e movem o foco', () => {
    const press = (key: string) =>
      act(() => {
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      })
    tab('Mapa').focus()
    press('ArrowRight')
    expect(tab('Sala').getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tab('Sala'))
    press('ArrowRight')
    expect(tab('Mapa').getAttribute('aria-selected')).toBe('true')
    press('ArrowLeft')
    expect(tab('Sala').getAttribute('aria-selected')).toBe('true')
    expect(tab('Sala').tabIndex).toBe(0)
    expect(tab('Mapa').tabIndex).toBe(-1)
  })
})
