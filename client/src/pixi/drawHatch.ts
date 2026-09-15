import type { FillPattern, Graphics } from 'pixi.js'
import type { FloorPolygon } from '../lib/floorContour'
import type { Region, RegionPoint, Wall } from '../types/map'
import { HATCH_FLAT_COLOR, hatchBandWidth, hatchUsesFlatBand, isInteriorWall, wallWidthFor } from './dungeonStyle'
import { groupWallChains, screenSafeWidth, traceWallChain } from './drawWalls'
import { buildFloorMask } from './floorMask'

function flatten(ring: RegionPoint[]): number[] {
  const out: number[] = new Array(ring.length * 2)
  ring.forEach((p, i) => {
    out[i * 2] = p.x
    out[i * 2 + 1] = p.y
  })
  return out
}

/**
 * Cadeias da faixa de hachura: só parede EXTERNA (interna não ganha faixa).
 * Parede com porta ENTRA — a faixa continua atrás do vão, e o chão do
 * corredor por cima recorta o que for passagem. Quebra só quando a largura
 * da parede muda (thickness diferente), porque a faixa é medida da face dela.
 */
export function hatchWallChains(walls: Wall[], grid: number): Wall[][] {
  const exterior = walls.filter((wall) => !isInteriorWall(wall))
  return groupWallChains(exterior, (previous, next) => wallWidthFor(previous, grid) !== wallWidthFor(next, grid))
}

/**
 * Faixa de hachura por ORDEM DE PINTURA (plano, abordagem A): um stroke largo
 * texturizado sob todo piso. A faixa se estende `hatchBandWidth(grid)` além da
 * FACE da parede: largura do stroke = parede + 2 × faixa. Anéis de chão por
 * peças recebem stroke de 2 × faixa (sem parede).
 *
 * `pattern === null` (sem canvas 2D) ou zoom abaixo do LOD (`hatchUsesFlatBand`)
 * pinta a faixa em cor lisa.
 */
export function drawHatch(
  graphics: Graphics,
  walls: Wall[],
  floorPolygons: FloorPolygon[],
  grid: number,
  pattern: FillPattern | null,
  cameraScale = 1,
): void {
  graphics.clear()
  const band = hatchBandWidth(grid)
  const texture = pattern !== null && !hatchUsesFlatBand(cameraScale, grid) ? { fill: pattern } : { color: HATCH_FLAT_COLOR }
  const paint = (width: number) => ({ ...texture, width: screenSafeWidth(width, cameraScale), cap: 'round' as const, join: 'round' as const })

  for (const chain of hatchWallChains(walls, grid)) {
    traceWallChain(graphics, chain)
    graphics.stroke(paint(wallWidthFor(chain[0], grid) + 2 * band))
  }
  for (const polygon of floorPolygons) {
    for (const ring of [polygon.outer, ...polygon.holes]) {
      if (ring.length < 3) continue
      graphics.poly(flatten(ring), true).stroke(paint(2 * band))
    }
  }
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
   * Redesenha faixa e máscara só quando `cacheKey` muda (comparação por `===`
   * item a item) ou quando o LOD cruza o limite. Seleção sozinha não repinta.
   */
  draw: (hatch: Graphics, mask: Graphics, input: HatchInput, cacheKey: readonly unknown[]) => void
}

/**
 * Renderer com cache, uma instância por canvas (editor e jogador). A máscara
 * é INVERSA: a silhueta do piso (floorMask.ts) apaga a faixa dentro de sala e
 * corredor, inclusive em sala sem preenchimento ou oculta translúcida.
 */
export function createHatchRenderer(getPattern: () => FillPattern | null): HatchRenderer {
  let lastKey: readonly unknown[] | null = null
  let lastFlat: boolean | null = null
  let lastPattern: FillPattern | null = null
  let masked = false

  function sameKey(a: readonly unknown[] | null, b: readonly unknown[]): boolean {
    return a !== null && a.length === b.length && a.every((value, i) => value === b[i])
  }

  function draw(hatch: Graphics, mask: Graphics, input: HatchInput, cacheKey: readonly unknown[]): void {
    const pattern = getPattern()
    const flat = pattern === null || hatchUsesFlatBand(input.cameraScale, input.grid)
    if (sameKey(lastKey, cacheKey) && flat === lastFlat && pattern === lastPattern) return
    lastKey = cacheKey
    lastFlat = flat
    lastPattern = pattern

    drawHatch(hatch, input.walls, input.floorPolygons, input.grid, pattern, input.cameraScale)
    const hasFloor = buildFloorMask(mask, input.regions, input.walls, input.floorPolygons)
    if (hasFloor && !masked) {
      hatch.setMask({ mask, inverse: true })
      masked = true
    } else if (!hasFloor && masked) {
      hatch.mask = null
      masked = false
    }
  }

  return { draw }
}
