/**
 * "Marcar destino" e "Tirar marca" no painel do jogador: o primeiro é botão de
 * modo (um toque no mapa põe a marca), o segundo só aparece com a marca posta.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'

describe('PlayerPanel: marca "vamos para cá"', () => {
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

  function render(opts: { armed: boolean; has: boolean; onToggle?: () => void; onClear?: () => void }): void {
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
          laserArmed={false}
          onToggleLaser={() => {}}
          destinationArmed={opts.armed}
          onToggleDestination={opts.onToggle ?? (() => {})}
          hasDestination={opts.has}
          onClearDestination={opts.onClear ?? (() => {})}
          onRenameToken={() => {}}
          onChangeTokenPhoto={async () => {}}
          notebook={[]}
          notebookUnread={false}
          onReadNotebook={() => {}}
        />,
      ),
    )
  }

  const botao = (texto: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === texto)

  it('sem marca: "Marcar destino" como botão de modo e nenhum "Tirar marca"; ligado pede o toque', () => {
    const onToggle = vi.fn()
    render({ armed: false, has: false, onToggle })
    const marcar = botao('Marcar destino')
    expect(marcar?.getAttribute('aria-pressed')).toBe('false')
    expect(botao('Tirar marca')).toBeUndefined()
    act(() => marcar?.click())
    expect(onToggle).toHaveBeenCalledTimes(1)
    render({ armed: true, has: false, onToggle })
    expect(botao('Toque no destino…')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('com marca: "Mudar destino" e "Tirar marca", que tira', () => {
    const onClear = vi.fn()
    render({ armed: false, has: true, onClear })
    expect(botao('Mudar destino')).toBeDefined()
    act(() => botao('Tirar marca')?.click())
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
