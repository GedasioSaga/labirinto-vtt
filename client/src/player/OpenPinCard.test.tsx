import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { OpenPinCard, type OpenPinCardConnection } from './OpenPinCard'

/**
 * O cartão aberto na tela do jogador, já ligado à conexão: é o que faz a
 * bolinha do mestre encher quando a Gabi abre a carta, e o que manda o pedido
 * de viagem. A tela (`player/main.tsx`) só escolhe qual pino está aberto.
 */

const CARTA: Pin = { id: 'carta', x: 400, y: 200, kind: 'interrogacao', description: 'Encontrem-me no cais', image: null }
const ESCADA: Pin = { id: 'escada', x: 100, y: 100, kind: 'viagem', description: 'Escada', image: null, passagem: 'livre' }

function conexao(requestTravelResult = true) {
  const markPinRead = vi.fn<OpenPinCardConnection['markPinRead']>(() => true)
  const requestTravel = vi.fn<OpenPinCardConnection['requestTravel']>(() => requestTravelResult)
  return { markPinRead, requestTravel }
}

describe('OpenPinCard: o cartão do jogador ligado à conexão', () => {
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

  it('Gabi abre a carta: a conexão marca a pista como lida, uma vez só', () => {
    const connection = conexao()
    act(() => root.render(<OpenPinCard pin={CARTA} connection={connection} travelWaiting={false} onClose={() => {}} />))
    expect(container.textContent).toContain('Encontrem-me no cais')
    expect(connection.markPinRead).toHaveBeenCalledTimes(1)
    expect(connection.markPinRead).toHaveBeenCalledWith('carta')
    // Pacote novo do mesmo pino (o mapa andou) não lê de novo.
    act(() => root.render(<OpenPinCard pin={{ ...CARTA, x: 401 }} connection={connection} travelWaiting={false} onClose={() => {}} />))
    expect(connection.markPinRead).toHaveBeenCalledTimes(1)
  })

  it('pino "só de perto" visto de longe: não marca lida', () => {
    const connection = conexao()
    act(() => root.render(<OpenPinCard pin={{ ...CARTA, description: '', longe: true }} connection={connection} travelWaiting={false} onClose={() => {}} />))
    expect(container.textContent).toContain('Chegue mais perto')
    expect(connection.markPinRead).toHaveBeenCalledTimes(0)
  })

  it('pedido de viagem aceito pela conexão fecha o cartão; recusado, o cartão fica', () => {
    const aceita = conexao(true)
    const onClose = vi.fn()
    act(() => root.render(<OpenPinCard pin={ESCADA} connection={aceita} travelWaiting={false} onClose={onClose} />))
    // Pedir abre a pergunta; o "sim" dela é que manda o pedido.
    const pedirEConfirmar = (): void => {
      act(() => container.querySelector<HTMLButtonElement>('.pp-pincard__travel')?.click())
      act(() => container.querySelector<HTMLButtonElement>('.pp-pincard__choices .pp-pincard__travel')?.click())
    }
    pedirEConfirmar()
    expect(aceita.requestTravel).toHaveBeenCalledTimes(1)
    expect(aceita.requestTravel).toHaveBeenCalledWith('escada', undefined)
    expect(onClose).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
    root = createRoot(container)

    const recusa = conexao(false)
    const onClose2 = vi.fn()
    act(() => root.render(<OpenPinCard pin={ESCADA} connection={recusa} travelWaiting={false} onClose={onClose2} />))
    pedirEConfirmar()
    expect(recusa.requestTravel).toHaveBeenCalledTimes(1)
    expect(onClose2).toHaveBeenCalledTimes(0)
  })
})
