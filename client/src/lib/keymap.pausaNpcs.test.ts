import { describe, expect, it } from 'vitest'
import { PAUSE_NPCS_SHORTCUT, resolveShortcut, type ShortcutEvent } from './keymap'

function tecla(key: string, extra: Partial<ShortcutEvent> = {}): ShortcutEvent {
  return { key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, targetTagName: '', ...extra }
}

describe('atalho da pausa geral dos NPCs', () => {
  it('Shift+P pausa ou retoma, e o texto do atalho é o que o botão anuncia', () => {
    expect(PAUSE_NPCS_SHORTCUT).toBe('Shift+P')
    expect(resolveShortcut(tecla('P', { shiftKey: true }))).toEqual({ kind: 'pauseNpcs' })
  })

  it('não rouba o P do Pincel nem dispara dentro de campo de texto', () => {
    expect(resolveShortcut(tecla('p'))).toEqual({ kind: 'selectTool', tool: 'brush' })
    expect(resolveShortcut(tecla('P', { shiftKey: true, targetTagName: 'INPUT' }))).toBeNull()
    expect(resolveShortcut(tecla('P', { shiftKey: true, targetTagName: 'SELECT' }))).toBeNull()
    expect(resolveShortcut(tecla('P', { shiftKey: true, targetContentEditable: true }))).toBeNull()
    expect(resolveShortcut(tecla('P', { shiftKey: true, ctrlKey: true }))).toBeNull()
    expect(resolveShortcut(tecla('P', { shiftKey: true, altKey: true }))).toBeNull()
  })
})
