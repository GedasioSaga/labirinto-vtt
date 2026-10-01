import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NovoTokenForm } from './NovoTokenForm'

/**
 * O formulário que o "+ Token" abre, extraído da antiga seção "Seleção" sem
 * mudar o gesto: o nome sugerido nasce selecionado (digitar já troca), Enter
 * vazio usa o sugerido, e o Esc desiste sem chegar ao mapa — lá o Esc é
 * "cancelar" e largaria a seleção.
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

function montar() {
  const props = { defaultTokenName: 'Token 3', onConfirm: vi.fn<(nome: string) => void>(), onCancel: vi.fn() }
  act(() => root.render(<NovoTokenForm {...props} />))
  return props
}

function campo(): HTMLInputElement {
  const alvo = container.querySelector<HTMLInputElement>('input#lb-new-token-name')
  if (alvo === null) throw new Error('sem o campo "Nome do novo token"')
  return alvo
}

function botao(texto: string): HTMLButtonElement {
  const alvo = [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === texto)
  if (alvo === undefined) throw new Error(`sem o botão "${texto}"`)
  return alvo
}

/** Digita como a pessoa: o React só vê a troca pelo setter nativo seguido do evento `input`. */
function digitar(alvo: HTMLInputElement, texto: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (setter === undefined) throw new Error('o jsdom não expôs o setter de value')
  act(() => {
    setter.call(alvo, texto)
    alvo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function esc(alvo: Element): KeyboardEvent {
  const evento = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  act(() => {
    alvo.dispatchEvent(evento)
  })
  return evento
}

describe('NovoTokenForm — o formulário do "+ Token"', () => {
  it('nasce com o nome sugerido no campo, com o foco e todo selecionado, sob o rótulo visível', () => {
    montar()
    const input = campo()
    expect(input.value).toBe('Token 3')
    expect(document.activeElement).toBe(input)
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 'Token 3'.length])
    expect(container.querySelector('label[for="lb-new-token-name"]')?.textContent).toBe('Nome do novo token')
  })

  it('o primeiro mouseup depois do foco não desfaz a seleção; o seguinte posiciona o cursor', () => {
    montar()
    const primeiro = new MouseEvent('mouseup', { bubbles: true, cancelable: true })
    act(() => {
      campo().dispatchEvent(primeiro)
    })
    expect(primeiro.defaultPrevented).toBe(true)
    const segundo = new MouseEvent('mouseup', { bubbles: true, cancelable: true })
    act(() => {
      campo().dispatchEvent(segundo)
    })
    expect(segundo.defaultPrevented).toBe(false)
  })

  it('Enter com o campo em branco usa o nome sugerido', () => {
    const props = montar()
    digitar(campo(), '   ')
    act(() => campo().form?.requestSubmit())
    expect(props.onConfirm).toHaveBeenCalledWith('Token 3')
  })

  it('Enter com texto usa o texto aparado', () => {
    const props = montar()
    digitar(campo(), '  Goblin ')
    act(() => campo().form?.requestSubmit())
    expect(props.onConfirm).toHaveBeenCalledWith('Goblin')
    expect(props.onCancel).not.toHaveBeenCalled()
  })

  it('Esc no campo desiste sem criar e não chega à janela', () => {
    const props = montar()
    const naJanela = vi.fn()
    window.addEventListener('keydown', naJanela)
    const evento = esc(campo())
    window.removeEventListener('keydown', naJanela)
    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onConfirm).not.toHaveBeenCalled()
    expect(naJanela).not.toHaveBeenCalled()
    expect(evento.defaultPrevented).toBe(true)
  })

  it('Esc vale onde o foco estiver: com o foco no Adicionar ou no Cancelar, também desiste', () => {
    const props = montar()
    for (const texto of ['Adicionar', 'Cancelar']) {
      act(() => botao(texto).focus())
      esc(document.activeElement ?? container)
    }
    expect(props.onCancel).toHaveBeenCalledTimes(2)
    expect(props.onConfirm).not.toHaveBeenCalled()
  })

  it('Cancelar desiste; o envio se chama exatamente "Adicionar", como as jornadas clicam', () => {
    const props = montar()
    expect(botao('Adicionar').type).toBe('submit')
    act(() => botao('Cancelar').click())
    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onConfirm).not.toHaveBeenCalled()
  })
})
