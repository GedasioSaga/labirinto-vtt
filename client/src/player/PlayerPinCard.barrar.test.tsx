import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * BARRAR A PASSAGEM por onde chegou: com a ficha encostada no pino de viagem,
 * o cartão oferece "Barrar a passagem"; barrada deste lado, diz isso e
 * oferece "Tirar a barra". Longe do pino (sem `barra`), nada disso aparece.
 */

function pino(extra: Partial<Pin> = {}): Pin {
  return { id: 'fundo', x: 1000, y: 250, kind: 'viagem', description: 'Fundo do poço', image: null, ...extra }
}

describe('PlayerPinCard: barrar a passagem', () => {
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

  function render(pin: Pin, onBarrar?: (on: boolean) => void): void {
    act(() => root.render(<PlayerPinCard pin={pin} onClose={() => {}} onRequestTravel={() => {}} onBarrar={onBarrar} />))
  }

  function botao(texto: string): HTMLButtonElement | undefined {
    return [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)
  }

  it('encostado no pino: "Barrar a passagem" pede a barra', () => {
    const onBarrar = vi.fn()
    render(pino(), onBarrar)
    const barrar = botao('Barrar a passagem')
    if (barrar === undefined) throw new Error('esperava o botão de barrar')
    act(() => barrar.click())
    expect(onBarrar).toHaveBeenCalledWith(true)
  })

  it('barrada deste lado: o cartão diz isso e oferece tirar a barra', () => {
    const onBarrar = vi.fn()
    render(pino({ barradaDaqui: true }), onBarrar)
    // A marca é do lado, não de quem barrou: chega igual a Ana, que barrou, e a
    // Carla, que só está na mesma cena. O texto não pode afirmar "você barrou".
    expect(container.textContent).toContain('Passagem barrada deste lado.')
    expect(container.textContent).not.toContain('Você barrou')
    expect(botao('Barrar a passagem')).toBeUndefined()
    const tirar = botao('Tirar a barra')
    if (tirar === undefined) throw new Error('esperava o botão de tirar a barra')
    act(() => tirar.click())
    expect(onBarrar).toHaveBeenCalledWith(false)
  })

  it('longe do pino, ou pino trancado pelo mestre: nada de barrar', () => {
    render(pino())
    expect(botao('Barrar a passagem')).toBeUndefined()
    render(pino({ passagem: 'trancada' }), vi.fn())
    expect(botao('Barrar a passagem')).toBeUndefined()
    expect(botao('Tirar a barra')).toBeUndefined()
  })
})
