import type { Graphics } from 'pixi.js'
import type { RegionPoint } from '../types/map'
import {
  SELECTION_COLOR,
  HANDLE_VISUAL_RADIUS,
  CORNER_HANDLE_RADIUS,
  CORNER_HANDLE_KEYLINE_WIDTH,
  CORNER_HANDLE_KEYLINE_COLOR,
} from './constants'

/**
 * Fração do MENOR lado que um chip de canto pode ocupar. Com 1/6, os dois
 * chips de um mesmo lado nunca encostam (1/6 + 1/6 < 1) — em objeto pequeno a
 * alça encolhe sozinha em vez de engolir a forma. Mesma ideia (e mesmo motivo)
 * de `CORNER_TOLERANCE_MAX_SIDE_RATIO` em `lib/roomOps.ts`, que já encolhe a
 * ÁREA DE CLIQUE do canto pelo tamanho da sala.
 */
const CORNER_HANDLE_MAX_SIDE_RATIO = 1 / 6

/**
 * Metade do lado do chip para um objeto de `width` x `height` (px de mundo).
 *
 * Fica entre dois limites, e por isso é monótona: nunca passa de
 * `CORNER_HANDLE_RADIUS` (o chip não cresce sem fim em sala grande) e nunca
 * cai abaixo de `HANDLE_VISUAL_RADIUS` (o chip nunca fica MENOR do que a alça
 * de 7 px que existia antes de 21/09/2026 — objeto minúsculo pode ficar
 * apertado, mas não pode regredir).
 */
export function cornerHandleRadius(width: number, height: number): number {
  const menorLado = Math.min(Math.abs(width), Math.abs(height))
  return Math.min(CORNER_HANDLE_RADIUS, Math.max(HANDLE_VISUAL_RADIUS, menorLado * CORNER_HANDLE_MAX_SIDE_RATIO))
}

/**
 * O quadradinho de canto: chip amarelo com uma faixa escura em volta.
 *
 * DOIS fills, nesta ordem, e a ordem é o recurso:
 *   1. o quadrado ESCURO, maior, entra primeiro e RECORTA o contorno de
 *      seleção que passa por baixo (o contorno é desenhado antes, em
 *      `drawWalls.ts`/`drawRegions.ts`, numa camada de baixo);
 *   2. o chip AMARELO entra dentro dele, sobrando
 *      `CORNER_HANDLE_KEYLINE_WIDTH` de escuro de cada lado.
 *
 * O resultado é um amarelo cercado de escuro — a única coisa assim no canvas.
 * O contorno de seleção encosta na faixa e para; o olho lê duas peças, não uma
 * linha que engrossou. Foi esse o defeito medido: contorno e alça dividiam a
 * mesma cor e a alça cabia inteira dentro da faixa do contorno.
 *
 * Sem movimento de propósito: o afordance de "dá para pegar aqui" precisa estar
 * na tela no MESMO quadro em que a seleção acontece. Animar a entrada da alça
 * atrasaria justamente a informação que faltava.
 */
export function drawCornerHandle(graphics: Graphics, x: number, y: number, radius: number): void {
  const fora = radius + CORNER_HANDLE_KEYLINE_WIDTH
  graphics.rect(x - fora, y - fora, fora * 2, fora * 2).fill({ color: CORNER_HANDLE_KEYLINE_COLOR })
  graphics.rect(x - radius, y - radius, radius * 2, radius * 2).fill({ color: SELECTION_COLOR })
}

/**
 * Alças de resize de uma Sala retangular (`Region.room?.shape === 'rect'`):
 * um chip por canto, SEM ponto médio de aresta — diferente de
 * `drawRegionHandles` (`pixi/drawEditHandles.ts`, usada pra região comum e
 * pra Sala polígono), que mistura vértice redondo + meio de aresta vazado.
 * Resize de Sala retangular só acontece pelos 4 cantos (arrasto, hit-test em
 * `lib/roomOps.ts` → `findRoomCornerAt`) ou pelo campo numérico de
 * largura/altura (`components/RoomControls.tsx`) — mesma função de geometria
 * nos dois casos (`lib/roomOps.ts` → `resizeRoomCorner`/`resizeRoomDimensions`),
 * por isso não há alça de aresta aqui: não existe gesto de "mover aresta"
 * separado do resize.
 *
 * O tamanho do chip sai do tamanho da sala (`cornerHandleRadius`), calculado
 * UMA vez para os 4 cantos: os quatro têm sempre o mesmo tamanho, senão a
 * sala pareceria ter uma alça "mais importante" que as outras.
 *
 * `points` fora do formato de 4 vértices (contrato de `RoomMeta.shape ===
 * 'rect'`) não desenha nada — o chamador (`drawEditHandles.ts`) só entra
 * neste branch quando `room.shape === 'rect'`, mas a guarda aqui evita alça
 * torta se algum dia isso divergir.
 */
export function drawRoomHandles(graphics: Graphics, points: RegionPoint[]): void {
  if (points.length !== 4) return
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const radius = cornerHandleRadius(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  for (const point of points) {
    drawCornerHandle(graphics, point.x, point.y, radius)
  }
}
