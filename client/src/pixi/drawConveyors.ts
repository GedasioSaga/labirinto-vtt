import type { Graphics } from 'pixi.js'
import type { ConveyorMarks } from '../lib/conveyorMarks'
import { pixelGrid, strokeWidthInWorld } from './pixelAlign'
import { WALL_COLOR } from './drawWalls'

/**
 * ESTEIRA e CABINE no editor do mestre (`lib/conveyorMarks.ts`): setas finas
 * no chão da sala-esteira, linha fina de pino a pino da cabine e anel fino no
 * pino de viagem com cabine ao par. Mesma cor clara da parede, mais apagada,
 * e traço de 1 px de tela: o minimapa continua sendo chão chapado com linhas
 * finas — nada de faixa listrada, hachura ou textura.
 */

/** Traço das marcas em px de tela (a parede fina é a referência). */
export const CONVEYOR_MARK_SCREEN_PX = 1
/** As setas ficam abaixo da parede: sugerem o movimento, não competem com ela. */
export const CONVEYOR_CHEVRON_ALPHA = 0.5
/** A linha da cabine atravessa salas: ainda mais apagada que as setas. */
export const CABIN_LINK_ALPHA = 0.35

export function drawConveyorMarks(graphics: Graphics, marks: ConveyorMarks, cameraScale: number, rendererResolution: number): void {
  graphics.clear()
  if (marks.chevrons.length === 0 && marks.links.length === 0 && marks.parRings.length === 0) return
  const width = strokeWidthInWorld(pixelGrid(cameraScale, rendererResolution, CONVEYOR_MARK_SCREEN_PX))
  if (marks.chevrons.length > 0) {
    for (const chevron of marks.chevrons) {
      graphics.moveTo(chevron.left.x, chevron.left.y).lineTo(chevron.tip.x, chevron.tip.y).lineTo(chevron.right.x, chevron.right.y)
    }
    graphics.stroke({ width, color: WALL_COLOR, alpha: CONVEYOR_CHEVRON_ALPHA, cap: 'round', join: 'round' })
  }
  if (marks.links.length > 0) {
    for (const link of marks.links) graphics.moveTo(link.from.x, link.from.y).lineTo(link.to.x, link.to.y)
    graphics.stroke({ width, color: WALL_COLOR, alpha: CABIN_LINK_ALPHA })
  }
  // Os anéis num traço à parte: o círculo não pode herdar o último ponto da linha.
  for (const ring of marks.parRings) {
    graphics.circle(ring.center.x, ring.center.y, ring.radius).stroke({ width, color: WALL_COLOR, alpha: CABIN_LINK_ALPHA })
  }
}
