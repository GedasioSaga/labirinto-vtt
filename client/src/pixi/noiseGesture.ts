import { useNoiseStore } from '../stores/noiseStore'

/**
 * Gesto do ruído sobre o canvas, sem Pixi (mesmo contrato do `laserGesture`):
 * o PixiCanvas repassa os eventos do stage e, quando um método devolve `true`,
 * o ruído consumiu o evento e a ferramenta ativa não roda. Armado, o clique
 * esquerdo emite o ponto UMA vez e desarma; o up do mesmo gesto também é dele,
 * para a ferramenta não ver um "soltar" sem "apertar".
 */

export interface NoiseGesturePoint {
  x: number
  y: number
}

/** Botão esquerdo em `PointerEvent.button`. */
const LEFT_BUTTON = 0

export function createNoiseGesture(emit: (point: NoiseGesturePoint) => void, store = useNoiseStore) {
  /** O pointerdown atual foi do ruído: o up também é dele. */
  let owned = false

  return {
    pointerDown(button: number, point: NoiseGesturePoint): boolean {
      const state = store.getState()
      if (button !== LEFT_BUTTON || !state.armed) return false
      owned = true
      state.setArmed(false)
      emit(point)
      return true
    },

    /** pointerup e pointerupoutside. */
    pointerUp(): boolean {
      if (!owned) return false
      owned = false
      return true
    },

    /** Janela perdeu o foco: o pointerup pode nunca chegar. */
    cancel(): void {
      owned = false
    },
  }
}
