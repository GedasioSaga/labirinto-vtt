import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import type { CompraNotice } from './playerConnection'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * LOJA COM PREÇOS no cartão do jogador: a banca mostra cada mercadoria com o
 * preço e o estoque, e "Quero" manda o pedido ao mestre. Mercadoria que acabou
 * não se pede; com um pedido esperando o mestre, nenhuma outra se pede. O
 * cartão fica aberto e diz onde está o pedido.
 */

function banca(extra: Partial<Pin> = {}): Pin {
  return {
    id: 'botica',
    x: 0,
    y: 0,
    kind: 'exclamacao',
    description: 'Botica de Zulmira',
    image: null,
    loja: [
      { id: 'xarope', nome: 'Xarope de tosse', preco: '1 moeda', estoque: 3 },
      { id: 'atadura', nome: 'Atadura', preco: '2 moedas', estoque: 0 },
      { id: 'agua', nome: 'Água benta', preco: 'uma vela' },
    ],
    ...extra,
  }
}

function compra(phase: CompraNotice['phase'], itemId = 'xarope', nome = 'Xarope de tosse'): CompraNotice {
  return { id: 1, pinId: 'botica', itemId, nome, phase }
}

describe('PlayerPinCard: loja com preços', () => {
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

  function render(pin: Pin, onBuy?: (itemId: string) => void, estado?: CompraNotice): void {
    act(() => root.render(<PlayerPinCard pin={pin} stairs={[]} onClose={() => {}} onBuy={onBuy} compra={estado} />))
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = [...container.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === nome)
    if (achado === undefined) throw new Error(`sem botão "${nome}"`)
    return achado
  }

  function linhas(): string[] {
    return [...container.querySelectorAll('[aria-label="Mercadorias"] li')].map((li) => [...li.children].map((parte) => (parte.textContent ?? '').trim()).join(' | '))
  }

  const status = (): string | null | undefined => container.querySelector('.pp-loja [role="status"]')?.textContent

  it('mostra cada mercadoria com o preço e o estoque, na ordem do mestre', () => {
    render(banca(), () => {})
    expect(linhas()).toEqual(['Xarope de tosse | 1 moeda | 3 em estoque | Quero', 'Atadura | 2 moedas | Acabou | Quero', 'Água benta | uma vela | Quero'])
  })

  it('"Quero" manda a mercadoria tocada, e o nome acessível diz qual', () => {
    const onBuy = vi.fn()
    render(banca(), onBuy)
    act(() => botao('Quero Xarope de tosse').click())
    expect(onBuy).toHaveBeenCalledTimes(1)
    expect(onBuy).toHaveBeenCalledWith('xarope')
  })

  it('mercadoria que acabou não se pede', () => {
    const onBuy = vi.fn()
    render(banca(), onBuy)
    expect(botao('Quero Atadura').disabled).toBe(true)
    expect(botao('Quero Água benta').disabled).toBe(false)
  })

  it('com um pedido esperando o mestre, nenhuma mercadoria se pede e o cartão diz o que foi pedido', () => {
    render(banca(), () => {}, compra('sent'))
    expect(botao('Quero Água benta').disabled).toBe(true)
    expect(botao('Quero Xarope de tosse').disabled).toBe(true)
    expect(status()).toBe('Pedido enviado ao mestre: Xarope de tosse')
  })

  it('a resposta do mestre aparece no cartão, e depois dela dá para pedir de novo', () => {
    render(banca(), () => {}, compra('sold'))
    expect(status()).toBe('Xarope de tosse está com você')
    expect(botao('Quero Xarope de tosse').disabled).toBe(false)
    render(banca(), () => {}, compra('denied', 'agua', 'Água benta'))
    expect(status()).toBe('O mestre não vendeu Água benta')
    render(banca(), () => {}, compra('far'))
    expect(status()).toBe('Chegue mais perto da banca para pedir')
  })

  it('sem quem mande o pedido, a lista aparece sem "Quero"', () => {
    render(banca())
    expect(linhas()).toHaveLength(3)
    expect(container.textContent).not.toContain('Quero')
  })

  it('pino sem loja: o cartão é o de sempre, sem lista', () => {
    render(banca({ loja: undefined }), () => {})
    expect(container.querySelector('[aria-label="Mercadorias"]')).toBeNull()
    expect(container.textContent).toContain('Botica de Zulmira')
  })

  it('a loja vem de fora da conferência campo a campo: mercadoria torta não quebra o cartão', () => {
    // O mapa chega da rede sem validação por campo: só texto vale.
    const torta = { id: 'x', nome: 7, preco: null } as unknown as NonNullable<Pin['loja']>[number] // teste: simula JSON torto vindo da rede
    render(banca({ loja: [torta, { id: 'agua', nome: 'Água benta', preco: 'uma vela' }] }), () => {})
    expect(linhas()).toEqual(['Água benta | uma vela | Quero'])
  })
})
