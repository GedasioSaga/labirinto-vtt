import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerCallButton, type PlayerCallButtonProps } from './PlayerCallButton'

describe('PlayerCallButton (chamar o mestre)', () => {
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

  function render(props: Partial<PlayerCallButtonProps> = {}): { onRaise: ReturnType<typeof vi.fn>; onLower: ReturnType<typeof vi.fn> } {
    const onRaise = vi.fn((_reason: string, _text?: string) => true)
    const onLower = vi.fn()
    act(() => root.render(<PlayerCallButton call={undefined} onRaise={onRaise} onLower={onLower} {...props} />))
    return { onRaise, onLower }
  }

  function botao(texto: string): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === texto)
    if (found === undefined) throw new Error(`sem botão "${texto}"`)
    return found
  }

  function digita(campo: HTMLInputElement, valor: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(campo, valor)
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('abre o formulário, escolhe "Quero agir", escreve e chama', () => {
    const { onRaise } = render()
    act(() => botao('Chamar o mestre').click())
    const agir = container.querySelector<HTMLInputElement>('input[type="radio"][value="agir"]')
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(5)
    act(() => agir?.click())
    const campo = container.querySelector<HTMLInputElement>('input[type="text"]')
    if (campo === null) throw new Error('sem campo de texto')
    expect(campo.maxLength).toBe(140)
    digita(campo, 'abro o baú')
    expect(container.textContent).toContain('130 caracteres restantes')
    act(() => botao('Chamar').click())
    expect(onRaise).toHaveBeenCalledWith('agir', 'abro o baú')
    // Chamou: o formulário fecha.
    expect(container.querySelector('form')).toBeNull()
  })

  it('mão acesa: "Esperando o mestre", com o motivo, e "Baixar a mão"', () => {
    const { onLower } = render({ call: { id: 1, phase: 'waiting', reason: 'agir' } })
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Esperando o mestre · Quero agir')
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Chamar o mestre')).toBe(false)
    act(() => botao('Baixar a mão').click())
    expect(onLower).toHaveBeenCalledTimes(1)
  })

  it('"O mestre viu" e "espere" aparecem como aviso, com o botão de chamar de volta', () => {
    render({ call: { id: 2, phase: 'seen' } })
    expect(container.querySelector('[role="status"]')?.textContent).toBe('O mestre viu')
    expect(botao('Chamar o mestre')).toBeTruthy()
    render({ call: { id: 3, phase: 'too_soon' } })
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Espere um instante para chamar de novo')
  })

  it('Esc fecha o formulário e devolve o foco ao botão', () => {
    render()
    const mao = botao('Chamar o mestre')
    act(() => mao.click())
    const campo = container.querySelector<HTMLInputElement>('input[type="text"]')
    act(() => {
      campo?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(container.querySelector('form')).toBeNull()
    expect(document.activeElement?.textContent).toBe('Chamar o mestre')
  })

  it('o chamado recusado (socket fechado) mantém o formulário e o texto', () => {
    render({ onRaise: vi.fn(() => false) })
    act(() => botao('Chamar o mestre').click())
    const campo = container.querySelector<HTMLInputElement>('input[type="text"]')
    if (campo === null) throw new Error('sem campo de texto')
    digita(campo, 'socorro')
    act(() => botao('Chamar').click())
    expect(container.querySelector('form')).not.toBeNull()
    expect(campo.value).toBe('socorro')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Não deu para chamar')
  })
})
