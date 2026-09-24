import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DoorState } from '../types/map'
import { WallDoorControls } from './WallDoorControls'

/** CHAVE ABRE PORTA no editor: a porta trancada ganha "Abre com", o nome do item que a destranca. */
describe('WallDoorControls — "Abre com"', () => {
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

  const render = (door: DoorState, onKeyChange = vi.fn()) => {
    act(() => root.render(<WallDoorControls door={door} onToggleDoor={vi.fn()} onToggleOpen={vi.fn()} onToggleLocked={vi.fn()} onToggleSecret={vi.fn()} onRevealPassage={vi.fn()} onKeyChange={onKeyChange} />))
    return onKeyChange
  }
  const campo = () => container.querySelector('input[aria-label="Abre com"]')

  /** Digita como o usuário: o setter nativo do valor, para o React ver a mudança. */
  const digitar = (input: HTMLInputElement, texto: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, texto)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('porta trancada mostra o campo com o nome gravado; porta destrancada não', () => {
    render({ open: false, locked: true, kind: 'normal', abreCom: 'Chave do Escudo' })
    const input = campo()
    expect(input).toBeInstanceOf(HTMLInputElement)
    expect(input instanceof HTMLInputElement ? input.value : '').toBe('Chave do Escudo')
    expect(container.textContent).toContain('Abre com')
    render({ open: false, locked: false, kind: 'normal' })
    expect(campo()).toBeNull()
  })

  it('o nome vale ao sair do campo ou no Enter, não a cada letra; apagar tira a chave', () => {
    const onKeyChange = render({ open: false, locked: true, kind: 'normal' })
    const input = campo()
    if (!(input instanceof HTMLInputElement)) throw new Error('esperava o campo')
    digitar(input, 'Chave do Escudo')
    expect(onKeyChange).not.toHaveBeenCalled()
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(onKeyChange).toHaveBeenCalledWith('Chave do Escudo')
    expect(onKeyChange).toHaveBeenCalledTimes(1)

    const onApagar = render({ open: false, locked: true, kind: 'normal', abreCom: 'Chave do Escudo' })
    const preenchido = campo()
    if (!(preenchido instanceof HTMLInputElement)) throw new Error('esperava o campo')
    digitar(preenchido, '')
    act(() => preenchido.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(onApagar).toHaveBeenCalledWith('')
  })
})
