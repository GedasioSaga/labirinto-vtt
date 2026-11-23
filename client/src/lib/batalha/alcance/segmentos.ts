/**
 * ALCANCE: AS PAREDES DA CONTA (plano docs/design/habilidades/ALCANCE.md §4). Os obstáculos são os
 * da visão (`visionSegments`, a porta única de toda conta de olhar) no piso de quem usa, do mapa
 * que a tela tem: o mestre e o host, o mapa inteiro; o jogador (e o host medindo por ele), o
 * recorte que saiu para ele, para a conta nunca contar que existe parede escondida.
 *
 * Na grade hexagonal as casas não acendem: só a distância conta, sem parede (§7.2).
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

import type { MapData } from '../../../types/map'
import { mapaDoPiso } from '../../pisos'
import { visionSegments } from '../../visibility'
import type { MapaDoAlcance } from './quemEntra'

/** Pelo recorte do piso (`mapaDoPiso` devolve o mesmo objeto enquanto o mapa não muda): refaz só quando o mapa muda. */
const guardados = new WeakMap<MapData, MapaDoAlcance>()

/** O mapa da conta das casas no piso `piso`. `map.width` e `map.height` são as casas da grade. */
export function mapaDoAlcance(map: MapData, piso: number): MapaDoAlcance {
  const doPiso = mapaDoPiso(map, piso)
  const guardado = guardados.get(doPiso)
  if (guardado !== undefined) return guardado
  const novo: MapaDoAlcance = { segmentos: map.gridShape === 'hex' ? [] : visionSegments(doPiso), colunas: map.width, linhas: map.height, grade: map.grid }
  guardados.set(doPiso, novo)
  return novo
}
