import type { Graphics } from 'pixi.js'
import { AREA_TRIGGER_COLORS, AREA_TRIGGER_FILL_ALPHA, AREA_TRIGGER_STROKE_WIDTH, type PlayerAreaTrigger } from '../lib/areaTriggers'

/**
 * GATILHO DE ÁREA no mapa — no editor do mestre (todas as áreas marcadas) e
 * na tela do jogador (só as reveladas, já recortadas pelo host). Cor chapada e
 * translúcida com contorno fino da mesma cor: estilo minimapa, sem hachura,
 * sem ícone desenhado por cima.
 */
export function drawAreaTriggers(graphics: Graphics, areas: readonly PlayerAreaTrigger[]): void {
  graphics.clear()
  for (const area of areas) {
    if (area.points.length < 3) continue
    const color = AREA_TRIGGER_COLORS[area.kind]
    graphics
      .poly(area.points, true)
      .fill({ color, alpha: AREA_TRIGGER_FILL_ALPHA })
      .stroke({ width: AREA_TRIGGER_STROKE_WIDTH, color, alpha: 0.9 })
  }
}
