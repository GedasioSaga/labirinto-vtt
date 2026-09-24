import type { Graphics } from 'pixi.js'
import { FACCAO_FILL_ALPHA, type PinturaFaccao } from '../lib/faccoes'

/**
 * FILTRO "QUEM MANDA AQUI" — só no editor do mestre. Cada território ganha a
 * cor da facção, chapada e translúcida por cima do chão, sem contorno próprio:
 * a parede fina da sala continua sendo a única linha (estilo minimapa, nada
 * de hachura nem textura). Pintura vazia limpa a camada.
 */
export function drawFaccoes(graphics: Graphics, pintura: readonly PinturaFaccao[]): void {
  graphics.clear()
  for (const area of pintura) {
    if (area.points.length < 3) continue
    graphics.poly(area.points, true).fill({ color: area.cor, alpha: FACCAO_FILL_ALPHA })
  }
}
