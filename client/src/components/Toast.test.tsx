import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToastMessage } from '../stores/toastStore'
import { Toast } from './Toast'

/**
 * O que a pilha de avisos DESENHA para o pedido da porta trancada: a caixa
 * "Pedidos (1)" já com um pedido só — e o pedido de passagem sozinho
 * continua o aviso de hoje (G4).
 */

function portaTrancada(run: { abrir?: () => void; nao?: () => void } = {}): ToastMessage {
  return {
    id: 'd1',
    kind: 'instrucao',
    text: 'Ana tenta forçar a porta em Mansão',
    actions: [
      { label: 'Destrancar e abrir', run: run.abrir ?? (() => {}), emLote: true },
      { label: 'Não', run: run.nao ?? (() => {}) },
    ],
    grupo: 'Pedidos',
    sempreEmCaixa: true,
  }
}

function passagem(id: string, jogador: string): ToastMessage {
  return {
    id,
    kind: 'instrucao',
    text: `${jogador} quer passar por Escada → Cripta`,
    actions: [
      { label: 'Deixar ir', run: () => {}, emLote: true },
      { label: 'Não', run: () => {} },
    ],
    grupo: 'Pedidos',
  }
}

describe('Toast: pedido da porta trancada na caixa de pedidos', () => {
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

  const botoes = (dentro: ParentNode) => [...dentro.querySelectorAll('button')].map((b) => b.textContent)
  const caixa = (nome: string) => container.querySelector(`[role="region"][aria-label="${nome}"]`)

  it('um pedido de porta só: caixa "Pedidos (1)" com a linha "Ana tenta forçar a porta", sem "Deixar todos"', () => {
    act(() => root.render(<Toast toasts={[portaTrancada()]} onDismiss={vi.fn()} />))
    const regiao = caixa('Pedidos (1)')
    expect(regiao).not.toBeNull()
    expect(regiao?.querySelector('h2')?.textContent).toBe('Pedidos (1)')
    expect(regiao?.textContent).toContain('Ana tenta forçar a porta em Mansão')
    // "Deixar todos" de um só repetiria o botão da linha.
    expect(regiao === null ? [] : botoes(regiao)).toEqual(['Destrancar e abrir', 'Não'])
    // Sozinha na caixa, a resposta esperada é o botão de latão.
    const abrir = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Destrancar e abrir')
    expect(abrir?.className).toContain('lb-btn--primary')
  })

  it('"Destrancar e abrir" na caixa tira a linha e responde', () => {
    const abrir = vi.fn()
    const onDismiss = vi.fn()
    act(() => root.render(<Toast toasts={[portaTrancada({ abrir })]} onDismiss={onDismiss} />))
    const botao = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Destrancar e abrir')
    act(() => botao?.click())
    expect(onDismiss).toHaveBeenCalledWith('d1')
    expect(abrir).toHaveBeenCalledTimes(1)
  })

  it('porta + passagem: uma caixa "Pedidos (2)" com as duas linhas e "Deixar todos"', () => {
    act(() => root.render(<Toast toasts={[passagem('p1', 'Bruno'), portaTrancada()]} onDismiss={vi.fn()} />))
    const regiao = caixa('Pedidos (2)')
    expect(regiao).not.toBeNull()
    expect(regiao === null ? [] : botoes(regiao)).toEqual(['Deixar ir', 'Não', 'Destrancar e abrir', 'Não', 'Deixar todos'])
  })

  it('controle: um pedido de passagem só continua o aviso de hoje, sem caixa', () => {
    act(() => root.render(<Toast toasts={[passagem('p1', 'Bruno')]} onDismiss={vi.fn()} />))
    expect(container.querySelector('[role="region"]')).toBeNull()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Bruno quer passar por Escada → Cripta')
  })
})
