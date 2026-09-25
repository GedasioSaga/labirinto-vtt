import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel, type PlayerCharacter } from './PlayerPanel'

/**
 * NPC EMPRESTADO na tela do jogador: o NPC que o mestre deu pelo "Atribuir"
 * (`emprestada`) aparece em "Meus personagens" com a marca de emprestado, mas
 * "Meu personagem" (nome e foto) é sempre a ficha PRÓPRIA — nunca a do NPC.
 */
const ESPADA: PlayerCharacter = { id: 'tok-espada', name: 'Espada' }
const MENINO: PlayerCharacter = { id: 'tok-menino', name: 'Menino', emprestada: true }

describe('PlayerPanel: NPC emprestado', () => {
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

  function render(characters: PlayerCharacter[], onRenameToken: (tokenId: string, name: string) => void = () => {}): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={characters}
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
          onRenameToken={onRenameToken}
          onChangeTokenPhoto={async () => {}}
          notebook={[]}
          notebookUnread={false}
          onReadNotebook={() => {}}
        />,
      ),
    )
  }

  function campoNome(): HTMLInputElement | null {
    const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.trim() === 'Nome')
    const id = label?.getAttribute('for')
    const el = id ? document.getElementById(id) : null
    return el instanceof HTMLInputElement ? el : null
  }

  it('só com o NPC emprestado: ele está na lista com a marca, e não há nome nem foto para mexer', () => {
    render([MENINO])
    expect(container.querySelector('[aria-label="Centralizar em Menino"]')).not.toBeNull()
    expect(container.textContent).toContain('Emprestado pelo mestre')
    expect(campoNome()).toBeNull()
  })

  it('"Meu personagem" edita a ficha própria, mesmo com o NPC listado primeiro', () => {
    const onRenameToken = vi.fn()
    render([MENINO, ESPADA], onRenameToken)
    const nome = campoNome()
    expect(nome?.value).toBe('Espada')
    act(() => {
      if (nome === null) throw new Error('sem o campo Nome')
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(nome, 'Lâmina')
      nome.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => campoNome()?.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(onRenameToken).toHaveBeenCalledWith('tok-espada', 'Lâmina')
  })

  it('CONTROLE: a ficha própria não leva a marca de emprestado', () => {
    render([ESPADA])
    expect(container.textContent).not.toContain('Emprestado pelo mestre')
    expect(campoNome()?.value).toBe('Espada')
  })
})
