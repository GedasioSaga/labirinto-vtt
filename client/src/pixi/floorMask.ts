import type { Graphics } from 'pixi.js'
import type { FloorPolygon } from '../lib/floorContour'
import type { Region, RegionPoint, Wall } from '../types/map'
import { isDegenerateRegion } from './shapes'

function flatten(ring: RegionPoint[]): number[] {
  const out: number[] = new Array(ring.length * 2)
  ring.forEach((p, i) => {
    out[i * 2] = p.x
    out[i * 2 + 1] = p.y
  })
  return out
}

/**
 * Regiões que são PISO: as que têm parede apontando para elas (`wall.regionId`),
 * ou seja, Salas. Região genérica sem paredes não entra.
 */
function floorRegions(regions: Region[], walls: Wall[]): Region[] {
  const withWalls = new Set<string>()
  for (const wall of walls) {
    if (wall.regionId !== undefined) withWalls.add(wall.regionId)
  }
  return regions.filter((region) => withWalls.has(region.id) && !isDegenerateRegion(region.points))
}

/**
 * Desenha no `graphics` a silhueta de todo piso (salas com paredes + chão por
 * peças, com os buracos recortados). Usado como máscara da grade: dentro do
 * piso na cor do usuário, fora dele apagada (editor) ou ausente (jogador).
 * Sala sem preenchimento (`filled === false`) ou oculta também conta como piso.
 * O `graphics.context` pode ser compartilhado com outra máscara (a inversa,
 * de fora do piso).
 *
 * Devolve `false` quando não há piso nenhum (quem chama tira a máscara).
 */
export function buildFloorMask(graphics: Graphics, regions: Region[], walls: Wall[], floorPolygons: FloorPolygon[]): boolean {
  graphics.clear()
  let shapes = 0
  for (const region of floorRegions(regions, walls)) {
    graphics.poly(flatten(region.points), true).fill({ color: 0xffffff })
    shapes++
  }
  for (const polygon of floorPolygons) {
    if (polygon.outer.length < 3) continue
    graphics.poly(flatten(polygon.outer), true).fill({ color: 0xffffff })
    for (const hole of polygon.holes) {
      if (hole.length >= 3) graphics.poly(flatten(hole), true).cut()
    }
    shapes++
  }
  return shapes > 0
}
