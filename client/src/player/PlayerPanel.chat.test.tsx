import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatChannel } from '../lib/chat'
import type { ChatUnread } from './playerConnection'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel, type PlayerPanelChat } from './PlayerPanel'

/**
 * CHAT dos jogadores no painel (docs/plano-chat.md, fatia A): a aba "Chat"
 * entra por último, só quando o mestre já mandou o histórico, e a menção a
 * mim acende o ponto na aba e no botão Painel.
 */

describe('PlayerPanel: aba Chat', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  function chat(unread: ChatUnread | undefined, onRead: (channel: ChatChannel) => void = () => {}): PlayerPanelChat {
    return { log: { cena: [], global: [] }, unread, status: undefined, selfName: 'Ana', onSend: () => true, onRead }
  }

  function render(chatProp: PlayerPanelChat | undefined): void {
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
          laserArmed={false}
          onToggleLaser={() => {}}
          onRenameToken={() => {}}
          onChangeTokenPhoto={async () => {}}
          notebook={[]}
          notebookUnread={false}
          onReadNotebook={() => {}}
          chat={chatProp}
        />,
      ),
    )
  }

  function abas(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  }

  function aba(nome: RegExp): HTMLButtonElement {
    const achada = abas().find((b) => nome.test(b.textContent ?? ''))
    if (!achada) throw new Error(`aba ${nome} não existe`)
    return achada
  }

  function botaoPainel(): HTMLButtonElement {
    const achado = container.querySelector<HTMLButtonElement>('button.pp-toggle')
    if (!achado) throw new Error('sem o botão Painel')
    return achado
  }

  it('antes do welcome não há aba Chat; depois, ela vem por último e o End chega nela', () => {
    render(undefined)
    expect(abas().map((b) => b.textContent)).toEqual(['Jogo', 'Caderno', 'Lugares'])

    render(chat(undefined))
    expect(abas().map((b) => b.textContent)).toEqual(['Jogo', 'Caderno', 'Lugares', 'Chat'])
    const chatTab = aba(/Chat/)
    const painel = document.getElementById(chatTab.getAttribute('aria-controls') ?? '')
    expect(painel?.getAttribute('role')).toBe('tabpanel')
    expect(painel?.hidden).toBe(true)
    act(() => {
      aba(/Jogo/).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    })
    expect(document.activeElement).toBe(chatTab)
    expect(painel?.hidden).toBe(false)
  })

  it('menção nova acende o ponto na aba Chat e no botão Painel; sem menção, nenhum ponto', () => {
    render(chat({ cena: [], global: [] }))
    expect(aba(/Chat/).querySelector('.pp-unread')).toBeNull()
    expect(botaoPainel().querySelector('.pp-unread')).toBeNull()

    render(chat({ cena: ['c1'], global: [] }))
    expect(aba(/Chat/).querySelector('.pp-unread')?.textContent).toBe(' (menção nova no chat)')
    expect(botaoPainel().querySelector('.pp-unread')).not.toBeNull()
  })

  it('abrir a aba Chat com a menção à vista marca como lida', () => {
    const lidos: ChatChannel[] = []
    render(chat({ cena: ['c1'], global: [] }, (channel) => lidos.push(channel)))
    expect(lidos).toEqual([])
    act(() => aba(/Chat/).click())
    expect(lidos).toEqual(['cena'])
  })
})
