/**
 * "Baixar meu caderno" na aba Caderno: um toque gera o arquivo no aparelho
 * (quem monta é `main.tsx`, pelo `onDownloadNotebook`) e a aba diz o nome do
 * arquivo que saiu — ou por que não saiu.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'

describe('PlayerPanel: baixar meu caderno', () => {
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

  function render(onDownloadNotebook?: () => string): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={[{ id: 't1', name: 'Duda' }]}
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
          onDownloadNotebook={onDownloadNotebook}
        />,
      ),
    )
  }

  function abrirCaderno(): void {
    const aba = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => /Caderno/.test(b.textContent ?? ''))
    if (!aba) throw new Error('sem a aba Caderno')
    act(() => aba.click())
  }

  function botaoBaixar(): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tabpanel"]:not([hidden]) button')).find((b) => b.textContent === 'Baixar meu caderno')
  }

  it('a aba Caderno tem "Baixar meu caderno", e o toque gera o arquivo uma vez e diz o nome dele', () => {
    const baixar = vi.fn(() => 'Duda - meu caderno - 24-09-2026.html')
    render(baixar)
    abrirCaderno()
    const botao = botaoBaixar()
    expect(botao).toBeDefined()
    expect(container.textContent).toMatch(/mapas que você conhece, suas pistas e os recados/)
    act(() => botao?.click())
    expect(baixar).toHaveBeenCalledTimes(1)
    const aviso = container.querySelector('[role="tabpanel"]:not([hidden]) [role="status"]')
    expect(aviso?.textContent).toBe('Baixado: Duda - meu caderno - 24-09-2026.html')
  })

  it('não deu para gerar: o motivo aparece como alerta, sem aviso de baixado', () => {
    render(() => {
      throw new Error('o navegador bloqueou o download')
    })
    abrirCaderno()
    act(() => botaoBaixar()?.click())
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Não deu para baixar: o navegador bloqueou o download')
    expect(container.querySelector('[role="tabpanel"]:not([hidden]) [role="status"]')).toBeNull()
  })

  it('sem quem gere o arquivo (tela antiga), o botão não aparece', () => {
    render()
    abrirCaderno()
    expect(botaoBaixar()).toBeUndefined()
  })
})
