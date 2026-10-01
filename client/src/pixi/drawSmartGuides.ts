/**
 * GUIA INTELIGENTE NO CANVAS (pedido 3, `lib/smartGuides.ts`): segmento
 * magenta de 1 px de tela entre as peças alinhadas, com um "x" em cada ponto
 * onde uma peça encosta na linha, como no Figma. Fino e curto de propósito: o
 * mapa segue o minimapa do Resident Evil (linha fina, nada de traço grosso), e
 * a guia não pode competir com a parede.
 *
 * Fatia 3: o VÃO medido é uma cota — o segmento de uma borda à outra, com um
 * tracinho atravessado em cada ponta. O número dele é de `drawGuideLabels.ts`.
 *
 * Sem animação: a guia responde a cada pointermove, e movimento numa ação de
 * alta frequência só atrasa a leitura (skill emil-kowalski-ui-craft). Por isso
 * também não há nada a reduzir em `prefers-reduced-motion`.
 */
import type { Graphics } from 'pixi.js'
import { screenPxToWorld, type GapMark, type GuideOverlay } from '../lib/smartGuides'
import { SMART_GUIDE_COLOR } from './constants'
import { alignToPixel, pixelGrid, strokeWidthInWorld, type PixelGrid } from './pixelAlign'

/** Meia perna do "x" das pontas, em px de tela (o x inteiro tem o dobro). */
export const SMART_GUIDE_MARK_SCREEN_PX = 3

/** Meio tracinho das pontas do vão, em px de tela: a cota tem 8 px de altura, como a do Figma. */
export const SMART_GUIDE_GAP_TICK_SCREEN_PX = 4

function strokeCross(graphics: Graphics, x: number, y: number, arm: number): void {
  graphics.moveTo(x - arm, y - arm).lineTo(x + arm, y + arm).moveTo(x - arm, y + arm).lineTo(x + arm, y - arm)
}

/**
 * A cota do vão. As pontas também caem no meio do pixel físico: o tracinho
 * fica numa coluna forte, e a borda da peça anda menos de meio pixel físico.
 */
function strokeGap(graphics: Graphics, gap: GapMark, tick: number, grid: PixelGrid): void {
  const at = alignToPixel(gap.at, grid)
  const from = alignToPixel(gap.from, grid)
  const to = alignToPixel(gap.to, grid)
  if (gap.axis === 'x') {
    graphics.moveTo(from, at).lineTo(to, at)
    graphics.moveTo(from, at - tick).lineTo(from, at + tick)
    graphics.moveTo(to, at - tick).lineTo(to, at + tick)
  } else {
    graphics.moveTo(at, from).lineTo(at, to)
    graphics.moveTo(at - tick, from).lineTo(at + tick, from)
    graphics.moveTo(at - tick, to).lineTo(at + tick, to)
  }
}

/**
 * Limpa SEMPRE no topo, também com tudo vazio: é assim que a guia do passo
 * anterior some. Guias e vãos saem num `stroke` só (um lote, não um por
 * guia). A linha cai no meio do pixel físico (`alignToPixel`): 1 coluna forte,
 * não 2 meio apagadas.
 */
export function drawSmartGuides(graphics: Graphics, overlay: GuideOverlay, cameraScale: number, rendererResolution: number): void {
  graphics.clear()
  if (overlay.guides.length === 0 && overlay.gaps.length === 0) return
  const grid = pixelGrid(cameraScale, rendererResolution)
  const arm = screenPxToWorld(SMART_GUIDE_MARK_SCREEN_PX, cameraScale)
  for (const guide of overlay.guides) {
    const at = alignToPixel(guide.position, grid)
    if (guide.axis === 'x') {
      graphics.moveTo(at, guide.from).lineTo(at, guide.to)
      for (const mark of guide.marks) strokeCross(graphics, at, mark, arm)
    } else {
      graphics.moveTo(guide.from, at).lineTo(guide.to, at)
      for (const mark of guide.marks) strokeCross(graphics, mark, at, arm)
    }
  }
  const tick = screenPxToWorld(SMART_GUIDE_GAP_TICK_SCREEN_PX, cameraScale)
  for (const gap of overlay.gaps) strokeGap(graphics, gap, tick, grid)
  graphics.stroke({ width: strokeWidthInWorld(grid), color: SMART_GUIDE_COLOR })
}
