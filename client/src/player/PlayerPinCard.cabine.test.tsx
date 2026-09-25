import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * CABINE DE TRANSPORTE no cartão do jogador: a parada diz se a cabine está
 * ali. Sem a cabine, o cartão não oferece passar (o host recusaria); com ela,
 * o botão é o de sempre, pelo modo do pino.
 */

function parada(extra: Partial<Pin>): Pin {
  return { id: 'grade', x: 0, y: 0, kind: 'viagem', description: 'Grade do elevador', image: null, ...extra }
}

describe('PlayerPinCard: cabine de transporte', () => {
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

  const botoes = () => [...container.querySelectorAll('button')].map((b) => b.textContent)

  it('cabine longe: diz que não está aqui e não oferece passar', () => {
    act(() => root.render(<PlayerPinCard pin={parada({ cabine: 'longe', passagem: 'livre' })} stairs={[]} onClose={vi.fn()} onRequestTravel={vi.fn()} />))
    expect(container.textContent).toContain('A cabine não está aqui')
    expect(botoes()).toEqual(['Fechar'])
  })

  it('cabine aqui: diz que está aqui e o botão de passar é o do modo do pino', () => {
    const pedir = vi.fn()
    act(() => root.render(<PlayerPinCard pin={parada({ cabine: 'aqui', passagem: 'livre' })} stairs={[]} onClose={vi.fn()} onRequestTravel={pedir} />))
    expect(container.textContent).toContain('A cabine está aqui')
    expect(botoes()).toEqual(['Passar', 'Fechar'])
  })

  it('pino de viagem sem cabine: o cartão de sempre, sem frase de cabine', () => {
    act(() => root.render(<PlayerPinCard pin={parada({})} stairs={[]} onClose={vi.fn()} onRequestTravel={vi.fn()} />))
    expect(container.textContent).not.toContain('cabine')
    expect(botoes()).toEqual(['Pedir para passar', 'Fechar'])
  })
})
