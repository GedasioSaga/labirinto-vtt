import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel, type PlayerCharacter } from './PlayerPanel'

/**
 * "MINHA FICHA", "CENTRALIZAR EM…" e "CENTRALIZAR NO MEU PERSONAGEM" dizem à
 * câmera COMO ir até a ficha: o toque do dedo ou o clique do mouse (`detail` 1
 * ou mais) pede o deslize (`animate` = true); Enter e Espaço sintetizam o
 * clique com `detail` 0 e fazem o pedido de sempre, só com a ficha — a câmera
 * salta, porque ação de teclado não espera animação. O mesmo padrão dos botões
 * de zoom (`PlayerZoomControls`) e do Inventário.
 */

const FABIO: PlayerCharacter = { id: 'tok-fabio', name: 'Capa azul' }

describe('PlayerPanel — centralizar pelo toque desliza, pelo teclado salta', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    // jsdom não tem matchMedia: a janela larga do notebook, onde o painel nasce aberto.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  function render(onFocusToken: (tokenId: string, animate?: boolean) => void): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={[FABIO]}
          characterColor="#3b82f6"
          settings={DEFAULT_PLAYER_SETTINGS}
          onSettingsChange={() => {}}
          onFocusToken={onFocusToken}
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
        />,
      ),
    )
  }

  /** Nome acessível do botão: o aria-label quando há, senão o texto (os ícones são aria-hidden). */
  function botao(nomeAcessivel: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === nomeAcessivel)
    if (!achado) throw new Error(`sem o botão "${nomeAcessivel}"`)
    return achado
  }

  function tocar(el: HTMLElement): void {
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    })
  }

  const BOTOES = ['Minha ficha', `Centralizar em ${FABIO.name}`, 'Centralizar no meu personagem']

  for (const nome of BOTOES) {
    it(`"${nome}" pelo dedo ou pelo mouse: a câmera desliza até a ficha`, () => {
      const onFocusToken = vi.fn()
      render(onFocusToken)
      tocar(botao(nome))
      expect(onFocusToken).toHaveBeenCalledTimes(1)
      expect(onFocusToken).toHaveBeenCalledWith(FABIO.id, true)
    })

    it(`"${nome}" pelo teclado (clique com detail 0): o pedido de sempre, só com a ficha, e a câmera salta`, () => {
      const onFocusToken = vi.fn()
      render(onFocusToken)
      act(() => botao(nome).click())
      expect(onFocusToken).toHaveBeenCalledTimes(1)
      // Exatamente um argumento: sem `animate`, quem recebe centraliza de uma vez, como antes do deslize existir.
      expect(onFocusToken).toHaveBeenCalledWith(FABIO.id)
    })
  }
})
