import { shallow } from 'zustand/shallow'
import { useMapStore } from './mapStore'

/**
 * Assina mudanças em [walls, stairs, lights, regions, drawings, hiddenLayers,
 * selection] — os únicos campos que exigem redesenhar as formas vetoriais do
 * Pixi. `selection` entra aqui porque o destaque de seleção (Task 3 de
 * selecionar-apagar) é desenhado dentro de drawWalls/drawLights/drawRegions
 * — sem isso no seletor, clicar pra selecionar uma parede/luz/região não
 * dispara redraw, e o destaque só aparece "por acidente" na próxima mutação
 * de walls/lights/regions. Onda 4, item 24: `selection` virou o CONJUNTO
 * canônico (lib/selectionModel.ts) — cobre também o contorno do grupo
 * (drawAreaSelectionOutline, N3) que antes dependia do campo separado
 * `areaSelection`, hoje derivado do mesmo `selection` em PixiCanvas.tsx.
 * `hiddenLayers` entra pela mesma razão (Fase 1, camadas): redrawShapes
 * filtra por camada visível (lib/layers.ts), então ocultar/mostrar uma
 * camada pelo LayersPanel precisa disparar redraw mesmo sem nenhuma entidade
 * ter mudado. `stairs` entra na Fase 2 (drawStairs, em redrawShapes) pela
 * mesma razão de walls/lights/regions: addStair/removeStair/moveStair/
 * updateStairPoint/setStairDirection precisam disparar redraw. Usa `shallow`
 * para comparar o tuplo, evitando disparar em toda mudança de estado (ex.:
 * setCamera/addToken/setShowGrid) que não afeta esta camada.
 */
export function subscribeToShapesRedraw(onChange: () => void): () => void {
  return useMapStore.subscribe(
    (state) => [
      state.map.walls,
      state.map.stairs,
      state.map.lights,
      state.map.regions,
      state.map.drawings,
      state.map.floor,
      state.map.floorStyle,
      state.map.lines,
      state.map.markers,
      state.map.frame,
      state.map.hiddenLayers,
      state.selection,
      // A5 — overlay das zonas ocultas e o destaque da zona aberta no painel.
      state.map.concealZones,
      state.selectedConcealZoneId,
      // Pinos de ponto de interesse e o destaque do pino aberto no painel.
      state.map.pins,
      state.selectedPinId,
    ] as const,
    onChange,
    { equalityFn: shallow },
  )
}
