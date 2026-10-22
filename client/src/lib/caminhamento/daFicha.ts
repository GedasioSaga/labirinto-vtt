import type { Point } from '../../pixi/world'
import type { MapData, Token } from '../../types/map'
import { mapaDoPiso, pisoDe } from '../pisos'
import { tokenSizeInSquares } from '../tokenSize'
import type { FichaNoCaminho } from './busca'
import type { MapaDoCaminho } from './malha'

/**
 * O que o motor precisa de uma cena para mover a ficha `tokenId`: as paredes
 * do piso dela, o raio dela e as outras fichas do mesmo piso. Ficha de outro
 * piso não atrapalha, parede de outro piso não barra.
 */
export interface EntradaDaFicha {
  mapa: MapaDoCaminho
  raio: number
  fichas: FichaNoCaminho[]
}

/** Raio da ficha em px de mundo, com o tamanho já conferido (`lib/tokenSize.ts`). */
export function raioDaFicha(token: Pick<Token, 'size'>, grid: number): number {
  return (tokenSizeInSquares(token) * grid) / 2
}

/**
 * `posicoes`: onde as fichas que já andaram neste tique estão agora (o mapa é o
 * do começo do tique) — quem anda depois delas no mesmo tique as vê no lugar novo.
 */
export function entradaDaFicha(map: MapData, tokenId: string, posicoes?: ReadonlyMap<string, Point>): EntradaDaFicha | null {
  const token = map.tokens.find((t) => t.id === tokenId)
  if (token === undefined) return null
  const doPiso = mapaDoPiso(map, pisoDe(token))
  const fichas: FichaNoCaminho[] = []
  for (const t of doPiso.tokens) {
    if (t.id === tokenId) continue
    const onde = posicoes?.get(t.id) ?? t
    fichas.push({ id: t.id, x: onde.x, y: onde.y, raio: raioDaFicha(t, map.grid) })
  }
  return {
    mapa: { walls: doPiso.walls, grid: map.grid, width: map.width, height: map.height },
    raio: raioDaFicha(token, map.grid),
    fichas,
  }
}
