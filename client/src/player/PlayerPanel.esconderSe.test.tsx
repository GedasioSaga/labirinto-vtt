/**
 * "Esconder" no painel do jogador: vira pedido ao mestre. Esperando, o botão
 * trava e diz isso; aceito, o painel diz que a ficha está escondida e que só
 * o mestre revela — não há "desesconder" do lado do jogador.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel, type PlayerHideControls } from './PlayerPanel'
import { HIDE_NOTICE_TEXT } from './hideNotice'

describe('PlayerPanel: esconder-se', () => {
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

  function render(hide: PlayerHideControls | undefined): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={[{ id: 'ficha-duda', name: 'Duda' }]}
          characterColor="#3b82f6"
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
          hide={hide}
        />,
      ),
    )
  }

  const botao = (texto: string): HTMLButtonElement | undefined => [...container.querySelectorAll('button')].find((b) => b.textContent === texto)

  it('"Esconder" pede ao mestre pela própria ficha', () => {
    const onRequest = vi.fn()
    render({ hidden: false, waiting: false, onRequest })
    const esconder = botao('Esconder')
    expect(esconder?.disabled).toBe(false)
    act(() => esconder?.click())
    expect(onRequest).toHaveBeenCalledWith('ficha-duda')
  })

  it('esperando o mestre: o botão trava e diz que o pedido está com ele', () => {
    render({ hidden: false, waiting: true, onRequest: vi.fn() })
    expect(botao('Aguardando o mestre…')?.disabled).toBe(true)
    expect(botao('Esconder')).toBeUndefined()
  })

  it('escondida: sem botão, e o painel diz que só o mestre revela', () => {
    render({ hidden: true, waiting: false, onRequest: vi.fn() })
    expect(botao('Esconder')).toBeUndefined()
    expect(container.textContent).toContain('Escondida: os outros jogadores não veem sua ficha. Só o mestre revela.')
  })

  it('tela sem a função (mestre antigo, teste): nenhum botão', () => {
    render(undefined)
    expect(botao('Esconder')).toBeUndefined()
    expect(container.textContent).not.toContain('Escondida')
  })
})

describe('HIDE_NOTICE_TEXT', () => {
  it('toda recusa tem uma linha curta para o jogador', () => {
    expect(HIDE_NOTICE_TEXT).toEqual({
      denied: 'O mestre não deixou você se esconder agora',
      pending: 'Seu pedido já está com o mestre',
      too_soon: 'Espere um instante para pedir de novo',
      unavailable: 'Não dá para se esconder agora',
    })
  })
})
