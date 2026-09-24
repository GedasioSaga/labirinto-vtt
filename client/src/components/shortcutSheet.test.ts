import { describe, expect, it } from 'vitest'
import { FEATURES } from '../lib/features'
import { hiddenTools, resolveShortcut, TOOL_SHORTCUTS, type ShortcutEvent } from '../lib/keymap'
import type { DrawingTool } from '../types/tools'
import { TOOL_LABELS, TOOLBAR_SLOTS, toolsOfSlot } from './labels'
import { DOCUMENTED_ACTIONS, shortcutColumns, type ShortcutRow } from './shortcutSheet'

// A tela de atalhos não pode prometer tecla que não faz nada (nem esquecer
// uma que faz). Este arquivo aperta cada linha da tela no mapa de teclas de
// verdade (`resolveShortcut`) e confere com a tabela da barra.

/** A tecla escrita na tela como o navegador a entrega em `KeyboardEvent.key`. */
const KEY_OF_CAP: Readonly<Record<string, string>> = {
  Esc: 'Escape',
  Delete: 'Delete',
  Backspace: 'Backspace',
  Enter: 'Enter',
  Espaço: ' ',
  // A linha das setas vale pelas quatro; a da direita basta para conferir o passo.
  Setas: 'ArrowRight',
}

const MODIFIERS: ReadonlySet<string> = new Set(['Ctrl', 'Shift', 'Alt'])

/** O aperto que a linha ensina, como o canvas o entregaria a `resolveShortcut`. */
function pressOf(row: ShortcutRow): ShortcutEvent {
  const main = row.combo.keys.filter((key) => !MODIFIERS.has(key))
  if (main.length !== 1) throw new Error(`linha "${row.what}": esperava uma tecla principal, veio ${JSON.stringify(row.combo.keys)}`)
  const cap = main[0]
  return {
    key: KEY_OF_CAP[cap] ?? cap.toLowerCase(),
    ctrlKey: row.combo.keys.includes('Ctrl'),
    metaKey: false,
    // "?" só sai com Shift, no teclado americano e no ABNT2.
    shiftKey: row.combo.keys.includes('Shift') || cap === '?',
    altKey: row.combo.keys.includes('Alt'),
    targetTagName: '',
    ...row.when,
  }
}

const allRows = (columns = shortcutColumns()) => columns.flat().flatMap((group) => group.rows)

const toolOf = (row: ShortcutRow): DrawingTool | null => (row.action?.kind === 'selectTool' ? row.action.tool : null)

describe('shortcutSheet — o que a tela de atalhos mostra', () => {
  it('toda linha de atalho do mapa de teclas faz, em resolveShortcut, o que ela diz', () => {
    const rows = allRows().filter((row) => row.action !== undefined)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(resolveShortcut(pressOf(row)), `linha "${row.what}"`).toEqual(row.action)
    }
  })

  it('gesto que não passa pelo mapa de teclas não disputa a tecla com outro atalho', () => {
    // Espaço (arrastar a vista) e Enter (fechar o traço) são tratados no canvas
    // antes do mapa de teclas; se um dia o mapa de teclas os tomar para outra
    // coisa, a linha da tela passa a mentir.
    const rows = allRows().filter((row) => row.action === undefined && !row.combo.hold && row.combo.keys.length > 0)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(resolveShortcut(pressOf(row)), `linha "${row.what}"`).toBeNull()
    }
  })

  it('toda ação do mapa de teclas tem pelo menos uma linha na tela', () => {
    const shown = new Set(allRows().map((row) => row.action?.kind))
    for (const kind of Object.keys(DOCUMENTED_ACTIONS)) {
      expect(shown.has(kind as keyof typeof DOCUMENTED_ACTIONS), `ação "${kind}" sem linha na tela`).toBe(true)
    }
  })

  it('cada letra de ferramenta aparece uma vez, com o mesmo nome e a mesma letra do balão da barra', () => {
    const rows = allRows()
    const hidden = hiddenTools()
    for (const [tool, letter] of Object.entries(TOOL_SHORTCUTS) as [DrawingTool, string][]) {
      const matching = rows.filter((row) => toolOf(row) === tool)
      const label = TOOL_LABELS[tool]
      if (letter === '' || !label || hidden.has(tool)) {
        expect(matching, `"${tool}" não tem letra que funcione e não deveria aparecer`).toEqual([])
        continue
      }
      expect(matching.length, `"${tool}" deveria aparecer uma vez`).toBe(1)
      expect(matching[0].what).toBe(label)
      expect(matching[0].combo.keys).toEqual([letter])
    }
  })

  it('as ferramentas vêm na ordem da barra, em dois grupos por assunto', () => {
    const hidden = hiddenTools()
    const toolbarOrder = TOOLBAR_SLOTS.flat()
      .flatMap(toolsOfSlot)
      .filter((tool) => TOOL_SHORTCUTS[tool] !== '' && TOOL_LABELS[tool] && !hidden.has(tool))
    const toolGroups = shortcutColumns()
      .flat()
      .filter((group) => group.rows.some((row) => toolOf(row) !== null))
    expect(toolGroups.map((group) => group.title)).toEqual(['Construir', 'Desenhar e anotar'])
    expect(toolGroups.flatMap((group) => group.rows.map(toolOf))).toEqual(toolbarOrder)
  })

  it('Token escondido pela flag some da tela; com a flag ligada, a letra K volta', () => {
    const tokenRows = (tokenTool: boolean) =>
      allRows(shortcutColumns({ ...FEATURES, tokenTool })).filter((row) => toolOf(row) === 'token')
    expect(tokenRows(false)).toEqual([])
    expect(tokenRows(true).map((row) => row.combo.keys)).toEqual([[TOOL_SHORTCUTS.token]])
  })

  it('o ? tem as duas leituras: com pino troca o tipo, sem pino abre esta tela', () => {
    const question = allRows().filter((row) => row.combo.keys.includes('?'))
    expect(question.map((row) => row.action?.kind).sort()).toEqual(['showShortcuts', 'togglePinType'])
    for (const row of question) expect(row.what.toLowerCase()).toContain('pino')
  })

  it('agrupada por assunto: vários grupos com título, nenhum vazio, nenhuma linha comprida', () => {
    const groups = shortcutColumns().flat()
    expect(groups.length).toBeGreaterThanOrEqual(2)
    for (const group of groups) {
      expect(group.title.trim()).not.toBe('')
      expect(group.rows.length, `grupo "${group.title}" vazio`).toBeGreaterThan(0)
    }
    for (const row of allRows()) expect(row.what.length, `"${row.what}" comprida demais para uma linha`).toBeLessThanOrEqual(48)
  })
})
