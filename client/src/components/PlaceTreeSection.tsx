import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type UIEvent } from 'react'
import { CollapsibleSection } from './CollapsibleSection'
import { ChevronDownIcon } from './icons'
import { buildPlaceTree, visibleRows, type PlaceNode } from '../lib/placeTree'
import type { Region } from '../types/map'

export interface PlaceTreeSectionProps {
  /** As regiões da cena aberta: a árvore é das salas dela e de nenhuma outra. */
  regions: readonly Region[]
  /** Sala selecionada no editor: a linha dela fica marcada. */
  currentId: string | null
  /** Clique (ou Enter) numa linha: seleciona o local e enquadra ele com tudo que há dentro. */
  onFrame: (regionId: string) => void
}

/** Altura fixa de cada linha, em px: é ela que deixa virtualizar sem medir o DOM. Igual a `.lb-locais__item`. */
export const PLACE_ROW_HEIGHT = 28
/** Altura máxima da janela da árvore, em px; a lista rola dentro dela. */
const VIEW_MAX_HEIGHT = 360
/** Linhas montadas além da borda da janela, para a rolagem não mostrar buraco. */
const OVERSCAN_ROWS = 6
/** Recuo por nível, em px. */
const INDENT_PX = 14

const COUNT_FORMAT = new Intl.NumberFormat('pt-BR')

function placesLabel(count: number): string {
  return count === 1 ? '1 local' : `${COUNT_FORMAT.format(count)} locais`
}

