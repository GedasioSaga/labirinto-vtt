/**
 * CARTÃO DO ITEM (entrega 5): a imagem grande por URL da sala, "Ver inteira"
 * (a imagem na tela toda, que o Escape fecha sozinha), nome, categoria,
 * quantidade, descrição e "Pegar" / "Pedir para pegar", apagado de longe.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PinItem } from '../types/map'
import { PlayerItemCard, TEXTO_LONGE_DO_ITEM } from './PlayerItemCard'

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

const ID_POCAO = `${'9'.repeat(64)}.webp`
const POCAO: PinItem = { nome: 'Poção', imagem: `midia:${ID_POCAO}`, descricao: 'Cura 50 HP.', categoria: 'Consumível', quantidade: 3, livre: true }

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(props: Partial<Parameters<typeof PlayerItemCard>[0]> = {}) {
  const onClose = props.onClose ?? vi.fn()
  const onTake = props.onTake ?? vi.fn()
  act(() => root.render(<PlayerItemCard item={POCAO} onClose={onClose} onTake={onTake} {...props} />))
  return { onClose, onTake }
}

const botao = (nome: string): HTMLButtonElement | undefined =>
  [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === nome)

const escape = () => act(() => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))

describe('cartão do item', () => {
  it('mostra a imagem pela URL da sala, o nome, a categoria com a pilha e a descrição', () => {
    render()
    expect(container.querySelector('img')?.getAttribute('src')).toBe(`/media/${ID_POCAO}`)
    expect(container.textContent).toContain('Poção')
    expect(container.textContent).toContain('Consumível · Quantidade: 3')
    expect(container.textContent).toContain('Cura 50 HP.')
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Poção')
  })

  it('"Pega direto" oferece Pegar; "Pede ao mestre" oferece Pedir para pegar; esperando, desliga', () => {
    const { onTake } = render()
    act(() => botao('Pegar')?.click())
    expect(onTake).toHaveBeenCalledTimes(1)
    const { livre: _livre, ...pede } = POCAO
    render({ item: pede })
    expect(botao('Pedir para pegar')).toBeDefined()
    render({ item: pede, takeWaiting: true })
    expect(botao('Pedido enviado ao mestre')?.disabled).toBe(true)
  })

  it('longe: o botão apaga e o cartão diz por quê', () => {
    const { onTake } = render({ longe: true })
    expect(botao('Pegar')?.disabled).toBe(true)
    expect(container.textContent).toContain(TEXTO_LONGE_DO_ITEM)
    act(() => botao('Pegar')?.click())
    expect(onTake).not.toHaveBeenCalled()
  })

  it('"Ver inteira" abre a imagem na tela toda; Escape fecha só ela e o foco volta; o segundo Escape fecha o cartão', () => {
    const { onClose } = render()
    act(() => botao('Ver a imagem de Poção inteira')?.click())
    const inteira = document.querySelector('[aria-label="Imagem de Poção"]')
    expect(inteira?.querySelector('img')?.getAttribute('src')).toBe(`/media/${ID_POCAO}`)
    expect(document.activeElement?.textContent).toBe('Fechar imagem')
    escape()
    expect(document.querySelector('[aria-label="Imagem de Poção"]')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(botao('Ver a imagem de Poção inteira'))
    escape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('tocar na imagem inteira não fecha o cartão; tocar no fundo dela fecha só ela', () => {
    const { onClose } = render()
    act(() => botao('Ver a imagem de Poção inteira')?.click())
    const inteira = document.querySelector<HTMLElement>('[aria-label="Imagem de Poção"]')
    const imagem = inteira?.querySelector('img')
    act(() => void imagem?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
    act(() => imagem?.click())
    expect(onClose).not.toHaveBeenCalled()
    expect(document.querySelector('[aria-label="Imagem de Poção"]')).not.toBeNull()
    act(() => inteira?.click())
    expect(document.querySelector('[aria-label="Imagem de Poção"]')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sem imagem: cartão compacto, sem "Ver inteira"; o texto do pino entra quando o item não tem descrição', () => {
    render({ item: { nome: 'Corda' }, textoDoPino: 'Enrolada no gancho.' })
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.pp-pincard--compacto')).not.toBeNull()
    expect(botao('Ver a imagem de Corda inteira')).toBeUndefined()
    expect(container.textContent).toContain('Enrolada no gancho.')
    expect(botao('Pedir para pegar')).toBeDefined()
  })
})
