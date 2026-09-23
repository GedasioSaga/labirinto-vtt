import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionBar, type ActionBarProps } from './ActionBar'
import { ExportImageDialog, type ExportImageDialogProps } from './ExportImageDialog'

describe('"Exportar imagem" no rodapé e no diálogo', () => {
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
    vi.restoreAllMocks()
  })

  function actionBarProps(onExportImage: () => void): ActionBarProps {
    const noop = vi.fn()
    return {
      onSave: noop,
      onOpen: noop,
      onImportBackground: noop,
      onExportFolder: noop,
      onExportImage,
      onImportFolder: noop,
      onGoHome: noop,
      hasBackgroundImage: false,
      onFloorFromBackground: noop,
      onDetailsFromBackground: noop,
      onRecreateMinimapFromBackground: noop,
    }
  }

  function dialogProps(overrides: Partial<ExportImageDialogProps> = {}): ExportImageDialogProps {
    return { defaultGrid: true, busy: false, onExport: vi.fn(), onClose: vi.fn(), ...overrides }
  }

  const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
  const labelOf = (el: Element): string => {
    const labelledBy = el.getAttribute('aria-labelledby')
    if (labelledBy) return labelledBy.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
    const id = el.getAttribute('id')
    return (id ? document.querySelector(`label[for="${id}"]`)?.textContent : null) ?? el.closest('label')?.textContent ?? ''
  }
  const checkbox = (name: RegExp): HTMLInputElement => {
    const found = Array.from(document.body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).filter((el) => name.test(labelOf(el)))
    if (found.length !== 1) throw new Error(`esperava 1 opção ${name}, achei ${found.length}`)
    return found[0]
  }
  const button = (name: RegExp): HTMLButtonElement => {
    const found = Array.from(dialog()?.querySelectorAll<HTMLButtonElement>('button') ?? []).filter((el) =>
      name.test(el.getAttribute('aria-label') ?? el.textContent ?? ''),
    )
    if (found.length !== 1) throw new Error(`esperava 1 botão ${name}, achei ${found.length}`)
    return found[0]
  }

  it('o rodapé de ações de arquivo tem o botão "Exportar imagem", ao lado de "Exportar mapa (pasta)"', () => {
    const onExportImage = vi.fn()
    act(() => root.render(<ActionBar {...actionBarProps(onExportImage)} />))
    const item = container.querySelector<HTMLButtonElement>('[role="toolbar"] button[aria-label^="Exportar imagem"]')
    expect(item).not.toBeNull()
    expect(container.querySelector('button[aria-label="Exportar mapa (pasta)"]')).not.toBeNull()
    act(() => item?.click())
    expect(onExportImage).toHaveBeenCalledTimes(1)
  })

  it('o diálogo se chama "Exportar imagem" e tem as opções de grade e de objetos só do mestre', () => {
    act(() => root.render(<ExportImageDialog {...dialogProps()} />))
    const opened = dialog()
    expect(opened?.getAttribute('aria-modal')).toBe('true')
    expect(labelOf(opened ?? document.body)).toMatch(/Exportar imagem/)
    expect(checkbox(/grade/i).checked).toBe(true)
    // Desligada por padrão: imagem postada no grupo não entrega segredo por descuido.
    expect(checkbox(/s[óo] do mestre|ocult[oa]s? (para|dos) jogadores/i).checked).toBe(false)
  })

  it('a grade começa como está no editor', () => {
    act(() => root.render(<ExportImageDialog {...dialogProps({ defaultGrid: false })} />))
    expect(checkbox(/grade/i).checked).toBe(false)
  })

  it('confirmar manda as opções marcadas', () => {
    const onExport = vi.fn()
    act(() => root.render(<ExportImageDialog {...dialogProps({ onExport })} />))
    act(() => checkbox(/grade/i).click())
    act(() => checkbox(/s[óo] do mestre/i).click())
    act(() => button(/^Exportar/).click())
    expect(onExport).toHaveBeenCalledWith({ grid: false, masterOnly: true })
  })

  it('Cancelar e Esc fecham sem exportar; Esc não chega aos atalhos do editor', () => {
    const onExport = vi.fn()
    const onClose = vi.fn()
    const onWindowKey = vi.fn()
    window.addEventListener('keydown', onWindowKey)
    try {
      act(() => root.render(<ExportImageDialog {...dialogProps({ onExport, onClose })} />))
      act(() => button(/^Cancelar/).click())
      expect(onClose).toHaveBeenCalledTimes(1)
      act(() => {
        dialog()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })
      expect(onClose).toHaveBeenCalledTimes(2)
      expect(onWindowKey).not.toHaveBeenCalled()
      expect(onExport).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', onWindowKey)
    }
  })

  it('enquanto gera a imagem, o botão avisa e não aceita segundo clique', () => {
    const onExport = vi.fn()
    act(() => root.render(<ExportImageDialog {...dialogProps({ onExport, busy: true })} />))
    const confirm = button(/^Export/)
    expect(confirm.disabled).toBe(true)
    expect(confirm.textContent).toMatch(/Exportando/)
    act(() => confirm.click())
    expect(onExport).not.toHaveBeenCalled()
  })
})
