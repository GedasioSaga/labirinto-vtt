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
 * Fatia 5: o Alt segurado mede (`lib/altMeasure.ts`) com a mesma cota, e a
 * peça na diagonal ganha o tracejado que leva a ponta da cota até ela.
 *
 * Sem animação: a guia responde a cada pointermove, e movimento numa ação de
 * alta frequência só atrasa a leitura (skill emil-kowalski-ui-craft). Por isso
 * também não há nada a reduzir em `prefers-reduced-motion`. A medida do Alt
 * também aparece e some seca: ela é leitura pedida pela mão, não um evento
 * que precise chamar o olho.
 */
import type { Graphics } from 'pixi.js'
import type { AltMeasure } from '../lib/altMeasure'
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

/** Traço do tracejado da medida, em px de tela; o vão entre dois traços tem o mesmo tamanho. */
export const ALT_MEASURE_DASH_SCREEN_PX = 4

/**
 * Teto de traços num tracejado. A peça medida fica sob o mouse, mas a seleção
 * pode estar muito longe, fora da tela: sem teto, o tracejado viraria milhares
 * de traços. Passando dele, cada traço (e cada vão) fica mais comprido.
 */
export const ALT_MEASURE_MAX_DASHES = 256

/**
 * O tracejado de `from` a `to` no eixo, na posição `at` do outro eixo. Tem
 * traço nas DUAS pontas: uma encosta na ponta da cota, a outra na peça, e o
 * olho liga as duas. Para caber, o vão estica um pouco (de 1 a 3 traços);
 * tracejado curto demais para um vão vira um traço só.
 */
function strokeDashed(graphics: Graphics, line: GapMark, dash: number, grid: PixelGrid): void {
  const at = alignToPixel(line.at, grid)
  const start = Math.min(line.from, line.to)
  const length = Math.abs(line.to - line.from)
  if (!(length > 0) || !(dash > 0)) return
  const count = Math.min(ALT_MEASURE_MAX_DASHES, Math.max(1, Math.floor((length + dash) / (2 * dash))))
  const dashLength = count === 1 ? length : Math.min(dash, length / (2 * count - 1))
  const step = count === 1 ? 0 : (length - dashLength) / (count - 1)
  // Pelo índice, e não somando o passo: a soma acumula erro e o último traço passaria da peça.
  for (let i = 0; i < count; i += 1) {
    const from = start + i * step
    const to = from + dashLength
    if (line.axis === 'x') graphics.moveTo(from, at).lineTo(to, at)
    else graphics.moveTo(at, from).lineTo(at, to)
  }
}

/**
 * A medida do Alt segurado: as cotas (iguais às do vão) e os tracejados da
 * peça na diagonal, num `stroke` só, magenta de 1 px de tela. Limpa SEMPRE no
 * topo, como `drawSmartGuides`: é assim que a medida anterior some.
 */
export function drawAltMeasure(graphics: Graphics, measure: AltMeasure, cameraScale: number, rendererResolution: number): void {
  graphics.clear()
  if (measure.gaps.length === 0 && measure.extensions.length === 0) return
  const grid = pixelGrid(cameraScale, rendererResolution)
  const tick = screenPxToWorld(SMART_GUIDE_GAP_TICK_SCREEN_PX, cameraScale)
  for (const gap of measure.gaps) strokeGap(graphics, gap, tick, grid)
  const dash = screenPxToWorld(ALT_MEASURE_DASH_SCREEN_PX, cameraScale)
  for (const extension of measure.extensions) strokeDashed(graphics, extension, dash, grid)
  graphics.stroke({ width: strokeWidthInWorld(grid), color: SMART_GUIDE_COLOR })
}
