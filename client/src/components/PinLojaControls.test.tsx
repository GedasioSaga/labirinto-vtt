import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LojaItem, PinKind } from '../types/map'
import { PinControls } from './PinControls'
import { PinLojaControls } from './PinLojaControls'

/**
 * LOJA COM PREÇOS no painel do pino: o mestre liga a loja, escreve cada
 * mercadoria (nome, preço, estoque) e tira a que não vende mais. Estoque vazio
 * = sem conta (não acaba). Só o "!"/"?" vira banca.
 */

describe('PinLojaControls', () => {
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

  let proximo = 0
  const novoId = (): string => `item-${(proximo += 1)}`

  function render(loja: LojaItem[] | null, onChange: (loja: LojaItem[] | undefined) => void): void {
    act(() => root.render(<PinLojaControls loja={loja} onChange={onChange} novoId={novoId} />))
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = [...container.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === nome)
    if (achado === undefined) throw new Error(`sem botão "${nome}"`)
    return achado
  }

  function campo(rotulo: string): HTMLInputElement {
    const label = [...container.querySelectorAll('label')].find((l) => l.textContent === rotulo)
    const alvo = label === undefined ? null : document.getElementById(label.htmlFor)
    if (!(alvo instanceof HTMLInputElement)) throw new Error(`sem campo "${rotulo}"`)
    return alvo
  }

  function digitar(input: HTMLInputElement, valor: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    if (setter === undefined) throw new Error('jsdom sem setter de value')
    act(() => {
      setter.call(input, valor)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  const XAROPE: LojaItem = { id: 'x', nome: 'Xarope', preco: '1 moeda', estoque: 3 }

  it('ligar a loja já traz uma mercadoria em branco para escrever; desligar tira a loja', () => {
    proximo = 0
    const onChange = vi.fn()
    render(null, onChange)
    const ligar = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    if (ligar === null) throw new Error('sem chave da loja')
    act(() => ligar.click())
    expect(onChange).toHaveBeenLastCalledWith([{ id: 'item-1', nome: '', preco: '' }])
    render([XAROPE], onChange)
    const desligar = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    if (desligar === null) throw new Error('sem chave da loja')
    act(() => desligar.click())
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('nome, preço e estoque de cada mercadoria, com rótulo de verdade', () => {
    const onChange = vi.fn()
    render([XAROPE], onChange)
    digitar(campo('Mercadoria 1'), 'Xarope de tosse')
    expect(onChange).toHaveBeenLastCalledWith([{ ...XAROPE, nome: 'Xarope de tosse' }])
    digitar(campo('Preço da mercadoria 1'), '2 moedas')
    expect(onChange).toHaveBeenLastCalledWith([{ ...XAROPE, preco: '2 moedas' }])
    digitar(campo('Estoque da mercadoria 1'), '5')
    expect(onChange).toHaveBeenLastCalledWith([{ ...XAROPE, estoque: 5 }])
  })

  it('estoque vazio é "sem conta": o campo some do item, não vira zero', () => {
    const onChange = vi.fn()
    render([XAROPE], onChange)
    digitar(campo('Estoque da mercadoria 1'), '')
    expect(onChange).toHaveBeenLastCalledWith([{ id: 'x', nome: 'Xarope', preco: '1 moeda' }])
  })

  it('"+ Mercadoria" acrescenta no fim; "Tirar" tira só aquela, e tirar a última desliga a loja', () => {
    proximo = 0
    const onChange = vi.fn()
    render([XAROPE], onChange)
    act(() => botao('+ Mercadoria').click())
    expect(onChange).toHaveBeenLastCalledWith([XAROPE, { id: 'item-1', nome: '', preco: '' }])
    act(() => botao('Tirar Xarope').click())
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })
})

describe('PinControls: a loja no painel do pino', () => {
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

  function painel(kind: PinKind): void {
    act(() =>
      root.render(
        <PinControls
          kind={kind}
          onKindChange={() => {}}
          description="Botica"
          onDescriptionChange={() => {}}
          locked={false}
          onLockedChange={() => {}}
          image={null}
          onChooseImage={() => {}}
          onClearImage={() => {}}
          onDelete={() => {}}
          loja={{ pinId: 'botica', loja: null, onChange: () => {} }}
        />,
      ),
    )
  }

  it('o "!" e o "?" oferecem "Loja com preços"; a viagem e a alavanca não', () => {
    painel('exclamacao')
    expect(container.textContent).toContain('Loja com preços')
    painel('interrogacao')
    expect(container.textContent).toContain('Loja com preços')
    painel('viagem')
    expect(container.textContent).not.toContain('Loja com preços')
    painel('alavanca')
    expect(container.textContent).not.toContain('Loja com preços')
  })
})
