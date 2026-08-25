import { shallow } from 'zustand/shallow'
import { useMapStore } from './mapStore'

/**
 * Assina mudanças em [camera, showGrid, grid] — os únicos campos que exigem
 * redesenhar o grid do Pixi. Usa `shallow` para comparar o tuplo, evitando
 * disparar em toda mudança de estado (ex.: addWall/addToken/loadMap), que foi
 * a regressão original corrigida neste módulo.
 */
export function subscribeToGridRedraw(onChange: () => void): () => void {
  return useMapStore.subscribe(
    (state) => [state.camera, state.map.showGrid, state.map.grid, state.map.gridShape] as const,
    onChange,
    { equalityFn: shallow },
  )
}
