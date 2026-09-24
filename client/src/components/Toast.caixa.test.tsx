import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToastMessage } from '../stores/toastStore'
import { Toast } from './Toast'

/**
 * A CAIXA de avisos (dois ou mais do mesmo grupo) só oferece "Deixar todos"
 * quando o botão tem o que fazer: se nenhum aviso dela tem ação `emLote`, o
 * botão seria um clique que não responde ninguém.
 */

describe('Toast: "Deixar todos" da caixa', () => {
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

  function desenha(toasts: ToastMessage[], onDismiss: (id: string) => void = () => {}): void {
    act(() => root.render(<Toast toasts={toasts} onDismiss={onDismiss} />))
  }

  function botoes(): string[] {
    return [...container.querySelectorAll('button')].map((botao) => botao.textContent ?? '')
  }

  it('caixa sem nenhuma ação em lote não mostra "Deixar todos"', () => {
    const olhar = vi.fn()
    desenha([
      { id: 'a1', kind: 'instrucao', text: 'Ana achou a chave', grupo: 'Achados', actions: [{ label: 'Olhar', run: olhar }] },
      { id: 'a2', kind: 'instrucao', text: 'Bruno achou o mapa', grupo: 'Achados', actions: [{ label: 'Olhar', run: olhar }] },
    ])
    expect(container.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe('Achados (2)')
    expect(botoes()).toEqual(['Olhar', 'Olhar'])
  })

  it('caixa "Bilhetes (2)": o "Deixar todos" aparece e entrega os dois', () => {
    const entregues: string[] = []
    const interceptados: string[] = []
    const dispensados: string[] = []
    const bilhete = (id: string, texto: string): ToastMessage => ({
      id,
      kind: 'instrucao',
      text: texto,
      grupo: 'Bilhetes',
      actions: [
        { label: 'Entregar', run: () => entregues.push(id), emLote: true },
        { label: 'Interceptar', run: () => interceptados.push(id) },
      ],
    })
    desenha([bilhete('b1', 'Ana → Bruno, pelo pombo: "No poço."'), bilhete('b2', 'Bruno → Ana, pelo tubo: "Vou."')], (id) => dispensados.push(id))
    const todos = [...container.querySelectorAll('button')].find((botao) => botao.textContent === 'Deixar todos')
    if (todos === undefined) throw new Error('a caixa de bilhetes deveria ter "Deixar todos"')
    act(() => todos.click())
    expect(entregues).toEqual(['b1', 'b2'])
    expect(interceptados).toEqual([])
    expect(dispensados).toEqual(['b1', 'b2'])
  })
})
