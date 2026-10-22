import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MenuDaParede } from '../pixi/wallGesture'
import { SAIDA_DO_POP_MS } from './grimorio/comum'
import { WallGestureMenu } from './WallGestureMenu'
import { WallGestureMenuHost } from './WallGestureMenuHost'

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

function abrir() {
  const handlers = { onAbrirVao: vi.fn(), onDesabar: vi.fn(), onClose: vi.fn() }
  act(() => root.render(<WallGestureMenu x={120} y={80} limite={{ width: 1200, height: 800 }} {...handlers} />))
  return handlers
}

function itens(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
}

function nomeAcessivel(item: HTMLElement): string {
  const id = item.getAttribute('aria-labelledby')
  return id === null ? '' : (document.getElementById(id)?.textContent ?? '')
}

function tecla(key: string) {
  const alvo = document.activeElement ?? container
  act(() => {
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

describe('WallGestureMenu: o menu do clique direito na parede', () => {
  it('é um menu com "Abrir vão aqui" e "Desabar parede", e o foco entra no primeiro', () => {
    abrir()
    expect(container.querySelector('[role="menu"]')?.getAttribute('aria-label')).toBe('Parede')
    expect(itens().map(nomeAcessivel)).toEqual(['Abrir vão aqui', 'Desabar parede'])
    expect(document.activeElement).toBe(itens()[0])
  })

  it('"Abrir vão aqui" num clique: abre o vão e fecha o menu', () => {
    const h = abrir()
    act(() => itens()[0].click())
    expect(h.onAbrirVao).toHaveBeenCalledTimes(1)
    expect(h.onClose).toHaveBeenCalledTimes(1)
    expect(h.onDesabar).not.toHaveBeenCalled()
  })

  it('"Desabar parede" num clique: desaba e fecha o menu', () => {
    const h = abrir()
    act(() => itens()[1].click())
    expect(h.onDesabar).toHaveBeenCalledTimes(1)
    expect(h.onClose).toHaveBeenCalledTimes(1)
    expect(h.onAbrirVao).not.toHaveBeenCalled()
  })

  it('setas andam entre os itens e Esc fecha sem fazer nada', () => {
    const h = abrir()
    tecla('ArrowDown')
    expect(document.activeElement).toBe(itens()[1])
    tecla('ArrowDown')
    expect(document.activeElement).toBe(itens()[0])
    tecla('End')
    expect(document.activeElement).toBe(itens()[1])
    tecla('Escape')
    expect(h.onClose).toHaveBeenCalledTimes(1)
    expect(h.onAbrirVao).not.toHaveBeenCalled()
    expect(h.onDesabar).not.toHaveBeenCalled()
  })

  it('a tecla do menu não vaza para os atalhos do editor', () => {
    abrir()
    const atalhoGlobal = vi.fn()
    window.addEventListener('keydown', atalhoGlobal)
    tecla('Escape')
    window.removeEventListener('keydown', atalhoGlobal)
    expect(atalhoGlobal).not.toHaveBeenCalled()
  })

  it('clique fora fecha; clique dentro não', () => {
    const h = abrir()
    act(() => {
      itens()[0].dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(h.onClose).not.toHaveBeenCalled()
    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(h.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('WallGestureMenuHost: o menu da parede sai animado, como no PixiCanvas', () => {
  const MENU: MenuDaParede = { wallId: 'w1', ponto: { x: 3, y: 4 }, x: 120, y: 80, limite: { width: 1200, height: 800 } }
  const menu = () => container.querySelector<HTMLElement>('[role="menu"]')

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const montar = (aberto: MenuDaParede | null, onClose: () => void = () => {}) =>
    act(() => root.render(<WallGestureMenuHost menu={aberto} onClose={onClose} />))

  it('fechado, fica os 120 ms da saída com gr-sai e inerte, o clique fora não o fecha de novo, e então some', () => {
    const onClose = vi.fn()
    montar(MENU, onClose)
    const aberto = menu()
    expect(aberto?.classList.contains('gr-anima')).toBe(true)
    expect(aberto?.classList.contains('gr-sai')).toBe(false)
    montar(null, onClose)
    expect(menu()).toBe(aberto)
    expect(aberto?.classList.contains('gr-sai')).toBe(true)
    expect(aberto?.hasAttribute('inert')).toBe(true)
    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(onClose).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(SAIDA_DO_POP_MS - 1))
    expect(menu()).toBe(aberto)
    act(() => vi.advanceTimersByTime(1))
    expect(menu()).toBeNull()
  })

  it('reaberto no mesmo ponto no meio da saída: o mesmo nó volta, sem gr-sai, com o foco no primeiro item', () => {
    montar(MENU)
    const aberto = menu()
    montar(null)
    // O foco sai do menu que está saindo; reaberto, ele tem de voltar ao primeiro item.
    const focado = document.activeElement
    if (focado instanceof HTMLElement) act(() => focado.blur())
    montar({ ...MENU })
    expect(menu()).toBe(aberto)
    expect(aberto?.classList.contains('gr-sai')).toBe(false)
    expect(document.activeElement).toBe(itens()[0])
  })
})
