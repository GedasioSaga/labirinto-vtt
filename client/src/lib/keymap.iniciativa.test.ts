import { describe, expect, it } from 'vitest'
import { NEXT_TURN_SHORTCUT, resolveShortcut, type ShortcutEvent } from './keymap'

function tecla(key: string, extra: Partial<ShortcutEvent> = {}): ShortcutEvent {
  return { key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, targetTagName: '', ...extra }
}

describe('atalho da próxima vez (iniciativa)', () => {
  it('Shift+N passa a vez, e o texto do atalho é o que o botão anuncia', () => {
    expect(NEXT_TURN_SHORTCUT).toBe('Shift+N')
    expect(resolveShortcut(tecla('N', { shiftKey: true }))).toEqual({ kind: 'nextTurn' })
  })

  it('não rouba o N da Sala nem dispara dentro de campo de texto', () => {
    expect(resolveShortcut(tecla('n'))).toEqual({ kind: 'selectTool', tool: 'room' })
    expect(resolveShortcut(tecla('N', { shiftKey: true, targetTagName: 'INPUT' }))).toBeNull()
    expect(resolveShortcut(tecla('N', { shiftKey: true, targetTagName: 'INPUT', targetInputType: 'number' }))).toBeNull()
    expect(resolveShortcut(tecla('N', { shiftKey: true, ctrlKey: true }))).toBeNull()
    expect(resolveShortcut(tecla('N', { shiftKey: true, altKey: true }))).toBeNull()
  })
})
