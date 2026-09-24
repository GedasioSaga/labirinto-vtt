import type { Graphics } from 'pixi.js'
import type { TokenCompanion } from '../types/map'
import { OWNER_RING_EDGE_ALPHA, OWNER_RING_EDGE_COLOR, OWNER_RING_EDGE_WIDTH_PX } from './ownerMarker'

/**
 * MARCA DE COMPANHEIRO: o que separa a ficha de outro jogador da ficha de NPC
 * na tela do jogador. Aro fino na cor de sinal do dono (a mesma do sinal dele,
 * `lib/signals.ts`), mais fino que o aro BRANCO de dono (`ownerMarker.ts`): o
 * "esta é a sua" continua sendo o aro mais forte da tela.
 *
 * Espessura em px de TELA, como o aro de dono: afastado ainda se acha; de
 * perto, não vira rosca.
 */
export const COMPANION_RING_WIDTH_PX = 2

function safeScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

/** Aro no espaço da ficha (px de mundo, centro em 0,0), logo por FORA do disco, com o fio escuro do aro de dono por fora. */
export function drawCompanionRing(g: Graphics, radius: number, scale: number, color: number): void {
  const s = safeScale(scale)
  const ring = COMPANION_RING_WIDTH_PX / s
  const edge = OWNER_RING_EDGE_WIDTH_PX / s
  g.clear()
  g.circle(0, 0, radius + ring / 2).stroke({ width: ring, color, alpha: 1 })
  g.circle(0, 0, radius + ring + edge / 2).stroke({ width: edge, color: OWNER_RING_EDGE_COLOR, alpha: OWNER_RING_EDGE_ALPHA })
}

/** O que se lê embaixo do nome do personagem: de quem é a ficha, e que é de jogador. */
export function companionLabelText(companion: TokenCompanion): string {
  return `${companion.name} (jogador)`
}
