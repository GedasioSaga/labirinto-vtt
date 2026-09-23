import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdvancedField, AdvancedSection } from './AdvancedSection'
import { Toggle } from './Toggle'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.localStorage.clear()
})

const header = () => container.querySelector<HTMLButtonElement>('button[aria-expanded]')

describe('AdvancedSection', () => {
  it('nasce fechado, com título h3 "Avançado", mesmo com lb-section:advanced=1 gravado', () => {
    window.localStorage.setItem('lb-section:advanced', '1')
    act(() =>
      root.render(
        <AdvancedSection>
          <p>campo</p>
        </AdvancedSection>,
      ),
    )
    expect(header()?.textContent).toBe('Avançado')
    expect(header()?.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('h3')?.textContent).toBe('Avançado')
    expect(container.querySelector('h2')).toBeNull()
  })

  it('sem filhos (ou só filhos condicionais falsos) não gera DOM', () => {
    act(() => root.render(<AdvancedSection />))
    expect(container.innerHTML).toBe('')
    act(() => root.render(<AdvancedSection>{false}{null}</AdvancedSection>))
    expect(container.innerHTML).toBe('')
  })

  it('AdvancedField liga a frase ao controle por aria-describedby', () => {
    act(() =>
      root.render(
        <AdvancedSection>
          <AdvancedField hint="Explica o controle.">
            {(hintId) => <Toggle label="Opção" checked={false} onChange={vi.fn()} describedBy={hintId} />}
          </AdvancedField>
        </AdvancedSection>,
      ),
    )
    act(() => header()?.click())
    const input = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    const hintId = input?.getAttribute('aria-describedby') ?? ''
    expect(hintId).not.toBe('')
    expect(document.getElementById(hintId)?.textContent).toBe('Explica o controle.')
    expect(document.getElementById(hintId)?.classList.contains('lb-field__hint')).toBe(true)
  })
})
