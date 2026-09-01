import type { Graphics } from 'pixi.js'
import type { Stair } from '../types/map'
import { SELECTION_COLOR, STAIR_COLOR, STROKE_WEIGHT } from './constants'
import { computeStairSteps, computeStairArrow } from '../lib/stairs'

/**
 * Escada RETA renderizada procedural (não é sprite): uma linha central fina de
 * referência + os degraus (linhas perpendiculares, geometria de
 * lib/stairs.ts:computeStairSteps) + uma seta triangular na ponta indicando o
 * sentido de subida (computeStairArrow). Mesmo esqueleto de drawWalls.ts —
 * `graphics.clear()` e redesenha tudo a cada chamada, sem cache de estado.
 */
export function drawStairs(graphics: Graphics, stairs: Stair[], selectedStairId: string | null = null): void {
  graphics.clear()
  for (const stair of stairs) {
    const isSelected = stair.id === selectedStairId
    const color = isSelected ? SELECTION_COLOR : STAIR_COLOR

    for (const segment of stair.segments) {
      graphics.moveTo(segment.x1, segment.y1).lineTo(segment.x2, segment.y2).stroke({ width: STROKE_WEIGHT.hairline, color, alpha: 0.6 })

      for (const step of computeStairSteps(segment, stair.stepWidth)) {
        graphics.moveTo(step.x1, step.y1).lineTo(step.x2, step.y2).stroke({ width: isSelected ? STROKE_WEIGHT.bold : STROKE_WEIGHT.medium, color })
      }

      const arrow = computeStairArrow(segment, stair.direction)
      graphics.poly([arrow.tip, arrow.back1, arrow.back2]).fill({ color })
    }
  }
}
