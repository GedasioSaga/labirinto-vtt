/**
 * O CAMPO DE RESPOSTA do aviso (agir sobre uma ficha): o mestre escreve o que
 * o NPC responde e aperta Aceitar ou Recusar; o texto vai para a `run` do
 * botão. Vale no aviso solto e na linha da caixa "Pedidos (N)".
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToastMessage } from '../stores/toastStore'
import { Toast } from './Toast'

function pedido(id: string, run: (resposta?: string) => void): ToastMessage {
  return {
    id,
    kind: 'instrucao',
    text: `Ana → Severa: Falar (${id})`,
    grupo: 'Pedidos',
    resposta: { rotulo: 'Resposta só para Ana (opcional)', maxLength: 20 },
    actions: [
      { label: 'Aceitar', run },
      { label: 'Recusar', run: () => {} },
    ],
  }
}

describe('Toast: campo de resposta do aviso', () => {
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

  function digita(campo: HTMLInputElement, valor: string): void {
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(campo, valor)
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function campoCom(rotulo: string, dentro: ParentNode): HTMLInputElement {
    const label = [...dentro.querySelectorAll('label')].find((l) => l.textContent === rotulo)
    const campo = label?.control
    if (!(campo instanceof HTMLInputElement)) throw new Error(`sem campo "${rotulo}"`)
    return campo
  }

  function botao(texto: string, dentro: ParentNode): HTMLButtonElement {
    const achado = [...dentro.querySelectorAll('button')].find((b) => b.textContent === texto)
    if (!achado) throw new Error(`sem botão "${texto}"`)
    return achado
  }

  it('aviso solto: o texto escrito vai aparado para a ação, e o campo respeita o teto', () => {
    const run = vi.fn()
    const onDismiss = vi.fn()
    act(() => root.render(<Toast toasts={[pedido('t1', run)]} onDismiss={onDismiss} />))
    const campo = campoCom('Resposta só para Ana (opcional)', container)
    expect(campo.maxLength).toBe(20)
    digita(campo, '  Subiu ontem.  ')
    act(() => botao('Aceitar', container).click())
    expect(onDismiss).toHaveBeenCalledWith('t1')
    expect(run).toHaveBeenCalledWith('Subiu ontem.')
  })

  it('na caixa "Pedidos (2)", cada linha tem o seu campo, e o texto de uma não vai para a outra', () => {
    const primeira = vi.fn()
    const segunda = vi.fn()
    act(() => root.render(<Toast toasts={[pedido('t1', primeira), pedido('t2', segunda)]} onDismiss={() => {}} />))
    const linhas = [...container.querySelectorAll('li')]
    expect(linhas).toHaveLength(2)
    const [um, dois] = linhas
    if (um === undefined || dois === undefined) throw new Error('esperava duas linhas')
    digita(campoCom('Resposta só para Ana (opcional)', dois), 'Ela te ignora.')
    act(() => botao('Aceitar', dois).click())
    expect(segunda).toHaveBeenCalledWith('Ela te ignora.')
    act(() => botao('Aceitar', um).click())
    expect(primeira).toHaveBeenCalledWith('')
  })

  it('chega outro pedido no meio da escrita: o aviso vira caixa e o texto já escrito continua no campo', () => {
    const run = vi.fn()
    act(() => root.render(<Toast toasts={[pedido('t1', run)]} onDismiss={() => {}} />))
    digita(campoCom('Resposta só para Ana (opcional)', container), 'Ela sorri.')
    act(() => root.render(<Toast toasts={[pedido('t1', run), pedido('t2', () => {})]} onDismiss={() => {}} />))
    const [um] = [...container.querySelectorAll('li')]
    if (um === undefined) throw new Error('esperava a caixa com as linhas')
    expect(campoCom('Resposta só para Ana (opcional)', um).value).toBe('Ela sorri.')
    act(() => botao('Aceitar', um).click())
    expect(run).toHaveBeenCalledWith('Ela sorri.')
  })

  it('aviso sem campo continua só com os botões', () => {
    const run = vi.fn()
    act(() => root.render(<Toast toasts={[{ id: 'x', kind: 'instrucao', text: 'Grog quer passar', actions: [{ label: 'Deixar ir', run }] }]} onDismiss={() => {}} />))
    expect(container.querySelector('input')).toBeNull()
    act(() => botao('Deixar ir', container).click())
    expect(run).toHaveBeenCalledTimes(1)
  })
})
