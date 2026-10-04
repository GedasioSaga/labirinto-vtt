import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { isRightColumnShortcut, RIGHT_COLUMN_SHORTCUT } from '../lib/keymap'
import { ChatUnreadBadge, chatUnreadLabel, type ChatUnread } from './MasterChatPanel'
import { ChevronsLeftIcon, ChevronsRightIcon } from './icons'
import './RightColumn.css'

/**
 * COLUNA DA DIREITA do mestre, espelho do rail da esquerda: em cima as abas
 * "Jogo | Chat", embaixo as Cenas, com um divisor arrastável entre as duas.
 * A coluna inteira se esconde (botão ou Shift+J) para liberar o mapa; aí sobra
 * só um botão pequeno na borda direita, que leva o contador do chat.
 *
 * Tudo fica montado mesmo escondido (`hidden`): o rascunho do chat, o filtro
 * das Cenas e o estado interno do painel Jogo sobrevivem a esconder e mostrar.
 */

export type RightColumnTab = 'room' | 'chat'

export interface RightColumnTabDef {
  id: RightColumnTab
  label: string
  /** O que espera leitura nesta aba (a do Chat): número na aba e no nome dela. */
  unread?: ChatUnread
  panel: ReactNode
}

export interface RightColumnProps {
  open: boolean
  onOpenChange(open: boolean): void
  /** Vazio = sem abas (navegador puro, sem sala possível): as Cenas ficam com a coluna toda. */
  tabs: readonly RightColumnTabDef[]
  active: RightColumnTab
  onActiveChange(tab: RightColumnTab): void
  /** A seção Cenas inteira (ScenesSection). */
  scenes: ReactNode
  /** Cenas aberta? Recolhida, ela vira só o cabeçalho e as abas ocupam o resto. */
  scenesOpen: boolean
  /** O que o chat ainda não leu, para o botão de reabrir a coluna. */
  unread: ChatUnread
  /** Linha acima das abas (o "Pausar NPCs", que com a coluna aberta mora aqui). */
  top?: ReactNode
  /** A coluna, para o mapa centrar o "Ir lá" no que ela deixa livre. */
  columnRef?: { current: HTMLElement | null }
}

const OPEN_KEY = 'lb-coldir:aberta'
const SCENES_KEY = 'lb-coldir:cenas'

/** Abaixo desta largura de janela, sem escolha lembrada, a coluna nasce escondida: as duas colunas comeriam o mapa. */
export const RIGHT_COLUMN_NARROW_PX = 1024
/** Altura das Cenas quando o mestre nunca arrastou o divisor. */
export const SCENES_DEFAULT_PX = 320
/** Menor altura das Cenas aberta: o cabeçalho e duas linhas da lista. */
export const SCENES_MIN_PX = 120
/** Menor altura das abas em cima: as abas e o começo do painel. */
export const TABS_MIN_PX = 180
/** Passo das setas no divisor; com Shift, o passo grande. */
export const DIVIDER_STEP_PX = 16
export const DIVIDER_BIG_STEP_PX = 64

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Sem armazenamento a escolha vale só nesta sessão.
  }
}

function readStoredOpen(): boolean {
  const raw = readStored(OPEN_KEY)
  if (raw === '1') return true
  if (raw === '0') return false
  return window.innerWidth >= RIGHT_COLUMN_NARROW_PX
}

function readStoredScenesPx(): number {
  const value = Number(readStored(SCENES_KEY))
  return Number.isFinite(value) && value >= SCENES_MIN_PX ? Math.round(value) : SCENES_DEFAULT_PX
}

/** Aberta ou escondida, lembrado entre as sessões (o dono é o App: o chat e o resto da tela leem). */
export function useRightColumnOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(readStoredOpen)
  const change = useCallback((next: boolean) => {
    setOpen(next)
    writeStored(OPEN_KEY, next ? '1' : '0')
  }, [])
  return [open, change]
}

const tabId = (tab: RightColumnTab) => `lb-rail-tab-${tab}`
const panelId = (tab: RightColumnTab) => `lb-rail-panel-${tab}`

