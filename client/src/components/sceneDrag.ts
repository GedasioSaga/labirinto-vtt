import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/**
 * ARRASTAR UMA CENA SOBRE OUTRA na lista Cenas (CENAS EM PASTAS): soltar em
 * cima de uma cena põe a arrastada dentro dela; soltar na faixa "primeiro
 * nível" a tira da pasta.
 *
 * É gesto de ponteiro, e não o arrastar do HTML (`draggable`): no Windows o
 * WebView do Tauri toma o arrastar do HTML para soltar arquivo na janela, e a
 * lista nunca receberia o gesto. Com ponteiro o mesmo código vale no app, no
 * navegador e no teste.
 *
 * O hook só sabe ONDE o ponteiro está (`target`); se ali pode soltar, e o que
 * acontece ao soltar, quem decide é a seção, que conhece a árvore.
 */

/** Onde a cena arrastada cairia: dentro de uma cena, ou no primeiro nível. */
export type SceneDropTarget = { kind: 'cena'; sceneId: string } | { kind: 'raiz' }

/** O arrasto em andamento: qual cena, e o que está sob o ponteiro agora. */
export interface SceneDrag {
  sceneId: string
  target: SceneDropTarget | null
}

/** Quanto o ponteiro anda antes de o clique virar arrasto: o tremor da mão num clique não arrasta. */
export const SCENE_DRAG_THRESHOLD_PX = 5

/** O fantasma fica ao lado da ponta do ponteiro, sem cobrir a linha onde a cena vai cair. */
const GHOST_OFFSET_PX = 14

/** Classe no `<html>` durante o arrasto: a mão fechada em toda a janela e nada de selecionar texto. */
const DRAGGING_CLASS = 'lb-arrastando-cena'

function sameTarget(a: SceneDropTarget | null, b: SceneDropTarget | null): boolean {
  if (a === null || b === null) return a === b
  if (a.kind === 'raiz' || b.kind === 'raiz') return a.kind === b.kind
  return a.sceneId === b.sceneId
}

/**
 * O que está sob a ponta do ponteiro: a linha de uma cena, a faixa "primeiro
 * nível" ou nada. `elementFromPoint` acha a linha mesmo com o ponteiro preso
 * ao elemento onde o gesto começou (o dedo prende); o fantasma não conta, ele
 * tem `pointer-events: none`. Sem `elementFromPoint` (jsdom), vale o alvo do
 * próprio evento.
 */
function targetAt(x: number, y: number, fallback: EventTarget | null): SceneDropTarget | null {
  const hit = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(x, y) : null
  const element = hit ?? (fallback instanceof Element ? fallback : null)
  if (element === null) return null
  if (element.closest('[data-cena-raiz]') !== null) return { kind: 'raiz' }
  const sceneId = element.closest<HTMLElement>('[data-cena-id]')?.dataset.cenaId
  return sceneId === undefined || sceneId === '' ? null : { kind: 'cena', sceneId }
}

export interface SceneDragApi {
  /** `null` fora do arrasto — e também entre apertar e andar os primeiros pixels. */
  drag: SceneDrag | null
  /** Ref do fantasma que segue o ponteiro; ele é posto no lugar sem render, a cada movimento. */
  ghostRef: (element: HTMLElement | null) => void
  /** `onPointerDown` da linha: arma o arrasto de `sceneId`, que só começa quando o ponteiro anda. */
  begin: (sceneId: string, event: ReactPointerEvent<HTMLElement>) => void
  /**
   * Chamado no clique do nome da cena. Soltar no mesmo nome onde o gesto
   * começou faz o navegador disparar o clique: `true` diz que esse clique é
   * o fim de um arrasto e não troca de cena.
   */
  swallowClick: () => boolean
}

export function useSceneDrag(onDrop: (sceneId: string, target: SceneDropTarget) => void): SceneDragApi {
  const [drag, setDrag] = useState<SceneDrag | null>(null)
  const dropRef = useRef(onDrop)
  const ghost = useRef<HTMLElement | null>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const swallow = useRef(false)
  /** Desliga os ouvintes do gesto em andamento; `null` = nenhum gesto. */
  const detach = useRef<(() => void) | null>(null)

  useEffect(() => {
    dropRef.current = onDrop
  }, [onDrop])

  // A seção fechou (troca de aba) no meio do gesto: nada de ouvinte órfão na janela.
  useEffect(() => () => detach.current?.(), [])

  const placeGhost = () => {
    const element = ghost.current
    if (element === null) return
    element.style.transform = `translate3d(${pointer.current.x + GHOST_OFFSET_PX}px, ${pointer.current.y + GHOST_OFFSET_PX}px, 0)`
  }

  const ghostRef = useCallback((element: HTMLElement | null) => {
    ghost.current = element
    placeGhost()
  }, [])

  const begin = (sceneId: string, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || detach.current !== null) return
    const { pointerId } = event
    const start = { x: event.clientX, y: event.clientY }
    pointer.current = start
    let started = false
    let cancelled = false
    let target: SceneDropTarget | null = null

    const endVisuals = () => {
      document.documentElement.classList.remove(DRAGGING_CLASS)
      setDrag(null)
    }

    const follow = (x: number, y: number, fallback: EventTarget | null) => {
      const next = targetAt(x, y, fallback)
      if (sameTarget(next, target)) return
      target = next
      setDrag({ sceneId, target })
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId || cancelled) return
      pointer.current = { x: e.clientX, y: e.clientY }
      if (!started) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < SCENE_DRAG_THRESHOLD_PX) return
        started = true
        window.getSelection()?.removeAllRanges()
        document.documentElement.classList.add(DRAGGING_CLASS)
        target = targetAt(e.clientX, e.clientY, e.target)
        setDrag({ sceneId, target })
      }
      e.preventDefault()
      placeGhost()
      follow(e.clientX, e.clientY, e.target)
    }

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      const dropped = started && !cancelled ? targetAt(e.clientX, e.clientY, e.target) : null
      stop()
      if (!started) return
      // O clique que o navegador ainda dispara (botão desceu e subiu no mesmo
      // nome) é do arrasto. Ele chega nesta mesma volta do laço de eventos; na
      // próxima, o clique volta a trocar de cena.
      swallow.current = true
      setTimeout(() => {
        swallow.current = false
      }, 0)
      if (dropped !== null) dropRef.current(sceneId, dropped)
    }

    // Esc desiste do arrasto — e não chega ao mapa, onde largaria a seleção.
    // O gesto segue armado até soltar, para o clique do fim também ser engolido.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !started || cancelled) return
      e.preventDefault()
      e.stopPropagation()
      cancelled = true
      endVisuals()
    }

    // A roda rola a lista por baixo do ponteiro parado: o destino é o que ficou sob ele.
    const onScroll = () => {
      if (started && !cancelled) follow(pointer.current.x, pointer.current.y, null)
    }

    const onGone = () => stop()

    function stop() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', onGone)
      document.removeEventListener('scroll', onScroll, true)
      detach.current = null
      if (started && !cancelled) endVisuals()
    }

    function onCancel(e: PointerEvent) {
      if (e.pointerId === pointerId) stop()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', onGone)
    document.addEventListener('scroll', onScroll, true)
    detach.current = stop
  }

  const swallowClick = () => swallow.current

  return { drag, ghostRef, begin, swallowClick }
}
