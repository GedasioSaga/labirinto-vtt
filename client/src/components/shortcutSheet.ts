import { FEATURES, type FeatureFlags } from '../lib/features'
import { hiddenTools, TOOL_SHORTCUTS, type Action, type ShortcutEvent } from '../lib/keymap'
import type { DrawingTool } from '../types/tools'
import { TOOL_LABELS, TOOLBAR_SLOTS, toolsOfSlot } from './labels'

/**
 * O que a tela de atalhos (tecla `?`, `ShortcutsDialog.tsx`) mostra: cada
 * letra e cada combinação, com o que ela faz, agrupadas por assunto. PURO: só
 * dados, sem DOM.
 *
 * Duas amarras para a tela não mentir:
 *  - as letras de ferramenta saem de `TOOL_SHORTCUTS`/`TOOL_LABELS`, a MESMA
 *    tabela que escreve o "(W)" nos balões da barra, e na ordem da barra;
 *  - toda linha que é atalho do mapa de teclas diz qual `Action` promete, e o
 *    teste ao lado aperta a tecla em `resolveShortcut` para conferir. Linha sem
 *    `action` é gesto que o canvas trata antes do mapa de teclas (roda,
 *    Espaço, Enter, L segurado), conferido no código que o trata.
 */

export interface ShortcutCombo {
  /** Teclas apertadas juntas, como estão escritas no teclado: ['Ctrl', 'Z']. Vazio = só mouse. */
  keys: readonly string[]
  /** O que o mouse faz junto, por extenso ("arrastar"). */
  mouse?: string
  /** A tecla fica apertada durante o gesto: segurar L é laser, tocar L é a Linha. */
  hold?: boolean
}

export interface ShortcutRow {
  /** O que acontece, começando pelo verbo — ou o nome da ferramenta. */
  what: string
  combo: ShortcutCombo
  /** A ação de `resolveShortcut` que esta linha promete. */
  action?: Action
  /** A situação em que a promessa vale (pino selecionado, traço aberto). */
  when?: Pick<ShortcutEvent, 'canTogglePinType' | 'hasPointDraft'>
}

export interface ShortcutGroup {
  title: string
  rows: readonly ShortcutRow[]
}

/**
 * Toda ação do mapa de teclas tem linha na tela. `Record` exaustivo: ação nova
 * em `lib/keymap.ts` sem entrada aqui não compila, e o teste ao lado cobra a
 * linha — a tela não esquece um atalho em silêncio (o mesmo cuidado de
 * `TOOL_SHORTCUTS` com as ferramentas).
 */
export const DOCUMENTED_ACTIONS: Record<Action['kind'], true> = {
  selectTool: true,
  nudge: true,
  duplicate: true,
  save: true,
  open: true,
  zoomReset: true,
  selectAll: true,
  fitAll: true,
  cancel: true,
  deleteSelected: true,
  undo: true,
  redo: true,
  undoDraftPoint: true,
  togglePinType: true,
  showShortcuts: true,
}

/**
 * Grupos da barra (`TOOLBAR_SLOTS`) que viram "Construir": Selecionar e o
 * grupo da planta (parede, porta, salas, chão...). Os seguintes — Desenho,
 * Texto, Pino, Medir, Borracha — são "Desenhar e anotar".
 */
const TOOLBAR_GROUPS_TO_BUILD = 2

function toolRow(tool: DrawingTool, hidden: ReadonlySet<DrawingTool>): ShortcutRow | null {
  const letter = TOOL_SHORTCUTS[tool]
  const label = TOOL_LABELS[tool]
  // Sem letra (Sala livre, Caminho), sem rótulo ou escondida por flag: a
  // tecla não faz nada, então a tela não a promete.
  if (letter === '' || !label || hidden.has(tool)) return null
  return { what: label, combo: { keys: [letter] }, action: { kind: 'selectTool', tool } }
}

function toolGroups(flags: Readonly<FeatureFlags>): [ShortcutGroup, ShortcutGroup] {
  const hidden = hiddenTools(flags)
  const build: ShortcutRow[] = []
  const draw: ShortcutRow[] = []
  const listed = new Set<DrawingTool>()
  TOOLBAR_SLOTS.forEach((slots, groupIndex) => {
    for (const tool of slots.flatMap(toolsOfSlot)) {
      const row = toolRow(tool, hidden)
      if (row === null) continue
      listed.add(tool)
      if (groupIndex < TOOLBAR_GROUPS_TO_BUILD) build.push(row)
      else draw.push(row)
    }
  })
  // Letra que vale sem botão na barra (o Token, quando a flag volta): a tecla
  // funciona, então a linha existe. `Object.keys` de um Record exaustivo só
  // devolve ferramentas de verdade (ver `buildToolByLetter`).
  for (const tool of Object.keys(TOOL_SHORTCUTS) as DrawingTool[]) {
    if (listed.has(tool)) continue
    const row = toolRow(tool, hidden)
    if (row !== null) build.push(row)
  }
  return [
    { title: 'Construir', rows: build },
    { title: 'Desenhar e anotar', rows: draw },
  ]
}

