import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { pinDirectory, type PinDirectoryEntry } from '../lib/pinDirectory'
import { PinsSection } from './PinsSection'

/**
 * "Pinos" no painel do mestre: a lista de todos os pinos da aventura, com
 * busca e filtro por cena. Tocar num resultado (ou Enter na busca) leva o
 * editor até o pino — quem abre a cena e seleciona é o `onGo` do App.
 */

function pino(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 100, y: 200, kind: 'interrogacao', description: '', image: null, ...extra }
}

const ENTRADAS: PinDirectoryEntry[] = pinDirectory([
  { sceneId: 's-casa', sceneName: 'Casa do crime', pins: [pino('faca', { nome: 'Faca' }), pino('bilhete', { nome: 'Bilhete' })] },
  { sceneId: 's-porao', sceneName: 'Porão', pins: [pino('pegada', { nome: 'Pegada' })] },
])

describe('PinsSection: lista de pinos buscável', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(entries: readonly PinDirectoryEntry[], onGo: (entry: PinDirectoryEntry) => void = () => {}): void {
    act(() => root.render(<PinsSection entries={entries} onGo={onGo} />))
  }

  function busca(): HTMLInputElement {
    const input = container.querySelector('input[type="search"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('sem campo de busca')
    return input
  }

  function digitar(input: HTMLInputElement, valor: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, valor)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function resultados(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll('ul[aria-label="Pinos da aventura"] button')).filter(
      (b): b is HTMLButtonElement => b instanceof HTMLButtonElement,
    )
  }

  it('mostra os pinos pelo nome do mestre, com a cena de cada um', () => {
    render(ENTRADAS)
    expect(resultados().map((b) => b.textContent)).toEqual(['FacaCasa do crime', 'BilheteCasa do crime', 'PegadaPorão'])
  })

  it('buscar "fac" deixa só a Faca; tocar nela chama onGo com a cena e o pino', () => {
    const onGo = vi.fn()
    render(ENTRADAS, onGo)
    digitar(busca(), 'fac')
    expect(resultados().map((b) => b.textContent)).toEqual(['FacaCasa do crime'])
    act(() => resultados()[0].click())
    expect(onGo).toHaveBeenCalledWith(expect.objectContaining({ sceneId: 's-casa', pinId: 'faca' }))
  })

  it('Enter na busca vai ao primeiro resultado', () => {
    const onGo = vi.fn()
    render(ENTRADAS, onGo)
    const campo = busca()
    digitar(campo, 'peg')
    act(() => {
      campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(onGo).toHaveBeenCalledTimes(1)
    expect(onGo).toHaveBeenCalledWith(expect.objectContaining({ sceneId: 's-porao', pinId: 'pegada' }))
  })

  it('o filtro de cena corta os pinos das outras', () => {
    render(ENTRADAS)
    const filtro = container.querySelector('select')
    if (!(filtro instanceof HTMLSelectElement)) throw new Error('sem filtro de cena')
    expect(Array.from(filtro.options).map((o) => o.textContent)).toEqual(['Todas as cenas', 'Casa do crime', 'Porão'])
    act(() => {
      filtro.value = 's-porao'
      filtro.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(resultados().map((b) => b.textContent)).toEqual(['PegadaPorão'])
  })

  it('busca sem resultado diz isso, e Esc limpa a busca sem chegar ao canvas', () => {
    render(ENTRADAS)
    const campo = busca()
    digitar(campo, 'revólver')
    expect(resultados()).toHaveLength(0)
    expect(container.textContent).toContain('Nenhum pino com “revólver”.')
    // O atalho do canvas escuta no documento: o Esc da busca não pode chegar lá.
    const fora = vi.fn()
    document.addEventListener('keydown', fora)
    act(() => {
      campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    document.removeEventListener('keydown', fora)
    expect(fora).not.toHaveBeenCalled()
    expect(busca().value).toBe('')
    expect(resultados()).toHaveLength(3)
  })

  it('sem pino nenhum (e sem cena para filtrar), diz que não há pinos', () => {
    render([])
    expect(container.querySelector('select')).toBeNull()
    expect(container.textContent).toContain('Nenhum pino no mapa ainda.')
  })
})
