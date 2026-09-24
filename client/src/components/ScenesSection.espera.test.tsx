import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MINUTO_MS } from '../lib/cenaQueEspera'
import type { SceneListItem } from '../stores/adventureStore'
import { ScenesSection } from './ScenesSection'

/**
 * atencao-do-mestre — 'há N min' na linha da cena que espera o mestre. Âmbar
 * (a classe --longa) a partir de 10 min, e o número anda sozinho com o tempo.
 */
const CENAS: SceneListItem[] = [
  { id: 's-docas', name: 'Docas', active: true, available: true, renamable: true, tokenCount: 2 },
  { id: 's-capitania', name: 'Capitania', active: false, available: true, renamable: false, tokenCount: 1 },
  { id: 's-sotao', name: 'Sótão', active: false, available: true, renamable: false, tokenCount: 1 },
]

const AGORA = Date.UTC(2026, 8, 22, 21, 0, 0)

describe('ScenesSection: há quanto tempo a cena espera', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(AGORA)
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  function render(waitingSince?: ReadonlyMap<string, number>): void {
    act(() => root.render(<ScenesSection scenes={CENAS} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} waitingSince={waitingSince} />))
  }

  function linha(nome: string): HTMLLIElement | undefined {
    return Array.from(container.querySelectorAll('li')).find((li) => Array.from(li.querySelectorAll('button')).some((b) => b.textContent === nome))
  }

  function espera(nome: string): HTMLElement | null {
    return linha(nome)?.querySelector<HTMLElement>('.lb-cenas__espera') ?? null
  }

  it('11 min nas Docas: "há 11 min" na linha da Capitania, em âmbar', () => {
    render(new Map([['s-capitania', AGORA - 11 * MINUTO_MS]]))
    const selo = espera('Capitania')
    expect(selo?.textContent).toBe('há 11 min')
    expect(selo?.classList.contains('lb-cenas__espera--longa')).toBe(true)
    // O mouse em cima diz o que é e ensina o atalho.
    expect(selo?.getAttribute('title')).toContain('Ctrl+J')
  })

  it('menos de 10 min: aparece, sem âmbar', () => {
    render(new Map([['s-sotao', AGORA - 4 * MINUTO_MS]]))
    const selo = espera('Sótão')
    expect(selo?.textContent).toBe('há 4 min')
    expect(selo?.classList.contains('lb-cenas__espera--longa')).toBe(false)
  })

  it('o número anda com o relógio, sem ninguém mexer: 9 min vira 10 e fica âmbar', () => {
    render(new Map([['s-capitania', AGORA - 9 * MINUTO_MS]]))
    expect(espera('Capitania')?.textContent).toBe('há 9 min')
    act(() => {
      vi.advanceTimersByTime(MINUTO_MS)
    })
    expect(espera('Capitania')?.textContent).toBe('há 10 min')
    expect(espera('Capitania')?.classList.contains('lb-cenas__espera--longa')).toBe(true)
  })

  it('cena que não espera (a aberta, a vazia, ou há menos de 1 min) não tem selo', () => {
    render(
      new Map([
        ['s-capitania', AGORA - 11 * MINUTO_MS],
        ['s-sotao', AGORA - 30_000],
      ]),
    )
    expect(espera('Docas')).toBeNull()
    expect(espera('Sótão')).toBeNull()
    expect(espera('Capitania')).not.toBeNull()
  })

  it('sem sala (sem waitingSince): nenhuma linha tem selo', () => {
    render()
    expect(container.querySelectorAll('.lb-cenas__espera')).toHaveLength(0)
    expect(linha('Capitania')).toBeDefined()
  })
})
