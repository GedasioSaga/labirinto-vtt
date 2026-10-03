import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * VEÍCULO: a passageira que não dirige abre o cartão do pino. Antes ele
 * oferecia "Passar", e a recusa `a_bordo` só chegava depois do clique. Agora
 * o botão já vem apagado dizendo por quê; o host continua recusando.
 */

const POCO: Pin = { id: 'poco', x: 400, y: 200, kind: 'viagem', description: 'Poço', image: null, destino: null, passagem: 'livre' }

describe('PlayerPinCard: a bordo sem dirigir', () => {
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

  const render = (props: { aBordo?: boolean; congelado?: boolean; longe?: boolean }): void =>
    act(() => root.render(<PlayerPinCard pin={POCO} stairs={[]} onClose={() => {}} onRequestTravel={() => {}} {...props} />))
  const passar = (): HTMLButtonElement | null => container.querySelector<HTMLButtonElement>('button.pp-pincard__travel')

  it('a bordo: o botão diz "A bordo: desça para viajar" e não clica', () => {
    render({ aBordo: true })
    expect(passar()?.textContent).toBe('A bordo: desça para viajar')
    expect(passar()?.disabled).toBe(true)
  })

  it('a bordo vence o "Chegue mais perto": a passageira não anda até o pino', () => {
    render({ aBordo: true, longe: true })
    expect(passar()?.textContent).toBe('A bordo: desça para viajar')
  })

  it('congelado vence o a bordo: descer não adiantaria', () => {
    render({ aBordo: true, congelado: true })
    expect(passar()?.textContent).toBe('Congelado pelo mestre')
  })

  it('controle: a pé, o "Passar" de sempre', () => {
    render({})
    expect(passar()?.textContent).toBe('Passar')
    expect(passar()?.disabled).toBe(false)
  })
})
