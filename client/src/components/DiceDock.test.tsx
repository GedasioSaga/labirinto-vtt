/**
 * DADO ROLADO NA SALA na tela do MESTRE: o botão "Dados" abre o painel
 * "Dados" (com o "Rolar escondido", que só ele tem) e as rolagens da mesa
 * ficam à vista mesmo com o painel fechado.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiceRequest } from '../lib/dice'
import type { DiceFeedRoll } from './DiceControls'
import { DiceDock } from './DiceDock'

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

const dados = (): HTMLButtonElement | undefined => Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === 'Dados')
const painel = (): HTMLElement | null => container.querySelector('section[aria-label="Dados"]:not([hidden])')

describe('DiceDock (mestre)', () => {
  it('"Dados" abre e fecha o painel "Dados"; o painel tem o "Rolar escondido"', () => {
    act(() => root.render(<DiceDock rolls={[]} onRoll={() => {}} />))
    const botao = dados()
    if (botao === undefined) throw new Error('sem botão Dados')
    expect(botao.getAttribute('aria-expanded')).toBe('false')
    expect(painel()).toBeNull()
    act(() => botao.click())
    expect(botao.getAttribute('aria-expanded')).toBe('true')
    expect(painel()?.querySelector('input[type="checkbox"]')).not.toBeNull()
    expect(painel()?.textContent).toContain('Rolar escondido')
    act(() => botao.click())
    expect(painel()).toBeNull()
  })

  it('Esc no painel fecha e devolve o foco ao "Dados"', () => {
    act(() => root.render(<DiceDock rolls={[]} onRoll={() => {}} />))
    const botao = dados()
    if (botao === undefined) throw new Error('sem botão Dados')
    act(() => botao.click())
    const rolar = Array.from(painel()?.querySelectorAll('button') ?? []).find((b) => b.textContent === 'Rolar')
    act(() => rolar?.focus())
    act(() => {
      rolar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(painel()).toBeNull()
    expect(document.activeElement).toBe(botao)
  })

  it('abrir põe o foco no primeiro dado: pelo teclado já dá para escolher e rolar', () => {
    act(() => root.render(<DiceDock rolls={[]} onRoll={() => {}} />))
    const botao = dados()
    if (botao === undefined) throw new Error('sem botão Dados')
    act(() => botao.click())
    expect((document.activeElement?.textContent ?? '').trim()).toBe('d4')
    expect(painel()?.contains(document.activeElement)).toBe(true)
  })

  describe('Esc e o atalho "cancelar" do editor (que larga a seleção do mapa)', () => {
    const atalhoDoEditor = vi.fn()
    beforeEach(() => {
      atalhoDoEditor.mockReset()
      window.addEventListener('keydown', atalhoDoEditor)
    })
    afterEach(() => {
      window.removeEventListener('keydown', atalhoDoEditor)
    })

    const esc = (alvo: Element) =>
      act(() => {
        alvo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })

    it('painel aberto e o foco no próprio "Dados": o Esc fecha o painel e não chega ao editor', () => {
      act(() => root.render(<DiceDock rolls={[]} onRoll={() => {}} />))
      const botao = dados()
      if (botao === undefined) throw new Error('sem botão Dados')
      act(() => botao.click())
      act(() => botao.focus())
      esc(botao)
      expect(painel()).toBeNull()
      expect(botao.getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(botao)
      expect(atalhoDoEditor).not.toHaveBeenCalled()
    })

    it('Esc dentro do painel também não chega ao editor', () => {
      act(() => root.render(<DiceDock rolls={[]} onRoll={() => {}} />))
      act(() => dados()?.click())
      const alvo = document.activeElement
      if (alvo === null) throw new Error('sem foco')
      esc(alvo)
      expect(painel()).toBeNull()
      expect(atalhoDoEditor).not.toHaveBeenCalled()
    })

    it('controle: painel fechado, o Esc no "Dados" segue para o editor', () => {
      act(() => root.render(<DiceDock rolls={[]} onRoll={() => {}} />))
      const botao = dados()
      if (botao === undefined) throw new Error('sem botão Dados')
      act(() => botao.focus())
      esc(botao)
      expect(atalhoDoEditor).toHaveBeenCalledTimes(1)
    })
  })

  it('Rolar entrega o pedido e se é escondido', () => {
    const onRoll = vi.fn<(request: DiceRequest, hidden: boolean) => void>()
    act(() => root.render(<DiceDock rolls={[]} onRoll={onRoll} />))
    act(() => dados()?.click())
    const rolar = Array.from(painel()?.querySelectorAll('button') ?? []).find((b) => b.textContent === 'Rolar')
    act(() => rolar?.click())
    expect(onRoll).toHaveBeenCalledWith({ count: 1, sides: 20, modifier: 0 }, false)
  })

  it('as rolagens da mesa aparecem com o painel fechado', () => {
    const ana: DiceFeedRoll = { id: 'r1', from: 'Ana', count: 2, sides: 6, modifier: 3, results: [5, 4], total: 12, at: 0 }
    act(() => root.render(<DiceDock rolls={[ana]} onRoll={() => {}} />))
    expect(painel()).toBeNull()
    expect(container.querySelector('[role="log"]')?.textContent).toContain('2d6+3')
  })
})
