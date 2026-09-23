import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToastMessage } from '../stores/toastStore'
import { Toast } from './Toast'

/**
 * Aviso que pede um TEXTO de volta ("Responder" do chamado): o botão abre um
 * campo na própria linha; Enter envia e tira o aviso, Esc fecha o campo e o
 * aviso continua. E o botão que "mantém" ("Ir lá") age sem tirar o aviso.
 */
describe('Toast: responder dentro do aviso', () => {
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

  function chamado(id: string, text: string, enviar: (texto: string) => void, irLa = vi.fn()): ToastMessage {
    return {
      id,
      kind: 'instrucao',
      text,
      grupo: 'Chamados',
      actions: [
        { label: 'Ir lá', run: irLa, mantem: true },
        { label: 'Visto', run: vi.fn() },
      ],
      resposta: { rotulo: 'Responder', maxLength: 500, enviar },
    }
  }

  function botoes(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll('button'))
  }

  function digita(campo: HTMLInputElement, valor: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(campo, valor)
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function render(toasts: ToastMessage[], onDismiss: (id: string) => void): void {
    act(() => root.render(<Toast toasts={toasts} onDismiss={onDismiss} />))
  }

  it('aviso solto: Responder abre o campo, Enviar manda o texto e tira o aviso', () => {
    const enviar = vi.fn()
    const onDismiss = vi.fn()
    render([chamado('t1', 'Carla: Pergunta', enviar)], onDismiss)
    expect(botoes().map((b) => b.textContent)).toEqual(['Ir lá', 'Visto', 'Responder', '×'])
    act(() => botoes().find((b) => b.textContent === 'Responder')?.click())
    const campo = container.querySelector<HTMLInputElement>('input[type="text"]')
    if (campo === null) throw new Error('sem campo')
    expect(document.activeElement).toBe(campo)
    expect(campo.getAttribute('aria-label')).toBe('Resposta para Carla: Pergunta')
    digita(campo, 'Pode usar.')
    act(() => campo.form?.requestSubmit())
    expect(enviar).toHaveBeenCalledWith('Pode usar.')
    expect(onDismiss).toHaveBeenCalledWith('t1')
  })

  it('resposta vazia não sai; Esc fecha o campo, o aviso fica e o foco volta ao Responder', () => {
    const enviar = vi.fn()
    const onDismiss = vi.fn()
    render([chamado('t1', 'Carla: Pergunta', enviar)], onDismiss)
    act(() => botoes().find((b) => b.textContent === 'Responder')?.click())
    const enviarBtn = botoes().find((b) => b.textContent === 'Enviar')
    expect(enviarBtn?.disabled).toBe(true)
    const campo = container.querySelector<HTMLInputElement>('input[type="text"]')
    act(() => {
      campo?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(container.querySelector('input[type="text"]')).toBeNull()
    expect(enviar).not.toHaveBeenCalled()
    expect(onDismiss).not.toHaveBeenCalled()
    expect(document.activeElement?.textContent).toBe('Responder')
  })

  it('"Ir lá" (mantém) age sem tirar o aviso; na caixa, sem "Deixar todos" para quem não tem ação em lote', () => {
    const irLa = vi.fn()
    const onDismiss = vi.fn()
    render([chamado('t1', 'Duda: Quero agir', vi.fn(), irLa), chamado('t2', 'Carla: Pergunta', vi.fn())], onDismiss)
    expect(container.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe('Chamados (2)')
    expect(botoes().some((b) => b.textContent === 'Deixar todos')).toBe(false)
    act(() => botoes().find((b) => b.textContent === 'Ir lá')?.click())
    expect(irLa).toHaveBeenCalledTimes(1)
    expect(onDismiss).not.toHaveBeenCalled()
    // Responder também funciona na linha da caixa.
    act(() => botoes().filter((b) => b.textContent === 'Responder')[1]?.click())
    expect(container.querySelector<HTMLInputElement>('input[type="text"]')?.getAttribute('aria-label')).toBe('Resposta para Carla: Pergunta')
  })
})
