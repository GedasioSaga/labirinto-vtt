/**
 * FANTASMA DO ENDIREITAR — pedido 5 de 30/09/2026, fatia 4. Depois que o Alt
 * (ou o botão "Endireitar") deixa a linha em pé ou deitada, a posição de ANTES
 * fica um instante na tela e apaga (`straightenGhost.ts`). O olho vê de onde a
 * linha saiu, sem a geometria animar: o mapa e o histórico são os do endireitar.
 *
 * Linha fina na cor da seleção — ela diz "o que você selecionou estava aqui".
 * Fina de propósito: o mapa segue o minimapa do Resident Evil (linha fina,
 * nada de parede grossa), então nem a parede vira um traço gordo no fantasma.
 */
import type { Graphics } from 'pixi.js'
import { SELECTION_COLOR } from './constants'
import { pixelGrid, strokeWidthInWorld } from './pixelAlign'

/**
 * Um traço do fantasma: os pontos da posição de antes, em px de mundo — dois
 * numa Linha ou num pedaço de Parede, todos os do Caminho.
 */
export type GhostStroke = readonly { readonly x: number; readonly y: number }[]

/**
 * Espessura do fantasma em px de TELA, a mesma em qualquer zoom. O dobro do
 * fio da guia (1 px): o fantasma vive menos de 0,2 s, e um fio de 1 px a meia
 * opacidade, na diagonal, some no antialias antes de o olho achá-lo.
 */
export const STRAIGHTEN_GHOST_SCREEN_PX = 2

/**
 * Desenha os traços num `stroke` só (um lote). Limpa SEMPRE no topo: é assim
 * que o fantasma anterior some. Ponta e canto redondos: o canto do Caminho e
 * a emenda dos pedaços da parede com porta não ficam com dente.
 */
export function drawStraightenGhost(graphics: Graphics, strokes: readonly GhostStroke[], cameraScale: number, rendererResolution: number): void {
  graphics.clear()
  let drawn = false
  for (const stroke of strokes) {
    const [first, ...rest] = stroke
    if (first === undefined || rest.length === 0) continue
    graphics.moveTo(first.x, first.y)
    for (const point of rest) graphics.lineTo(point.x, point.y)
    drawn = true
  }
  if (!drawn) return
  const width = strokeWidthInWorld(pixelGrid(cameraScale, rendererResolution, STRAIGHTEN_GHOST_SCREEN_PX))
  graphics.stroke({ width, color: SELECTION_COLOR, cap: 'round', join: 'round' })
}
