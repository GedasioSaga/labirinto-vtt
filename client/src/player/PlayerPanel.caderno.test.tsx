import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteEntry } from '../net/protocol'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'

const AS_20_30 = new Date(2026, 8, 22, 20, 30).getTime()
const AS_21_05 = new Date(2026, 8, 22, 21, 5).getTime()

describe('PlayerPanel: aba Caderno', () => {
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

  function render(notebook: NoteEntry[], notebookUnread = false, onReadNotebook: () => void = () => {}): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={[{ id: 't1', name: 'Fábio' }]}
          characterColor="#fff"
          settings={DEFAULT_PLAYER_SETTINGS}
          onSettingsChange={() => {}}
          onFocusToken={() => {}}
          signalArmed={false}
          onToggleSignal={() => {}}
          measureArmed={false}
          onToggleMeasure={() => {}}
          onRenameToken={() => {}}
          onChangeTokenPhoto={async () => {}}
          notebook={notebook}
          notebookUnread={notebookUnread}
          onReadNotebook={onReadNotebook}
        />,
      ),
    )
  }

  function aba(nome: RegExp): HTMLButtonElement {
    const achada = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => nome.test(b.textContent ?? ''))
    if (!achada) throw new Error(`aba ${nome} não existe`)
    return achada
  }

  function tecla(alvo: HTMLElement, key: string): void {
    act(() => {
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    })
  }

  it('Caderno mostra "20:30 · Mestre: o baú tem fundo falso", o mais novo em cima', () => {
    render([
      { id: 'n1', text: 'o baú tem fundo falso', at: AS_20_30 },
      { id: 'n2', text: 'a guarda troca à meia-noite', at: AS_21_05 },
    ])
    act(() => aba(/Caderno/).click())
    const itens = Array.from(container.querySelectorAll('[role="tabpanel"]:not([hidden]) li')).map((li) => li.textContent)
    expect(itens).toEqual(['21:05 · Mestre: a guarda troca à meia-noite', '20:30 · Mestre: o baú tem fundo falso'])
  })

  it('a aba de jogo é a padrão: o painel abre como sempre abriu', () => {
    render([{ id: 'n1', text: 'o baú tem fundo falso', at: AS_20_30 }])
    expect(aba(/Jogo/).getAttribute('aria-selected')).toBe('true')
    expect(container.textContent).toContain('Meus personagens')
    expect(container.textContent).not.toContain('o baú tem fundo falso')
  })

  it('caderno vazio diz o que vai aparecer ali', () => {
    render([])
    act(() => aba(/Caderno/).click())
    expect(container.querySelector('[role="tabpanel"]:not([hidden])')?.textContent).toMatch(/Nenhum recado ainda/)
  })

  it('recado com HTML aparece como texto', () => {
    render([{ id: 'n1', text: '<b>x</b>', at: AS_20_30 }])
    act(() => aba(/Caderno/).click())
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<b>x</b>')
  })

  it('recado novo acende o ponto no botão Painel e na aba; abrir o Caderno avisa que leu', () => {
    const onRead = vi.fn()
    render([{ id: 'n1', text: 'oi', at: AS_20_30 }], true, onRead)
    const painel = Array.from(container.querySelectorAll('button')).find((b) => b.classList.contains('pp-toggle'))
    expect(painel?.querySelector('.pp-unread')).not.toBeNull()
    expect(aba(/Caderno/).querySelector('.pp-unread')).not.toBeNull()
    expect(onRead).not.toHaveBeenCalled()
    act(() => aba(/Caderno/).click())
    expect(onRead).toHaveBeenCalled()
  })

  it('sem recado novo, nenhum ponto', () => {
    render([{ id: 'n1', text: 'oi', at: AS_20_30 }], false)
    expect(container.querySelector('.pp-unread')).toBeNull()
  })

  it('com o Caderno aberto, recado que chega já conta como lido', () => {
    const onRead = vi.fn()
    render([], false, onRead)
    act(() => aba(/Caderno/).click())
    onRead.mockClear()
    render([{ id: 'n1', text: 'oi', at: AS_20_30 }], true, onRead)
    expect(onRead).toHaveBeenCalled()
  })

  it('setas trocam de aba e só a aba ativa entra no Tab', () => {
    render([])
    const jogo = aba(/Jogo/)
    act(() => jogo.focus())
    tecla(jogo, 'ArrowRight')
    expect(aba(/Caderno/).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(aba(/Caderno/))
    expect(aba(/Jogo/).tabIndex).toBe(-1)
    expect(aba(/Caderno/).tabIndex).toBe(0)
    tecla(aba(/Caderno/), 'Home')
    expect(aba(/Jogo/).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(aba(/Jogo/))
  })
})
