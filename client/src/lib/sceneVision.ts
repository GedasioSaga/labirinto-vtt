import type { MapData } from '../types/map'

/**
 * VISÃO POR CENA: a cena diz quantos quadrados se enxerga nela ("Visão nesta
 * cena", `MapData.visionCells`) e cada jogador tem um fator próprio, que vale
 * em toda cena. Mapa-mundi longe, mina perto, sem o mestre mexer no raio de
 * ninguém a cada viagem.
 */

/** Faixa do "Visão nesta cena", em quadrados inteiros. */
export const SCENE_VISION_CELLS_MIN = 1
export const SCENE_VISION_CELLS_MAX = 200

/** Faixa do "Fator de visão" de cada jogador (slider do painel Sala). */
export const VISION_FACTOR_MIN = 0.5
export const VISION_FACTOR_MAX = 3
export const VISION_FACTOR_STEP = 0.1
export const VISION_FACTOR_DEFAULT = 1

/**
 * O valor da cena, só se servir: inteiro dentro da faixa. O resto (texto,
 * zero, negativo, fração, arquivo editado à mão) é AUSENTE — o raio de sempre —
 * e nunca raio zero, que deixaria o grupo inteiro às cegas.
 */
export function readSceneVisionCells(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined
  return value >= SCENE_VISION_CELLS_MIN && value <= SCENE_VISION_CELLS_MAX ? value : undefined
}

/** Fator na faixa, em passos de 0,1 (o slider manda `1.5000000001` às vezes). */
export function clampVisionFactor(factor: number): number {
  // Uma casa decimal = o passo de 0,1 do slider.
  const stepped = Math.round(factor * 10) / 10
  return Math.min(VISION_FACTOR_MAX, Math.max(VISION_FACTOR_MIN, stepped))
}

/** "x1,0": o fator como o mestre lê no painel. */
export function formatVisionFactor(factor: number): string {
  return `x${factor.toFixed(1).replace('.', ',')}`
}

/**
 * Raio em px de mundo. Com "Visão nesta cena": quadrados x casa x fator. Sem
 * valor: o raio em px do jogador (`basePx`, o de hoje) x fator.
 */
export function playerVisionRadius(map: Pick<MapData, 'grid' | 'visionCells'>, basePx: number, factor: number): number {
  const cells = readSceneVisionCells(map.visionCells)
  const base = cells === undefined ? basePx : cells * map.grid
  return base * factor
}
