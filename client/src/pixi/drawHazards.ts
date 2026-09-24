import type { Graphics } from 'pixi.js'
import { HAZARD_COLORS, HAZARD_FILL_ALPHA, type PlayerHazard } from '../lib/hazards'

/**
 * ZONA DE PERIGO no mapa — no editor do mestre (todas as salas tomadas) e na
 * tela do jogador (só as que ele enxerga, já recortadas pelo host). Cor
 * chapada e translúcida por cima do chão, sem contorno próprio: a parede
 * fina da sala continua sendo a única linha. Estilo minimapa — nada de
 * textura, chama desenhada ou hachura.
 */
export function drawHazardAreas(graphics: Graphics, areas: readonly PlayerHazard[]): void {
  graphics.clear()
  for (const area of areas) {
    if (area.points.length < 3) continue
    graphics.poly(area.points, true).fill({ color: HAZARD_COLORS[area.kind], alpha: HAZARD_FILL_ALPHA })
  }
}
