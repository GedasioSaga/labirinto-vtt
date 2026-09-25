/**
 * VISÃO POR CENA: a cena diz quantos quadrados se enxerga nela ("Visão nesta
 * cena"), e cada jogador tem um fator próprio (x1,0 de fábrica). Raio = cena x
 * fator. Cena sem valor continua como antes: o raio em px de cada jogador.
 */
import { describe, expect, it } from 'vitest'
import {
  VISION_FACTOR_DEFAULT,
  VISION_FACTOR_MAX,
  VISION_FACTOR_MIN,
  clampVisionFactor,
  formatVisionFactor,
  playerVisionRadius,
  readSceneVisionCells,
} from './sceneVision'

describe('playerVisionRadius', () => {
  it('cena com valor: quadrados x tamanho da casa x fator do jogador', () => {
    const mina = { grid: 64, visionCells: 6 }
    expect(playerVisionRadius(mina, 700, 1)).toBe(384)
    expect(playerVisionRadius(mina, 700, 1.5)).toBe(576)
    // O raio em px do jogador não conta onde a cena já diz o alcance.
    expect(playerVisionRadius(mina, 250, 1)).toBe(384)
  })

  it('cena sem valor: o raio em px de hoje, vezes o fator', () => {
    expect(playerVisionRadius({ grid: 64 }, 700, 1)).toBe(700)
    expect(playerVisionRadius({ grid: 64, visionCells: undefined }, 250, 1)).toBe(250)
    expect(playerVisionRadius({ grid: 64 }, 250, 1.5)).toBe(375)
  })

  it('valor torto na cena vale como ausente, não como raio zero', () => {
    expect(playerVisionRadius({ grid: 64, visionCells: 0 }, 700, 1)).toBe(700)
    expect(playerVisionRadius({ grid: 64, visionCells: Number.NaN }, 700, 1)).toBe(700)
  })
})

describe('readSceneVisionCells', () => {
  it('só inteiro positivo dentro da faixa passa', () => {
    expect(readSceneVisionCells(6)).toBe(6)
    expect(readSceneVisionCells(1)).toBe(1)
    expect(readSceneVisionCells(0)).toBeUndefined()
    expect(readSceneVisionCells(-3)).toBeUndefined()
    expect(readSceneVisionCells(2.5)).toBeUndefined()
    expect(readSceneVisionCells('6')).toBeUndefined()
    expect(readSceneVisionCells(null)).toBeUndefined()
    expect(readSceneVisionCells(Number.POSITIVE_INFINITY)).toBeUndefined()
    expect(readSceneVisionCells(100_000)).toBeUndefined()
  })
})

describe('fator do jogador', () => {
  it('fica na faixa, em passos de 0,1', () => {
    expect(clampVisionFactor(1.5)).toBe(1.5)
    expect(clampVisionFactor(1.54)).toBe(1.5)
    expect(clampVisionFactor(99)).toBe(VISION_FACTOR_MAX)
    expect(clampVisionFactor(0)).toBe(VISION_FACTOR_MIN)
    expect(VISION_FACTOR_DEFAULT).toBe(1)
  })

  it('aparece como "x1,0", com vírgula', () => {
    expect(formatVisionFactor(1)).toBe('x1,0')
    expect(formatVisionFactor(1.5)).toBe('x1,5')
    expect(formatVisionFactor(0.5)).toBe('x0,5')
  })
})
