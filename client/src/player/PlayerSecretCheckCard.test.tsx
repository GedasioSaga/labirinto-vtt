import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SECRET_CHECK_RESULT_MAX, SECRET_CHECK_RESULT_MIN } from '../net/protocol'
import { PlayerSecretCheckCard, SECRET_CHECK_INVALID_TEXT, SECRET_CHECK_NOTICE_TEXT, SECRET_CHECK_PRIVACY_HINT } from './PlayerSecretCheckCard'

describe('PlayerSecretCheckCard (teste secreto do mestre)', () => {
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

  function render(label: string, onAnswer: (result: number) => void): void {
    act(() => root.render(<PlayerSecretCheckCard label={label} onAnswer={onAnswer} />))
  }

  function campo(): HTMLInputElement {
    const input = container.querySelector('input')
    if (input === null) throw new Error('sem campo do resultado')
    return input
  }

  function enviar(): HTMLButtonElement {
    const botao = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Enviar')
    if (botao === undefined) throw new Error('sem botão Enviar')
    return botao
  }

  function digita(valor: string): void {
    const input = campo()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, valor)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('mostra o nome do teste como TEXTO e diz que só o mestre vê o resultado', () => {
    render('<b>Percepção</b>', () => {})
    expect(container.textContent).toContain('<b>Percepção</b>')
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain(SECRET_CHECK_PRIVACY_HINT)
    const rotulo = container.querySelector(`label[for="${campo().id}"]`)
    expect(rotulo?.textContent).toBe('Seu resultado')
    expect(campo().min).toBe(String(SECRET_CHECK_RESULT_MIN))
    expect(campo().max).toBe(String(SECRET_CHECK_RESULT_MAX))
  })

  it('"Enviar" manda só um número inteiro na faixa', () => {
    const onAnswer = vi.fn()
    render('Percepção', onAnswer)
    for (const invalido of ['', '2.5', String(SECRET_CHECK_RESULT_MAX + 1)]) {
      digita(invalido)
      act(() => enviar().click())
    }
    expect(onAnswer).not.toHaveBeenCalled()
    digita('17')
    act(() => enviar().click())
    expect(onAnswer).toHaveBeenCalledWith(17)
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it('enviar vazio ou inválido diz o que corrigir junto ao campo e leva o foco a ele; o erro some quando o valor vale', () => {
    render('Percepção', () => {})
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(campo().getAttribute('aria-invalid')).toBeNull()
    act(() => enviar().click())
    const erro = container.querySelector('[role="alert"]')
    expect(erro?.textContent).toBe(SECRET_CHECK_INVALID_TEXT)
    expect(campo().getAttribute('aria-invalid')).toBe('true')
    expect(campo().getAttribute('aria-describedby')).toContain(erro?.id ?? 'sem-id')
    expect(document.activeElement).toBe(campo())
    // O que ele digitou não some; o erro sai assim que vira um número válido.
    digita('2.5')
    expect(campo().value).toBe('2.5')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(SECRET_CHECK_INVALID_TEXT)
    digita('12')
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(campo().getAttribute('aria-invalid')).toBeNull()
  })

  it('Enter no campo envia (é um formulário)', () => {
    const onAnswer = vi.fn()
    render('Percepção', onAnswer)
    digita('-2')
    const form = container.querySelector('form')
    act(() => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(onAnswer).toHaveBeenCalledWith(-2)
  })

  it('não rouba o foco ao aparecer', () => {
    const outro = document.createElement('input')
    document.body.appendChild(outro)
    outro.focus()
    render('Percepção', () => {})
    expect(document.activeElement).toBe(outro)
    outro.remove()
  })

  it('o aviso depois do cartão diz o que aconteceu, sem o resultado', () => {
    expect(SECRET_CHECK_NOTICE_TEXT).toEqual({ sent: 'Resultado enviado ao mestre', closed: 'O mestre encerrou o teste' })
  })
})
