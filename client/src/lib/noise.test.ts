/**
 * RUÍDO NO MAPA: a direção que o jogador ouve é só um dos 8 pontos da rosa
 * (ou "ao redor"), nunca o ângulo exato — o ângulo exato, cruzado com a
 * ficha dele, entregaria a posição.
 */
import { describe, expect, it } from 'vitest'
import {
  NOISE_RANGE_DEFAULT_CELLS,
  NOISE_RANGE_MAX_CELLS,
  NOISE_RANGE_MIN_CELLS,
  clampNoiseRangeCells,
  isNoiseDirection,
  noiseArrowAngle,
  noiseCueText,
  noiseDirection,
} from './noise'

const GRID = 50
const ficha = { x: 500, y: 500 }

describe('noiseDirection', () => {
  it('os 8 pontos da rosa, com o norte para cima da tela (y cresce para baixo)', () => {
    expect(noiseDirection(ficha, { x: 500, y: 100 }, GRID)).toBe('n')
    expect(noiseDirection(ficha, { x: 900, y: 100 }, GRID)).toBe('ne')
    expect(noiseDirection(ficha, { x: 900, y: 500 }, GRID)).toBe('e')
    expect(noiseDirection(ficha, { x: 900, y: 900 }, GRID)).toBe('se')
    expect(noiseDirection(ficha, { x: 500, y: 900 }, GRID)).toBe('s')
    expect(noiseDirection(ficha, { x: 100, y: 900 }, GRID)).toBe('sw')
    expect(noiseDirection(ficha, { x: 100, y: 500 }, GRID)).toBe('w')
    expect(noiseDirection(ficha, { x: 100, y: 100 }, GRID)).toBe('nw')
  })

  it('arredonda para o ponto mais próximo: 20 graus a leste do norte ainda é norte', () => {
    const rad = (20 * Math.PI) / 180
    expect(noiseDirection(ficha, { x: 500 + Math.sin(rad) * 300, y: 500 - Math.cos(rad) * 300 }, GRID)).toBe('n')
    const rad2 = (25 * Math.PI) / 180
    expect(noiseDirection(ficha, { x: 500 + Math.sin(rad2) * 300, y: 500 - Math.cos(rad2) * 300 }, GRID)).toBe('ne')
  })

  it('a menos de meia casa da ficha não tem direção: "ao redor"', () => {
    expect(noiseDirection(ficha, ficha, GRID)).toBe('around')
    expect(noiseDirection(ficha, { x: 515, y: 510 }, GRID)).toBe('around')
    expect(noiseDirection(ficha, { x: 530, y: 500 }, GRID)).toBe('e')
  })
})

describe('isNoiseDirection', () => {
  it('só os 9 valores conhecidos', () => {
    for (const dir of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'around']) expect(isNoiseDirection(dir)).toBe(true)
    expect(isNoiseDirection('N')).toBe(false)
    expect(isNoiseDirection('norte')).toBe(false)
    expect(isNoiseDirection(0)).toBe(false)
    expect(isNoiseDirection(undefined)).toBe(false)
  })
})

describe('noiseCueText e noiseArrowAngle', () => {
  it('texto curto em português, sem distância nem fonte', () => {
    expect(noiseCueText('n')).toBe('Um ruído ao norte')
    expect(noiseCueText('ne')).toBe('Um ruído a nordeste')
    expect(noiseCueText('e')).toBe('Um ruído a leste')
    expect(noiseCueText('s')).toBe('Um ruído ao sul')
    expect(noiseCueText('w')).toBe('Um ruído a oeste')
    expect(noiseCueText('around')).toBe('Um ruído bem perto de você')
  })

  it('ângulo da seta em graus a partir do norte, no sentido do relógio; "ao redor" não tem seta', () => {
    expect(noiseArrowAngle('n')).toBe(0)
    expect(noiseArrowAngle('e')).toBe(90)
    expect(noiseArrowAngle('sw')).toBe(225)
    expect(noiseArrowAngle('around')).toBeNull()
  })
})

describe('clampNoiseRangeCells', () => {
  it('prende na faixa e cai no padrão com valor que não é número', () => {
    expect(clampNoiseRangeCells(12)).toBe(12)
    expect(clampNoiseRangeCells(0)).toBe(NOISE_RANGE_MIN_CELLS)
    expect(clampNoiseRangeCells(10_000)).toBe(NOISE_RANGE_MAX_CELLS)
    expect(clampNoiseRangeCells(Number.NaN)).toBe(NOISE_RANGE_DEFAULT_CELLS)
    expect(clampNoiseRangeCells(Number.POSITIVE_INFINITY)).toBe(NOISE_RANGE_DEFAULT_CELLS)
  })
})
