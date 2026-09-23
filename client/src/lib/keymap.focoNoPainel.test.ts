import { describe, expect, it } from 'vitest'
import { isEditableTarget, resolveShortcut, type ShortcutEvent } from './keymap'

// Achados 10 e 11 do passeio de 20/09/2026: atalho com o foco no painel.
// Réguas de ponta a ponta em `e2e/task-jornada-atalho-com-foco-no-painel.spec.ts`.

function evt(overrides: Partial<ShortcutEvent>): ShortcutEvent {
  return { key: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, targetTagName: '', ...overrides }
}

describe('isEditableTarget — só onde a tecla vira texto', () => {
  for (const tipo of ['text', 'search', 'number', 'email', 'url', 'tel', 'password', 'date', 'TEXT']) {
    it(`INPUT type=${tipo} é campo de texto`, () => {
      expect(isEditableTarget('INPUT', tipo)).toBe(true)
    })
  }

  for (const tipo of ['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color', 'file', 'image', 'Checkbox']) {
    it(`INPUT type=${tipo} NÃO é campo de texto`, () => {
      expect(isEditableTarget('INPUT', tipo)).toBe(false)
    })
  }

  it('INPUT sem tipo conhecido fica do lado seguro: é campo de texto', () => {
    expect(isEditableTarget('INPUT')).toBe(true)
    expect(isEditableTarget('INPUT', 'tipo-do-futuro')).toBe(true)
  })

  it('TEXTAREA, SELECT e contenteditable são edição; BUTTON, DIV e CANVAS não', () => {
    expect(isEditableTarget('TEXTAREA')).toBe(true)
    expect(isEditableTarget('SELECT')).toBe(true)
    expect(isEditableTarget('DIV', undefined, true)).toBe(true)
    expect(isEditableTarget('BUTTON')).toBe(false)
    expect(isEditableTarget('DIV')).toBe(false)
    expect(isEditableTarget('CANVAS')).toBe(false)
    expect(isEditableTarget('')).toBe(false)
  })
})

describe('resolveShortcut — foco num interruptor do painel', () => {
  it('W com o foco no checkbox "Mostrar grade" põe a Parede na mão', () => {
    expect(resolveShortcut(evt({ key: 'w', targetTagName: 'INPUT', targetInputType: 'checkbox' }))).toEqual({
      kind: 'selectTool',
      tool: 'wall',
    })
  })

  it('W com o foco num rádio ou num controle deslizante também vale', () => {
    expect(resolveShortcut(evt({ key: 'w', targetTagName: 'INPUT', targetInputType: 'radio' }))?.kind).toBe('selectTool')
    expect(resolveShortcut(evt({ key: 'w', targetTagName: 'INPUT', targetInputType: 'range' }))?.kind).toBe('selectTool')
  })

  it('W digitado no nome da sala (INPUT de texto) continua sendo letra', () => {
    expect(resolveShortcut(evt({ key: 'w', targetTagName: 'INPUT', targetInputType: 'text' }))).toBeNull()
  })

  it('W num contenteditable continua sendo letra', () => {
    expect(resolveShortcut(evt({ key: 'w', targetTagName: 'DIV', targetContentEditable: true }))).toBeNull()
  })
})

describe('resolveShortcut — a regra do ?', () => {
  // Sem pino selecionado o ? abre a tela de atalhos (keymap.telaDeAtalhos.test.ts);
  // aqui o pino está selecionado, e o ? é dele.
  it('? (Shift+/) com o pino selecionado pede a troca do tipo do pino', () => {
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, canTogglePinType: true }))).toEqual({ kind: 'togglePinType' })
  })

  it('? com o foco num botão do painel (o título, um rádio) também vale', () => {
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, targetTagName: 'BUTTON', canTogglePinType: true }))).toEqual({
      kind: 'togglePinType',
    })
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, targetTagName: 'H2', canTogglePinType: true }))).toEqual({
      kind: 'togglePinType',
    })
  })

  it('? dentro de campo de texto (a descrição do pino) é texto', () => {
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, targetTagName: 'TEXTAREA' }))).toBeNull()
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, targetTagName: 'INPUT', targetInputType: 'text' }))).toBeNull()
  })

  it('Ctrl+? e Alt+? não são o atalho', () => {
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, ctrlKey: true }))).toBeNull()
    expect(resolveShortcut(evt({ key: '?', shiftKey: true, altKey: true }))).toBeNull()
  })

  it('a barra sem Shift (/) não troca nada, e Shift+letra segue reservado', () => {
    expect(resolveShortcut(evt({ key: '/' }))).toBeNull()
    expect(resolveShortcut(evt({ key: 'W', shiftKey: true }))).toBeNull()
  })
})
