/**
 * Botão "Laser" no painel do jogador, ao lado de "Medir": botão de modo
 * (`aria-pressed`), e ligado mostra como apontar.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'

describe('PlayerPanel: botão Laser', () => {
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

  function render(laserArmed: boolean, onToggleLaser: () => void): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={[{ id: 't1', name: 'Lanterna' }]}
          characterColor="#3cff00"
          settings={DEFAULT_PLAYER_SETTINGS}
          onSettingsChange={() => {}}
          onFocusToken={() => {}}
          signalArmed={false}
          onToggleSignal={() => {}}
          measureArmed={false}
          onToggleMeasure={() => {}}
          laserArmed={laserArmed}
          onToggleLaser={onToggleLaser}
          onRenameToken={() => {}}
          onChangeTokenPhoto={async () => {}}
          notebook={[]}
          notebookUnread={false}
          onReadNotebook={() => {}}
        />,
      ),
    )
  }

  const botoes = () => Array.from(container.querySelectorAll('button'))
  const laser = () => botoes().find((b) => (b.textContent ?? '').startsWith('Laser'))

  it('fica no painel do jogador, logo depois de "Medir", como botão de modo', () => {
    render(false, () => {})
    const botao = laser()
    expect(botao).toBeDefined()
    expect(botao?.closest('[aria-label="Painel do jogador"]')).not.toBeNull()
    expect(botao?.getAttribute('aria-pressed')).toBe('false')
    const nomes = botoes().map((b) => b.textContent)
    expect(nomes.indexOf('Laser')).toBe(nomes.indexOf('Medir') + 1)
  })

  it('clicar liga o modo; ligado fica pressionado e diz como apontar', () => {
    const onToggle = vi.fn()
    render(false, onToggle)
    act(() => laser()?.click())
    expect(onToggle).toHaveBeenCalledTimes(1)
    render(true, onToggle)
    expect(laser()?.getAttribute('aria-pressed')).toBe('true')
    expect(container.textContent).toContain('Segure e arraste no mapa para apontar')
  })
})
