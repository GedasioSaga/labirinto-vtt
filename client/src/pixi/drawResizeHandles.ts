import type { Graphics } from 'pixi.js'
import type { Box } from '../lib/objectTransform'
import { boxCorners } from '../lib/objectTransform'
import { drawCornerHandlesOnScreen } from './drawRoomHandles'

/**
 * Alças de resize por canto de um `Box` — generalização de
 * `drawRoomHandles.ts` (que só sabe desenhar os 4 vértices já em
 * `RegionPoint[]` de uma Sala retangular) para qualquer entidade cujo resize
 * seja "bounding box com 4 cantos": Drawing rect/ellipse/polygon, Token,
 * Prop (ver `lib/objectTransform.ts`). MESMO desenho, não só mesmo número:
 * desde 21/09/2026 os dois chamam `drawCornerHandle`, a fonte única do chip
 * (`pixi/drawRoomHandles.ts`), em vez de repetirem o `rect().fill()` cada um
 * no seu arquivo — foi assim que a alça de Sala ficou invisível sem que a de
 * Token acusasse nada. Mesma ordem de cantos (`boxCorners`, convenção
 * `Corner` 0..3).
 *
 * O chip encolhe com o objeto (`cornerHandleRadius`): num Prop de 20 px de
 * lado, quatro chips de 12 px cobririam o Prop inteiro. E tem tamanho fixo na
 * tela em qualquer zoom (`drawCornerHandlesOnScreen`); sem `cameraScale`, zoom 1.
 */
export function drawBoxResizeHandles(graphics: Graphics, box: Box, cameraScale = 1): void {
  drawCornerHandlesOnScreen(graphics, boxCorners(box), box.maxX - box.minX, box.maxY - box.minY, cameraScale)
}
