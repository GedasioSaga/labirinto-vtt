import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * PINO SÓ DE PERTO no cartão: com a ficha longe (`longe`), o cartão continua
 * abrindo para leitura, mas nenhum botão de passagem aceita toque e o cartão
 * diz o que fazer. Trancada continua dizendo só que está trancada.
 */

const PORTA: Pin = { id: 'porta', x: 100, y: 100, kind: 'viagem', description: 'Porta do porão', image: null }
const ENCRUZILHADA: Pin = {
  ...PORTA,
  id: 'cruz',
  escolhas: [
    { id: 'principal', rotulo: 'Escada de cima' },
    { id: 's2', rotulo: 'Túnel de baixo' },
  ],
}

let root: Root
let host: HTMLDivElement

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function botoes(): HTMLButtonElement[] {
  return Array.from(host.querySelectorAll('button'))
}

function botao(nome: string): HTMLButtonElement {
  const achado = botoes().find((b) => b.textContent === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

describe('PlayerPinCard: pino de viagem de longe', () => {
  it('pino de uma saída: o botão fica apagado com "Chegue mais perto para passar" e não pede', () => {
    const pedir = vi.fn()
    act(() => root.render(<PlayerPinCard pin={PORTA} onClose={() => {}} onRequestTravel={pedir} longe />))
    expect(host.textContent).toContain('Porta do porão')
    const apagado = botao('Chegue mais perto para passar')
    expect(apagado.disabled).toBe(true)
    act(() => apagado.click())
    expect(pedir).not.toHaveBeenCalled()
    expect(host.querySelector('.pp-pincard__confirm')).toBeNull()
  })

  it('encruzilhada: todas as saídas apagadas, com o aviso de chegar mais perto', () => {
    act(() => root.render(<PlayerPinCard pin={ENCRUZILHADA} onClose={() => {}} onRequestTravel={() => {}} longe />))
    expect(host.textContent).toContain('Chegue mais perto para passar')
    expect(botao('Escada de cima').disabled).toBe(true)
    expect(botao('Túnel de baixo').disabled).toBe(true)
  })

  it('trancada de longe diz só que está trancada, sem "Chegue mais perto"', () => {
    act(() => root.render(<PlayerPinCard pin={{ ...PORTA, passagem: 'trancada' }} onClose={() => {}} onRequestTravel={() => {}} longe />))
    expect(host.textContent).toContain('Está trancada')
    expect(host.textContent).not.toContain('Chegue mais perto')
  })

  it('perto (sem `longe`), o cartão é o de sempre: "Pedir para passar" aceita toque', () => {
    act(() => root.render(<PlayerPinCard pin={PORTA} onClose={() => {}} onRequestTravel={() => {}} />))
    const pedir = botao('Pedir para passar')
    expect(pedir.disabled).toBe(false)
    expect(host.textContent).not.toContain('Chegue mais perto')
  })

  it('a ficha sai de perto com a pergunta aberta: o "Pedir" da confirmação apaga também', () => {
    const pedir = vi.fn()
    act(() => root.render(<PlayerPinCard pin={PORTA} onClose={() => {}} onRequestTravel={pedir} />))
    act(() => botao('Pedir para passar').click())
    act(() => root.render(<PlayerPinCard pin={PORTA} onClose={() => {}} onRequestTravel={pedir} longe />))
    const confirmar = botao('Pedir')
    expect(confirmar.disabled).toBe(true)
    act(() => confirmar.click())
    expect(pedir).not.toHaveBeenCalled()
    expect(host.textContent).toContain('Chegue mais perto para passar')
  })
})
