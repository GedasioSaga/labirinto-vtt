/**
 * Planta por cena, na lista Cenas: "Planta conhecida por todos" (grava na
 * aventura) e "Revelar planta para…" (escolhe os jogadores, vale mesmo em
 * cena vazia). O botão é um glifo, como o ✉ do recado.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SceneListItem } from '../stores/adventureStore'
import { ScenesSection, planRevealFeedbackText, type ScenesSectionProps } from './ScenesSection'

const CENAS: SceneListItem[] = [
  { id: 's-capital', name: 'Capital', active: true, available: true, renamable: true, tokenCount: 3 },
  { id: 's-abadia', name: 'Abadia', active: false, available: true, renamable: true, tokenCount: 0, planKnownByAll: true },
]

const JOGADORES = [
  { playerId: 'p-oto', name: 'Oto' },
  { playerId: 'p-eva', name: 'Eva' },
]

describe('ScenesSection: planta por cena', () => {
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

  function render(extra: Partial<ScenesSectionProps>): void {
    act(() => root.render(<ScenesSection scenes={CENAS} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} {...extra} />))
  }

  function botao(nome: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === nome)
  }

  function clica(el: HTMLElement | null | undefined): void {
    if (el === null || el === undefined) throw new Error('elemento não existe')
    act(() => el.click())
  }

  function caixa(rotulo: string): HTMLInputElement {
    const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.trim() === rotulo)
    const input = label?.querySelector('input') ?? (label?.htmlFor ? container.querySelector<HTMLInputElement>(`#${CSS.escape(label.htmlFor)}`) : null)
    if (!(input instanceof HTMLInputElement)) throw new Error(`sem caixa "${rotulo}"`)
    return input
  }

  it('o botão de planta abre o painel da cena; a caixa mostra o estado e liga/desliga', () => {
    const onTogglePlanKnown = vi.fn()
    render({ onTogglePlanKnown })
    const abrir = botao('Planta de Abadia')
    expect(abrir?.getAttribute('aria-expanded')).toBe('false')
    clica(abrir)
    expect(abrir?.getAttribute('aria-expanded')).toBe('true')
    const flag = caixa('Planta conhecida por todos')
    expect(flag.checked).toBe(true)
    clica(flag)
    expect(onTogglePlanKnown).toHaveBeenCalledWith('s-abadia', false)

    clica(botao('Planta de Capital'))
    expect(caixa('Planta conhecida por todos').checked).toBe(false)
    clica(caixa('Planta conhecida por todos'))
    expect(onTogglePlanKnown).toHaveBeenLastCalledWith('s-capital', true)
  })

  it('Revelar planta para… cena vazia: sem ninguém marcado não revela; marcando Oto, revela só para ele', () => {
    const onRevealPlanFor = vi.fn(() => 1)
    render({ onTogglePlanKnown: () => {}, onRevealPlanFor, players: JOGADORES })
    clica(botao('Planta de Abadia'))
    const revelar = botao('Revelar')
    expect(revelar?.disabled).toBe(true)
    expect(container.textContent).toContain('Marque ao menos um jogador')

    clica(caixa('Oto'))
    expect(revelar?.disabled).toBe(false)
    clica(revelar)
    expect(onRevealPlanFor).toHaveBeenCalledWith('s-abadia', ['p-oto'])
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Planta revelada para 1 jogador')
  })

  it('sem sala aberta a revelação some; sala sem jogador diz isso', () => {
    render({ onTogglePlanKnown: () => {} })
    clica(botao('Planta de Abadia'))
    expect(container.textContent).not.toContain('Revelar planta para')

    render({ onTogglePlanKnown: () => {}, onRevealPlanFor: () => 0, players: [] })
    expect(container.textContent).toContain('Nenhum jogador na sala')
    expect(botao('Revelar')).toBeUndefined()
  })

  it('Esc dentro do painel fecha o painel', () => {
    render({ onTogglePlanKnown: () => {}, onRevealPlanFor: () => 1, players: JOGADORES })
    const abrir = botao('Planta de Abadia')
    abrir?.focus()
    clica(abrir)
    const dentro = caixa('Oto')
    act(() => {
      dentro.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(abrir?.getAttribute('aria-expanded')).toBe('false')
    expect(container.textContent).not.toContain('Planta conhecida por todos')
  })

  it('mapa solto (sem aventura) não tem o botão', () => {
    act(() =>
      root.render(
        <ScenesSection
          scenes={[{ id: '', name: 'Vale', active: true, available: true, renamable: false, tokenCount: 0 }]}
          onSelect={() => {}}
          onCreate={() => {}}
          onRename={() => {}}
          onTogglePlanKnown={() => {}}
        />,
      ),
    )
    expect(botao('Planta de Vale')).toBeUndefined()
  })

  it('o aviso conta os jogadores e diz quando não deu', () => {
    expect(planRevealFeedbackText(2)).toBe('Planta revelada para 2 jogadores')
    expect(planRevealFeedbackText(1)).toBe('Planta revelada para 1 jogador')
    expect(planRevealFeedbackText(0)).toBe('Nenhum jogador recebeu: a cena ou os jogadores não estão mais na sala.')
    expect(planRevealFeedbackText(null)).toBe('Não deu para revelar: a sala não está aberta.')
  })
})
