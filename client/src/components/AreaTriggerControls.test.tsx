import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AreaTriggerControls, type AreaTriggerControlsProps } from './AreaTriggerControls'

/**
 * GATILHO DE ÁREA no painel da Região/Sala: o mestre escolhe "Nenhum",
 * "Armadilha" ou "Alarme" e, com gatilho marcado, liga "Mostrar aos
 * jogadores". Sem gatilho não há o que mostrar: o interruptor nem aparece.
 */

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

function render(overrides: Partial<AreaTriggerControlsProps> = {}) {
  const props: AreaTriggerControlsProps = {
    kind: null,
    revealed: false,
    onKindChange: vi.fn(),
    onRevealedChange: vi.fn(),
    ...overrides,
  }
  act(() => root.render(<AreaTriggerControls {...props} />))
  return props
}

function opcao(texto: string): HTMLButtonElement {
  const achado = [...container.querySelectorAll('[role="radio"]')].find((b) => b.textContent === texto)
  if (!(achado instanceof HTMLButtonElement)) throw new Error(`o painel não tem a opção "${texto}"`)
  return achado
}

function interruptor(): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Mostrar aos jogadores'))
  const input = label?.querySelector('input')
  return input instanceof HTMLInputElement ? input : null
}

describe('AreaTriggerControls', () => {
  it('sem gatilho: "Nenhum" marcado e sem interruptor de mostrar', () => {
    render()
    expect(opcao('Nenhum').getAttribute('aria-checked')).toBe('true')
    expect(interruptor()).toBeNull()
  })

  it('escolher "Armadilha" chama onKindChange com o tipo', () => {
    const props = render()
    act(() => opcao('Armadilha').click())
    expect(props.onKindChange).toHaveBeenCalledWith('armadilha')
  })

  it('com alarme marcado: o interruptor aparece e liga "Mostrar aos jogadores"', () => {
    const props = render({ kind: 'alarme' })
    expect(opcao('Alarme').getAttribute('aria-checked')).toBe('true')
    const toggle = interruptor()
    if (toggle === null) throw new Error('esperava o interruptor "Mostrar aos jogadores"')
    expect(toggle.checked).toBe(false)
    act(() => toggle.click())
    expect(props.onRevealedChange).toHaveBeenCalledWith(true)
  })
})
