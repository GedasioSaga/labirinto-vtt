import { useEffect, type RefObject } from 'react'

/** Fração da distância que o halo percorre por quadro: dá inércia sem atrasar demais. */
const FOLLOW = 0.08
/** Abaixo disso (px) o halo é considerado parado e o laço dorme até o mouse mexer. */
const REST_PX = 0.5

/**
 * Faz o halo de lampião da tela inicial seguir o mouse com inércia.
 *
 * Decorativo: só liga com mouse de verdade (`hover: hover` + `pointer: fine`)
 * e sem "reduzir movimento". Escreve `transform` direto no elemento (nunca uma
 * variável CSS no pai, que recalcularia o estilo de toda a tela) e o laço de
 * `requestAnimationFrame` para sozinho quando o halo alcança o mouse.
 */
export function useLampGlow(stageRef: RefObject<HTMLElement | null>, glowRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const stage = stageRef.current
    const glow = glowRef.current
    if (!stage || !glow || typeof window.matchMedia !== 'function') return
    const canFollow = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    if (!canFollow.matches) return

    const rect = stage.getBoundingClientRect()
    let x = rect.width * 0.72
    let y = rect.height * 0.42
    let targetX = x
    let targetY = y
    let frame = 0

    const paint = () => {
      glow.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
    }
    const step = () => {
      x += (targetX - x) * FOLLOW
      y += (targetY - y) * FOLLOW
      paint()
      frame = Math.abs(targetX - x) + Math.abs(targetY - y) > REST_PX ? requestAnimationFrame(step) : 0
    }
    const onMove = (event: PointerEvent) => {
      const box = stage.getBoundingClientRect()
      targetX = event.clientX - box.left
      targetY = event.clientY - box.top
      if (!frame) frame = requestAnimationFrame(step)
    }

    // Sem o laço o CSS posiciona o halo por `left`/`top`; com ele, a posição
    // vem toda do `transform`, então a âncora volta para o canto.
    glow.style.left = '0'
    glow.style.top = '0'
    paint()
    stage.addEventListener('pointermove', onMove)
    return () => {
      stage.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [stageRef, glowRef])
}
