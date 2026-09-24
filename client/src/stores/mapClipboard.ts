import type { Point } from '../pixi/world'
import type { MapData } from '../types/map'
import type { SelectionKind } from '../types/tools'
import type { SelectionSet } from '../lib/selectionModel'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'

/**
 * Ctrl+C / Ctrl+X / Ctrl+V do editor — a ponte entre o teclado
 * (`pixi/PixiCanvas.tsx`, `runShortcut`) e a área de transferência da store
 * (`clipboard`, `copySelected`, `cutSelected`, `pasteClipboardAt` em
 * `mapStore.ts`). Fica fora do `PixiCanvas` para ser testável sem Pixi.
 *
 * A área de transferência é do APP, não do sistema: o que se copia é pedaço de
 * mapa (sala com paredes e sub-salas, desenho, chão…), e colar em outra cena
 * ou em outro mapa só precisa que o app continue aberto.
 */

/** Onde colar: o ponteiro sobre o mapa ou, com ele fora, o centro da vista. */
export interface PasteTarget {
  /** Último ponto do ponteiro sobre o canvas, px de mundo; `null` fora dele. */
  cursor: Point | null
  /** Centro da vista, px de mundo — usado quando não há ponteiro. */
  fallback: Point
}

export type ClipboardShortcut = 'copy' | 'cut' | 'paste'

const NOTHING_COPIED_TEXT = 'Nada copiado ainda — selecione algo e use Ctrl+C ou Ctrl+X'
const PASTE_HINT = 'Ctrl+V cola perto do cursor'

interface Noun {
  text: string
  feminine: boolean
  plural: boolean
}

const NOUNS: Record<SelectionKind, string> = {
  wall: 'Parede',
  region: 'Região',
  stair: 'Escada',
  light: 'Luz',
  token: 'Token',
  prop: 'Objeto',
  drawing: 'Desenho',
  floor: 'Pedaço de chão',
}
const FEMININE: ReadonlySet<SelectionKind> = new Set<SelectionKind>(['wall', 'region', 'stair', 'light'])

/** "Sala "Despensa"", "Desenho", "3 itens" — o que o aviso diz que foi guardado. */
function describeItems(map: MapData, items: SelectionSet): Noun {
  if (items.length !== 1) return { text: `${items.length} itens`, feminine: false, plural: true }
  const item = items[0]
  const room = item.kind === 'region' ? map.regions.find((r) => r.id === item.id)?.room : undefined
  if (room !== undefined) {
    const name = room.name.trim()
    return { text: name === '' ? 'Sala' : `Sala "${name}"`, feminine: true, plural: false }
  }
  return { text: NOUNS[item.kind], feminine: FEMININE.has(item.kind), plural: false }
}

function participle(stem: string, noun: Noun): string {
  return `${stem}${noun.feminine ? 'a' : 'o'}${noun.plural ? 's' : ''}`
}

/**
 * Executa o atalho. Devolve `true` quando o app tratou a tecla — quem chama
 * então impede o Ctrl+C/X/V do navegador. Copiar ou recortar sem seleção
 * devolve `false` e fica calado: o gesto continua sendo do navegador (copiar
 * texto da interface). Colar sem nada copiado explica o que fazer.
 */
export function runClipboardShortcut(kind: ClipboardShortcut, target: PasteTarget | null): boolean {
  const store = useMapStore.getState()
  const toast = useToastStore.getState()
  if (kind === 'paste') {
    if (store.clipboard === null) {
      toast.push('info', NOTHING_COPIED_TEXT)
      return false
    }
    if (target === null) return false
    return store.pasteClipboardAt(target.cursor ?? target.fallback)
  }
  const { map, selection } = store
  const done = kind === 'copy' ? store.copySelected() : store.cutSelected()
  if (!done) return false
  const noun = describeItems(map, selection)
  const text =
    kind === 'copy'
      ? `${noun.text} ${participle('copiad', noun)} — ${PASTE_HINT}`
      : `${noun.text} ${participle('recortad', noun)} — ${PASTE_HINT}, Ctrl+Z desfaz`
  toast.push('info', text)
  return true
}
