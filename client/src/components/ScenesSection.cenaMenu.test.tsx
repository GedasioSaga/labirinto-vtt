import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SceneDeletionInfo, SceneListItem } from '../stores/adventureStore'
import { ScenesSection, type ScenesSectionProps } from './ScenesSection'

const CENAS: SceneListItem[] = [
  { id: 's-cais', name: 'PC - Cais', active: true, available: true, renamable: true, tokenCount: 3 },
  { id: 's-casa', name: 'Casa genérica', active: false, available: true, renamable: true, tokenCount: 1 },
  { id: 's-9', name: 'Cena 9', active: false, available: true, renamable: true, tokenCount: 0 },
]

const INFO: Record<string, SceneDeletionInfo> = {
  's-cais': { orphanPins: 1, blockers: ['Ana', 'Bruno'] },
  's-casa': { orphanPins: 2, blockers: [] },
  's-9': { orphanPins: 0, blockers: [] },
}

describe('ScenesSection: menu "…" da cena (Duplicar, Subir, Descer, Apagar)', () => {
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

  function render(extra: Partial<ScenesSectionProps> = {}): void {
    act(() =>
      root.render(
        <ScenesSection
          scenes={CENAS}
          onSelect={() => {}}
          onCreate={() => {}}
          onRename={() => {}}
          onDuplicate={() => {}}
          onMove={() => {}}
          onDelete={() => {}}
          deletionInfo={(sceneId) => INFO[sceneId] ?? { orphanPins: 0, blockers: [] }}
          {...extra}
        />,
      ),
    )
  }

  function gatilho(cena: string): HTMLButtonElement {
    const alvo = container.querySelector<HTMLButtonElement>(`button[aria-label="Mais ações de ${cena}"]`)
    if (alvo === null) throw new Error(`sem menu para ${cena}`)
    return alvo
  }

  function abrir(cena: string): HTMLElement {
    act(() => gatilho(cena).click())
    const menu = container.querySelector<HTMLElement>('[role="menu"]')
    if (menu === null) throw new Error('menu não abriu')
    return menu
  }

  function item(menu: HTMLElement, nome: string): HTMLButtonElement {
    const alvo = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((b) => b.textContent === nome)
    if (alvo === undefined) throw new Error(`sem item ${nome}`)
    return alvo
  }

  /** Abre o "…" da cena e escolhe o item — dois `act` separados, para o menu renderizar antes do clique. */
  function escolher(cena: string, nome: string): void {
    const menu = abrir(cena)
    act(() => item(menu, nome).click())
  }

  function tecla(alvo: Element, key: string): void {
    act(() => {
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    })
  }

  function confirmacao(): HTMLElement | null {
    return container.querySelector<HTMLElement>('[role="alertdialog"]')
  }

  function botaoNa(scope: HTMLElement, nome: string): HTMLButtonElement {
    const alvo = Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === nome)
    if (alvo === undefined) throw new Error(`sem botão ${nome}`)
    return alvo
  }

  it('sem os callbacks (mapa solto) não há menu "…"', () => {
    act(() => root.render(<ScenesSection scenes={CENAS} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} />))
    expect(container.querySelector('button[aria-label^="Mais ações de"]')).toBeNull()
  })

  it('o menu tem os quatro itens, com foco no primeiro; Subir fica esmaecido na primeira cena', () => {
    render()
    const menu = abrir('PC - Cais')
    expect(gatilho('PC - Cais').getAttribute('aria-expanded')).toBe('true')
    expect(Array.from(menu.querySelectorAll('[role="menuitem"]')).map((b) => b.textContent)).toEqual(['Duplicar', 'Subir', 'Descer', 'Apagar cena…'])
    expect(document.activeElement).toBe(item(menu, 'Duplicar'))
    expect(item(menu, 'Subir').getAttribute('aria-disabled')).toBe('true')
    expect(item(menu, 'Descer').getAttribute('aria-disabled')).toBeNull()
  })

  it('Duplicar chama onDuplicate com a cena da linha e fecha o menu', () => {
    const onDuplicate = vi.fn()
    render({ onDuplicate })
    const menu = abrir('Casa genérica')
    act(() => item(menu, 'Duplicar').click())
    expect(onDuplicate).toHaveBeenCalledWith('s-casa')
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })

  it('Subir move a cena uma posição para cima; Descer, para baixo', () => {
    const onMove = vi.fn()
    render({ onMove })
    escolher('Casa genérica', 'Subir')
    expect(onMove).toHaveBeenLastCalledWith('s-casa', -1)
    escolher('Casa genérica', 'Descer')
    expect(onMove).toHaveBeenLastCalledWith('s-casa', 1)
    expect(onMove).toHaveBeenCalledTimes(2)
  })

  it('item esmaecido não age: Descer na última cena não chama onMove', () => {
    const onMove = vi.fn()
    render({ onMove })
    const menu = abrir('Cena 9')
    expect(item(menu, 'Descer').getAttribute('aria-disabled')).toBe('true')
    act(() => item(menu, 'Descer').click())
    expect(onMove).not.toHaveBeenCalled()
  })

  it('setas pulam o item esmaecido e Esc fecha devolvendo o foco ao "…"', () => {
    render()
    const menu = abrir('PC - Cais')
    tecla(menu, 'ArrowDown')
    // "Subir" está esmaecido na primeira cena: a seta vai direto a "Descer".
    expect(document.activeElement).toBe(item(menu, 'Descer'))
    tecla(menu, 'ArrowDown')
    expect(document.activeElement).toBe(item(menu, 'Apagar cena…'))
    tecla(menu, 'ArrowDown')
    expect(document.activeElement).toBe(item(menu, 'Duplicar'))
    tecla(menu, 'ArrowUp')
    expect(document.activeElement).toBe(item(menu, 'Apagar cena…'))
    tecla(menu, 'Escape')
    expect(container.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(gatilho('PC - Cais'))
  })

  it('"Apagar cena…" pede confirmação com os pinos que ficam soltos, foco em Cancelar; Apagar chama onDelete', () => {
    const onDelete = vi.fn()
    render({ onDelete })
    escolher('Casa genérica', 'Apagar cena…')
    const caixa = confirmacao()
    if (caixa === null) throw new Error('confirmação não abriu')
    expect(caixa.textContent).toContain('Apagar Casa genérica?')
    expect(caixa.textContent).toContain('2 pinos de viagem de outras cenas vão ficar sem destino')
    expect(document.activeElement).toBe(botaoNa(caixa, 'Cancelar'))
    expect(onDelete).not.toHaveBeenCalled()
    act(() => botaoNa(caixa, 'Apagar').click())
    expect(onDelete).toHaveBeenCalledWith('s-casa')
    expect(confirmacao()).toBeNull()
  })

  it('"Cena 9" sem pino apontando diz que nada fica solto, e Esc cancela sem apagar', () => {
    const onDelete = vi.fn()
    render({ onDelete })
    escolher('Cena 9', 'Apagar cena…')
    const caixa = confirmacao()
    if (caixa === null) throw new Error('confirmação não abriu')
    expect(caixa.textContent).toContain('Nenhum pino de outra cena leva para cá.')
    tecla(caixa, 'Escape')
    expect(confirmacao()).toBeNull()
    expect(onDelete).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(gatilho('Cena 9'))
  })

  it('"PC - Cais" com o grupo mostra os nomes e Apagar desligado', () => {
    const onDelete = vi.fn()
    render({ onDelete })
    escolher('PC - Cais', 'Apagar cena…')
    const caixa = confirmacao()
    if (caixa === null) throw new Error('confirmação não abriu')
    expect(caixa.textContent).toContain('Não dá para apagar: Ana e Bruno estão nesta cena.')
    const apagar = botaoNa(caixa, 'Apagar')
    expect(apagar.disabled).toBe(true)
    act(() => apagar.click())
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('com uma cena só, "Apagar cena…" fica esmaecido', () => {
    render({ scenes: [CENAS[0]] })
    const menu = abrir('PC - Cais')
    expect(item(menu, 'Apagar cena…').getAttribute('aria-disabled')).toBe('true')
    act(() => item(menu, 'Apagar cena…').click())
    expect(confirmacao()).toBeNull()
  })
})
