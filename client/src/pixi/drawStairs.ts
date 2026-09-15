import type { Graphics } from 'pixi.js'
import type { Stair, StairSegment } from '../types/map'
import { SELECTION_COLOR, STAIR_COLOR, STROKE_WEIGHT } from './constants'
import { alignToPixel, pixelGrid, strokeWidthInWorld, type PixelGrid } from './pixelAlign'
import { computeStairSteps, computeStairArrow } from '../lib/stairs'
import { selectionOutlineWidth } from './drawWalls'

/**
 * Escada RETA renderizada procedural (não é sprite): uma linha central fina de
 * referência + os degraus (linhas perpendiculares, geometria de
 * lib/stairs.ts:computeStairSteps) + uma seta triangular na ponta indicando o
 * sentido de subida (computeStairArrow). Mesmo esqueleto de drawWalls.ts —
 * `graphics.clear()` e redesenha tudo a cada chamada, sem cache de estado.
 *
 * A escada selecionada ganha contorno POR BAIXO em `SELECTION_COLOR`
 * (`SELECTION_OUTLINE_SCREEN_PX` de cada lado, mesma regra de drawWalls.ts):
 * a cor real da escada continua visível por cima. `cameraScale` mantém o
 * contorno com espessura fixa na tela.
 *
 * A linha central é um traço de 1 px de TELA: horizontal ou vertical, cai no
 * pixel físico inteiro (pixelAlign.ts; exige `world.position` alinhado).
 */
export function drawStairs(
  graphics: Graphics,
  stairs: Stair[],
  selectedStairId: string | null = null,
  cameraScale = 1,
  rendererResolution = 1,
): void {
  graphics.clear()
  const selected = selectedStairId === null ? undefined : stairs.find((stair) => stair.id === selectedStairId)
  if (selected) drawStairSelectionOutline(graphics, selected, cameraScale)
  const pixel = pixelGrid(cameraScale, rendererResolution, STROKE_WEIGHT.hairline)

  for (const stair of stairs) {
    for (const segment of stair.segments) {
      const center = alignedCenterLine(segment, pixel)
      graphics.moveTo(center.x1, center.y1).lineTo(center.x2, center.y2).stroke({ width: strokeWidthInWorld(pixel), color: STAIR_COLOR, alpha: 0.6 })

      for (const step of computeStairSteps(segment, stair.stepWidth)) {
        graphics.moveTo(step.x1, step.y1).lineTo(step.x2, step.y2).stroke({ width: STROKE_WEIGHT.medium, color: STAIR_COLOR })
      }

      const arrow = computeStairArrow(segment, stair.direction)
      graphics.poly([arrow.tip, arrow.back1, arrow.back2]).fill({ color: STAIR_COLOR })
    }
  }
}

/** Segmento reto (horizontal/vertical) com o eixo fixo no pixel físico; diagonal fica como está. */
function alignedCenterLine(segment: StairSegment, pixel: PixelGrid): StairSegment {
  if (segment.y1 === segment.y2) {
    const y = alignToPixel(segment.y1, pixel)
    return { ...segment, y1: y, y2: y }
  }
  if (segment.x1 === segment.x2) {
    const x = alignToPixel(segment.x1, pixel)
    return { ...segment, x1: x, x2: x }
  }
  return segment
}

/** Degraus e seta traçados mais largos em `SELECTION_COLOR`, antes da escada real. */
function drawStairSelectionOutline(graphics: Graphics, stair: Stair, cameraScale: number): void {
  const outline = 2 * selectionOutlineWidth(cameraScale)
  for (const segment of stair.segments) {
    graphics.moveTo(segment.x1, segment.y1).lineTo(segment.x2, segment.y2)
    for (const step of computeStairSteps(segment, stair.stepWidth)) {
      graphics.moveTo(step.x1, step.y1).lineTo(step.x2, step.y2)
    }
    graphics.stroke({ width: STROKE_WEIGHT.medium + outline, color: SELECTION_COLOR, cap: 'square' })

    const arrow = computeStairArrow(segment, stair.direction)
    graphics.poly([arrow.tip, arrow.back1, arrow.back2]).stroke({ width: outline, color: SELECTION_COLOR, join: 'round' })
  }
}
