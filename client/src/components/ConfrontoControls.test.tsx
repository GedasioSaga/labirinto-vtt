import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Confronto } from '../types/map'
import { CONFRONTO_LABEL, ConfrontoControls, type ConfrontoControlsProps } from './ConfrontoControls'

const FICHAS = [
  { id: 'ana', nome: 'Ana' },
  { id: 'rato', nome: 'Rato 1' },
  { id: 'bruno', nome: 'Bruno' },
]

describe('ConfrontoControls — o mestre liga o confronto na cena aberta', () => {
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

  const handlers = () => ({
    onIniciar: vi.fn<(fila: string[], passo: number) => void>(),
    onProximaVez: vi.fn<() => void>(),
    onEncerrar: vi.fn<() => void>(),
  })

  const render = (props: ConfrontoControlsProps) => act(() => root.render(<ConfrontoControls {...props} />))

  const botao = (nome: string): HTMLButtonElement => {
    const el = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === nome || b.getAttribute('aria-label') === nome)
    if (el === undefined) throw new Error(`sem botão ${nome}`)
    return el
  }

  const clicar = (el: HTMLElement) => act(() => el.click())

  const marcar = (nome: string) => {
    const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.includes(nome))
    const input = label?.querySelector('input')
    if (!input) throw new Error(`sem caixa ${nome}`)
    clicar(input)
  }

  it('monta a fila na ordem marcada, Subir/Descer reordena, e Começar manda fila e passo', () => {
    const h = handlers()
    render({ fichas: FICHAS, confronto: undefined, ...h })
    clicar(botao(CONFRONTO_LABEL))
    // Sem ninguém marcado não começa, e diz por quê.
    expect(botao('Começar').disabled).toBe(true)
    expect(container.textContent).toContain('Marque ao menos uma ficha')
    marcar('Rato 1')
    marcar('Ana')
    marcar('Bruno')
    clicar(botao('Descer Rato 1'))
    clicar(botao('Subir Bruno'))
    const passo = container.querySelector<HTMLInputElement>('input[type="number"]')
    if (!passo) throw new Error('sem campo de passo')
    expect(passo.value).toBe('6')
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(passo, '4')
      passo.dispatchEvent(new Event('input', { bubbles: true }))
    })
    clicar(botao('Começar'))
    expect(h.onIniciar).toHaveBeenCalledWith(['ana', 'bruno', 'rato'], 4)
  })

  it('Esc fecha sem começar e devolve o foco ao botão', () => {
    const h = handlers()
    render({ fichas: FICHAS, confronto: undefined, ...h })
    clicar(botao(CONFRONTO_LABEL))
    const form = container.querySelector('form')
    if (!form) throw new Error('sem formulário')
    act(() => {
      form.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(container.querySelector('form')).toBeNull()
    expect(document.activeElement).toBe(botao(CONFRONTO_LABEL))
    expect(h.onIniciar).not.toHaveBeenCalled()
  })

  it('cena sem ficha: o botão fica indisponível com o motivo ao lado', () => {
    render({ fichas: [], confronto: undefined, ...handlers() })
    expect(botao(CONFRONTO_LABEL).disabled).toBe(true)
    expect(container.textContent).toContain('Nenhuma ficha nesta cena')
  })

  it('confronto ligado: a fila com a vez marcada, o passo, Próxima vez e Encerrar', () => {
    const h = handlers()
    const c: Confronto = { fila: ['rato', 'ana', 'fora'], vez: 1, passo: 5, turno: 2 }
    render({ fichas: FICHAS, confronto: c, ...h })
    const itens = Array.from(container.querySelectorAll('li')).map((li) => li.textContent)
    // Ficha que saiu da cena continua na fila, marcada como fora.
    expect(itens).toEqual(['Rato 1', 'Ana', 'Ficha fora da cena'])
    expect(container.querySelector('li[aria-current="true"]')?.textContent).toBe('Ana')
    expect(container.textContent).toContain('5 casas por vez')
    clicar(botao('Próxima vez'))
    clicar(botao('Encerrar'))
    expect(h.onProximaVez).toHaveBeenCalledTimes(1)
    expect(h.onEncerrar).toHaveBeenCalledTimes(1)
  })
})
