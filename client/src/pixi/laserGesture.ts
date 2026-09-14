import { isLaserArmed, useLaserStore } from '../stores/laserStore'

/**
 * Gesto do laser sobre o canvas, sem Pixi: o PixiCanvas repassa os eventos do
 * stage e, quando um método devolve `true`, o laser consumiu o evento e a
 * ferramenta ativa não roda. Armado (L ou botão Laser) não emite nada; só o
 * botão esquerdo pressionado começa o traço, e o gesto inteiro (down, move,
 * up) fica com o laser até soltar, mesmo se desarmar no meio.
 */

export interface LaserGesturePoint {
  x: number
  y: number
}

/** Botão esquerdo em `PointerEvent.button`. */
const LEFT_BUTTON = 0

export function createLaserGesture(emit: (point: LaserGesturePoint) => void, store = useLaserStore) {
  /** O pointerdown atual foi do laser: move e up também são dele. */
  let owned = false

  return {
    pointerDown(button: number, point: LaserGesturePoint): boolean {
      const state = store.getState()
      if (button !== LEFT_BUTTON || !isLaserArmed(state)) return false
      owned = true
      state.setDrawing(true)
      emit(point)
      return true
    },

    pointerMove(point: LaserGesturePoint): boolean {
      if (!owned) return false
      if (store.getState().drawing) emit(point)
      return true
    },

    /** pointerup e pointerupoutside. */
    pointerUp(): boolean {
      if (!owned) return false
      owned = false
      store.getState().setDrawing(false)
      return true
    },

    /** Janela perdeu o foco: o pointerup pode nunca chegar. */
    cancel(): void {
      owned = false
      store.getState().setDrawing(false)
    },
  }
}
