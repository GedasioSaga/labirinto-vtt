import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * CABINE DE TRANSPORTE no cartão do jogador — CHAMAR, FILA e OCUPANTE. Sem a
 * cabine, o cartão oferece "Chamar a cabine"; chamada, diz que ela vem; com
 * alguém dentro, diz que está ocupada. Em nenhum caso oferece passar.
 */

function parada(extra: Partial<Pin>): Pin {
  return { id: 'grade', x: 0, y: 0, kind: 'viagem', description: 'Grade do elevador', image: null, passagem: 'pede', ...extra }
}

describe('PlayerPinCard: chamar a cabine', () => {
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
  const botao = (texto: string): HTMLButtonElement => {
    const el = [...container.querySelectorAll('button')].find((b) => b.textContent === texto)
    if (el === undefined) throw new Error(`sem o botão ${texto}`)
    return el
  }

  it('cabine longe: oferece "Chamar a cabine"; tocar chama uma vez e o cartão diz que o chamado foi', () => {
    const chamar = vi.fn(() => true)
    act(() => root.render(<PlayerPinCard pin={parada({ cabine: 'longe' })} stairs={[]} onClose={vi.fn()} onRequestTravel={vi.fn()} onChamarCabine={chamar} />))
    expect(container.textContent).toContain('A cabine não está aqui')
    expect(botoes()).toEqual(['Chamar a cabine', 'Fechar'])
    act(() => botao('Chamar a cabine').click())
    expect(chamar).toHaveBeenCalledTimes(1)
    expect(botoes()).toEqual(['Fechar'])
    expect(container.textContent).toContain('Você chamou a cabine.')
  })

  it('o chamado não saiu (sem conexão): o botão continua lá para tentar de novo', () => {
    const chamar = vi.fn(() => false)
    act(() => root.render(<PlayerPinCard pin={parada({ cabine: 'longe' })} stairs={[]} onClose={vi.fn()} onChamarCabine={chamar} />))
    act(() => botao('Chamar a cabine').click())
    expect(chamar).toHaveBeenCalledTimes(1)
    expect(botoes()).toEqual(['Chamar a cabine', 'Fechar'])
  })

  it('parada já chamada: diz que a cabine vem, sem botão de passar nem de chamar de novo', () => {
    act(() => root.render(<PlayerPinCard pin={parada({ cabine: 'chamada' })} stairs={[]} onClose={vi.fn()} onRequestTravel={vi.fn()} onChamarCabine={vi.fn(() => true)} />))
    expect(container.textContent).toContain('A cabine foi chamada para cá.')
    expect(botoes()).toEqual(['Fechar'])
  })

  it('cabine aqui com alguém dentro: diz que está ocupada, sem botão de passar nem de chamar', () => {
    act(() => root.render(<PlayerPinCard pin={parada({ cabine: 'ocupada' })} stairs={[]} onClose={vi.fn()} onRequestTravel={vi.fn()} onChamarCabine={vi.fn(() => true)} />))
    expect(container.textContent).toContain('A cabine está aqui, mas alguém já embarcou.')
    expect(botoes()).toEqual(['Fechar'])
  })

  it('trancada ganha de tudo: nada de chamar a cabine', () => {
    act(() => root.render(<PlayerPinCard pin={parada({ cabine: 'longe', passagem: 'trancada' })} stairs={[]} onClose={vi.fn()} onChamarCabine={vi.fn(() => true)} />))
    expect(container.textContent).toContain('Está trancada')
    expect(botoes()).toEqual(['Fechar'])
  })
})
