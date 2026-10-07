import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RAIO_PADRAO_PX, SceneSettingsDialog, raioEmQuadrados } from './SceneSettingsDialog'

/** "Configurar cena" (07/10/2026): visão dos jogadores por cena, com o radar ao lado. */
describe('SceneSettingsDialog', () => {
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

  function abrir(visionCells: number | undefined, dark = false, extra: { onClose?: () => void; onVisionCellsChange?: (c: number | undefined) => void } = {}) {
    act(() =>
      root.render(
        <SceneSettingsDialog
          sceneName="Mina"
          cellPx={70}
          vision={{ visionCells, onVisionCellsChange: extra.onVisionCellsChange ?? vi.fn(), dark, onDarkChange: vi.fn() }}
          onClose={extra.onClose ?? vi.fn()}
        />,
      ),
    )
  }

  const radar = () => document.body.querySelector('svg[role="img"]')

  it('raio em quadrados: o da cena, senão o padrão convertido pelo quadro', () => {
    expect(raioEmQuadrados(4, 64)).toEqual({ cells: 4, padrao: false })
    expect(raioEmQuadrados(undefined, 70)).toEqual({ cells: RAIO_PADRAO_PX / 70, padrao: true })
    expect(raioEmQuadrados(undefined, 0).cells).toBeCloseTo(RAIO_PADRAO_PX / 64, 1)
  })

  it('mostra o nome da cena, o campo da visão e o radar com o raio', () => {
    abrir(3)
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('Configurar Mina')
    expect(document.body.querySelector<HTMLInputElement>('#lb-scene-vision')?.value).toBe('3')
    expect(radar()?.getAttribute('aria-label')).toBe('Prévia: o jogador vê 3 quadrados em volta')
  })

  it('cena escura aparece no radar; sem valor, a legenda fala do raio padrão', () => {
    abrir(undefined, true)
    expect(radar()?.getAttribute('aria-label')).toContain('cena escura')
    expect(document.body.querySelector('figcaption')?.textContent).toContain('raio padrão')
  })

  it('mudar o campo grava; Esc fecha', () => {
    const onVisionCellsChange = vi.fn()
    const onClose = vi.fn()
    abrir(undefined, false, { onVisionCellsChange, onClose })
    const campo = document.body.querySelector<HTMLInputElement>('#lb-scene-vision')
    if (campo === null) throw new Error('campo ausente')
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(campo, '5')
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onVisionCellsChange).toHaveBeenCalledWith(5)
    act(() => {
      document.body.querySelector('[role="dialog"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalled()
  })
})
