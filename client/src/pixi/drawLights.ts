import { Color, type Graphics } from 'pixi.js'
import type { Light } from '../types/map'

export function drawLights(graphics: Graphics, lights: Light[]): void {
  graphics.clear()
  for (const light of lights) {
    const color = new Color(light.color).toNumber()
    graphics.circle(light.x, light.y, light.radius).fill({ color, alpha: light.intensity * 0.25 })
  }
}
