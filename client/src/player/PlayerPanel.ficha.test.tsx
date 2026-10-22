/**
 * FICHA DE PERSONAGEM: o botão "Ficha" na barra de cima. Só existe onde o
 * host serve ficha (numa aventura); o nome acessível diz que é a ficha de
 * PERSONAGEM — "Minha ficha", ao lado, centra a câmera no token.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel, type PlayerCharacter } from './PlayerPanel'
import { lerPlayerCss, porMidia, regraNaMidia } from './cssDoJogador.testkit'

const HEROI: PlayerCharacter = { id: 'heroi', name: 'Heroi' }

/** As mídias em que o rótulo vira o recorte de 1 px do leitor de tela (sai da vista). */
const midiasQueRecortam = (css: string, rotulo: string): string[] =>
  porMidia(css, rotulo)
    .filter(({ regra }) => regra.get('position') === 'absolute' && regra.get('clip') === 'rect(0, 0, 0, 0)')
    .map(({ condicao }) => condicao)

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

  function render(onOpenFicha?: (byKeyboard: boolean) => void, onOpenInventory?: (byKeyboard: boolean) => void): void {
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
          onOpenFicha={onOpenFicha}
          onOpenInventory={onOpenInventory}
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

  // Com a "Ficha" a barra de pílulas media 324 px numa tela de 320 (Chrome,
  // 320 x 568). Em pé a barra é a faixa de couro da fatia 19a, de colunas
  // iguais com o rótulo embaixo do ícone: é ali que mora o caso de 320 x 568.
  // As pílulas só com o ícone ficaram para a tela estreita E baixa.
  const EM_PE = '(max-width: 699px) and (min-height: 481px)'
  const ESTREITA_E_BAIXA = '(max-width: 379px) and (max-height: 480px)'

  it('em pé (320 x 568) os quatro atalhos são filhos da faixa, uma coluna igual para cada, com o rótulo à vista', async () => {
    const css = await lerPlayerCss()
    const faixa = regraNaMidia(css, EM_PE, '.pp-bar')
    expect(faixa.get('display')).toBe('grid')
    expect(faixa.get('grid-auto-flow')).toBe('column')
    // `minmax(0, 1fr)` e não `1fr`: o rótulo comprido não alarga a coluna dele e empurra a última para fora.
    expect(faixa.get('grid-auto-columns')).toBe('minmax(0, 1fr)')
    expect(faixa.get('left')).toBe('0')
    expect(faixa.get('right')).toBe('0')
    const atalho = regraNaMidia(css, EM_PE, '.pp-bar > button')
    expect(atalho.get('flex-direction')).toBe('column')
    expect(atalho.get('min-width')).toBe('0')

    render(() => {}, () => {})
    // Os quatro são filhos diretos da faixa: cada um ganha a sua coluna (`.pp-bar > button`).
    const atalhos = Array.from(container.querySelectorAll<HTMLElement>('.pp-bar > button')).map((b) => b.className)
    expect(atalhos).toEqual(['pp-toggle', 'pp-mine', 'pp-bag', 'pp-ficha-btn'])

    // O rótulo só sai da vista na pílula estreita e baixa: nenhuma mídia que vale em pé o recorta.
    for (const rotulo of ['.pp-mine__rotulo', '.pp-bag__rotulo', '.pp-ficha-btn__rotulo']) {
      expect(midiasQueRecortam(css, rotulo), rotulo).toEqual([ESTREITA_E_BAIXA])
    }
  })

  it('abaixo de 380 px, na barra de pílulas, "Minha ficha" e "Ficha" viram alvos quadrados; o nome fica para o leitor de tela', async () => {
    const css = await lerPlayerCss()
    for (const seletor of ['.pp-mine', '.pp-ficha-btn']) {
      const regra = regraNaMidia(css, ESTREITA_E_BAIXA, seletor)
      expect(regra.get('width'), seletor).toBe('var(--pp-bar-h)')
      expect(regra.get('padding'), seletor).toBe('0')
    }
    for (const rotulo of ['.pp-mine__rotulo', '.pp-ficha-btn__rotulo']) {
      expect(regraNaMidia(css, ESTREITA_E_BAIXA, rotulo).get('position'), rotulo).toBe('absolute')
    }
    render(() => {})
    expect(container.querySelector('.pp-mine')?.textContent).toBe('Minha ficha')
  })
})
