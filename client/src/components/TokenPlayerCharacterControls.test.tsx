import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAYER_CHARACTER_HINT, TokenPlayerCharacterControls } from './TokenPlayerCharacterControls'

/** "Ficha de jogador": o interruptor do mestre que põe a ficha na lista de quem chega. */

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

describe('TokenPlayerCharacterControls', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('mostra o estado e o porquê, e o clique devolve o valor novo', () => {
    const onChange = vi.fn()
    act(() => root.render(<TokenPlayerCharacterControls playerCharacter={false} onPlayerCharacterChange={onChange} />))
    const input = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    if (input === null) throw new Error('o interruptor deveria existir')
    expect(input.checked).toBe(false)
    expect(container.textContent).toContain('Ficha de jogador')
    const hintId = input.getAttribute('aria-describedby')
    expect(hintId === null ? null : document.getElementById(hintId)?.textContent).toBe(PLAYER_CHARACTER_HINT)
    act(() => input.click())
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('marcada, aparece ligada', () => {
    act(() => root.render(<TokenPlayerCharacterControls playerCharacter onPlayerCharacterChange={vi.fn()} />))
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true)
  })
})
