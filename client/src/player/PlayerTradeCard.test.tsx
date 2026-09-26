import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CarriedItem } from '../types/map'
import { PlayerBackpack } from './PlayerBackpack'
import type { TradeOfferState } from './playerConnection'
import { PlayerTradeCard } from './PlayerTradeCard'

/**
 * MOEDAS E TROCA na tela do jogador. O cartão da oferta diz quem oferece, o
 * que dá e o que pede, com Aceitar, Recusar e Contrapropor (marca itens do
 * bolso e um valor). "Comigo" mostra a bolsa e "Pagar a…" um colega encostado.
 */

const MOCHILA: CarriedItem[] = [
  { id: 'faca', nome: 'Faca' },
  { id: 'vela', nome: 'Vela' },
]

function oferta(extra: Partial<TradeOfferState> = {}): TradeOfferState {
  return { id: 1, offerId: 'o1', tokenId: 'bruno', de: 'Zulmira', dou: { itens: ['Xarope'], moedas: 0 }, peco: { itens: [{ id: 'faca', nome: 'Faca' }], moedas: 3 }, phase: 'open', ...extra }
}

describe('cartão da oferta', () => {
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

  function render(troca: TradeOfferState, handlers: Partial<{ onAnswer: (a: boolean) => void; onCounter: (i: string[], m: number) => void }> = {}, moedas = 5): void {
    act(() =>
      root.render(
        <PlayerTradeCard troca={troca} mochila={MOCHILA} moedas={moedas} onAnswer={handlers.onAnswer ?? (() => {})} onCounter={handlers.onCounter ?? (() => {})} onDismiss={() => {}} />,
      ),
    )
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nome)
    if (achado === undefined) throw new Error(`sem botão ${nome}`)
    return achado
  }

  it('diz quem oferece, o que dá e o que pede', () => {
    render(oferta())
    const texto = container.textContent ?? ''
    expect(texto).toContain('Zulmira dá: Xarope')
    expect(texto).toContain('Zulmira pede: Faca e 3 moedas')
  })

  it('Aceitar e Recusar respondem', () => {
    const onAnswer = vi.fn()
    render(oferta(), { onAnswer })
    act(() => botao('Aceitar').click())
    act(() => botao('Recusar').click())
    expect(onAnswer.mock.calls).toEqual([[true], [false]])
  })

  it('sem o que ela pede, Aceitar fica indisponível e o cartão diz por quê', () => {
    render(oferta(), {}, 1)
    expect(botao('Aceitar').disabled).toBe(true)
    expect(container.textContent).toContain('Você não tem tudo o que é pedido')
  })

  it('Contrapropor: marca a Vela, põe 1 moeda e envia', () => {
    const onCounter = vi.fn()
    render(oferta(), { onCounter })
    act(() => botao('Contrapropor').click())
    const enviar = botao('Enviar contraproposta')
    expect(enviar.disabled).toBe(true)
    const vela = container.querySelector<HTMLInputElement>('input[type="checkbox"][value="vela"]')
    if (vela === null) throw new Error('sem a vela')
    act(() => vela.click())
    const valor = container.querySelector<HTMLInputElement>('input[type="number"]')
    if (valor === null) throw new Error('sem campo de moedas')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(valor, '1')
      valor.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => botao('Enviar contraproposta').click())
    expect(onCounter).toHaveBeenCalledWith(['vela'], 1)
  })

  it('contraproposta enviada e troca feita viram texto, sem botões de resposta', () => {
    render(oferta({ phase: 'countered' }))
    expect(container.textContent).toContain('Contraproposta enviada ao mestre')
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Aceitar')).toBe(false)
    render(oferta({ phase: 'done' }))
    expect(container.textContent).toContain('Troca feita')
  })
})

describe('"Comigo": bolsa e Pagar a…', () => {
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

  it('mostra as moedas e paga a um colega encostado', () => {
    const onPay = vi.fn()
    act(() => root.render(<PlayerBackpack items={[]} moedas={5} colleagues={[{ tokenId: 'diego', name: 'Diego' }]} onGive={() => {}} onPay={onPay} />))
    expect(container.textContent).toContain('Bolsa: 5 moedas')
    const abrir = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Pagar a…')
    if (abrir === undefined) throw new Error('sem Pagar a…')
    act(() => abrir.click())
    const valor = container.querySelector<HTMLInputElement>('input[type="number"]')
    if (valor === null) throw new Error('sem campo')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(valor, '2')
      valor.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const diego = Array.from(container.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === 'Pagar 2 moedas a Diego')
    if (diego === undefined) throw new Error('sem botão do Diego')
    act(() => diego.click())
    expect(onPay).toHaveBeenCalledWith('diego', 2)
  })

  it('a ficha encostada no colega tem menos que o valor: sem botão, e a linha diz quanto ela tem', () => {
    const onPay = vi.fn()
    // Bolsa do painel 10 (ficha longe); a ficha encostada no Diego tem 0.
    act(() =>
      root.render(
        <PlayerBackpack
          items={[]}
          moedas={10}
          colleagues={[
            { tokenId: 'diego', name: 'Diego', moedas: 0 },
            { tokenId: 'carla', name: 'Carla', moedas: 10 },
          ]}
          onGive={() => {}}
          onPay={onPay}
        />,
      ),
    )
    const abrir = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Pagar a…')
    if (abrir === undefined) throw new Error('sem Pagar a…')
    act(() => abrir.click())
    const valor = container.querySelector<HTMLInputElement>('input[type="number"]')
    if (valor === null) throw new Error('sem campo')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(valor, '5')
      valor.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const botoes = Array.from(container.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'))
    expect(botoes).not.toContain('Pagar 5 moedas a Diego')
    expect(botoes).toContain('Pagar 5 moedas a Carla')
    expect(container.textContent).toContain('Diego: a sua ficha ao lado dele tem 0 moedas')
  })

  it('bolsa vazia não oferece Pagar a…', () => {
    act(() => root.render(<PlayerBackpack items={[]} moedas={0} colleagues={[{ tokenId: 'diego', name: 'Diego' }]} onGive={() => {}} onPay={() => {}} />))
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Pagar a…')).toBe(false)
    expect(container.textContent).toContain('Nada com você.')
  })
})
