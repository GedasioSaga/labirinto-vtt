import { act, createRef, type RefObject } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel, type PlayerCharacter } from './PlayerPanel'

const FABIO: PlayerCharacter = { id: 'tok-fabio', name: 'Capa azul' }
/** O mesmo corte de player.css: abaixo de 700 px o painel vira gaveta. */
const CELULAR = '(max-width: 699px)'

describe('PlayerPanel: painel que recolhe em qualquer largura e "Minha ficha" sempre à mão', () => {
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

  /** jsdom não tem matchMedia: o stub faz o papel da janela (larga ou de celular). */
  function janela(largura: 'notebook' | 'celular'): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: largura === 'celular' && query === CELULAR,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  }

  interface Opcoes {
    characters?: PlayerCharacter[]
    onFocusToken?: (tokenId: string) => void
    onToggleSignal?: () => void
    onToggleMeasure?: () => void
    panelRef?: RefObject<HTMLElement | null>
    barRef?: RefObject<HTMLDivElement | null>
  }

  function render(opcoes: Opcoes = {}): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={opcoes.characters ?? [FABIO]}
          characterColor="#3b82f6"
          settings={DEFAULT_PLAYER_SETTINGS}
          onSettingsChange={() => {}}
          onFocusToken={opcoes.onFocusToken ?? (() => {})}
          signalArmed={false}
          onToggleSignal={opcoes.onToggleSignal ?? (() => {})}
          measureArmed={false}
          onToggleMeasure={opcoes.onToggleMeasure ?? (() => {})}
          onRenameToken={() => {}}
          onChangeTokenPhoto={async () => {}}
          panelRef={opcoes.panelRef}
          barRef={opcoes.barRef}
        />,
      ),
    )
  }

  /** Nome acessível do botão: o aria-label quando há, senão o texto (os ícones são aria-hidden). */
  function nome(el: Element): string {
    return (el.getAttribute('aria-label') ?? el.textContent ?? '').trim()
  }

  function botao(nomeAcessivel: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((b) => nome(b) === nomeAcessivel)
  }

  function painel(): HTMLElement {
    const aside = container.querySelector<HTMLElement>('aside[aria-label="Painel do jogador"]')
    if (!aside) throw new Error('sem o painel do jogador')
    return aside
  }

  /** Recolhido = fora da árvore de acessibilidade e da tela (o atributo hidden). */
  function aberto(): boolean {
    return !painel().hidden
  }

  function clicar(el: HTMLElement | undefined): void {
    if (!el) throw new Error('botão não encontrado')
    act(() => el.click())
  }

  function escape(alvo: EventTarget = document.body): void {
    act(() => {
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
  }

  it('no notebook o painel começa aberto, "Fechar painel" recolhe e "Painel" abre de novo', () => {
    janela('notebook')
    render()
    expect(aberto()).toBe(true)

    const alternar = botao('Fechar painel')
    expect(alternar, 'no notebook deveria haver o botão "Fechar painel"').toBeDefined()
    expect(alternar?.getAttribute('aria-expanded')).toBe('true')
    expect(alternar?.getAttribute('aria-controls')).toBe(painel().id)

    clicar(alternar)
    expect(aberto()).toBe(false)
    const abrir = botao('Painel')
    expect(abrir).toBe(alternar)
    expect(abrir?.getAttribute('aria-expanded')).toBe('false')

    clicar(abrir)
    expect(aberto()).toBe(true)
  })

  it('o botão do painel fica FORA do painel: recolhido, ele continua na tela para trazê-lo de volta', () => {
    janela('notebook')
    render()
    const alternar = botao('Fechar painel')
    clicar(alternar)
    expect(painel().contains(alternar ?? null)).toBe(false)
    expect(alternar?.closest('[hidden]')).toBeNull()
  })

  it('"Minha ficha" fica fora do painel, continua com ele recolhido e pede a câmera na própria ficha', () => {
    janela('notebook')
    const onFocusToken = vi.fn()
    render({ onFocusToken })
    const minhaFicha = botao('Minha ficha')
    expect(minhaFicha, 'deveria haver um botão "Minha ficha" sem abrir painel nenhum').toBeDefined()
    expect(painel().contains(minhaFicha ?? null)).toBe(false)

    clicar(botao('Fechar painel'))
    expect(botao('Minha ficha')?.closest('[hidden]')).toBeNull()
    clicar(botao('Minha ficha'))
    expect(onFocusToken).toHaveBeenCalledWith(FABIO.id)
  })

  it('sem personagem no mapa não há "Minha ficha": não existe ficha para achar', () => {
    janela('notebook')
    render({ characters: [] })
    expect(botao('Minha ficha')).toBeUndefined()
  })

  it('no notebook, centralizar, Sinalizar e Medir não recolhem o painel (ele não cobre o mapa inteiro)', () => {
    janela('notebook')
    const onFocusToken = vi.fn()
    render({ onFocusToken })
    clicar(botao('Centralizar no meu personagem'))
    clicar(botao(`Centralizar em ${FABIO.name}`))
    clicar(botao('Minha ficha'))
    clicar(botao('Sinalizar'))
    clicar(botao('Medir'))
    expect(onFocusToken).toHaveBeenCalledTimes(3)
    expect(aberto()).toBe(true)
  })

  it('no notebook, Escape não recolhe o painel: ele é da régua e dos cartões', () => {
    janela('notebook')
    render()
    escape()
    expect(aberto()).toBe(true)
  })

  it('no celular o painel começa recolhido; "Painel" abre, e Escape fecha devolvendo o foco ao botão', () => {
    janela('celular')
    render()
    expect(aberto()).toBe(false)
    const alternar = botao('Painel')
    expect(alternar?.getAttribute('aria-expanded')).toBe('false')

    clicar(alternar)
    expect(aberto()).toBe(true)
    expect(nome(alternar as HTMLButtonElement)).toBe('Fechar painel')

    const dentro = botao('Centralizar no meu personagem')
    act(() => dentro?.focus())
    escape(dentro)
    expect(aberto()).toBe(false)
    expect(document.activeElement).toBe(alternar)
  })

  it('no celular, "Centralizar em" e "Minha ficha" fecham a gaveta para mostrar o mapa', () => {
    janela('celular')
    const onFocusToken = vi.fn()
    render({ onFocusToken })
    clicar(botao('Painel'))
    clicar(botao(`Centralizar em ${FABIO.name}`))
    expect(aberto()).toBe(false)

    clicar(botao('Painel'))
    clicar(botao('Minha ficha'))
    expect(aberto()).toBe(false)
    expect(onFocusToken).toHaveBeenCalledTimes(2)
  })

  it('o painel e a barra chegam por ref, para a câmera saber o que cobre o mapa', () => {
    janela('notebook')
    const panelRef = createRef<HTMLElement>()
    const barRef = createRef<HTMLDivElement>()
    render({ panelRef, barRef })
    expect(panelRef.current).toBe(painel())
    expect(barRef.current?.contains(botao('Fechar painel') ?? null)).toBe(true)
    expect(barRef.current?.contains(botao('Minha ficha') ?? null)).toBe(true)
  })
})
