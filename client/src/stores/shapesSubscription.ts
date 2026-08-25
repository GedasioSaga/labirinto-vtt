import { shallow } from 'zustand/shallow'
import { useMapStore } from './mapStore'

/**
 * Assina mudanças em [walls, lights, regions] — os únicos campos que exigem
 * redesenhar as formas vetoriais do Pixi. Usa `shallow` para comparar o tuplo,
 * evitando disparar em toda mudança de estado (ex.: setCamera/addToken/setShowGrid),
 * que não afeta paredes/luzes/regiões.
 */
export function subscribeToShapesRedraw(onChange: () => void): () => void {
  return useMapStore.subscribe(
    (state) => [state.map.walls, state.map.lights, state.map.regions] as const,
    onChange,
    { equalityFn: shallow },
  )
}
