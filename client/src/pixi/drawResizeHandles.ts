import type { Graphics } from 'pixi.js'
import type { Box } from '../lib/objectTransform'
import { boxCorners } from '../lib/objectTransform'
import { SELECTION_COLOR, HANDLE_VISUAL_RADIUS } from './constants'

/**
 * Alças de resize por canto de um `Box` — generalização de
 * `drawRoomHandles.ts` (que só sabe desenhar os 4 vértices já em
 * `RegionPoint[]` de uma Sala retangular) para qualquer entidade cujo resize
 * seja "bounding box com 4 cantos": Drawing rect/ellipse/polygon, Token,
 * Prop (ver `lib/objectTransform.ts`). Mesmo visual (`HANDLE_VISUAL_RADIUS`,
 * `pixi/constants.ts` — mesmo valor que `drawRoomHandles.ts` usa, fonte
 * única em vez dos dois arquivos terem seu próprio `5` local), mesma ordem
 * de cantos (`boxCorners`, convenção `Corner` 0..3), reaproveitado como base
 * comum em vez de duplicar o desenho em cada chamador de `drawEditHandles.ts`.
 */
export function drawBoxResizeHandles(graphics: Graphics, box: Box): void {
  for (const corner of boxCorners(box)) {
    graphics
      .rect(corner.x - HANDLE_VISUAL_RADIUS, corner.y - HANDLE_VISUAL_RADIUS, HANDLE_VISUAL_RADIUS * 2, HANDLE_VISUAL_RADIUS * 2)
      .fill({ color: SELECTION_COLOR })
  }
}
