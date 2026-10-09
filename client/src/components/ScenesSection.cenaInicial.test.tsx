/**
 * CENA INICIAL na lista Cenas: o "…" da cena oferece "Definir como cena
 * inicial", e a cena inicial tem uma marca pequena — à vista também quando é
 * a cena aberta.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SceneListItem } from '../stores/adventureStore'
import { ScenesSection } from './ScenesSection'

const CENAS: SceneListItem[] = [
  { id: 's-sub', name: 'Subterrâneo', active: true, available: true, renamable: true, tokenCount: 2, start: true },
  { id: 's-goa', name: 'Reino de Goa', active: false, available: true, renamable: true, tokenCount: 0 },
]

describe('ScenesSection: cena inicial', () => {
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

  function render(onSetStart: (sceneId: string) => void): void {
    act(() => root.render(<ScenesSection scenes={CENAS} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} onSetStart={onSetStart} />))
  }

  function itensDoMenu(cena: string): HTMLButtonElement[] {
    const gatilho = container.querySelector<HTMLButtonElement>(`button[aria-label="Mais ações de ${cena}"]`)
    if (gatilho === null) throw new Error(`sem menu para ${cena}`)
    act(() => gatilho.click())
    const menu = container.querySelector<HTMLElement>('[role="menu"]')
    if (menu === null) throw new Error('menu não abriu')
    return Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
  }

  it('a cena inicial tem a marca, a aberta inclusive; as outras não', () => {
    render(() => {})
    const marcas = Array.from(container.querySelectorAll('[aria-label="Cena inicial"]'))
    expect(marcas).toHaveLength(1)
    expect(marcas[0].closest('li')?.textContent).toContain('Subterrâneo')
  })

  it('"Definir como cena inicial" chama com a cena da linha e fecha o menu', () => {
    const onSetStart = vi.fn()
    render(onSetStart)
    const item = itensDoMenu('Reino de Goa').find((botao) => botao.textContent === 'Definir como cena inicial')
    if (item === undefined) throw new Error('sem o item')
    act(() => item.click())
    expect(onSetStart).toHaveBeenCalledWith('s-goa')
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })

  it('na cena que já é a inicial o item diz isso e fica esmaecido', () => {
    const onSetStart = vi.fn()
    render(onSetStart)
    const item = itensDoMenu('Subterrâneo').find((botao) => botao.textContent === 'É a cena inicial')
    if (item === undefined) throw new Error('sem o item')
    expect(item.getAttribute('aria-disabled')).toBe('true')
    act(() => item.click())
    expect(onSetStart).not.toHaveBeenCalled()
  })
})
