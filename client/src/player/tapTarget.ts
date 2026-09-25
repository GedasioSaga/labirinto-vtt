import { findDoorAt } from '../lib/doorReach'
import { findPinAt } from '../lib/pins'
import type { Point } from '../pixi/world'
import type { Pin, Wall } from '../types/map'

/**
 * O que está sob o dedo do jogador quando ele aperta o mapa:
 * - `pin`: um pino visível — o toque abre o cartão;
 * - `door`: uma porta visível — o toque abre ou fecha;
 * - `map`: chão, nada tocável — segurar parado vira sinal de mapa.
 */
export type TapTarget = { kind: 'pin'; pinId: string } | { kind: 'door'; doorId: string } | { kind: 'map' }

/**
 * Controle sob o ponto, em px de MUNDO. O pino vem primeiro porque é desenhado
 * por cima de tudo (inclusive da porta).
 * @param pins Só os pinos que o jogador pode ver.
 * @param walls Só as paredes que o jogador pode ver (as portas entre elas).
 * @param tolerance Folga do dedo, em px de mundo.
 */
export function findTapTarget(pins: readonly Pin[], walls: readonly Wall[], point: Point, tolerance: number): TapTarget {
  const pin = findPinAt(pins, point, tolerance)
  if (pin !== null) return { kind: 'pin', pinId: pin.id }
  const door = findDoorAt(walls, point, tolerance)
  if (door !== null) return { kind: 'door', doorId: door.id }
  return { kind: 'map' }
}

/**
 * Segurar parado sobre `target` pode virar sinal de mapa? Só no chão: pino e
 * porta são controles, e quem aperta ali quer abrir o cartão ou a porta. Se a
 * tela engasga e o toque demora meio segundo para soltar, a intenção não muda.
 */
export function holdBecomesSignal(target: TapTarget): boolean {
  return target.kind === 'map'
}
