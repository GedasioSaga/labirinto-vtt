import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import type { LockAnswerPhase } from './playerConnection'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * FECHADURA COM SEGREDO no cartão: com `fechadura` no recorte, o cartão
 * oferece digitar (teclado) ou girar (volantes) e "Tentar". Quem confere é o
 * host: o cartão só manda a tentativa e mostra a resposta dele.
 */

function pino(extra: Partial<Pin> = {}): Pin {
  return { id: 'cofre', x: 0, y: 0, kind: 'exclamacao', description: 'Cofre de parede', image: null, ...extra }
}

describe('PlayerPinCard: fechadura com segredo', () => {
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

  function render(pin: Pin, onTryLock: (tentativa: string) => void, lockPhase?: LockAnswerPhase, onRequestTravel?: () => void): void {
    act(() => root.render(<PlayerPinCard pin={pin} onClose={() => {}} onTryLock={onTryLock} lockPhase={lockPhase} onRequestTravel={onRequestTravel} />))
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = [...container.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === nome)
    if (achado === undefined) throw new Error(`sem botão "${nome}"`)
    return achado
  }

  function clicar(el: HTMLElement): void {
    act(() => el.click())
  }

  function digitar(input: HTMLInputElement, valor: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    if (setter === undefined) throw new Error('jsdom sem setter de value')
    act(() => {
      setter.call(input, valor)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('teclado: digita a combinação e "Tentar" manda o que foi digitado', () => {
    const onTry = vi.fn()
    render(pino({ fechadura: { forma: 'teclado', casas: 4 } }), onTry)
    const input = container.querySelector<HTMLInputElement>('input#pp-lock-input-cofre')
    if (input === null) throw new Error('sem campo')
    // Rótulo de verdade, ligado ao campo.
    expect(container.querySelector('label[for="pp-lock-input-cofre"]')?.textContent).toBe('Combinação')
    digitar(input, '1234')
    clicar(botao('Tentar'))
    expect(onTry).toHaveBeenCalledWith('1234')
  })

  it('teclado vazio não tenta', () => {
    const onTry = vi.fn()
    render(pino({ fechadura: { forma: 'teclado', casas: 4 } }), onTry)
    expect(botao('Tentar').disabled).toBe(true)
    expect(onTry).not.toHaveBeenCalled()
  })

  it('volantes: um volante por casa, girar para cima e para baixo, e "Tentar" manda os números', () => {
    const onTry = vi.fn()
    render(pino({ fechadura: { forma: 'volantes', casas: 3 } }), onTry)
    expect(container.querySelectorAll('.pp-lock__wheel')).toHaveLength(3)
    clicar(botao('Girar o volante 1 para cima'))
    clicar(botao('Girar o volante 1 para cima'))
    // Do 0 para baixo dá a volta no 9.
    clicar(botao('Girar o volante 3 para baixo'))
    expect(container.querySelector('[aria-label="Volante 1"]')?.textContent).toBe('2')
    clicar(botao('Tentar'))
    expect(onTry).toHaveBeenCalledWith('209')
  })

  it('a resposta do host aparece como estado: "Não abre." e "Abriu."', () => {
    render(pino({ fechadura: { forma: 'teclado', casas: 4 } }), () => {}, 'wrong')
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Não abre.')
    render(pino({ fechadura: { forma: 'teclado', casas: 4 } }), () => {}, 'too_soon')
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Espere um instante antes de tentar de novo.')
    render(pino(), () => {}, 'open')
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Abriu.')
  })

  it('conferindo: o botão fica desligado até a resposta', () => {
    render(pino({ fechadura: { forma: 'teclado', casas: 4 } }), () => {}, 'sending')
    expect(botao('Conferindo…').disabled).toBe(true)
  })

  it('pino de viagem com fechadura fechada não oferece passar, só a fechadura', () => {
    const onTravel = vi.fn()
    render(pino({ kind: 'viagem', fechadura: { forma: 'teclado', casas: 2 } }), () => {}, undefined, onTravel)
    expect(container.textContent).not.toContain('Pedir para passar')
    expect(container.textContent).toContain('Trancada com segredo')
    expect(container.querySelector('input#pp-lock-input-cofre')).not.toBeNull()
  })

  it('sem fechadura, o cartão é o de sempre', () => {
    render(pino(), () => {})
    expect(container.querySelector('.pp-lock')).toBeNull()
  })
})
