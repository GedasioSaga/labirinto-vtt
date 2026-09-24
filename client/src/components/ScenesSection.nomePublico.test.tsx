/**
 * NOME PARA OS JOGADORES na lista de cenas do mestre: o renomear ganha um
 * segundo campo, opcional, e a linha da cena diz o que os jogadores leem.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SceneListItem } from '../stores/adventureStore'
import { ScenesSection } from './ScenesSection'

const CENAS: SceneListItem[] = [
  { id: 's-t', name: 'Terreo do cofre', publicName: 'Térreo', active: true, available: true, renamable: true, tokenCount: 1 },
  { id: 's-p', name: 'Porao do culto', active: false, available: true, renamable: true, tokenCount: 0 },
]

describe('ScenesSection: nome para os jogadores', () => {
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

  function render(onRename: (sceneId: string, name: string, publicName: string) => void): void {
    act(() => root.render(<ScenesSection scenes={CENAS} onSelect={() => {}} onCreate={() => {}} onRename={onRename} />))
  }

  function campoPorRotulo(rotulo: string): HTMLInputElement {
    const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent === rotulo)
    const alvo = label === undefined ? null : document.getElementById(label.htmlFor)
    if (!(alvo instanceof HTMLInputElement)) throw new Error(`campo "${rotulo}" não achado`)
    return alvo
  }

  function digita(alvo: HTMLInputElement, texto: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(alvo, texto)
      alvo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('a linha da cena diz o nome que os jogadores leem; sem nome público, não diz nada', () => {
    render(() => {})
    const itens = Array.from(container.querySelectorAll('li'))
    expect(itens[0]?.textContent).toContain('Jogadores leem: Térreo')
    expect(itens[1]?.textContent).not.toContain('Jogadores leem')
  })

  it('renomear abre com o nome público atual e devolve os dois nomes', () => {
    const onRename = vi.fn()
    render(onRename)
    const lapis = container.querySelector<HTMLButtonElement>('button[aria-label="Renomear Terreo do cofre"]')
    act(() => lapis?.click())

    const publico = campoPorRotulo('Nome para os jogadores (opcional)')
    expect(publico.value).toBe('Térreo')
    digita(publico, '1º andar')
    const form = container.querySelector('form')
    act(() => form?.requestSubmit())
    expect(onRename).toHaveBeenCalledTimes(1)
    expect(onRename).toHaveBeenCalledWith('s-t', 'Terreo do cofre', '1º andar')
  })

  it('criar cena não pede nome público (é só o renomear que edita)', () => {
    render(() => {})
    const criar = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === '+ Nova cena')
    act(() => criar?.click())
    expect(container.querySelectorAll('form input')).toHaveLength(1)
    expect(container.textContent).not.toContain('Nome para os jogadores')
  })
})
