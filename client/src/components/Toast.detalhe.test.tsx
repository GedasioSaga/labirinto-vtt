/**
 * CAIXA DE PEDIDOS COM IDADE, na tela: o aviso com `detalhe` ganha uma linha
 * pequena embaixo da frase ("há 3 min · agora a 20 casas do pino") que se
 * relê sozinha enquanto o aviso espera. A frase do pedido fica num elemento
 * só dela, igual à de sempre.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToastMessage } from '../stores/toastStore'
import { DETALHE_RELEITURA_MS, Toast } from './Toast'

function pedido(id: string, detalhe: () => string): ToastMessage {
  return {
    id,
    kind: 'instrucao',
    text: `${id} quer passar por Escada → Cripta`,
    grupo: 'Pedidos',
    detalhe,
    actions: [
      { label: 'Deixar ir', run: () => {}, emLote: true },
      { label: 'Não', run: () => {} },
    ],
  }
}

describe('Toast: linha viva do pedido (idade e distância)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  const detalhes = () => [...container.querySelectorAll('.lb-toast__detalhe')].map((el) => el.textContent)
  const frases = () => [...container.querySelectorAll('.lb-toast__text')].map((el) => el.textContent)

  it('aviso solto: a linha aparece embaixo da frase, e a frase fica sozinha no elemento dela', () => {
    act(() => root.render(<Toast toasts={[pedido('Ana', () => 'há menos de 1 min · agora a 2 casas do pino')]} onDismiss={() => {}} />))
    expect(frases()).toEqual(['Ana quer passar por Escada → Cripta'])
    expect(detalhes()).toEqual(['há menos de 1 min · agora a 2 casas do pino'])
  })

  it('a linha se relê sozinha: o tempo passa e a ficha anda sem aviso novo', () => {
    let linha = 'há menos de 1 min · agora a 2 casas do pino'
    act(() => root.render(<Toast toasts={[pedido('Ana', () => linha)]} onDismiss={() => {}} />))
    linha = 'há 3 min · agora a 20 casas do pino'
    // Antes do prazo, nada muda: a tela não relê a cada quadro.
    expect(detalhes()).toEqual(['há menos de 1 min · agora a 2 casas do pino'])
    act(() => vi.advanceTimersByTime(DETALHE_RELEITURA_MS))
    expect(detalhes()).toEqual(['há 3 min · agora a 20 casas do pino'])
  })

  it('caixa "Pedidos (N)": cada linha tem a sua idade e a sua distância', () => {
    act(() =>
      root.render(
        <Toast
          toasts={[pedido('Ana', () => 'há 3 min · agora a 20 casas do pino'), pedido('Bruno', () => 'há 1 min · agora no pino')]}
          onDismiss={() => {}}
        />,
      ),
    )
    const caixa = container.querySelector('[role="region"]')
    expect(caixa?.getAttribute('aria-label')).toBe('Pedidos (2)')
    const linhas = [...container.querySelectorAll('.lb-toastcaixa__row')].map((li) => [
      li.querySelector('.lb-toast__text')?.textContent,
      li.querySelector('.lb-toast__detalhe')?.textContent,
    ])
    expect(linhas).toEqual([
      ['Ana quer passar por Escada → Cripta', 'há 3 min · agora a 20 casas do pino'],
      ['Bruno quer passar por Escada → Cripta', 'há 1 min · agora no pino'],
    ])
  })

  it('a linha que muda sozinha não é lida em voz alta a cada segundo', () => {
    act(() => root.render(<Toast toasts={[pedido('Ana', () => 'há 3 min · agora a 20 casas do pino')]} onDismiss={() => {}} />))
    expect(container.querySelector('.lb-toast__detalhe')?.getAttribute('aria-live')).toBe('off')
  })

  it('aviso sem detalhe, ou com detalhe vazio (pedido já respondido), não ganha linha nenhuma', () => {
    const semDetalhe: ToastMessage = { id: 'x', kind: 'info', text: 'Mapa salvo' }
    act(() => root.render(<Toast toasts={[semDetalhe, pedido('Ana', () => '')]} onDismiss={() => {}} />))
    expect(frases()).toEqual(['Mapa salvo', 'Ana quer passar por Escada → Cripta'])
    expect(detalhes()).toEqual([])
  })

  it('sem aviso com detalhe, nenhum relógio fica ligado', () => {
    act(() => root.render(<Toast toasts={[{ id: 'x', kind: 'info', text: 'Mapa salvo' }]} onDismiss={() => {}} />))
    expect(vi.getTimerCount()).toBe(0)
    act(() => root.render(<Toast toasts={[pedido('Ana', () => 'há 1 min · agora no pino')]} onDismiss={() => {}} />))
    expect(vi.getTimerCount()).toBe(1)
  })
})
