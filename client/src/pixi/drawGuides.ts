import type { Graphics } from 'pixi.js'
import type { AlignmentGuide } from '../lib/alignmentGuides'
import { SELECTION_COLOR } from './constants'

export function drawGuides(graphics: Graphics, guides: AlignmentGuide[], viewport: { left: number; top: number; right: number; bottom: number }): void {
  graphics.clear()
  for (const guide of guides) {
    if (guide.axis === 'x') {
      graphics.moveTo(guide.position, viewport.top).lineTo(guide.position, viewport.bottom)
    } else {
      graphics.moveTo(viewport.left, guide.position).lineTo(viewport.right, guide.position)
    }
    graphics.stroke({ width: 1, color: SELECTION_COLOR, alpha: 0.6 })
  }
}
