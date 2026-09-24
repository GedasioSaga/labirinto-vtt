import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'
import type { PersonalNote } from './personalNotes'

const NOTAS: PersonalNote[] = [{ id: 'n1', mapId: 'vila', x: 420, y: 180, text: 'baú trancado aqui' }]

describe('PlayerPanel: Anotar e Minhas notas', () => {
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
    vi.unstubAllGlobals()
  })

  /** jsdom não tem matchMedia: o stub faz o papel da janela. Mesmo corte de player.css. */
  function janela(largura: 'notebook' | 'celular'): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: largura === 'celular' && query === '(max-width: 699px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  }

  interface Ganchos {
    noteArmed?: boolean
    onToggleNote?: () => void
    onFocusNote?: (id: string) => void
    onRemoveNote?: (id: string) => void
  }

  function render({ noteArmed = false, onToggleNote = () => {}, onFocusNote = () => {}, onRemoveNote = () => {} }: Ganchos = {}): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={[{ id: 't1', name: 'Fabi' }]}
          characterColor="#fff"
          settings={DEFAULT_PLAYER_SETTINGS}
          onSettingsChange={() => {}}
          onFocusToken={() => {}}
          signalArmed={false}
          onToggleSignal={() => {}}
          measureArmed={false}
          onToggleMeasure={() => {}}
          laserArmed={false}
          onToggleLaser={() => {}}
          onRenameToken={() => {}}
          onChangeTokenPhoto={async () => {}}
          notebook={[]}
          notebookUnread={false}
          onReadNotebook={() => {}}
          noteArmed={noteArmed}
          onToggleNote={onToggleNote}
          personalNotes={NOTAS}
          onFocusNote={onFocusNote}
          onRemoveNote={onRemoveNote}
        />,
      ),
    )
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === nome)
    if (!achado) throw new Error(`sem o botão ${nome}`)
    return achado
  }

  function aba(nome: RegExp): HTMLButtonElement {
    const achada = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => nome.test(b.textContent ?? ''))
    if (!achada) throw new Error(`aba ${nome} não existe`)
    return achada
  }

  it('"Anotar" é um modo de um toque, como o Sinalizar: aperta e pede o toque no mapa', () => {
    const onToggleNote = vi.fn()
    render({ onToggleNote })
    const anotar = botao('Anotar')
    expect(anotar.getAttribute('aria-pressed')).toBe('false')
    act(() => anotar.click())
    expect(onToggleNote).toHaveBeenCalledTimes(1)

    render({ noteArmed: true, onToggleNote })
    const ligado = botao('Toque onde anotar…')
    expect(ligado.getAttribute('aria-pressed')).toBe('true')
    expect(container.textContent).toContain('Só você vê')
  })

  it('no celular, ligar "Anotar" fecha a gaveta para o dedo cair no mapa', () => {
    janela('celular')
    render()
    act(() => botao('Painel').click())
    const painel = container.querySelector('aside.pp-panel')
    expect(painel?.hasAttribute('hidden')).toBe(false)
    act(() => botao('Anotar').click())
    expect(painel?.hasAttribute('hidden')).toBe(true)
  })

  it('Caderno > Minhas notas: lista as notas e tocar numa centraliza nela', () => {
    const onFocusNote = vi.fn()
    const onRemoveNote = vi.fn()
    render({ onFocusNote, onRemoveNote })
    act(() => aba(/Caderno/).click())
    const aberta = container.querySelector('[role="tabpanel"]:not([hidden])')
    expect(aberta?.textContent).toContain('Minhas notas')
    expect(aberta?.textContent).toContain('baú trancado aqui')
    const centrar = container.querySelector<HTMLButtonElement>('button[aria-label="Centralizar em baú trancado aqui"]')
    if (!centrar) throw new Error('sem o botão de centralizar')
    act(() => centrar.click())
    expect(onFocusNote).toHaveBeenCalledWith('n1')
    const apagar = container.querySelector<HTMLButtonElement>('button[aria-label="Apagar nota baú trancado aqui"]')
    if (!apagar) throw new Error('sem o botão de apagar')
    act(() => apagar.click())
    expect(onRemoveNote).toHaveBeenCalledWith('n1')
  })
})
