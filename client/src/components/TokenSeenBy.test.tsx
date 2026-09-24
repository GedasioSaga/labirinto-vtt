import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TokenSeenBy, seenByText } from './TokenSeenBy'

/*
 * "Visto por" no painel da ficha: o mestre lê quem enxerga o guarda sem sair
 * do painel. A lista vem da ponte (`HostBridge.tokenSeenBy`); aqui só a frase
 * e o redesenho a cada recorte novo que sai pelo fio.
 */

describe('seenByText: a frase do painel', () => {
  it('ninguém, um, vários e "não se aplica"', () => {
    expect(seenByText([])).toBe('Ninguém vê')
    expect(seenByText(['Duda'])).toBe('Visto por: Duda')
    expect(seenByText(['Ana', 'Duda'])).toBe('Visto por: Ana, Duda')
    expect(seenByText(null)).toBeNull()
  })
})

describe('TokenSeenBy: o painel acompanha as telas dos jogadores', () => {
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

  /** Ponte de mentira: `quemVe` é o que as telas dizem agora; `recorteNovo` avisa quem observa. */
  function ponte(inicial: string[] | null) {
    let quemVe = inicial
    const watchers = new Set<() => void>()
    return {
      watch(listener: () => void) {
        watchers.add(listener)
        return () => {
          watchers.delete(listener)
        }
      },
      read: (tokenId: string): string[] | null => (tokenId === 'guarda' ? quemVe : null),
      recorteNovo(agora: string[] | null) {
        quemVe = agora
        for (const watcher of watchers) watcher()
      },
      observando: () => watchers.size,
    }
  }

  it('"Ninguém vê" → arrasta para a rua: "Visto por: Duda" → atrás da parede: "Ninguém vê"', () => {
    const p = ponte([])
    act(() => root.render(<TokenSeenBy tokenId="guarda" watch={p.watch} read={p.read} />))
    expect(container.textContent).toBe('Ninguém vê')
    expect(p.observando()).toBe(1)

    act(() => p.recorteNovo(['Duda']))
    expect(container.textContent).toBe('Visto por: Duda')

    act(() => p.recorteNovo([]))
    expect(container.textContent).toBe('Ninguém vê')
  })

  it('ficha com dono ou sala fechada: não desenha nada', () => {
    const p = ponte(null)
    act(() => root.render(<TokenSeenBy tokenId="guarda" watch={p.watch} read={p.read} />))
    expect(container.textContent).toBe('')
    expect(container.childElementCount).toBe(0)
  })

  it('para de observar ao sair do painel', () => {
    const p = ponte([])
    act(() => root.render(<TokenSeenBy tokenId="guarda" watch={p.watch} read={p.read} />))
    expect(p.observando()).toBe(1)
    act(() => root.render(<></>))
    expect(p.observando()).toBe(0)
  })
})
