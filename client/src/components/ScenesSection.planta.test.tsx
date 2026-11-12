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

  /** A planta saiu da faixa do hover (ela cobria o nome): abre pelo "Mostrar a planta aos jogadores…" do menu "…" da cena. */
  function abrirPlanta(cena: string): void {
    clica(botao(`Mais ações de ${cena}`))
    clica(Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((item) => item.textContent === 'Mostrar a planta aos jogadores…'))
  }

  function caixa(rotulo: string): HTMLInputElement {
    const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.trim() === rotulo)
    const input = label?.querySelector('input') ?? (label?.htmlFor ? container.querySelector<HTMLInputElement>(`#${CSS.escape(label.htmlFor)}`) : null)
    if (!(input instanceof HTMLInputElement)) throw new Error(`sem caixa "${rotulo}"`)
    return input
  }

  it('o "Mostrar a planta aos jogadores…" do menu abre o painel da cena; a caixa mostra o estado e liga/desliga', () => {
    const onTogglePlanKnown = vi.fn()
    render({ onTogglePlanKnown })
    expect(container.textContent).not.toContain('Planta conhecida por todos')
    abrirPlanta('Abadia')
    const flag = caixa('Planta conhecida por todos')
    expect(flag.checked).toBe(true)
    clica(flag)
    expect(onTogglePlanKnown).toHaveBeenCalledWith('s-abadia', false)

    abrirPlanta('Capital')
    expect(caixa('Planta conhecida por todos').checked).toBe(false)
    clica(caixa('Planta conhecida por todos'))
    expect(onTogglePlanKnown).toHaveBeenLastCalledWith('s-capital', true)
  })

  it('Revelar planta para… cena vazia: sem ninguém marcado não revela; marcando Oto, revela só para ele', () => {
    const onRevealPlanFor = vi.fn(() => 1)
    render({ onTogglePlanKnown: () => {}, onRevealPlanFor, players: JOGADORES })
    abrirPlanta('Abadia')
    const revelar = botao('Revelar')
    expect(revelar?.disabled).toBe(true)
    expect(container.textContent).toContain('Marque ao menos um jogador')

    clica(caixa('Oto'))
    expect(revelar?.disabled).toBe(false)
    clica(revelar)
    expect(onRevealPlanFor).toHaveBeenCalledWith('s-abadia', ['p-oto'])
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Planta revelada para 1 jogador')
  })

  it('sem mesa online aberta a revelação some; mesa online sem jogador diz isso', () => {
    render({ onTogglePlanKnown: () => {} })
    abrirPlanta('Abadia')
    expect(container.textContent).not.toContain('Revelar planta para')

    render({ onTogglePlanKnown: () => {}, onRevealPlanFor: () => 0, players: [] })
    expect(container.textContent).toContain('Nenhum jogador na mesa online')
    expect(botao('Revelar')).toBeUndefined()
  })

  it('Esc dentro do painel fecha o painel', () => {
    render({ onTogglePlanKnown: () => {}, onRevealPlanFor: () => 1, players: JOGADORES })
    abrirPlanta('Abadia')
    const dentro = caixa('Oto')
    act(() => {
      dentro.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(container.textContent).not.toContain('Planta conhecida por todos')
  })

  it('mapa solto (sem aventura) não tem a planta', () => {
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
    expect(botao('Mais ações de Vale')).toBeUndefined()
    expect(botao('Planta de Vale')).toBeUndefined()
  })

  it('o aviso conta os jogadores e diz quando não deu', () => {
    expect(planRevealFeedbackText(2)).toBe('Planta revelada para 2 jogadores')
    expect(planRevealFeedbackText(1)).toBe('Planta revelada para 1 jogador')
    expect(planRevealFeedbackText(0)).toBe('Nenhum jogador recebeu: a cena ou os jogadores não estão mais na mesa online.')
    expect(planRevealFeedbackText(null)).toBe('Não deu para revelar: a mesa online não está aberta.')
  })
})
