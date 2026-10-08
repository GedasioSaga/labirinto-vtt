/**
 * FICHA DE PERSONAGEM: o botão "Ficha" na barra de cima. Só existe onde o
 * host serve ficha (numa aventura); o nome acessível diz que é a ficha de
 * PERSONAGEM — "Minha ficha", ao lado, centra a câmera no token.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel, type PlayerCharacter } from './PlayerPanel'
import { lerPlayerCss, regraNaMidia } from './cssDoJogador.testkit'

const HEROI: PlayerCharacter = { id: 'heroi', name: 'Heroi' }

describe('PlayerPanel: botão "Ficha"', () => {
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

  function render(onOpenFicha?: (byKeyboard: boolean) => void): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={[HEROI]}
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
          onOpenFicha={onOpenFicha}
        />,
      ),
    )
  }

  const botaoDaFicha = () => container.querySelector<HTMLButtonElement>('.pp-bar button[aria-label="Ficha de personagem"]')

  it('sem ficha servida pelo host (mapa solto): sem o botão', () => {
    render(undefined)
    expect(botaoDaFicha()).toBeNull()
  })

  it('com ficha: o botão "Ficha" na barra abre a ficha (clique = com animação)', () => {
    const onOpenFicha = vi.fn()
    render(onOpenFicha)
    const botao = botaoDaFicha()
    expect(botao?.textContent).toBe('Ficha')
    expect(botao?.getAttribute('aria-haspopup')).toBe('dialog')
    act(() => botao?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })))
    expect(onOpenFicha).toHaveBeenCalledWith(false)
  })

  it('pelo teclado (Enter/Espaço chegam com detail 0): abre sem animação', () => {
    const onOpenFicha = vi.fn()
    render(onOpenFicha)
    act(() => botaoDaFicha()?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 })))
    expect(onOpenFicha).toHaveBeenCalledWith(true)
  })

  // Com a "Ficha" a barra media 324 px numa tela de 320 (Chrome, 320 x 568): abaixo
  // de 380 px "Minha ficha" e "Ficha" ficam só com o ícone, como a bolsa.
  it('abaixo de 380 px "Minha ficha" e "Ficha" viram alvos quadrados; o nome fica para o leitor de tela', async () => {
    const css = await lerPlayerCss()
    for (const seletor of ['.pp-mine', '.pp-ficha-btn']) {
      const regra = regraNaMidia(css, '(max-width: 379px)', seletor)
      expect(regra.get('width'), seletor).toBe('var(--pp-bar-h)')
      expect(regra.get('padding'), seletor).toBe('0')
    }
    for (const rotulo of ['.pp-mine__rotulo', '.pp-ficha-btn__rotulo']) {
      expect(regraNaMidia(css, '(max-width: 379px)', rotulo).get('position'), rotulo).toBe('absolute')
    }
    render(() => {})
    expect(container.querySelector('.pp-mine')?.textContent).toBe('Minha ficha')
  })
})
