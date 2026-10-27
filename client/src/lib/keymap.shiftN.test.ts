import { describe, expect, it } from 'vitest'
import { resolveShortcut, type ShortcutEvent } from './keymap'

function tecla(key: string, extra: Partial<ShortcutEvent> = {}): ShortcutEvent {
  return { key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, targetTagName: '', ...extra }
}

// A Iniciativa saiu (modo batalha, fatia B3): o Shift+N que passava a vez
// ficou livre, e o N sozinho continua sendo a Sala.
describe('Shift+N livre', () => {
  it('Shift+N não faz nada', () => {
    expect(resolveShortcut(tecla('N', { shiftKey: true }))).toBeNull()
    expect(resolveShortcut(tecla('n', { shiftKey: true }))).toBeNull()
  })

  it('o N sozinho continua sendo a Sala', () => {
    expect(resolveShortcut(tecla('n'))).toEqual({ kind: 'selectTool', tool: 'room' })
  })
})
