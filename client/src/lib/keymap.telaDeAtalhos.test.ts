import { describe, expect, it } from 'vitest'
import { resolveShortcut, type ShortcutEvent } from './keymap'

// Tela de atalhos (tecla ?). Régua de ponta a ponta:
// `e2e/task-jornada-tela-de-atalhos.spec.ts`. Aqui só a decisão "esta tecla
// significa o quê"; quem sabe se há pino selecionado é o canvas, que passa
// `canTogglePinType`.

function evt(overrides: Partial<ShortcutEvent>): ShortcutEvent {
  return { key: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, targetTagName: '', ...overrides }
}

describe('resolveShortcut — o ? sem pino abre a tela de atalhos', () => {
  it('? sem pino selecionado abre a tela de atalhos', () => {
    expect(resolveShortcut(evt({ key: '?', shiftKey: true }))).toEqual({ kind: 'showShortcuts' })
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, canTogglePinType: false }))).toEqual({ kind: 'showShortcuts' })
  })

  it('com um pino que o ? sabe trocar, o ? troca o tipo e não abre a tela', () => {
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, canTogglePinType: true }))).toEqual({ kind: 'togglePinType' })
  })

  it('foco num botão, num título ou num interruptor: o ? sem pino abre a tela', () => {
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, targetTagName: 'BUTTON' }))).toEqual({ kind: 'showShortcuts' })
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, targetTagName: 'H2' }))).toEqual({ kind: 'showShortcuts' })
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, targetTagName: 'INPUT', targetInputType: 'checkbox' }))).toEqual({
      kind: 'showShortcuts',
    })
  })

  it('? digitado num campo de texto é texto, com ou sem pino selecionado', () => {
    for (const canTogglePinType of [false, true]) {
      expect(resolveShortcut(evt({ key: '?', shiftKey: true, targetTagName: 'INPUT', targetInputType: 'text', canTogglePinType }))).toBeNull()
      expect(resolveShortcut(evt({ key: '?', shiftKey: true, targetTagName: 'TEXTAREA', canTogglePinType }))).toBeNull()
      expect(resolveShortcut(evt({ key: '?', shiftKey: true, targetTagName: 'DIV', targetContentEditable: true, canTogglePinType }))).toBeNull()
    }
  })

  it('Ctrl+?, Cmd+?, Alt+? e a barra sem Shift não abrem a tela', () => {
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, ctrlKey: true }))).toBeNull()
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, metaKey: true }))).toBeNull()
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, altKey: true }))).toBeNull()
    expect(resolveShortcut(evt({ key: '/' }))).toBeNull()
  })
})
