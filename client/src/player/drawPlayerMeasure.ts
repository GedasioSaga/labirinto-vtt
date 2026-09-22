import type { Graphics } from 'pixi.js'
import type { Point } from '../pixi/world'

/**
 * Linha da régua do jogador, desenhada em espaço de TELA (acima do `world`,
 * como os sinais): a espessura fica a mesma em qualquer zoom, sem redesenho
 * por mudança de escala.
 *
 * Estilo do minimapa (Resident Evil): traço fino e claro, pontas pequenas.
 * O véu escuro e estreito por baixo só impede a linha de sumir em chão
 * claro; não é contorno.
 */
const LINE_COLOR = 0xf2ede4
const LINE_ALPHA = 0.95
const LINE_WIDTH = 1.5
const SHADOW_COLOR = 0x111111
const SHADOW_ALPHA = 0.35
const SHADOW_WIDTH = 3.5
/** Pontas discretas: ponto cheio onde a medida começou, anel pequeno onde o dedo está. */
const START_DOT_RADIUS = 2.5
const END_RING_RADIUS = 3.5

export function drawPlayerMeasure(g: Graphics, start: Point, end: Point): void {
  g.clear()
  g.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width: SHADOW_WIDTH, color: SHADOW_COLOR, alpha: SHADOW_ALPHA, cap: 'round' })
  g.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width: LINE_WIDTH, color: LINE_COLOR, alpha: LINE_ALPHA, cap: 'round' })
  g.circle(start.x, start.y, START_DOT_RADIUS).fill({ color: LINE_COLOR, alpha: LINE_ALPHA })
  g.circle(end.x, end.y, END_RING_RADIUS).stroke({ width: LINE_WIDTH, color: LINE_COLOR, alpha: LINE_ALPHA })
}
