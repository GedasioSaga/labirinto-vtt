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
        { label: 'Ir lá', run: irLa, mantem: true },
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

/**
 * "Deixar todos" é a resposta em lote dos pedidos de passagem e da porta
 * (ações `emLote`). Uma caixa só com ações no ponto não tem o que deixar: o
 * botão não pode aparecer prometendo algo que não faz.
 */
describe('Toast: "Deixar todos" com ações no ponto na caixa', () => {
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

  function acaoNoPonto(id: string, quem: string): ToastMessage {
    return {
      id,
      kind: 'instrucao',
      text: `${quem} quer Procurar — Ferreiro`,
      grupo: 'Pedidos',
      actions: [
        { label: 'Ir lá', run: vi.fn(), mantem: true },
        { label: 'Nada aqui', run: vi.fn() },
        { label: 'Feito', run: vi.fn() },
      ],
    }
  }

  function pedidoDaPorta(id: string, deixar: () => void): ToastMessage {
    return {
      id,
      kind: 'instrucao',
      text: 'Duda bate na porta',
      grupo: 'Pedidos',
      sempreEmCaixa: true,
      actions: [
        { label: 'Destrancar e abrir', run: deixar, emLote: true },
        { label: 'Não', run: vi.fn() },
      ],
    }
  }

  const botoesDeixarTodos = () => Array.from(container.querySelectorAll('button')).filter((b) => b.textContent === 'Deixar todos')

  it('só ações no ponto esperando: a caixa "Pedidos (2)" aparece sem "Deixar todos"', () => {
    act(() => root.render(<Toast toasts={[acaoNoPonto('a', 'Fabi'), acaoNoPonto('b', 'Duda')]} onDismiss={vi.fn()} />))
    expect(container.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe('Pedidos (2)')
    expect(botoesDeixarTodos()).toEqual([])
    // As respostas de cada linha continuam lá.
    expect(Array.from(container.querySelectorAll('button')).filter((b) => b.textContent === 'Nada aqui')).toHaveLength(2)
  })

  it('porta + ação no ponto: "Deixar todos" responde só a porta e a ação no ponto fica esperando', () => {
    const onDismiss = vi.fn()
    const deixar = vi.fn()
    act(() => root.render(<Toast toasts={[pedidoDaPorta('porta', deixar), acaoNoPonto('ponto', 'Fabi')]} onDismiss={onDismiss} />))
    const [deixarTodos] = botoesDeixarTodos()
    if (deixarTodos === undefined) throw new Error('com um pedido em lote na caixa, "Deixar todos" deveria aparecer')
    act(() => deixarTodos.click())
    expect(deixar).toHaveBeenCalledTimes(1)
    expect(onDismiss.mock.calls).toEqual([['porta']])
  })
})
