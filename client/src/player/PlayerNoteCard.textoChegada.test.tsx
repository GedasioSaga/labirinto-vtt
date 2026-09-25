import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ARRIVAL_CARD_TITLE, PlayerNoteCard } from './PlayerNoteCard'

/**
 * O cartão do TEXTO DE CHEGADA é o mesmo do recado, com outro título: o
 * jogador distingue "o mestre me mandou isto agora" de "é o que se vê ao
 * chegar aqui". O resto (texto puro, Fechar, Escape) é o mesmo cartão.
 */
describe('PlayerNoteCard como cartão de chegada', () => {
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

  it('mostra o título de chegada e o texto como TEXTO', () => {
    act(() => root.render(<PlayerNoteCard title={ARRIVAL_CARD_TITLE} text={'<i>Frio</i>\nsilêncio'} onClose={() => {}} />))
    expect(container.querySelector('h2')?.textContent).toBe(ARRIVAL_CARD_TITLE)
    expect(container.querySelector('.pp-note__text')?.textContent).toBe('<i>Frio</i>\nsilêncio')
    expect(container.querySelector('i')).toBeNull()
    const secao = container.querySelector('section')
    expect(secao?.getAttribute('aria-labelledby')).toBe(container.querySelector('h2')?.id)
  })

  it('sem título, continua sendo o recado do mestre', () => {
    act(() => root.render(<PlayerNoteCard text="oi" onClose={() => {}} />))
    expect(container.querySelector('h2')?.textContent).toBe('Recado do mestre')
  })

  it('Fechar fecha o cartão de chegada', () => {
    const onClose = vi.fn()
    act(() => root.render(<PlayerNoteCard title={ARRIVAL_CARD_TITLE} text="oi" onClose={onClose} />))
    const fechar = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Fechar')
    expect(fechar).toBeDefined()
    act(() => fechar?.click())
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
