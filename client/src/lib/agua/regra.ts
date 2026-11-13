import type { Agua, MapData, RegionPoint } from '../../types/map'
import { pisoDe } from '../pisos'
import { pontoNaAgua } from './forma'

/**
 * ÁGUA QUE BARRA (decisão do mestre de 12/11/2026): com "Barra a passagem"
 * ligada, a ficha do JOGADOR não entra naquela água; a visão passa por cima.
 * Quem já está dentro sai (não fica preso). A água secreta não barra: a
 * recusa contaria que ela existe.
 */

/** Entre duas amostras do trecho andado, em casas. */
const PASSO_DA_PROVA = 0.2

/**
 * A primeira água que barra o trecho de `de` a `ate` no piso `piso`, ou
 * `null`. A água em que a ficha já está não conta.
 */
export function aguaQueBarra(map: Pick<MapData, 'aguas' | 'grid'>, piso: number, de: RegionPoint, ate: RegionPoint): Agua | null {
  const aguas = (map.aguas ?? []).filter((a) => a.barra === true && a.secret !== true && a.recorte === undefined && pisoDe(a) === piso)
  if (aguas.length === 0) return null
  const grid = map.grid
  const comprimento = Math.hypot(ate.x - de.x, ate.y - de.y)
  const passos = Math.max(1, Math.ceil(comprimento / (grid * PASSO_DA_PROVA)))
  for (const agua of aguas) {
    if (pontoNaAgua(agua, grid, de.x, de.y)) continue
    for (let i = 1; i <= passos; i += 1) {
      const t = i / passos
      if (pontoNaAgua(agua, grid, de.x + (ate.x - de.x) * t, de.y + (ate.y - de.y) * t)) return agua
    }
  }
  return null
}
