/**
 * HOJE NA SESSÃO na tela (lista de cenas, ideia 3): "Fixar no topo" no menu da
 * cena põe a linha no bloco do topo, o alfinete tira, e a sexta é recusada com
 * o aviso na própria linha — a lista do topo fica como estava.
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AVISO_FIXADAS_CHEIAS, alternarFixada } from '../lib/cenasFixadas'
import type { SceneListItem } from '../stores/adventureStore'
import { ScenesSection } from './ScenesSection'

const CENAS: SceneListItem[] = ['Vila', 'Praça', 'Forja', 'Taverna', 'Adega', 'Bosque', 'Mina'].map((name, i) => ({
  id: `s${i + 1}`,
  name,
  active: i === 0,
  available: true,
  renamable: true,
  tokenCount: 0,
}))

/** A store de mentira: as mesmas contas de `alternarFixada` que a store usa. */
function Mesa({ inicial }: { inicial: string[] }) {
  const [fixadas, setFixadas] = useState(inicial)
  return (
    <ScenesSection
      scenes={CENAS}
      pinned={fixadas}
      onTogglePin={(sceneId) => {
        const r = alternarFixada(fixadas, sceneId)
        if (r.cheia) return 'cheia'
        setFixadas(r.fixadas)
        return r.fixadas.length > fixadas.length ? 'fixou' : 'tirou'
      }}
      onSelect={() => {}}
      onCreate={() => {}}
      onRename={() => {}}
    />
  )
}

describe('ScenesSection: Hoje na sessão', () => {
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

  const fixadasNaTela = () =>
    Array.from(container.querySelectorAll<HTMLElement>('[aria-label="Cenas fixadas"] button.lb-cenas__nome')).map((b) => b.textContent)

  function escolher(cena: string, nome: string): void {
    const gatilho = container.querySelector<HTMLButtonElement>(`button[aria-label="Mais ações de ${cena}"]`)
    if (gatilho === null) throw new Error(`sem menu para ${cena}`)
    act(() => gatilho.click())
    const item = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menu"]:not([inert]) [role="menuitem"]')).find((b) => b.textContent === nome)
    if (item === undefined) throw new Error(`sem item ${nome}`)
    act(() => item.click())
  }

  const vazio = () => container.querySelector('[role="region"][aria-label="Hoje na sessão"] .lb-cenas__vazio')?.textContent ?? null

  it('Fixar no topo põe a cena no bloco, na ordem; o alfinete tira, e sem fixadas o bloco ensina como fixar', () => {
    act(() => root.render(<Mesa inicial={[]} />))
    expect(vazio()).toContain('Fixe uma cena')
    escolher('Bosque', 'Fixar no topo')
    escolher('Forja', 'Fixar no topo')
    expect(fixadasNaTela()).toEqual(['Bosque', 'Forja'])
    // O mesmo item, na fixada, vira "Tirar do topo".
    escolher('Bosque', 'Tirar do topo')
    expect(fixadasNaTela()).toEqual(['Forja'])
    const alfinete = container.querySelector<HTMLButtonElement>('button[aria-label="Tirar Forja do topo"]')
    if (alfinete === null) throw new Error('sem o alfinete')
    act(() => alfinete.click())
    expect(fixadasNaTela()).toEqual([])
    expect(vazio()).toContain('Fixe uma cena')
  })

  it('sem fixadas, o bloco é uma linha só e discreta; o título ensina o resto', () => {
    act(() => root.render(<Mesa inicial={[]} />))
    const vazia = container.querySelector<HTMLElement>('[role="region"][aria-label="Hoje na sessão"] .lb-cenas__vazio')
    expect(vazia?.textContent).toBe('Fixe uma cena pelo menu “…” dela.')
    expect(vazia?.title).toContain('Fixar no topo')
  })

  it('botão direito numa fixada abre o menu da cena, no lugar do menu do navegador', () => {
    act(() => root.render(<Mesa inicial={['s5']} />))
    const fixada = container.querySelector<HTMLElement>('[aria-label="Cenas fixadas"] li[data-cena-fixada="s5"]')
    if (fixada === null) throw new Error('sem a fixada')
    const evento = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 12 })
    act(() => {
      fixada.querySelector('.lb-cenas__nome')?.dispatchEvent(evento)
    })
    expect(evento.defaultPrevented, 'o menu do navegador não abre').toBe(true)
    const menu = container.querySelector<HTMLElement>('[role="menu"]:not([inert])')
    expect(menu?.getAttribute('aria-label')).toBe('Ações de Adega')
    expect(Array.from(menu?.querySelectorAll('[role="menuitem"]') ?? []).map((b) => b.textContent)).toContain('Tirar do topo')
    // Esc fecha e devolve o foco à fixada, de onde o menu saiu.
    act(() => {
      menu?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.activeElement).toBe(fixada.querySelector('.lb-cenas__nome'))
  })

  it('a sexta não entra: a linha dela diz por quê e o bloco fica com as cinco', () => {
    act(() => root.render(<Mesa inicial={['s1', 's2', 's3', 's4', 's5']} />))
    escolher('Bosque', 'Fixar no topo')
    expect(fixadasNaTela()).toEqual(['Vila', 'Praça', 'Forja', 'Taverna', 'Adega'])
    const linha = container.querySelector('ul[aria-label="Cenas da aventura"] > li[data-cena-id="s6"]')
    expect(linha?.querySelector('[role="status"]')?.textContent).toBe(AVISO_FIXADAS_CHEIAS)
  })
})
