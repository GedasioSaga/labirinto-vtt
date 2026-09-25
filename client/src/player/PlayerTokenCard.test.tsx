import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Token } from '../types/map'
import { TOKEN_ACTION_TEXT_MAX_LENGTH } from '../lib/tokenActions'
import { PlayerTokenCard } from './PlayerTokenCard'

function ficha(name: string): Token {
  return { id: 'severa', characterId: null, name, x: 200, y: 100, size: 1, image: null }
}

describe('PlayerTokenCard (cartão da ficha alheia)', () => {
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

  function render(props: { name?: string; waiting?: boolean; onSend?: (action: string, text: string) => void; onClose?: () => void }): void {
    act(() =>
      root.render(
        <PlayerTokenCard token={ficha(props.name ?? 'Mulher de capuz')} waiting={props.waiting ?? false} onSend={props.onSend ?? (() => {})} onClose={props.onClose ?? (() => {})} />,
      ),
    )
  }

  function botao(texto: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)
    if (!(found instanceof HTMLButtonElement)) throw new Error(`sem botão "${texto}"`)
    return found
  }

  function clica(texto: string): void {
    act(() => botao(texto).click())
  }

  function digita(valor: string): void {
    const campo = container.querySelector('input')
    if (!(campo instanceof HTMLInputElement)) throw new Error('sem campo')
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(campo, valor)
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('mostra o nome que o jogador vê e as ações; nome escondido vira "Alguém"', () => {
    render({})
    const dialogo = container.querySelector('[role="dialog"]')
    expect(dialogo?.getAttribute('aria-label')).toBe('Ficha: Mulher de capuz')
    expect(container.textContent).toContain('Mulher de capuz')
    for (const acao of ['Falar', 'Oferecer', 'Pedir ajuda', 'Empurrar', 'Outro']) expect(botao(acao).disabled).toBe(false)
    render({ name: '' })
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Ficha: Alguém')
  })

  it('Empurrar sem texto vai direto no "Enviar ao mestre"', () => {
    const onSend = vi.fn()
    render({ onSend })
    clica('Empurrar')
    clica('Enviar ao mestre')
    expect(onSend).toHaveBeenCalledWith('empurrar', '')
  })

  it('Falar exige texto: o envio só liga depois de escrever, e o contador diz quanto falta', () => {
    const onSend = vi.fn()
    render({ onSend })
    clica('Falar')
    expect(botao('Enviar ao mestre').disabled).toBe(true)
    const campo = container.querySelector('input')
    expect(campo?.maxLength).toBe(TOKEN_ACTION_TEXT_MAX_LENGTH)
    // O rótulo é do campo: tocar nele leva o foco para lá.
    const rotulo = container.querySelector('label')
    expect(rotulo?.htmlFor).toBe(campo?.id)
    digita('Você viu o Lemos?')
    expect(container.textContent).toContain(`Faltam ${TOKEN_ACTION_TEXT_MAX_LENGTH - 'Você viu o Lemos?'.length} caracteres`)
    // Enter no campo envia (é um formulário).
    act(() => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(onSend).toHaveBeenCalledWith('falar', 'Você viu o Lemos?')
  })

  it('"Voltar" desfaz a escolha sem enviar nada', () => {
    const onSend = vi.fn()
    render({ onSend })
    clica('Oferecer')
    clica('Voltar')
    expect(onSend).not.toHaveBeenCalled()
    expect(botao('Empurrar').disabled).toBe(false)
  })

  it('com um pedido esperando o mestre, as ações ficam desligadas e o cartão diz por quê', () => {
    render({ waiting: true })
    expect(botao('Empurrar').disabled).toBe(true)
    expect(container.textContent).toContain('Você já tem um pedido esperando o mestre')
  })

  it('Escape e "Fechar" fecham', () => {
    const onClose = vi.fn()
    render({ onClose })
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    clica('Fechar')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('o nome da ficha é texto, nunca HTML', () => {
    render({ name: '<img src=x onerror="alert(1)">' })
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">')
  })
})
