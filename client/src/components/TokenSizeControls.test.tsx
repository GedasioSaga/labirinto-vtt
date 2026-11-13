/**
 * "Tamanho da ficha" do painel com o número DIGITADO (pedido do mestre de
 * 12/11/2026: "eu quero dizer o quanto tem que mudar"): o mesmo campo do
 * "Tamanho da ficha ao entrar" da cena, com os atalhos 1, 2 e 3 embaixo.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TokenSizeControls } from './TokenSizeControls'

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function tecla(input: HTMLInputElement, key: string): void {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

describe('TokenSizeControls: o campo do tamanho da ficha', () => {
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

  const campo = (): HTMLInputElement => {
    const achado = container.querySelector<HTMLInputElement>('input[aria-label="Tamanho da ficha em casas"]')
    if (achado === null) throw new Error('o campo do tamanho não está no painel')
    return achado
  }
  const marcados = () => Array.from(container.querySelectorAll('[role="radio"][aria-checked="true"]')).map((b) => b.getAttribute('aria-label'))

  it('"1.5" (com ponto) e Enter manda 1,5; com 1,5 nenhum atalho fica marcado e o campo diz "1,5 casa"; o atalho "2 casas" continua lá', () => {
    const trocar = vi.fn()
    act(() => root.render(<TokenSizeControls size={1} onSizeChange={trocar} />))
    expect(campo().value).toBe('1')
    expect(marcados()).toEqual(['1 casa'])

    digitar(campo(), '1.5')
    tecla(campo(), 'Enter')
    expect(trocar).toHaveBeenCalledTimes(1)
    expect(trocar).toHaveBeenLastCalledWith(1.5)

    act(() => root.render(<TokenSizeControls size={1.5} onSizeChange={trocar} />))
    expect(campo().value).toBe('1,5')
    expect(container.querySelector('.lb-tamanho__unidade')?.textContent).toBe('casa')
    expect(marcados()).toEqual([])

    act(() => container.querySelector<HTMLButtonElement>('[role="radio"][aria-label="2 casas"]')?.click())
    expect(trocar).toHaveBeenLastCalledWith(2)
  })

  it('número digitado e não confirmado vai para a ficha em que foi digitado quando o painel troca de ficha (remonta pelo `key`), nunca para a seguinte', () => {
    const naAna = vi.fn()
    const naBia = vi.fn()
    act(() => root.render(<TokenSizeControls key="ana" size={1} onSizeChange={naAna} />))
    digitar(campo(), '0,5')

    act(() => root.render(<TokenSizeControls key="bia" size={2} onSizeChange={naBia} />))
    expect(naAna).toHaveBeenCalledWith(0.5)
    expect(naBia).not.toHaveBeenCalled()
    expect(campo().value).toBe('2')
  })
})
