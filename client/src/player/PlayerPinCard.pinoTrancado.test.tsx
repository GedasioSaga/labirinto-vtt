import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * PINO TRANCADO VIRA PEDIDO, no cartão do jogador: trancado continua dizendo
 * que está trancado, mas agora oferece "Pedir ao mestre" (com a mesma
 * confirmação do pedido de passagem). Com a opção desligada pelo mestre
 * (`mudo`), o cartão é o de antes: só a frase, nenhum botão de pedir.
 */

function porta(extra: Partial<Pin> = {}): Pin {
  return { id: 'porta-lab', x: 0, y: 0, kind: 'viagem', description: 'Porta de aço', image: null, passagem: 'trancada', ...extra }
}

describe('PlayerPinCard: pino de viagem trancado', () => {
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
  const botao = (texto: string) => {
    const achado = [...container.querySelectorAll('button')].find((b) => b.textContent === texto)
    if (achado === undefined) throw new Error(`sem botão ${texto}`)
    return achado
  }

  it('trancado: diz que está trancado e oferece "Pedir ao mestre", que pergunta antes de mandar', () => {
    const onRequestTravel = vi.fn()
    act(() => root.render(<PlayerPinCard pin={porta()} stairs={[]} onClose={vi.fn()} onRequestTravel={onRequestTravel} />))
    expect(container.textContent).toContain('Está trancada')
    expect(botoes()).toEqual(['Pedir ao mestre', 'Fechar'])
    act(() => botao('Pedir ao mestre').click())
    // Um toque sem querer não vira pedido: primeiro a pergunta.
    expect(onRequestTravel).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Pedir ao mestre para abrir a passagem?')
    act(() => botao('Pedir').click())
    expect(onRequestTravel).toHaveBeenCalledTimes(1)
    expect(onRequestTravel).toHaveBeenCalledWith()
  })

  it('esperando o mestre: o botão fica desligado e diz que o pedido foi', () => {
    act(() => root.render(<PlayerPinCard pin={porta()} stairs={[]} onClose={vi.fn()} onRequestTravel={vi.fn()} travelWaiting />))
    const esperando = botao('Pedido enviado ao mestre')
    expect(esperando.disabled).toBe(true)
  })

  it('mudo (o mestre não aceita tentativas): só a frase de trancada, nenhum botão de pedir', () => {
    const onRequestTravel = vi.fn()
    act(() => root.render(<PlayerPinCard pin={porta({ mudo: true })} stairs={[]} onClose={vi.fn()} onRequestTravel={onRequestTravel} />))
    expect(container.textContent).toContain('Está trancada. Não dá para passar por aqui agora.')
    expect(botoes()).toEqual(['Fechar'])
  })

  it('encruzilhada trancada: um botão por saída, e o pedido leva a saída escolhida', () => {
    const onRequestTravel = vi.fn()
    const escolhas = [
      { id: 'principal', rotulo: 'Porta de aço' },
      { id: 'saida-2', rotulo: 'Duto de ar' },
    ]
    act(() => root.render(<PlayerPinCard pin={porta({ escolhas })} stairs={[]} onClose={vi.fn()} onRequestTravel={onRequestTravel} />))
    expect(botoes()).toEqual(['Porta de aço', 'Duto de ar', 'Fechar'])
    act(() => botao('Duto de ar').click())
    expect(container.textContent).toContain('Pedir ao mestre para passar por Duto de ar?')
    act(() => botao('Pedir').click())
    expect(onRequestTravel).toHaveBeenCalledWith('saida-2')
  })
})
