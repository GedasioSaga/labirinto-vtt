import { useContaGotasStore } from '../stores/contaGotasStore'

/**
 * Gesto do conta-gotas sobre o canvas, sem Pixi (mesmo contrato do
 * `noiseGesture`): o PixiCanvas repassa os eventos do stage e, quando um método
 * devolve `true`, o conta-gotas consumiu o evento e a ferramenta ativa não
 * roda — nada é desenhado, selecionado ou movido. Armado, o clique esquerdo lê
 * a cor do ponto UMA vez, entrega e desarma; o up do mesmo gesto também é dele.
 * Botão do meio e direito seguem com o mapa (pan, menus).
 */

/** Botão esquerdo em `PointerEvent.button`. */
const LEFT_BUTTON = 0

export function createContaGotasGesture(lerCor: (x: number, y: number) => string | null, store = useContaGotasStore) {
  /** O pointerdown atual foi do conta-gotas: o up também é dele. */
  let owned = false

  return {
    /** `x`/`y` em px CSS da tela do canvas (`event.global`). */
    pointerDown(button: number, x: number, y: number): boolean {
      const state = store.getState()
      if (button !== LEFT_BUTTON || state.donoId === null) return false
      owned = true
      const cor = lerCor(x, y)
      if (cor === null) state.desligar()
      else state.entregar(cor)
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
