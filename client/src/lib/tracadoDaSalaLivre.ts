import type { Point } from '../pixi/world'
import type { RoomFreeKind } from '../types/tools'
import { arredondarTracado } from './arredondarTracado'
import { isValidFreeRoomDraft, normalizeDraftPolygonPoints, normalizeFreeWallDraft } from './drawingFactory'

/** O contorno que o traçado da Sala livre vira: por onde a linha passa e se ela volta ao começo. */
export interface TracadoDaSalaLivre {
  pontos: Point[]
  fechado: boolean
}

/**
 * Fonte única do contorno da Sala livre, a partir dos cantos clicados.
 *
 * Existe para a prévia e o mapa nunca discordarem: o fim do traçado
 * (`finishRegion`/`finishFreeWall` em pixi/PixiCanvas.tsx) grava estes pontos,
 * e a prévia (`drawRegionDraft` em pixi/drawDraft.ts) desenha estes mesmos
 * pontos com o cursor valendo como o próximo canto. Antes cada lado fazia a
 * sua conta, e com "Arredondar" ligado a prévia mostrava uma linha aberta
 * enquanto a sala gravada fechava com o canto do primeiro clique em curva.
 *
 * - Sala: o fechamento é implícito; com 3 cantos distintos ou mais o contorno
 *   fecha, com menos ainda não é sala e fica aberto.
 * - Parede: fecha só quando o último clique cai no primeiro
 *   (`normalizeFreeWallDraft`); em qualquer outro lugar a linha fica aberta.
 *
 * Com `arredondar`, cada canto vira curva (`arredondarTracado`): na linha
 * aberta as pontas ficam onde a pessoa clicou; no contorno fechado todo canto
 * arredonda, inclusive o do primeiro clique.
 */
export function tracadoDaSalaLivre(cliques: Point[], modo: RoomFreeKind, arredondar: boolean): TracadoDaSalaLivre {
  const contorno = modo === 'parede' ? contornoDaParede(cliques) : contornoDaSala(cliques)
  if (!arredondar) return contorno
  return { pontos: arredondarTracado(contorno.pontos, contorno.fechado), fechado: contorno.fechado }
}

function contornoDaSala(cliques: Point[]): TracadoDaSalaLivre {
  const pontos = normalizeDraftPolygonPoints(cliques)
  return { pontos, fechado: isValidFreeRoomDraft(pontos) }
}

function contornoDaParede(cliques: Point[]): TracadoDaSalaLivre {
  const { points, closed } = normalizeFreeWallDraft(cliques)
  return { pontos: points, fechado: closed }
}
