import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerNoteCard } from './PlayerNoteCard'

describe('PlayerNoteCard (recado do mestre)', () => {
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

  function render(text: string, onClose: () => void, escapeCloses = true): void {
    act(() => root.render(<PlayerNoteCard text={text} onClose={onClose} escapeCloses={escapeCloses} />))
  }

  function pressEscape(target: EventTarget = document.body): void {
    act(() => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
  }

  it('mostra HTML do mestre como TEXTO: os sinais < e > na tela, nenhum <b> criado', () => {
    render('<b>negrito</b><img src=x onerror="alert(1)">', () => {})
    const texto = container.querySelector('.pp-note__text')
    expect(texto?.textContent).toBe('<b>negrito</b><img src=x onerror="alert(1)">')
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('"Fechar" e Escape fecham', () => {
    const onClose = vi.fn()
    render('oi', onClose)
    const fechar = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Fechar')
    act(() => fechar?.click())
    expect(onClose).toHaveBeenCalledTimes(1)
    pressEscape()
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('Escape dentro de campo de texto é da edição, e com outro cartão aberto é dele', () => {
    const onClose = vi.fn()
    render('oi', onClose)
    const campo = document.createElement('input')
    document.body.appendChild(campo)
    pressEscape(campo)
    campo.remove()
    expect(onClose).not.toHaveBeenCalled()

    render('oi', onClose, false)
    pressEscape()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('não rouba o foco ao aparecer', () => {
    const campo = document.createElement('input')
    document.body.appendChild(campo)
    campo.focus()
    render('oi', () => {})
    expect(document.activeElement).toBe(campo)
    campo.remove()
  })
})