export function RightColumn({ open, onOpenChange, tabs, active, onActiveChange, scenes, scenesOpen, unread, top, columnRef }: RightColumnProps) {
  const baseId = useId()
  const columnId = `${baseId}-coluna`
  const scenesId = `${baseId}-cenas`
  const columnEl = useRef<HTMLElement | null>(null)
  const tabsEl = useRef<HTMLDivElement | null>(null)
  const scenesEl = useRef<HTMLDivElement | null>(null)
  const reopenEl = useRef<HTMLButtonElement | null>(null)
  const tabButtons = useRef<Partial<Record<RightColumnTab, HTMLButtonElement | null>>>({})
  const [scenesPx, setScenesPx] = useState(readStoredScenesPx)
  const [dragging, setDragging] = useState(false)
  // Aberta pelo clique: entra deslizando da borda. Pelo teclado, aparece parada.
  const [slideIn, setSlideIn] = useState(false)
  // Para onde o foco vai depois de esconder ou mostrar (o botão que sumiu levaria o foco junto).
  const focusAfter = useRef<'reopen' | 'tab' | null>(null)
  // O teto do divisor para o leitor de tela, medido depois do layout (nunca no render).
  const [ariaMax, setAriaMax] = useState<number | null>(null)
  const drag = useRef<{ pointerId: number; startY: number; startPx: number; max: number; px: number } | null>(null)

  const hasTabs = tabs.length > 0
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0]
  const showDivider = hasTabs && scenesOpen

  // Estável entre renders: o React não desliga e religa a ref a cada render do App.
  const columnRefProp = useRef(columnRef)
  columnRefProp.current = columnRef
  const setColumnEl = useCallback((el: HTMLElement | null) => {
    columnEl.current = el
    if (columnRefProp.current !== undefined) columnRefProp.current.current = el
  }, [])

  /** Maior altura das Cenas agora: o que as duas metades somam, menos o mínimo das abas. Sem medida (jsdom), sem teto. */
  const maxScenesPx = (): number => {
    const total = (tabsEl.current?.offsetHeight ?? 0) + (scenesEl.current?.offsetHeight ?? 0)
    return total > 0 ? Math.max(SCENES_MIN_PX, total - TABS_MIN_PX) : Number.POSITIVE_INFINITY
  }
  const clampScenes = (px: number, max = maxScenesPx()) => Math.round(Math.min(Math.max(px, SCENES_MIN_PX), max))

  const commitScenesPx = (px: number) => {
    setScenesPx(px)
    writeStored(SCENES_KEY, String(px))
  }

  const hide = (focus: boolean) => {
    if (focus) focusAfter.current = 'reopen'
    onOpenChange(false)
  }
  const show = (byPointer: boolean, focus: boolean) => {
    setSlideIn(byPointer)
    if (focus) focusAfter.current = 'tab'
    onOpenChange(true)
  }

  useLayoutEffect(() => {
    const target = focusAfter.current
    focusAfter.current = null
    if (target === 'reopen' && !open) reopenEl.current?.focus()
    if (target === 'tab' && open) (current === undefined ? null : tabButtons.current[current.id])?.focus()
  }, [open, current])

  // Shift+J de qualquer ponto do editor, menos num campo de texto.
  const openRef = useRef(open)
  openRef.current = open
  const toggleRef = useRef({ hide, show })
  toggleRef.current = { hide, show }
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      const pressed = isRightColumnShortcut({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        targetTagName: target?.tagName ?? '',
        targetInputType: target instanceof HTMLInputElement ? target.type : undefined,
        targetContentEditable: target?.isContentEditable ?? false,
      })
      if (!pressed) return
      event.preventDefault()
      const focusInColumn = target !== null && columnEl.current?.contains(target) === true
      if (openRef.current) toggleRef.current.hide(focusInColumn)
      else toggleRef.current.show(false, target === reopenEl.current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useLayoutEffect(() => {
    if (!open || !showDivider) return
    const measure = () => {
      const max = maxScenesPx()
      setAriaMax(Number.isFinite(max) ? max : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // `maxScenesPx` lê só refs: muda quando a altura das Cenas ou a coluna mudam.
  }, [open, showDivider, scenesPx])

  const selectTab = (tab: RightColumnTab) => {
    onActiveChange(tab)
    tabButtons.current[tab]?.focus()
  }

  const onTabsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === current?.id)
    if (index < 0) return
    let next = -1
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    if (next < 0) return
    event.preventDefault()
    selectTab(tabs[next].id)
  }

  // ── Divisor: arrasto escreve a altura direto no estilo (sem render por movimento); soltar grava.

  const onDividerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const startPx = scenesEl.current?.offsetHeight || scenesPx
    drag.current = { pointerId: event.pointerId, startY: event.clientY, startPx, max: maxScenesPx(), px: startPx }
    setDragging(true)
  }

  const onDividerPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (state === null || state.pointerId !== event.pointerId) return
    // Divisor para cima = Cenas maior.
    const px = clampScenes(state.startPx + (state.startY - event.clientY), state.max)
    if (px === state.px) return
    state.px = px
    columnEl.current?.style.setProperty('--lb-coldir-cenas', `${px}px`)
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (state === null || state.pointerId !== event.pointerId) return
    drag.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setDragging(false)
    if (state.px !== state.startPx || state.px !== scenesPx) commitScenesPx(state.px)
  }

  const onDividerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? DIVIDER_BIG_STEP_PX : DIVIDER_STEP_PX
    const max = maxScenesPx()
    const now = clampScenes(scenesEl.current?.offsetHeight || scenesPx, max)
    let next: number | null = null
    if (event.key === 'ArrowUp') next = now + step
    else if (event.key === 'ArrowDown') next = now - step
    else if (event.key === 'Home') next = Number.isFinite(max) ? max : now
    else if (event.key === 'End') next = SCENES_MIN_PX
    if (next === null) return
    event.preventDefault()
    commitScenesPx(clampScenes(next, max))
  }

  const columnStyle = { '--lb-coldir-cenas': `${scenesPx}px` } as CSSProperties
  const columnClass = [
    'lb-coldir',
    hasTabs ? '' : 'lb-coldir--so-cenas',
    showDivider ? '' : 'lb-coldir--cenas-recolhida',
    dragging ? 'lb-coldir--arrastando' : '',
  ]
    .filter((name) => name !== '')
    .join(' ')
  const hideButton = (
    <button
      type="button"
      className="lb-coldir__esconder"
      aria-label="Esconder a coluna da direita"
      aria-controls={columnId}
      aria-expanded={true}
      aria-keyshortcuts={RIGHT_COLUMN_SHORTCUT}
      title={`Esconder Jogo, Chat e Cenas para ver mais mapa (${RIGHT_COLUMN_SHORTCUT})`}
      onClick={() => hide(true)}
    >
      <ChevronsRightIcon size={16} />
    </button>
  )

  return (
    <>
      <aside
        id={columnId}
        ref={setColumnEl}
        className={columnClass}
        aria-label={hasTabs ? 'Jogo, chat e cenas' : 'Cenas da aventura'}
        hidden={!open}
        data-entrada={slideIn ? 'deslizando' : undefined}
        style={columnStyle}
      >
        {top}
        {hasTabs ? (
          <div ref={tabsEl} className="lb-coldir__abas">
            <div className="lb-panel lb-coldir__head">
              <div className="lb-railtabs lb-coldir__tabs" role="tablist" aria-label="Jogo e chat" onKeyDown={onTabsKeyDown}>
                {tabs.map((tab) => {
                  const unreadHere = tab.unread
                  return (
                    <button
                      key={tab.id}
                      ref={(el) => {
                        tabButtons.current[tab.id] = el
                      }}
                      type="button"
                      role="tab"
                      id={tabId(tab.id)}
                      className="lb-railtabs__tab lb-coldir__tab"
                      aria-selected={current?.id === tab.id}
                      aria-controls={panelId(tab.id)}
                      aria-label={unreadHere === undefined ? undefined : chatUnreadLabel(tab.label, unreadHere)}
                      tabIndex={current?.id === tab.id ? 0 : -1}
                      onClick={() => onActiveChange(tab.id)}
                    >
                      {tab.label}
                      {unreadHere !== undefined && <ChatUnreadBadge unread={unreadHere} />}
                    </button>
                  )
                })}
              </div>
              {hideButton}
            </div>
            {tabs.map((tab) => (
              <div
                key={tab.id}
                role="tabpanel"
                id={panelId(tab.id)}
                aria-labelledby={tabId(tab.id)}
                className="lb-railtabs__panel lb-railtabs__panel--fill lb-coldir__painel"
                hidden={current?.id !== tab.id}
              >
                {tab.panel}
              </div>
            ))}
          </div>
        ) : (
          <div className="lb-coldir__head lb-coldir__head--solo">{hideButton}</div>
        )}
        {showDivider && (
          <div
            className="lb-coldir__divisor"
            role="separator"
            aria-orientation="horizontal"
            aria-controls={scenesId}
            aria-label="Altura das Cenas"
            aria-valuenow={scenesPx}
            aria-valuemin={SCENES_MIN_PX}
            aria-valuemax={ariaMax ?? undefined}
            title="Arraste, ou use as setas, para repartir a altura entre as abas e as Cenas. Duplo clique volta ao tamanho de antes."
            tabIndex={0}
            onPointerDown={onDividerPointerDown}
            onPointerMove={onDividerPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onDividerKeyDown}
            onDoubleClick={() => commitScenesPx(clampScenes(SCENES_DEFAULT_PX))}
          />
        )}
        {/* `div` com papel de região, e não `section`: as jornadas acham seções pela tag. */}
        <div ref={scenesEl} id={scenesId} className="lb-panel lb-coldir__cenas lb-scroll" role="region" aria-label="Cenas">
          {scenes}
        </div>
      </aside>
      {!open && (
        <button
          ref={reopenEl}
          type="button"
          className="lb-panel lb-coldir__reabrir"
          aria-label={chatUnreadLabel('Mostrar a coluna da direita', unread)}
          aria-controls={columnId}
          aria-expanded={false}
          aria-keyshortcuts={RIGHT_COLUMN_SHORTCUT}
          title={`Mostrar ${hasTabs ? 'Jogo, Chat e Cenas' : 'as Cenas'} (${RIGHT_COLUMN_SHORTCUT})`}
          onClick={() => show(true, true)}
        >
          <ChevronsLeftIcon size={16} />
          <ChatUnreadBadge unread={unread} />
        </button>
      )}
    </>
  )
}
