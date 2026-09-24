import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin, PinCard } from '../types/map'
import { SessionCards, type SessionCardsProps } from './SessionCards'

/**
 * Os cartões por cima do mapa do jogador (`player/main.tsx` monta este
 * componente): o cartão que o mestre mostrou ("Mostrar agora a…") abre
 * sozinho, fica no lugar do que o jogador tinha aberto, o "Fechar" fecha os
 * dois e, enquanto ele está na tela, o Escape não fecha o recado do mestre.
 */

const CARTA: PinCard = { id: 'carta', kind: 'exclamacao', description: 'Encontre-me na capela', image: null }
const PORTA: Pin = { id: 'porta', x: 5, y: 5, kind: 'viagem', description: 'Porta do porão', image: null }

function fakeConnection() {
  return {
    dismissShownPin: vi.fn(),
    dismissNote: vi.fn(),
    requestTravel: vi.fn((_pinId: string, _exitId?: string) => true),
  }
}

describe('SessionCards (cartões na tela do jogador)', () => {
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

  function render(props: SessionCardsProps): void {
    act(() => root.render(<SessionCards {...props} />))
  }

  function botao(texto: string): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto)
    if (!(found instanceof HTMLButtonElement)) throw new Error(`sem botão "${texto}"`)
    return found
  }

  function pressEscape(): void {
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
  }

  const map = { ...createEmptyMap('m1', '', 10, 10, 50), pins: [PORTA] }

  it('cartão mostrado pelo mestre abre sozinho no lugar do que o jogador tinha aberto, sem passagem', () => {
    render({
      state: { map, shownPin: { id: 1, pin: CARTA } },
      openPinId: 'porta',
      onOpenPinIdChange: vi.fn(),
      connection: fakeConnection(),
    })
    const cartoes = container.querySelectorAll('.pp-pincard')
    expect(cartoes).toHaveLength(1)
    expect(cartoes[0]?.textContent).toContain('Encontre-me na capela')
    expect(container.textContent).not.toContain('Porta do porão')
    expect(container.textContent).not.toContain('Pedir para passar')
    // O foco vai ao "Fechar" do cartão que chegou: o teclado tem para onde ir.
    expect(document.activeElement).toBe(botao('Fechar'))
  })

  it('"Fechar" no cartão mostrado fecha os dois: não revela o do jogador atrás', () => {
    const connection = fakeConnection()
    const onOpenPinIdChange = vi.fn()
    render({ state: { map, shownPin: { id: 1, pin: CARTA } }, openPinId: 'porta', onOpenPinIdChange, connection })
    act(() => botao('Fechar').click())
    expect(connection.dismissShownPin).toHaveBeenCalledTimes(1)
    expect(onOpenPinIdChange).toHaveBeenCalledWith(null)
  })

  it('com o cartão do mestre na tela, o Escape é dele e não fecha o recado; sem ele, fecha o recado', () => {
    const connection = fakeConnection()
    const note = { id: 'r1', text: 'A vela apagou.' }
    const props = { openPinId: null, onOpenPinIdChange: vi.fn(), connection }
    render({ ...props, state: { map, note, shownPin: { id: 1, pin: CARTA } } })
    expect(container.textContent).toContain('A vela apagou.')
    pressEscape()
    expect(connection.dismissShownPin).toHaveBeenCalledTimes(1)
    expect(connection.dismissNote).not.toHaveBeenCalled()

    // O cartão saiu (a conexão limpou `shownPin`): o Escape volta ao recado.
    render({ ...props, state: { map, note } })
    expect(container.querySelector('.pp-pincard')).toBeNull()
    pressEscape()
    expect(connection.dismissNote).toHaveBeenCalledTimes(1)
  })

  it('sem cartão do mestre, o pino que o jogador tocou abre com a passagem de sempre', () => {
    const connection = fakeConnection()
    const onOpenPinIdChange = vi.fn()
    render({ state: { map }, openPinId: 'porta', onOpenPinIdChange, connection })
    expect(container.textContent).toContain('Porta do porão')
    act(() => botao('Pedir para passar').click())
    act(() => botao('Pedir').click())
    expect(connection.requestTravel).toHaveBeenCalledWith('porta', undefined)
    expect(onOpenPinIdChange).toHaveBeenCalledWith(null)
  })

  it('nada aberto e nada mostrado: nenhum cartão de pino', () => {
    render({ state: { map }, openPinId: null, onOpenPinIdChange: vi.fn(), connection: fakeConnection() })
    expect(container.querySelector('.pp-pincard')).toBeNull()
    expect(container.childElementCount).toBe(0)
  })
})
