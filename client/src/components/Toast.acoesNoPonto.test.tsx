import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToastMessage } from '../stores/toastStore'
import { Toast } from './Toast'

/**
 * "Ir lá" do pedido no ponto leva o mestre ao lugar SEM responder: a linha
 * fica na tela para ele ainda dizer "Nada aqui" ou "Feito". Os outros botões
 * seguem tirando o aviso antes de agir.
 */
describe('Toast: botão que mantém o aviso', () => {
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

  function pedido(id: string, irLa: () => void, feito: () => void): ToastMessage {
    return {
      id,
      kind: 'instrucao',
      text: `Fabi quer Procurar — Ferreiro (${id})`,
      grupo: 'Pedidos',
      actions: [
        { label: 'Ir lá', run: irLa, mantemAviso: true },
        { label: 'Feito', run: feito },
      ],
    }
  }

  function botao(label: string, index = 0): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll('button')).filter((b) => b.textContent === label)[index]
    if (found === undefined) throw new Error(`sem botão "${label}"`)
    return found
  }

  it('aviso solto: "Ir lá" roda sem dispensar; "Feito" dispensa e roda', () => {
    const onDismiss = vi.fn()
    const irLa = vi.fn()
    const feito = vi.fn()
    act(() => root.render(<Toast toasts={[pedido('a', irLa, feito)]} onDismiss={onDismiss} />))
    act(() => botao('Ir lá').click())
    expect(irLa).toHaveBeenCalledTimes(1)
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => botao('Feito').click())
    expect(onDismiss).toHaveBeenCalledWith('a')
    expect(feito).toHaveBeenCalledTimes(1)
  })

  it('na caixa "Pedidos": a mesma regra por linha', () => {
    const onDismiss = vi.fn()
    const irLa = vi.fn()
    act(() => root.render(<Toast toasts={[pedido('a', irLa, vi.fn()), pedido('b', vi.fn(), vi.fn())]} onDismiss={onDismiss} />))
    expect(container.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe('Pedidos (2)')
    act(() => botao('Ir lá', 0).click())
    expect(irLa).toHaveBeenCalledTimes(1)
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => botao('Feito', 1).click())
    expect(onDismiss).toHaveBeenCalledWith('b')
  })
})
