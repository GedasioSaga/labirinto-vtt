import { Color, type Graphics } from 'pixi.js'
import type { Light } from '../types/map'
import { SELECTION_COLOR } from './constants'
import { LIGHT_HIT_RADIUS } from '../lib/selectionHitTest'

export function drawLights(graphics: Graphics, lights: Light[], selectedLightId: string | null = null): void {
  graphics.clear()
  for (const light of lights) {
    const color = new Color(light.color).toNumber()
    graphics.circle(light.x, light.y, light.radius).fill({ color, alpha: light.intensity * 0.25 })
    if (light.id === selectedLightId) {
      graphics.circle(light.x, light.y, LIGHT_HIT_RADIUS).stroke({ width: 3, color: SELECTION_COLOR })
    }
  }
}
