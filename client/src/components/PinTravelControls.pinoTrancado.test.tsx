import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PinPassage } from '../types/map'
import { PinTravelControls, type PinTravelControlsProps } from './PinTravelControls'

/**
 * PINO TRANCADO VIRA PEDIDO, no painel do mestre: com "Trancada" escolhida,
 * aparece "Aceita tentativas" (ligada por padrão). Ligada, o jogador pode
 * "Pedir ao mestre"; desligada, a passagem fica muda, como antes.
 */

function props(passage: PinPassage, extra: Partial<PinTravelControlsProps> = {}): PinTravelControlsProps {
  return {
    exits: [{ id: 'principal', rotulo: '', travel: { status: 'sem-destino' } }],
    scenes: [],
    pinsIn: () => [],
    onLinkNew: vi.fn(),
    onLinkExisting: vi.fn(),
    onUnlink: vi.fn(),
    onRename: vi.fn(),
    onGo: vi.fn(),
    passage,
    onPassageChange: vi.fn(),
    onOneWayChange: vi.fn(),
    arrivalOnly: false,
    acceptsAttempts: true,
    onAcceptsAttemptsChange: vi.fn(),
    ...extra,
  }
}

describe('PinTravelControls: "Aceita tentativas" do pino trancado', () => {
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

  const alternar = () => [...container.querySelectorAll('button')].find((b) => b.textContent === 'Aceita tentativas') ?? null

  it('trancada e ligada: o botão aparece apertado e diz que o pedido chega', () => {
    act(() => root.render(<PinTravelControls {...props('trancada')} />))
    const botao = alternar()
    expect(botao?.getAttribute('aria-pressed')).toBe('true')
    expect(container.textContent).toContain('Ninguém passa sozinho; o jogador pode pedir e você decide.')
  })

  it('desligar chama onAcceptsAttemptsChange(false); desligada, a passagem é muda', () => {
    const onAcceptsAttemptsChange = vi.fn()
    act(() => root.render(<PinTravelControls {...props('trancada', { onAcceptsAttemptsChange })} />))
    act(() => alternar()?.click())
    expect(onAcceptsAttemptsChange).toHaveBeenCalledWith(false)
    act(() => root.render(<PinTravelControls {...props('trancada', { acceptsAttempts: false, onAcceptsAttemptsChange })} />))
    expect(alternar()?.getAttribute('aria-pressed')).toBe('false')
    expect(container.textContent).toContain('Ninguém passa por aqui, e nenhum pedido chega a você.')
  })

  it('fora de "Trancada" o botão não aparece', () => {
    act(() => root.render(<PinTravelControls {...props('pede')} />))
    expect(alternar()).toBeNull()
    expect(container.querySelectorAll('button').length).toBeGreaterThan(0)
  })
})
