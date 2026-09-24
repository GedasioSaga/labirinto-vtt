import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel, type PlayerCharacter } from './PlayerPanel'

/**
 * AJUDANTE CONTRATADO na tela do jogador: o NPC emprestado aparece em "Meus
 * personagens" com a marca do acordo, e "Meu personagem" (nome e foto) é
 * sempre a ficha PRÓPRIA — nunca a do NPC, que o mestre só emprestou.
 */
const FABIO: PlayerCharacter = { id: 'tok-fabio', name: 'Capa azul' }
const AS_21_30 = new Date(2026, 8, 24, 21, 30).getTime()
const TIZIU: PlayerCharacter = { id: 'tok-tiziu', name: 'Menino', contrato: { tarefa: 'levar o recado', ate: AS_21_30, visao: false } }

describe('PlayerPanel: ajudante contratado', () => {
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

  it('o ajudante vem com a marca do acordo: tarefa e até quando', () => {
    render([FABIO, TIZIU])
    expect(container.textContent).toContain('Ajudante · levar o recado · até 21:30')
    expect(container.querySelector('[aria-label="Centralizar em Menino"]')).not.toBeNull()
  })

  it('"Meu personagem" edita a ficha própria, mesmo com o ajudante listado primeiro', () => {
    const onRenameToken = vi.fn()
    render([TIZIU, FABIO], onRenameToken)
    const nome = campoNome()
    expect(nome?.value).toBe('Capa azul')
    act(() => {
      if (nome === null) throw new Error('sem o campo Nome')
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(nome, 'Capa verde')
      nome.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => campoNome()?.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(onRenameToken).toHaveBeenCalledWith('tok-fabio', 'Capa verde')
  })

  it('só com o ajudante: não há nome nem foto para mexer, e o prazo "até o mestre retomar" aparece', () => {
    render([{ id: 'tok-tiziu', name: 'Menino', contrato: { tarefa: '', ate: null, visao: false } }])
    expect(campoNome()).toBeNull()
    expect(container.textContent).toContain('Ajudante · até o mestre retomar')
  })
})
