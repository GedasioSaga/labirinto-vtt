import { shallow } from 'zustand/shallow'
import { useMapStore } from './mapStore'

/**
 * Assina mudanças em [map.tokens, selection] — os únicos campos que
 * exigem redesenhar a camada de tokens do Pixi. Mesmo padrão de
 * gridSubscription.ts/shapesSubscription.ts: evita redraw em mutações não
 * relacionadas (addWall, setCamera, setShowGrid etc).
 */
export function subscribeToTokensRedraw(onChange: () => void): () => void {
  return useMapStore.subscribe(
    (state) => [state.map.tokens, state.selection] as const,
    onChange,
    { equalityFn: shallow },
  )
}
