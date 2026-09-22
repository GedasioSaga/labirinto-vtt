import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NOTE_MAX_LENGTH } from '../net/protocol'
import type { SceneListItem } from '../stores/adventureStore'
import { ScenesSection, noteFeedbackText } from './ScenesSection'

const CENAS: SceneListItem[] = [
  { id: 's-salao', name: 'Salao Norte', active: true, available: true, renamable: true, tokenCount: 1 },
  { id: 's-cripta', name: 'Cripta Rubra', active: false, available: true, renamable: false, tokenCount: 1 },
]

describe('ScenesSection: "Recado" por cena', () => {
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
  })

  function render(onNote?: (sceneId: string, text: string) => number | null): void {
    act(() => root.render(<ScenesSection scenes={CENAS} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} onNote={onNote} />))
  }

  function botao(nome: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nome)
  }

  function campo(): HTMLTextAreaElement | null {
    return container.querySelector('textarea')
  }

  /** Digita como o React espera: setter nativo + evento `input`. */
  function digita(texto: string): void {
    const alvo = campo()
    if (alvo === null) throw new Error('campo do recado não abriu')
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    act(() => {
      setter?.call(alvo, texto)
      alvo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function tecla(key: string, ctrlKey = false): void {
    const alvo = campo()
    if (alvo === null) throw new Error('campo do recado não abriu')
    act(() => {
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true }))
    })
  }

  it('sem sala (sem onNote) não há botão "Recado"', () => {
    render()
    expect(botao('Recado para Salao Norte')).toBeUndefined()
  })

  it('o campo tem o nome da cena, teto de 500 e "Enviar" manda para a cena da linha', () => {
    const onNote = vi.fn(() => 1)
    render(onNote)
    act(() => botao('Recado para Cripta Rubra')?.click())
    const label = container.querySelector(`label[for="${campo()?.id ?? ''}"]`)
    expect(label?.textContent).toBe('Recado para quem está em Cripta Rubra')
    expect(campo()?.maxLength).toBe(NOTE_MAX_LENGTH)
    digita('Algo se mexe.')
    act(() => botao('Enviar')?.click())
    expect(onNote).toHaveBeenCalledWith('s-cripta', 'Algo se mexe.')
    expect(campo()).toBeNull()
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Recado enviado a 1 jogador')
  })

  it('Ctrl+Enter envia; Enter comum não; Esc cancela sem enviar', () => {
    const onNote = vi.fn(() => 0)
    render(onNote)
    act(() => botao('Recado para Salao Norte')?.click())
    digita('oi')
    tecla('Enter')
    expect(onNote).not.toHaveBeenCalled()
    tecla('Enter', true)
    expect(onNote).toHaveBeenCalledWith('s-salao', 'oi')
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Ninguém está nesta cena')

    act(() => botao('Recado para Salao Norte')?.click())
    digita('não vai')
    tecla('Escape')
    expect(campo()).toBeNull()
    expect(onNote).toHaveBeenCalledTimes(1)
  })

  it('texto vazio não envia', () => {
    const onNote = vi.fn(() => 1)
    render(onNote)
    act(() => botao('Recado para Salao Norte')?.click())
    digita('   ')
    expect(botao('Enviar')?.disabled).toBe(true)
    tecla('Enter', true)
    expect(onNote).not.toHaveBeenCalled()
  })

  it('aviso: plural, singular, ninguém e sala fechada', () => {
    expect(noteFeedbackText(3)).toBe('Recado enviado a 3 jogadores')
    expect(noteFeedbackText(1)).toBe('Recado enviado a 1 jogador')
    expect(noteFeedbackText(0)).toBe('Ninguém está nesta cena')
    expect(noteFeedbackText(null)).toMatch(/sala/)
  })
})
