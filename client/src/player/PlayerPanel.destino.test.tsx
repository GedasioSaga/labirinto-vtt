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
        />,
      ),
    )
  }

  const botao = (texto: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto)
  const itens = () => Array.from(container.querySelectorAll('[role="menuitem"]')).map((b) => b.textContent)

  /** "Marcar destino" mora no menu "Marcações": abre o menu antes. */
  function abrirMarcacoes(): void {
    act(() => botao('Marcações')?.click())
  }

  it('sem marca: "Marcar destino" no menu Marcações e nenhum "Tirar marca"; ligado pede o toque', () => {
    const onToggle = vi.fn()
    render({ armed: false, has: false, onToggle })
    // Fora do menu, nenhum dos três: só o botão Marcações.
    expect(botao('Marcar destino')).toBeUndefined()
    abrirMarcacoes()
    // Só o destino neste painel (sem Anotar nem Deixar marca): o menu oferece o que a tela tem.
    expect(itens()).toEqual(['Marcar destino'])
    act(() => botao('Marcar destino')?.click())
    expect(onToggle).toHaveBeenCalledTimes(1)
    // Escolher fecha o menu.
    expect(container.querySelector('[role="menu"]')).toBeNull()
    render({ armed: true, has: false, onToggle })
    expect(container.textContent).toContain('Toque no destino, no mapa. Esc sai.')
    abrirMarcacoes()
    expect(itens()).toEqual(['Cancelar destino'])
  })

  it('com marca: "Mudar destino" e "Tirar marca" no menu, que tira', () => {
    const onClear = vi.fn()
    render({ armed: false, has: true, onClear })
    abrirMarcacoes()
    expect(itens()).toEqual(['Mudar destino', 'Tirar marca'])
    act(() => botao('Tirar marca')?.click())
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
