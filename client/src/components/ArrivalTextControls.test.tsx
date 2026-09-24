import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ARRIVAL_TEXT_MAX_LENGTH } from '../lib/arrivalText'
import { ArrivalTextControls } from './ArrivalTextControls'

/**
 * "Texto de chegada" nas Configurações do mapa: o mestre escreve o que quem
 * chega à cena lê uma vez. O texto só vale ao sair do campo — cada letra não
 * vira um passo do desfazer — e Escape desiste do que foi digitado.
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

function render(text: string, onChange: (next: string) => void): void {
  act(() => root.render(<ArrivalTextControls text={text} onChange={onChange} />))
}

function campo(): HTMLTextAreaElement {
  const alvo = container.querySelector('textarea')
  if (alvo === null) throw new Error('campo do texto de chegada não apareceu')
  return alvo
}

function digita(texto: string): void {
  const alvo = campo()
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  act(() => {
    setter?.call(alvo, texto)
    alvo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function sai(): void {
  act(() => campo().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
}

describe('ArrivalTextControls', () => {
  it('campo rotulado, com o texto atual e o teto do texto', () => {
    render('Frio.', vi.fn())
    const alvo = campo()
    expect(alvo.labels?.[0]?.textContent).toBe('Texto de chegada')
    expect(alvo.value).toBe('Frio.')
    expect(alvo.maxLength).toBe(ARRIVAL_TEXT_MAX_LENGTH)
  })

  it('digitar não grava; sair do campo grava uma vez', () => {
    const onChange = vi.fn()
    render('', onChange)
    digita('O ar cheira a enxofre.')
    expect(onChange).not.toHaveBeenCalled()
    sai()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('O ar cheira a enxofre.')
  })

  it('sair sem mudar nada não grava', () => {
    const onChange = vi.fn()
    render('Frio.', onChange)
    digita('  Frio.  ')
    sai()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Escape desiste do rascunho e volta ao texto gravado', () => {
    const onChange = vi.fn()
    render('Frio.', onChange)
    digita('Quente.')
    act(() => campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(campo().value).toBe('Frio.')
    sai()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('apagar tudo e sair grava vazio (a cena fica sem texto)', () => {
    const onChange = vi.fn()
    render('Frio.', onChange)
    digita('')
    sai()
    expect(onChange).toHaveBeenCalledWith('')
  })
})
