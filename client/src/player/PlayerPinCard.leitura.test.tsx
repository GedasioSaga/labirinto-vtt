import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * LEITURA DA PISTA: abrir o cartão é o que acende "leu" no painel Pistas do
 * mestre. Cartão de pino "só de perto" visto de longe NÃO conta — o texto nem
 * chegou; conta quando o texto chega com o cartão aberto.
 */

const CARTA: Pin = { id: 'carta', x: 400, y: 200, kind: 'interrogacao', description: 'Encontrem-me no cais', image: null }

describe('PlayerPinCard: avisa que a pista foi lida', () => {
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

  const render = (pin: Pin, onRead: (pinId: string) => void): void => act(() => root.render(<PlayerPinCard pin={pin} onClose={() => {}} onRead={onRead} />))

  it('abrir o cartão lê a pista uma vez, mesmo com pacotes novos do mesmo pino', () => {
    const onRead = vi.fn()
    render(CARTA, onRead)
    expect(onRead).toHaveBeenCalledTimes(1)
    expect(onRead).toHaveBeenCalledWith('carta')
    render({ ...CARTA, x: 401 }, onRead)
    expect(onRead).toHaveBeenCalledTimes(1)
  })

  it('longe: não lê; o texto chega com o cartão aberto e aí lê', () => {
    const onRead = vi.fn()
    render({ ...CARTA, description: '', longe: true }, onRead)
    expect(onRead).toHaveBeenCalledTimes(0)
    expect(container.textContent).toContain('Chegue mais perto')
    render(CARTA, onRead)
    expect(onRead).toHaveBeenCalledTimes(1)
    expect(onRead).toHaveBeenCalledWith('carta')
  })
})
