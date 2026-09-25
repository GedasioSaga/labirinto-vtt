import type { RegionPoint } from '../types/map'

/**
 * RUÍDO NO MAPA, regras compartilhadas por mestre e jogador. O mestre dispara
 * um ruído num ponto; o jogador perto o bastante ouve só a DIREÇÃO, e sempre
 * arredondada a um dos 8 pontos da rosa. O ângulo exato não sai: cruzado com
 * a ficha do próprio jogador, ele daria a linha onde o ruído está — e dois
 * jogadores juntando as linhas, o ponto.
 *
 * Norte é o alto da tela (y do mundo cresce para baixo), igual ao mapa do
 * jogador, que não gira.
 */

/** Os 8 pontos da rosa e "ao redor" (o ruído está em cima da ficha: não há para onde apontar). */
export type NoiseDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' | 'around'

/** Na ordem do relógio a partir do norte: o índice vezes 45 é o ângulo da seta. */
const COMPASS: readonly Exclude<NoiseDirection, 'around'>[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
const COMPASS_STEP_DEG = 45

/** Abaixo desta fração de casa entre a ficha e o ruído, a direção é "ao redor". */
const AROUND_CELLS = 0.5

/** Quanto tempo o aviso fica na tela do jogador. */
export const NOISE_CUE_TTL_MS = 5000

/** Alcance do ruído em casas: faixa, padrão e as opções da lista do mestre. */
export const NOISE_RANGE_MIN_CELLS = 1
export const NOISE_RANGE_MAX_CELLS = 60
export const NOISE_RANGE_DEFAULT_CELLS = 12
export const NOISE_RANGE_OPTIONS: readonly { cells: number; label: string }[] = [
  { cells: 6, label: 'Perto (6 casas)' },
  { cells: 12, label: 'Médio (12 casas)' },
  { cells: 24, label: 'Longe (24 casas)' },
  { cells: 60, label: 'A cena toda (60 casas)' },
]

const CUE_TEXT: Record<NoiseDirection, string> = {
  n: 'Um ruído ao norte',
  ne: 'Um ruído a nordeste',
  e: 'Um ruído a leste',
  se: 'Um ruído a sudeste',
  s: 'Um ruído ao sul',
  sw: 'Um ruído a sudoeste',
  w: 'Um ruído a oeste',
  nw: 'Um ruído a noroeste',
  around: 'Um ruído bem perto de você',
}

export function isNoiseDirection(value: unknown): value is NoiseDirection {
  return typeof value === 'string' && Object.hasOwn(CUE_TEXT, value)
}

/** Alcance preso na faixa; o que não é número finito cai no padrão. */
export function clampNoiseRangeCells(cells: number): number {
  if (!Number.isFinite(cells)) return NOISE_RANGE_DEFAULT_CELLS
  return Math.min(NOISE_RANGE_MAX_CELLS, Math.max(NOISE_RANGE_MIN_CELLS, cells))
}

/**
 * De onde vem o ruído, visto de `listener`: o ponto da rosa mais próximo do
 * ângulo real (setores de 45°), ou "ao redor" a menos de meia casa.
 */
export function noiseDirection(listener: RegionPoint, source: RegionPoint, grid: number): NoiseDirection {
  const dx = source.x - listener.x
  const dy = source.y - listener.y
  if (Math.hypot(dx, dy) < grid * AROUND_CELLS) return 'around'
  // Graus a partir do norte, no sentido do relógio: `atan2(leste, norte)`.
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI
  const sector = ((Math.round(deg / COMPASS_STEP_DEG) % COMPASS.length) + COMPASS.length) % COMPASS.length
  return COMPASS[sector]
}

/** O aviso do jogador, em uma linha: a direção, e nada sobre distância ou fonte. */
export function noiseCueText(dir: NoiseDirection): string {
  return CUE_TEXT[dir]
}

/** Ângulo da seta em graus (0 = norte, sentido do relógio); `null` para "ao redor". */
export function noiseArrowAngle(dir: NoiseDirection): number | null {
  if (dir === 'around') return null
  return COMPASS.indexOf(dir) * COMPASS_STEP_DEG
}

/** O retorno para o mestre depois do clique: quantos ouviram, ou por que não saiu. */
export function noiseFeedbackText(heard: number | null): string {
  if (heard === null) return 'Ruído não saiu: a sala não está aberta.'
  if (heard === 0) return 'Ruído: ninguém perto o bastante para ouvir.'
  return heard === 1 ? 'Ruído: 1 jogador ouviu a direção.' : `Ruído: ${heard} jogadores ouviram a direção.`
}
