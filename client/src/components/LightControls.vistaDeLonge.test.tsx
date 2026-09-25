// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LightControls, type LightControlsProps } from './LightControls'

/** "Vista de longe" no painel da Luz: o mestre liga e a luz vira ponto aceso para quem a enxerga de longe. */

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

let root: Root | null = null
let host: HTMLDivElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  host = null
})

function montar(overrides: Partial<LightControlsProps> = {}) {
  const props: LightControlsProps = {
    color: '#ffcc00',
    onColorChange: vi.fn(),
    intensity: 1,
    onIntensityChange: vi.fn(),
    tokens: [],
    attachedTokenId: null,
    onAttach: vi.fn(),
    onDetach: vi.fn(),
    ...overrides,
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  const r = createRoot(host)
  root = r
  act(() => r.render(<LightControls {...props} />))
  return props
}

function interruptor(): HTMLInputElement | null {
  const label = Array.from(document.querySelectorAll('label')).find((l) => l.textContent?.trim() === 'Vista de longe')
  const input = label?.querySelector('input')
  return input instanceof HTMLInputElement ? input : null
}

describe('LightControls — Vista de longe', () => {
  it('sem quem grave, o interruptor não aparece', () => {
    montar()
    expect(interruptor()).toBe(null)
  })

  it('desligado por padrão; ligar chama onVistaDeLongeChange(true) e explica o que o jogador vê', () => {
    const props = montar({ vistaDeLonge: false, onVistaDeLongeChange: vi.fn() })
    const toggle = interruptor()
    if (toggle === null) throw new Error('o painel da luz não tem "Vista de longe"')
    expect(toggle.checked).toBe(false)
    const hintId = toggle.getAttribute('aria-describedby')
    expect(hintId === null ? '' : (document.getElementById(hintId)?.textContent ?? '')).toContain('ponto aceso')
    act(() => toggle.click())
    expect(props.onVistaDeLongeChange).toHaveBeenCalledWith(true)
  })

  it('ligada: o interruptor aparece marcado e desligar chama com false', () => {
    const props = montar({ vistaDeLonge: true, onVistaDeLongeChange: vi.fn() })
    const toggle = interruptor()
    if (toggle === null) throw new Error('o painel da luz não tem "Vista de longe"')
    expect(toggle.checked).toBe(true)
    act(() => toggle.click())
    expect(props.onVistaDeLongeChange).toHaveBeenCalledWith(false)
  })
})
