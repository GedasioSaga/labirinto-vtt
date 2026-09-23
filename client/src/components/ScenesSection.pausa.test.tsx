import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SceneListItem } from '../stores/adventureStore'
import { ScenesSection } from './ScenesSection'

const CENAS: SceneListItem[] = [
  { id: 's-salao', name: 'Salao Norte', active: true, available: true, renamable: true, tokenCount: 1 },
  { id: 's-cripta', name: 'Cripta Rubra', active: false, available: true, renamable: false, tokenCount: 1 },
]

describe('ScenesSection: "Pausar" por cena', () => {
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

  function render(scenes: SceneListItem[], paused?: ReadonlySet<string>, onTogglePause?: (sceneId: string, paused: boolean) => void): void {
    act(() =>
      root.render(<ScenesSection scenes={scenes} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} paused={paused} onTogglePause={onTogglePause} />),
    )
  }

  /** O item da lista que tem o botão com o nome da cena. */
  function linha(nome: string): HTMLLIElement | undefined {
    return Array.from(container.querySelectorAll('li')).find((li) => Array.from(li.querySelectorAll('button')).some((b) => b.textContent === nome))
  }

  /** Botão cujo nome acessível contém "Pausar", DENTRO da linha da cena. */
  function pausar(nome: string): HTMLButtonElement | undefined {
    return Array.from(linha(nome)?.querySelectorAll('button') ?? []).find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').includes('Pausar'))
  }

  it('sem sala (sem onTogglePause) não há botão "Pausar"', () => {
    render(CENAS)
    expect(pausar('Salao Norte')).toBeUndefined()
    expect(pausar('Cripta Rubra')).toBeUndefined()
  })

  it('cada cena tem o próprio "Pausar", solto, dentro da linha dela', () => {
    render(CENAS, new Set(), () => {})
    for (const nome of ['Salao Norte', 'Cripta Rubra']) {
      const botao = pausar(nome)
      expect(botao, nome).toBeDefined()
      expect(botao?.getAttribute('aria-pressed')).toBe('false')
    }
  })

  it('clicar pede para pausar a cena da linha; pausada, o botão fica pressionado e o clique solta', () => {
    const onTogglePause = vi.fn()
    render(CENAS, new Set(), onTogglePause)
    act(() => pausar('Cripta Rubra')?.click())
    expect(onTogglePause).toHaveBeenCalledWith('s-cripta', true)

    render(CENAS, new Set(['s-cripta']), onTogglePause)
    const botao = pausar('Cripta Rubra')
    expect(botao?.getAttribute('aria-pressed')).toBe('true')
    // Mesmo nome acessível ligado ou desligado: o estado vai só em aria-pressed.
    expect(botao?.getAttribute('aria-label')).toBe('Pausar Cripta Rubra')
    expect(pausar('Salao Norte')?.getAttribute('aria-pressed')).toBe('false')
    act(() => botao?.click())
    expect(onTogglePause).toHaveBeenLastCalledWith('s-cripta', false)
  })

  it('mapa solto (sem cena) não tem "Pausar"', () => {
    render([{ id: '', name: 'Mapa solto', active: true, available: true, renamable: false, tokenCount: 0 }], new Set(), () => {})
    expect(pausar('Mapa solto')).toBeUndefined()
  })
})
