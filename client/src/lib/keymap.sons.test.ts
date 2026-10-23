import { describe, expect, it } from 'vitest'
import { resolveShortcut, resolverAtalhoDeSom, SOUND_SLOT_KEYS, TOOL_SHORTCUTS, type ShortcutEvent } from './keymap'

/*
 * ATALHOS DOS SONS (Sistema 4, fatia F3): as teclas 1 a 9 tocam o efeito que
 * tem aquele atalho na aba Sons. Ficam FORA do `resolveShortcut` (quem ouve é
 * a folha Sons, sempre montada) e só valem sem modificador, fora de campo de
 * texto e sem diálogo modal aberto.
 */

function evt(overrides: Partial<ShortcutEvent> = {}): ShortcutEvent {
  return { key: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, targetTagName: '', ...overrides }
}

describe('resolverAtalhoDeSom', () => {
  it('as teclas 1 a 9 viram o atalho de mesmo número; 0 e letras não', () => {
    expect(SOUND_SLOT_KEYS).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    for (const [indice, tecla] of SOUND_SLOT_KEYS.entries()) expect(resolverAtalhoDeSom(evt({ key: tecla }))).toBe(indice + 1)
    for (const tecla of ['0', 'a', 'J', '#', 'F1', 'Enter', ' ']) expect(resolverAtalhoDeSom(evt({ key: tecla }))).toBeNull()
  })

  it('com modificador não toca: Ctrl, Cmd, Alt e Shift', () => {
    expect(resolverAtalhoDeSom(evt({ key: '3', ctrlKey: true }))).toBeNull()
    expect(resolverAtalhoDeSom(evt({ key: '3', metaKey: true }))).toBeNull()
    expect(resolverAtalhoDeSom(evt({ key: '3', altKey: true }))).toBeNull()
    expect(resolverAtalhoDeSom(evt({ key: '3', shiftKey: true }))).toBeNull()
  })

  it('num campo de texto o dígito é texto: input, textarea, select e contenteditable', () => {
    expect(resolverAtalhoDeSom(evt({ key: '3', targetTagName: 'INPUT' }))).toBeNull()
    expect(resolverAtalhoDeSom(evt({ key: '3', targetTagName: 'INPUT', targetInputType: 'number' }))).toBeNull()
    expect(resolverAtalhoDeSom(evt({ key: '3', targetTagName: 'TEXTAREA' }))).toBeNull()
    expect(resolverAtalhoDeSom(evt({ key: '3', targetTagName: 'SELECT' }))).toBeNull()
    expect(resolverAtalhoDeSom(evt({ key: '3', targetTagName: 'DIV', targetContentEditable: true }))).toBeNull()
    // Interruptor e botão não digitam: o atalho vale.
    expect(resolverAtalhoDeSom(evt({ key: '3', targetTagName: 'INPUT', targetInputType: 'checkbox' }))).toBe(3)
    expect(resolverAtalhoDeSom(evt({ key: '3', targetTagName: 'BUTTON' }))).toBe(3)
  })

  it('com diálogo modal aberto não toca; tecla segurada (repetição) também não', () => {
    expect(resolverAtalhoDeSom({ ...evt({ key: '3' }), modalAberto: true })).toBeNull()
    expect(resolverAtalhoDeSom({ ...evt({ key: '3' }), repeticao: true })).toBeNull()
    expect(resolverAtalhoDeSom({ ...evt({ key: '3' }), modalAberto: false, repeticao: false })).toBe(3)
  })
})

describe('resolveShortcut não muda com os atalhos dos sons', () => {
  it('os dígitos 1 a 9 seguem sem ação nenhuma, com e sem Shift', () => {
    for (const tecla of SOUND_SLOT_KEYS) {
      expect(resolveShortcut(evt({ key: tecla }))).toBeNull()
      expect(resolveShortcut(evt({ key: tecla, shiftKey: true }))).toBeNull()
    }
    // Ctrl+0 continua sendo o único dígito com atalho (zoom de volta a 100%).
    expect(resolveShortcut(evt({ key: '0', ctrlKey: true }))).toEqual({ kind: 'zoomReset' })
  })

  it('nenhuma letra de ferramenta é dígito, e cada uma segue escolhendo a sua ferramenta', () => {
    for (const [ferramenta, tecla] of Object.entries(TOOL_SHORTCUTS)) {
      expect(SOUND_SLOT_KEYS).not.toContain(tecla)
      const acao = resolveShortcut(evt({ key: tecla.length === 1 ? tecla.toLowerCase() : tecla }))
      // Ferramenta escondida (FEATURES) devolve null; as outras devolvem a própria ferramenta.
      if (acao !== null) expect(acao).toEqual({ kind: 'selectTool', tool: ferramenta })
    }
  })
})
