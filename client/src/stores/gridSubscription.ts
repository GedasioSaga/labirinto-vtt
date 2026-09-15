import { shallow } from 'zustand/shallow'
import { useMapStore } from './mapStore'

/**
 * Assina mudanças em [camera, showGrid, grid, gridShape, gridSettings] — os únicos campos que exigem
 * redesenhar o grid do Pixi. Usa `shallow` para comparar o tuplo, evitando
 * disparar em toda mudança de estado (ex.: addWall/addToken/loadMap), que foi
 * a regressão original corrigida neste módulo.
 *
 * `gridSettings` (cor, opacidade, espessura, estilo) entrou depois da
 * auditoria de 14/09: o valor gravava, mas o canvas só mudava no próximo
 * zoom ou pan. Entra campo a campo, não o objeto: `loadMap` de um mapa novo
 * traz outro objeto com os mesmos valores, e isso não deve redesenhar.
 */
export function subscribeToGridRedraw(onChange: () => void): () => void {
  return useMapStore.subscribe(
    (state) => [
      state.camera,
      state.map.showGrid,
      state.map.grid,
      state.map.gridShape,
      state.map.gridSettings.color,
      state.map.gridSettings.opacity,
      state.map.gridSettings.lineWidth,
      state.map.gridSettings.lineStyle,
    ] as const,
    onChange,
    { equalityFn: shallow },
  )
}
