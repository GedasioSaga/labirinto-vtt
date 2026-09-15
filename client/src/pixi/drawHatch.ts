import type { FillPattern, Graphics } from 'pixi.js'
import type { FloorPolygon } from '../lib/floorContour'
import type { Region, Wall } from '../types/map'
import {
  HATCH_FLAT_COLOR,
  HATCH_INK_COLOR,
  PARCHMENT_COLOR,
  hatchStrokeWidth,
  hatchUsesFlatBand,
  isInteriorWall,
  wallWidthFor,
} from './dungeonStyle'
import { groupWallChains } from './drawWalls'
import { buildFloorMask } from './floorMask'
import { buildHatchGeometry, type HatchGeometry } from './hatchGeometry'

/**
 * Cadeias de parede EXTERNA (interna não ganha faixa), quebradas quando a
 * largura muda. Mantida para quem ainda agrupa por cadeia; a hachura vetorial
 * mede a distância parede a parede (hatchGeometry.ts) e não usa mais cadeias.
 */
export function hatchWallChains(walls: Wall[], grid: number): Wall[][] {
  const exterior = walls.filter((wall) => !isInteriorWall(wall))
  return groupWallChains(exterior, (previous, next) => wallWidthFor(previous, grid) !== wallWidthFor(next, grid))
}

/**
 * Pinta a geometria pronta: papel (ladrilhos do miolo + ladrilhos com calombo da borda, sem sobreposição) num
 * único `fill`, e os traços num único `stroke` de ponta reta. No LOD
 * (`flat`) só o papel, em cor lisa — com a MESMA borda irregular.
 */
export function paintHatchGeometry(graphics: Graphics, geometry: HatchGeometry, flat: boolean, cameraScale: number): void {
  graphics.clear()
  const rects = geometry.paperRects
  if (rects.length === 0 && geometry.paperPolygons.length === 0) return
  for (let k = 0; k < rects.length; k += 4) graphics.rect(rects[k], rects[k + 1], rects[k + 2], rects[k + 3])
  for (const polygon of geometry.paperPolygons) graphics.poly(polygon, true)
  graphics.fill({ color: flat ? HATCH_FLAT_COLOR : PARCHMENT_COLOR })
  if (flat) return

  const strokes = geometry.strokes
  if (strokes.length === 0) return
  for (let k = 0; k < strokes.length; k += 4) graphics.moveTo(strokes[k], strokes[k + 1]).lineTo(strokes[k + 2], strokes[k + 3])
  graphics.stroke({ width: hatchStrokeWidth(geometry.grid, cameraScale).width, color: HATCH_INK_COLOR, cap: 'butt' })
}

/**
 * Faixa de hachura VETORIAL "Dyson Logos" (hatchGeometry.ts): cachos de traços
 * num grid global de mundo, borda externa irregular, papel opaco atrás.
 *
 * `_pattern` não é mais usado (a textura do tile ficou para trás); o parâmetro
 * fica pela compatibilidade de assinatura. `regions` tira do conjunto os
 * cachos cujo centro cai em sala.
 */
export function drawHatch(
  graphics: Graphics,
  walls: Wall[],
  floorPolygons: FloorPolygon[],
  grid: number,
  _pattern: FillPattern | null,
  cameraScale = 1,
  regions: Region[] = [],
): HatchGeometry {
  const geometry = buildHatchGeometry({ walls, regions, floorPolygons, grid })
  paintHatchGeometry(graphics, geometry, hatchUsesFlatBand(cameraScale, grid), cameraScale)
  return geometry
}

export interface HatchInput {
  walls: Wall[]
  regions: Region[]
  floorPolygons: FloorPolygon[]
  grid: number
  cameraScale: number
}

export interface HatchRenderer {
  /**
   * Refaz a GEOMETRIA (e a máscara) só quando `cacheKey` muda (comparação por
   * `===` item a item). Repinta o Graphics sem recalcular quando o zoom cruza
   * o LOD ou o degrau da largura do traço (`hatchStrokeWidth`). Seleção e pan
   * não custam nada.
   */
  draw: (hatch: Graphics, mask: Graphics, input: HatchInput, cacheKey: readonly unknown[]) => void
}

/**
 * Renderer com cache, uma instância por canvas (editor e jogador). A máscara
 * é INVERSA: a silhueta do piso (floorMask.ts) apaga a faixa dentro de sala e
 * corredor, inclusive em sala sem preenchimento ou oculta translúcida.
 *
 * `_getPattern` é ignorado desde a hachura vetorial; continua na assinatura
 * para PixiCanvas/PlayerView não mudarem.
 */
export function createHatchRenderer(_getPattern?: () => FillPattern | null): HatchRenderer {
  let lastKey: readonly unknown[] | null = null
  let geometry: HatchGeometry | null = null
  let lastFlat: boolean | null = null
  let lastTier: number | null = null
  let masked = false

  function sameKey(a: readonly unknown[] | null, b: readonly unknown[]): boolean {
    return a !== null && a.length === b.length && a.every((value, i) => value === b[i])
  }

  function draw(hatch: Graphics, mask: Graphics, input: HatchInput, cacheKey: readonly unknown[]): void {
    const flat = hatchUsesFlatBand(input.cameraScale, input.grid)
    const tier = flat ? -1 : hatchStrokeWidth(input.grid, input.cameraScale).tier
    const keyChanged = geometry === null || !sameKey(lastKey, cacheKey)
    if (!keyChanged && flat === lastFlat && tier === lastTier) return
    lastFlat = flat
    lastTier = tier

    if (keyChanged) {
      lastKey = cacheKey
      geometry = buildHatchGeometry(input)
      const hasFloor = buildFloorMask(mask, input.regions, input.walls, input.floorPolygons)
      if (hasFloor && !masked) {
        hatch.setMask({ mask, inverse: true })
        masked = true
      } else if (!hasFloor && masked) {
        hatch.mask = null
        masked = false
      }
    }
    paintHatchGeometry(hatch, geometry as HatchGeometry, flat, input.cameraScale)
  }

  return { draw }
}
