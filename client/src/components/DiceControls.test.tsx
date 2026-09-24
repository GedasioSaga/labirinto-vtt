/**
 * DADO ROLADO NA SALA, as peças de tela que mestre e jogador dividem: o
 * formulário (d4 a d20, Quantidade, Modificador e "Rolar") e a lista de
 * rolagens. Escolher o dado NÃO rola; só o "Rolar" (ou Enter num campo).
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiceRequest } from '../lib/dice'
import { DiceFeed, DiceForm, type DiceFeedRoll } from './DiceControls'

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

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === nome)
  if (achado === undefined) throw new Error(`sem botão "${nome}"`)
  return achado
}

function campo(rotulo: string): HTMLInputElement {
  const label = Array.from(container.querySelectorAll('label')).find((l) => (l.textContent ?? '').includes(rotulo))
  const id = label?.getAttribute('for')
  // `getElementById`, e não seletor: o id do `useId` tem dois-pontos.
  const input = id ? document.getElementById(id) : null
  if (!(input instanceof HTMLInputElement)) throw new Error(`sem campo "${rotulo}"`)
  return input
}

/** Troca o valor como o teclado faria: o setter nativo e o evento `input` que o React escuta. */
function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function clicar(el: HTMLElement): void {
  act(() => el.click())
}

describe('DiceForm', () => {
  it('oferece d4 a d20, Quantidade, Modificador e Rolar; sem "escondido" para quem não pode', () => {
    act(() => root.render(<DiceForm onRoll={() => {}} />))
    for (const lados of [4, 6, 8, 10, 12, 20]) expect(botao(`d${lados}`)).toBeDefined()
    expect(campo('Quantidade').value).toBe('1')
    expect(campo('Modificador').value).toBe('0')
    expect(botao('Rolar')).toBeDefined()
    expect(container.querySelector('input[type="checkbox"]')).toBeNull()
  })

  it('escolher o dado não rola; Rolar manda quantidade, dado e modificador', () => {
    const onRoll = vi.fn<(request: DiceRequest, hidden: boolean) => void>()
    act(() => root.render(<DiceForm onRoll={onRoll} />))
    digitar(campo('Quantidade'), '3')
    digitar(campo('Modificador'), '-2')
    clicar(botao('d8'))
    expect(onRoll).not.toHaveBeenCalled()
    expect(botao('d8').getAttribute('aria-pressed')).toBe('true')
    expect(botao('d20').getAttribute('aria-pressed')).toBe('false')
    clicar(botao('Rolar'))
    expect(onRoll).toHaveBeenCalledTimes(1)
    expect(onRoll).toHaveBeenCalledWith({ count: 3, sides: 8, modifier: -2 }, false)
  })

  it('Enter num campo rola, como o botão', () => {
    const onRoll = vi.fn<(request: DiceRequest, hidden: boolean) => void>()
    act(() => root.render(<DiceForm onRoll={onRoll} />))
    const form = container.querySelector('form')
    if (form === null) throw new Error('sem formulário')
    act(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(onRoll).toHaveBeenCalledWith({ count: 1, sides: 20, modifier: 0 }, false)
  })

  it('o mestre marca "Rolar escondido" e a rolagem sai escondida; a marca fica para a próxima', () => {
    const onRoll = vi.fn<(request: DiceRequest, hidden: boolean) => void>()
    act(() => root.render(<DiceForm onRoll={onRoll} allowHidden />))
    const escondido = campo('Rolar escondido')
    expect(escondido.type).toBe('checkbox')
    clicar(escondido)
    clicar(botao('Rolar'))
    clicar(botao('Rolar'))
    expect(onRoll).toHaveBeenNthCalledWith(1, { count: 1, sides: 20, modifier: 0 }, true)
    expect(onRoll).toHaveBeenNthCalledWith(2, { count: 1, sides: 20, modifier: 0 }, true)
  })

  it('quantidade fora da faixa não rola: diz o que corrigir, mantém o que foi digitado e leva o foco ao campo', () => {
    const onRoll = vi.fn<(request: DiceRequest, hidden: boolean) => void>()
    act(() => root.render(<DiceForm onRoll={onRoll} />))
    digitar(campo('Quantidade'), '0')
    clicar(botao('Rolar'))
    expect(onRoll).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Quantidade de 1 a 20')
    expect(campo('Quantidade').value).toBe('0')
    expect(campo('Quantidade').getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(campo('Quantidade'))
    // Corrigiu: o aviso sai e a rolagem vai.
    digitar(campo('Quantidade'), '2')
    expect(container.textContent).not.toContain('Quantidade de 1 a 20')
    clicar(botao('Rolar'))
    expect(onRoll).toHaveBeenCalledWith({ count: 2, sides: 20, modifier: 0 }, false)
  })
})

describe('DiceFeed', () => {
  const ana: DiceFeedRoll = { id: 'r1', from: 'Ana', count: 2, sides: 6, modifier: 3, results: [5, 4], total: 12, at: 0 }

  it('cada rolagem mostra quem rolou, a expressão e o total', () => {
    act(() => root.render(<DiceFeed rolls={[ana]} />))
    const log = container.querySelector('[role="log"]')
    expect(log?.getAttribute('aria-label')).toBe('Rolagens')
    const item = container.querySelector('li')
    expect(item?.textContent).toContain('Ana')
    expect(item?.textContent).toContain('2d6+3')
    expect(item?.querySelector('.lb-dice-feed__total')?.textContent).toBe('12')
  })

  it('total negativo com o menos; rolagem escondida do mestre vem marcada', () => {
    const escondida: DiceFeedRoll = { id: 'r2', from: 'Mestre', master: true, hidden: true, count: 1, sides: 4, modifier: -5, results: [2], total: -3, at: 0 }
    act(() => root.render(<DiceFeed rolls={[escondida]} />))
    const item = container.querySelector('li')
    expect(item?.querySelector('.lb-dice-feed__total')?.textContent).toBe('−3')
    expect(item?.textContent).toContain('1d4−5')
    expect(item?.textContent).toContain('escondido')
  })

  it('sem rolagem nenhuma, a lista já existe (o leitor de tela anuncia a primeira) e fica vazia', () => {
    act(() => root.render(<DiceFeed rolls={[]} />))
    const log = container.querySelector('[role="log"]')
    expect(log).not.toBeNull()
    expect(log?.querySelectorAll('li')).toHaveLength(0)
    expect(log?.textContent).toBe('')
  })

  it('mostra só as últimas rolagens, a mais nova embaixo', () => {
    const rolls: DiceFeedRoll[] = [1, 2, 3, 4, 5, 6].map((n) => ({ ...ana, id: `r${n}`, results: [n, 1], total: n + 4 }))
    act(() => root.render(<DiceFeed rolls={rolls} />))
    const totais = Array.from(container.querySelectorAll('.lb-dice-feed__total')).map((el) => el.textContent)
    expect(totais).toEqual(['7', '8', '9', '10'])
  })
})
