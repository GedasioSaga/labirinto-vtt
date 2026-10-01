/**
 * GUIA INTELIGENTE NO CANVAS (pedido 3, `lib/smartGuides.ts`): segmento
 * magenta de 1 px de tela entre as peças alinhadas, com um "x" em cada ponto
 * onde uma peça encosta na linha, como no Figma. Fino e curto de propósito: o
 * mapa segue o minimapa do Resident Evil (linha fina, nada de traço grosso), e
 * a guia não pode competir com a parede.
 *
 * Sem animação: a guia responde a cada pointermove, e movimento numa ação de
 * alta frequência só atrasa a leitura (skill emil-kowalski-ui-craft). Por isso
 * também não há nada a reduzir em `prefers-reduced-motion`.
 */
import type { Graphics } from 'pixi.js'
import { screenPxToWorld, type SmartGuide } from '../lib/smartGuides'
import { SMART_GUIDE_COLOR } from './constants'
import { alignToPixel, pixelGrid, strokeWidthInWorld } from './pixelAlign'

/** Meia perna do "x" das pontas, em px de tela (o x inteiro tem o dobro). */
export const SMART_GUIDE_MARK_SCREEN_PX = 3

function strokeCross(graphics: Graphics, x: number, y: number, arm: number): void {
  graphics.moveTo(x - arm, y - arm).lineTo(x + arm, y + arm).moveTo(x - arm, y + arm).lineTo(x + arm, y - arm)
}

/**
 * Limpa SEMPRE no topo, também com a lista vazia: é assim que a guia do passo
 * anterior some. Todas as guias saem num `stroke` só (um lote, não um por
 * guia). A linha cai no meio do pixel físico (`alignToPixel`): 1 coluna forte,
 * não 2 meio apagadas.
 */
export function drawSmartGuides(graphics: Graphics, guides: readonly SmartGuide[], cameraScale: number, rendererResolution: number): void {
  graphics.clear()
  if (guides.length === 0) return
  const grid = pixelGrid(cameraScale, rendererResolution)
  const arm = screenPxToWorld(SMART_GUIDE_MARK_SCREEN_PX, cameraScale)
  for (const guide of guides) {
    const at = alignToPixel(guide.position, grid)
    if (guide.axis === 'x') {
      graphics.moveTo(at, guide.from).lineTo(at, guide.to)
      for (const mark of guide.marks) strokeCross(graphics, at, mark, arm)
    } else {
      graphics.moveTo(guide.from, at).lineTo(guide.to, at)
      for (const mark of guide.marks) strokeCross(graphics, mark, at, arm)
    }
  }
  graphics.stroke({ width: strokeWidthInWorld(grid), color: SMART_GUIDE_COLOR })
}
