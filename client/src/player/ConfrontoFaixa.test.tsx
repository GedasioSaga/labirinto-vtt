import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { ConfrontoFaixa } from './ConfrontoFaixa'
import type { PlayerConfronto } from '../lib/confronto'

function ficha(id: string, name: string): Token {
  return { id, characterId: null, name, x: 0, y: 0, size: 1, image: null }
}

const FICHAS = [ficha('rato', 'Rato 1'), ficha('ana', 'Ana'), ficha('bruno', 'Bruno')]

describe('ConfrontoFaixa — a vez na tela do jogador', () => {
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

  const render = (confronto: PlayerConfronto, tokens: Token[] = FICHAS) => act(() => root.render(<ConfrontoFaixa confronto={confronto} tokens={tokens} />))

  it('na vez dele: "Sua vez" com as casas que restam, e a fila com os nomes na ordem', () => {
    render({ fila: ['rato', 'ana', 'bruno'], vez: 'ana', suaVez: true, passo: 6, restam: 4 })
    const faixa = container.querySelector('[role="status"]')
    expect(faixa?.textContent).toContain('Sua vez · 4 casas')
    const nomes = Array.from(container.querySelectorAll('li')).map((li) => li.textContent)
    expect(nomes).toEqual(['Rato 1', 'Ana', 'Bruno'])
    expect(container.querySelector('li[aria-current="true"]')?.textContent).toBe('Ana')
  })

  it('uma casa só: singular', () => {
    render({ fila: ['ana'], vez: 'ana', suaVez: true, passo: 6, restam: 1 })
    expect(container.textContent).toContain('Sua vez · 1 casa')
    expect(container.textContent).not.toContain('1 casas')
  })

  it('vez de outro que ele vê: "Vez de" com o nome; de alguém que ele não vê: "Vez de outro"', () => {
    render({ fila: ['rato', 'ana'], vez: 'rato', suaVez: false, passo: 6, restam: null })
    expect(container.textContent).toContain('Vez de: Rato 1')
    render({ fila: ['ana'], vez: null, suaVez: false, passo: 6, restam: null })
    expect(container.textContent).toContain('Vez de outro')
    expect(container.querySelector('li[aria-current="true"]')).toBeNull()
  })

  it('nunca mostra id cru: ficha da fila que não está no mapa recebido fica de fora', () => {
    render({ fila: ['rato', 'sumiu', 'ana'], vez: 'ana', suaVez: false, passo: 6, restam: null })
    expect(container.textContent).not.toContain('sumiu')
    expect(container.querySelectorAll('li')).toHaveLength(2)
  })
})
