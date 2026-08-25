import { shallow } from 'zustand/shallow'
import { useMapStore } from './mapStore'

/**
 * Assina mudanças em [walls, lights, regions, selection] — os únicos campos
 * que exigem redesenhar as formas vetoriais do Pixi. `selection` entra aqui
 * porque o destaque de seleção (Task 3 de selecionar-apagar) é desenhado
 * dentro de drawWalls/drawLights/drawRegions — sem isso no seletor, clicar
 * pra selecionar uma parede/luz/região não dispara redraw, e o destaque só
 * aparece "por acidente" na próxima mutação de walls/lights/regions. Usa
 * `shallow` para comparar o tuplo, evitando disparar em toda mudança de
 * estado (ex.: setCamera/addToken/setShowGrid) que não afeta esta camada.
 */
export function subscribeToShapesRedraw(onChange: () => void): () => void {
  return useMapStore.subscribe(
    (state) => [state.map.walls, state.map.lights, state.map.regions, state.selection] as const,
    onChange,
    { equalityFn: shallow },
  )
}
