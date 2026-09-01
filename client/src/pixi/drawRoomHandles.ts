import type { Graphics } from 'pixi.js'
import type { RegionPoint } from '../types/map'
import { SELECTION_COLOR, HANDLE_VISUAL_RADIUS } from './constants'

/**
 * Alças de resize de uma Sala retangular (`Region.room?.shape === 'rect'`):
 * um quadrado preenchido por canto, SEM ponto médio de aresta — diferente de
 * `drawRegionHandles` (`pixi/drawEditHandles.ts`, usada pra região comum e
 * pra Sala polígono), que mistura vértice redondo + meio de aresta vazado.
 * Resize de Sala retangular só acontece pelos 4 cantos (arrasto, hit-test em
 * `lib/roomOps.ts` → `findRoomCornerAt`) ou pelo campo numérico de
 * largura/altura (`components/RoomControls.tsx`) — mesma função de geometria
 * nos dois casos (`lib/roomOps.ts` → `resizeRoomCorner`/`resizeRoomDimensions`),
 * por isso não há alça de aresta aqui: não existe gesto de "mover aresta"
 * separado do resize.
 *
 * `points` fora do formato de 4 vértices (contrato de `RoomMeta.shape ===
 * 'rect'`) não desenha nada — o chamador (`drawEditHandles.ts`) só entra
 * neste branch quando `room.shape === 'rect'`, mas a guarda aqui evita alça
 * torta se algum dia isso divergir.
 */
export function drawRoomHandles(graphics: Graphics, points: RegionPoint[]): void {
  if (points.length !== 4) return
  for (const point of points) {
    graphics
      .rect(point.x - HANDLE_VISUAL_RADIUS, point.y - HANDLE_VISUAL_RADIUS, HANDLE_VISUAL_RADIUS * 2, HANDLE_VISUAL_RADIUS * 2)
      .fill({ color: SELECTION_COLOR })
  }
}
