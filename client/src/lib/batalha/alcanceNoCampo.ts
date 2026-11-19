import type { MapData } from '../../types/map'
import { paredesParaAndarDoJogador } from '../obstaculosDeObjeto'
import { pisoDe } from '../pisos'
import { casasAoAlcance, montarMapaDosBlocos, type Casa } from './blocos'
import { casaDoToken } from './movimentoEmBatalha'

/**
 * CAMPO DE BATALHA (19/11/2026): as casas ao alcance da ficha que tem a vez,
 * com as paredes do mapa que a tela tem (o mestre: todas; o jogador: as do
 * recorte dele, as mesmas da prévia do passo, `previaDoPasso.ts`). Grade
 * quadrada só (a batalha conta blocos no quadrado).
 *
 * Montar o mapa dos blocos custa (todas as paredes do piso): o cálculo guarda
 * o último e só refaz quando as paredes, os objetos, a casa da ficha ou os
 * blocos que sobram mudam. O arrasto de OUTRA ficha não refaz nada.
 */

/** Teto de blocos para o desenho: passo de mesa nenhum chega perto, e a busca fica pequena. */
export const BLOCOS_DO_ALCANCE_MAX = 40

export type CalculoDoAlcance = (map: MapData, tokenId: string | null, sobra: number | null) => readonly Casa[] | null

export function criarCalculoDoAlcance(): CalculoDoAlcance {
  let chave: unknown[] | null = null
  let resultado: readonly Casa[] | null = null
  return (map, tokenId, sobra) => {
    if (tokenId === null || sobra === null || sobra <= 0 || map.gridShape !== 'square' || map.grid <= 0) {
      chave = null
      resultado = null
      return null
    }
    const ficha = map.tokens.find((token) => token.id === tokenId)
    if (ficha === undefined) return null
    const casa = casaDoToken({ x: ficha.x, y: ficha.y }, ficha.size, map.grid)
    const blocos = Math.min(BLOCOS_DO_ALCANCE_MAX, Math.floor(sobra))
    const nova = [map.walls, map.props, map.carimbos, map.grid, map.width, map.height, tokenId, casa.col, casa.row, blocos, ficha.size]
    if (chave !== null && nova.every((valor, i) => valor === chave?.[i])) return resultado
    chave = nova
    const paredes = paredesParaAndarDoJogador(map.walls, map, pisoDe(ficha), ficha)
    const mapa = montarMapaDosBlocos(paredes, map.grid, map.width, map.height)
    resultado = casasAoAlcance(mapa, casa, blocos).map((item) => item.casa)
    return resultado
  }
}
