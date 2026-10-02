import type { Graphics } from 'pixi.js'
import type { MapData } from '../types/map'
import { visibleTokens } from '../lib/layers'
import { tokenPatrolOf } from '../lib/npcPatrol'

/**
 * ROTA DE PATRULHA no Pixi: a ronda de cada NPC, só no editor do mestre. Mesmo
 * idioma do minimapa: linha fina, pontos pequenos, nada de brilho nem degradê.
 * A linha fecha do último ponto ao primeiro, porque é assim que o NPC anda; o
 * ponto para onde ele vai no próximo "Avançar patrulha" sai cheio, os outros vazados.
 */

/** Azul frio, para não se confundir com o âmbar do cone da vigia. */
const ROUTE_COLOR = 0x8fb8e8
const ROUTE_ALPHA = 0.75
const ROUTE_WIDTH = 1
/** Raio do ponto, em fração da grade, com piso para grade pequena. */
const POINT_RADIUS_FRACTION = 0.12
const POINT_RADIUS_MIN = 3
/** Anel do ponto aberto no painel: bem maior que o ponto e um pouco mais grosso que a linha, sem brilho. */
const OPEN_RING_FACTOR = 2.4
const OPEN_RING_WIDTH = 2

/** O ponto da rota de uma ficha cuja macro está aberta no painel. */
export interface PontoDaRotaAberto {
  tokenId: string
  indice: number
}

/**
 * Desenha a rota de cada NPC com patrulha. Ficha oculta no editor ou camada de
 * fichas escondida não desenha: o mestre tirou o NPC do tabuleiro. Limpa antes.
 */
export function drawPatrolRoutes(graphics: Graphics, map: MapData, aberto: PontoDaRotaAberto | null = null): void {
  graphics.clear()
  const radius = Math.max(POINT_RADIUS_MIN, map.grid * POINT_RADIUS_FRACTION)
  for (const token of visibleTokens(map.tokens, map.hiddenLayers)) {
    const patrol = token.hidden ? null : tokenPatrolOf(token)
    if (patrol === null) continue
    const { pontos } = patrol
    if (pontos.length >= 2) {
      graphics.poly(pontos, true).stroke({ width: ROUTE_WIDTH, color: ROUTE_COLOR, alpha: ROUTE_ALPHA })
    }
    const next = pontos.length >= 2 ? (patrol.atual + 1) % pontos.length : -1
    pontos.forEach((p, i) => {
      graphics.circle(p.x, p.y, radius)
      if (i === next) graphics.fill({ color: ROUTE_COLOR, alpha: ROUTE_ALPHA })
      else graphics.stroke({ width: ROUTE_WIDTH, color: ROUTE_COLOR, alpha: ROUTE_ALPHA })
    })
    // MACRO POR PONTO: o ponto aberto no painel ganha um anel em volta — o mestre vê no mapa de qual ponto está editando os passos.
    const destacado = aberto?.tokenId === token.id ? pontos[aberto.indice] : undefined
    if (destacado !== undefined) {
      graphics.circle(destacado.x, destacado.y, radius * OPEN_RING_FACTOR).stroke({ width: OPEN_RING_WIDTH, color: ROUTE_COLOR, alpha: 1 })
    }
  }
}