/** Minúsculo e sem acento: "Ó" e "o" começam igual para quem digita a inicial. */
function foldInitial(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * "Locais", na aba Mapa: a árvore Distrito > Quarteirão > Prédio > Piso >
 * Cômodo da cena aberta, pelo `Region.parentId` (`lib/placeTree.ts`). Cada
 * linha diz quantos locais há dentro; o clique enquadra o local no editor.
 *
 * Nasce recolhida e o corpo só existe aberto (`lazy`), como Objetos do mapa.
 * Aberta, é VIRTUALIZADA: na a09 são 2.828 locais, e só as linhas da janela
 * (mais uma folga) existem no DOM; a rolagem troca a janela, não a lista.
 */
export function PlaceTreeSection({ regions, currentId, onFrame }: PlaceTreeSectionProps) {
  return (
    <CollapsibleSection id="locais" title="Locais" defaultOpen={false} lazy>
      <PlaceTree regions={regions} currentId={currentId} onFrame={onFrame} />
    </CollapsibleSection>
  )
}

function PlaceTree({ regions, currentId, onFrame }: PlaceTreeSectionProps) {
  const tree = useMemo(() => buildPlaceTree(regions), [regions])
  /**
   * Locais cuja abertura difere do padrão. Padrão: o topo (os distritos) aberto,
   * o resto fechado — trocar de cena já mostra o nível seguinte sem clique.
   */
  const [toggled, setToggled] = useState<ReadonlySet<string>>(() => new Set())
  const [scrollTop, setScrollTop] = useState(0)
  /** Linha que o Tab alcança: a última que teve foco. */
  const [focusId, setFocusId] = useState<string | null>(null)
  const treeRef = useRef<HTMLDivElement | null>(null)
  /** Linha que precisa receber o foco depois do próximo desenho (ela pode ainda não estar montada). */
  const pendingFocus = useRef<string | null>(null)

  const isOpen = useCallback((node: PlaceNode) => (node.depth === 0) !== toggled.has(node.id), [toggled])
  const rows = useMemo(() => visibleRows(tree, isOpen), [tree, isOpen])
  const indexById = useMemo(() => new Map(rows.map((row, index) => [row.id, index])), [rows])

  useLayoutEffect(() => {
    const id = pendingFocus.current
    if (id === null) return
    pendingFocus.current = null
    for (const el of treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []) {
      if (el.dataset.local === id) {
        el.focus()
        return
      }
    }
  })

  if (tree.total === 0) {
    return <p className="lb-locais__vazio">Esta cena ainda não tem sala.</p>
  }

  const viewHeight = Math.min(rows.length * PLACE_ROW_HEIGHT, VIEW_MAX_HEIGHT)
  const tabId =
    focusId !== null && indexById.has(focusId) ? focusId : currentId !== null && indexById.has(currentId) ? currentId : (rows[0]?.id ?? null)
  const first = Math.max(0, Math.floor(scrollTop / PLACE_ROW_HEIGHT) - OVERSCAN_ROWS)
  const last = Math.min(rows.length, Math.ceil((scrollTop + viewHeight) / PLACE_ROW_HEIGHT) + OVERSCAN_ROWS)
  const mounted: number[] = []
  for (let i = first; i < last; i += 1) mounted.push(i)
  // A linha com foco continua montada fora da janela: desmontada, o foco cairia no nada.
  const tabIndex = tabId === null ? undefined : indexById.get(tabId)
  if (tabIndex !== undefined && (tabIndex < first || tabIndex >= last)) mounted.push(tabIndex)

  const toggle = (id: string) => {
    setToggled((before) => {
      const next = new Set(before)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Foca a linha `index`, rolando a janela só o bastante para ela aparecer. */
  const focusRow = (index: number) => {
    const row = rows[Math.max(0, Math.min(index, rows.length - 1))]
    if (row === undefined) return
    const el = treeRef.current
    const at = indexById.get(row.id) ?? 0
    const top = at * PLACE_ROW_HEIGHT
    let nextScroll = el?.scrollTop ?? scrollTop
    if (top < nextScroll) nextScroll = top
    else if (top + PLACE_ROW_HEIGHT > nextScroll + viewHeight) nextScroll = top + PLACE_ROW_HEIGHT - viewHeight
    if (el !== null) el.scrollTop = nextScroll
    setScrollTop(nextScroll)
    setFocusId(row.id)
    pendingFocus.current = row.id
  }

  /** Próxima linha, depois de `from` e dando a volta, cujo nome começa com `initial`. */
  const findByInitial = (from: number, initial: string): number => {
    for (let step = 1; step <= rows.length; step += 1) {
      const index = (from + step) % rows.length
      if (foldInitial(rows[index].name).startsWith(initial)) return index
    }
    return -1
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLElement)) return
    const id = event.target.dataset.local
    const index = id === undefined ? undefined : indexById.get(id)
    if (id === undefined || index === undefined) return
    const node = rows[index]
    const hasChildren = node.childIds.length > 0
    const pageRows = Math.max(1, Math.floor(viewHeight / PLACE_ROW_HEIGHT) - 1)
    switch (event.key) {
      case 'ArrowDown':
        focusRow(index + 1)
        break
      case 'ArrowUp':
        focusRow(index - 1)
        break
      case 'PageDown':
        focusRow(index + pageRows)
        break
      case 'PageUp':
        focusRow(index - pageRows)
        break
      case 'Home':
        focusRow(0)
        break
      case 'End':
        focusRow(rows.length - 1)
        break
      case 'ArrowRight':
        // Fechado abre; aberto entra no primeiro de dentro.
        if (hasChildren && !isOpen(node)) toggle(node.id)
        else if (hasChildren) focusRow(index + 1)
        break
      case 'ArrowLeft':
        // Aberto fecha; fechado (ou sem filhos) volta ao local de fora.
        if (hasChildren && isOpen(node)) toggle(node.id)
        else if (node.parentId !== null) focusRow(indexById.get(node.parentId) ?? index)
        break
      case 'Enter':
      case ' ':
        onFrame(node.id)
        break
      default: {
        // Letra salta para o local que começa com ela. Sem modificador, para
        // Ctrl+Z e companhia seguirem ao editor.
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return
        const found = findByInitial(index, foldInitial(event.key))
        if (found >= 0) focusRow(found)
      }
    }
    // Tecla que a árvore usou não segue para o mapa: lá seta empurra a
    // seleção e letra troca de ferramenta.
    event.preventDefault()
    event.stopPropagation()
  }

  const onScroll = (event: UIEvent<HTMLDivElement>) => setScrollTop(event.currentTarget.scrollTop)

  return (
    <div className="lb-locais">
      <p className="lb-locais__resumo" role="status">
        {placesLabel(tree.total)}. Clique num local para enquadrá-lo.
      </p>
      <div
        ref={treeRef}
        role="tree"
        aria-label="Locais da cena"
        className="lb-locais__arvore lb-scroll"
        style={{ height: viewHeight }}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
      >
        <div className="lb-locais__espaco" style={{ height: `${rows.length * PLACE_ROW_HEIGHT}px` }}>
          {mounted.map((index) => {
            const node = rows[index]
            const hasChildren = node.childIds.length > 0
            const open = hasChildren && isOpen(node)
            const inside = node.descendantCount === 0 ? '' : `, ${placesLabel(node.descendantCount)} dentro`
            return (
              <div
                key={node.id}
                role="treeitem"
                data-local={node.id}
                className="lb-locais__item"
                aria-label={`${node.name}${inside}`}
                aria-level={node.depth + 1}
                aria-posinset={node.position}
                aria-setsize={node.siblings}
                aria-expanded={hasChildren ? open : undefined}
                aria-selected={node.id === currentId}
                tabIndex={node.id === tabId ? 0 : -1}
                title={`Enquadrar ${node.name}`}
                style={{ top: index * PLACE_ROW_HEIGHT, paddingLeft: node.depth * INDENT_PX }}
                onFocus={() => setFocusId(node.id)}
                onClick={() => onFrame(node.id)}
              >
                {hasChildren ? (
                  // A seta abre e fecha sem enquadrar; pelo teclado quem abre são ← e →.
                  <span
                    className="lb-locais__seta"
                    data-aberta={open ? 'true' : undefined}
                    aria-hidden="true"
                    onClick={(event) => {
                      event.stopPropagation()
                      toggle(node.id)
                    }}
                  >
                    <ChevronDownIcon size={14} />
                  </span>
                ) : (
                  <span className="lb-locais__recuo" aria-hidden="true" />
                )}
                <span className="lb-locais__nome">{node.name}</span>
                {node.descendantCount > 0 && (
                  <span className="lb-num lb-locais__conta" aria-hidden="true">
                    {COUNT_FORMAT.format(node.descendantCount)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