const EDIT_GROUP: ShortcutGroup = {
  title: 'Editar',
  rows: [
    { what: 'Desfazer', combo: { keys: ['Ctrl', 'Z'] }, action: { kind: 'undo' } },
    { what: 'Refazer', combo: { keys: ['Ctrl', 'Y'] }, action: { kind: 'redo' } },
    { what: 'Duplicar a seleção', combo: { keys: ['Ctrl', 'D'] }, action: { kind: 'duplicate' } },
    { what: 'Selecionar tudo', combo: { keys: ['Ctrl', 'A'] }, action: { kind: 'selectAll' } },
    { what: 'Apagar a seleção', combo: { keys: ['Delete'] }, action: { kind: 'deleteSelected' } },
    { what: 'Mover a seleção 1 quadrado', combo: { keys: ['Setas'] }, action: { kind: 'nudge', dx: 1, dy: 0, fine: false } },
    { what: 'Mover 10 quadrados', combo: { keys: ['Shift', 'Setas'] }, action: { kind: 'nudge', dx: 10, dy: 0, fine: false } },
    { what: 'Mover 1 pixel', combo: { keys: ['Alt', 'Setas'] }, action: { kind: 'nudge', dx: 1, dy: 0, fine: true } },
    { what: 'Soltar a seleção', combo: { keys: ['Esc'] }, action: { kind: 'cancel' } },
    {
      what: 'Trocar ! e ? no pino selecionado',
      combo: { keys: ['?'] },
      action: { kind: 'togglePinType' },
      when: { canTogglePinType: true },
    },
    { what: 'Abrir esta tela, sem pino selecionado', combo: { keys: ['?'] }, action: { kind: 'showShortcuts' } },
  ],
}

/** Região, Sala livre, Polígono, Caminho e o corredor do Chão: clique a clique. */
const TRACE_GROUP: ShortcutGroup = {
  title: 'Traço ponto a ponto',
  rows: [
    // Tratado no canvas antes do mapa de teclas (`PixiCanvas.tsx`, Enter com rascunho aberto).
    { what: 'Fechar o traço', combo: { keys: ['Enter'] } },
    { what: 'Tirar o último ponto', combo: { keys: ['Backspace'] }, action: { kind: 'undoDraftPoint' }, when: { hasPointDraft: true } },
    { what: 'Cancelar o traço', combo: { keys: ['Esc'] }, action: { kind: 'cancel' } },
  ],
}

const VIEW_GROUP: ShortcutGroup = {
  title: 'Vista',
  rows: [
    { what: 'Enquadrar tudo', combo: { keys: ['F'] }, action: { kind: 'fitAll' } },
    { what: 'Zoom em 100%', combo: { keys: ['Ctrl', '0'] }, action: { kind: 'zoomReset' } },
    // Os três abaixo são gestos do canvas, fora do mapa de teclas:
    // `resolveMapWheel` (roda = zoom), Espaço armando o pan e o L do laser.
    { what: 'Aproximar e afastar', combo: { keys: [], mouse: 'roda do mouse' } },
    { what: 'Mover a vista', combo: { keys: ['Espaço'], mouse: 'arrastar' } },
    { what: 'Apontar o laser', combo: { keys: ['L'], mouse: 'arrastar', hold: true } },
  ],
}

const FILE_GROUP: ShortcutGroup = {
  title: 'Arquivo',
  rows: [
    { what: 'Salvar', combo: { keys: ['Ctrl', 'S'] }, action: { kind: 'save' } },
    { what: 'Abrir mapa', combo: { keys: ['Ctrl', 'O'] }, action: { kind: 'open' } },
  ],
}

/**
 * As colunas da tela, cada uma com seus grupos, na ordem de leitura. As
 * ferramentas vêm primeiro porque são a pergunta mais comum ("qual é a letra
 * da Porta?"); edição e traço fecham a terceira coluna.
 */
export function shortcutColumns(flags: Readonly<FeatureFlags> = FEATURES): ShortcutGroup[][] {
  const [build, draw] = toolGroups(flags)
  return [
    [build, FILE_GROUP],
    [draw, VIEW_GROUP],
    [EDIT_GROUP, TRACE_GROUP],
  ]
}
