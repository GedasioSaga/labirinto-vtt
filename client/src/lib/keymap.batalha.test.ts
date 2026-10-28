import { describe, expect, it } from 'vitest'
import { BATTLE_SHORTCUT, isBattleShortcut, resolveShortcut, type ShortcutEvent } from './keymap'

/** MODO BATALHA (B5): Shift+B inicia ou encerra a batalha; quem ouve é o controle da batalha no livro da mesa. */

function tecla(over: Partial<ShortcutEvent> = {}): ShortcutEvent {
  return { key: 'B', ctrlKey: false, metaKey: false, shiftKey: true, altKey: false, targetTagName: '', ...over }
}

describe('Shift+B (modo batalha)', () => {
  it('o atalho anunciado é Shift+B', () => {
    expect(BATTLE_SHORTCUT).toBe('Shift+B')
  })

  it('Shift+B fora de campo de texto é o atalho, maiúsculo ou minúsculo', () => {
    expect(isBattleShortcut(tecla())).toBe(true)
    expect(isBattleShortcut(tecla({ key: 'b' }))).toBe(true)
    // Interruptor e botão não digitam: a letra volta a ser atalho.
    expect(isBattleShortcut(tecla({ targetTagName: 'INPUT', targetInputType: 'checkbox' }))).toBe(true)
    expect(isBattleShortcut(tecla({ targetTagName: 'BUTTON' }))).toBe(true)
  })

  it('num campo de texto o Shift+B é um B maiúsculo', () => {
    expect(isBattleShortcut(tecla({ targetTagName: 'INPUT' }))).toBe(false)
    expect(isBattleShortcut(tecla({ targetTagName: 'INPUT', targetInputType: 'text' }))).toBe(false)
    expect(isBattleShortcut(tecla({ targetTagName: 'TEXTAREA' }))).toBe(false)
    expect(isBattleShortcut(tecla({ targetContentEditable: true }))).toBe(false)
  })

  it('B sozinho, Ctrl+Shift+B, Alt+Shift+B e Cmd+Shift+B não são o atalho', () => {
    expect(isBattleShortcut(tecla({ shiftKey: false, key: 'b' }))).toBe(false)
    expect(isBattleShortcut(tecla({ ctrlKey: true }))).toBe(false)
    expect(isBattleShortcut(tecla({ altKey: true }))).toBe(false)
    expect(isBattleShortcut(tecla({ metaKey: true }))).toBe(false)
  })

  it('não colide com o mapa de teclas do canvas: Shift+B não vira ferramenta nem ação', () => {
    expect(resolveShortcut(tecla())).toBeNull()
    // E o B sozinho continua sendo a ferramenta dele.
    expect(resolveShortcut(tecla({ shiftKey: false, key: 'b' }))).toEqual({ kind: 'selectTool', tool: 'prop' })
  })
})
