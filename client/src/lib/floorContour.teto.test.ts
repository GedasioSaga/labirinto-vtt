import { describe, expect, it } from 'vitest'
import { MAX_FLOOR_SAMPLES, buildFloorOutline, floorSampleStep } from './floorContour'
import { blocosDistance } from './floorBlocks'
import type { FloorPiece } from '../types/map'

/*
 * Pedido 03/10/2026: chão "muito grande" travava e derrubava o programa. A
 * grade do contorno no passo de 2 px virava dezenas de milhões de amostras
 * (um chão de 12 800 px: ~41 M amostras, ~160 MB por contorno). Teto de
 * amostras; tamanho comum não muda.
 */
const caixa = (w: number, h: number) => ({ minX: 0, minY: 0, maxX: w, maxY: h })
const amostras = (w: number, h: number, passo: number) => (w / passo + 5) * (h / passo + 5)

describe('floorSampleStep — teto de amostras do contorno do chão', () => {
  it('mapa de tamanho comum (30 × 20 casas de 64 px) fica no passo pedido, inclusive no passo 1', () => {
    expect(floorSampleStep(caixa(1920, 1280), 2)).toBe(2)
    expect(floorSampleStep(caixa(1920, 1280), 1)).toBe(1)
    expect(floorSampleStep(caixa(1920, 1280), 4)).toBe(4)
  })

  it('até 4 000 × 4 000 px o passo 2 continua', () => {
    expect(floorSampleStep(caixa(3900, 3900), 2)).toBe(2)
  })

  it('chão enorme: o passo cresce e a grade cabe no teto', () => {
    for (const lado of [6400, 12800, 25600, 100_000]) {
      const passo = floorSampleStep(caixa(lado, lado), 2)
      expect(passo, `lado ${lado}`).toBeGreaterThan(2)
      expect(amostras(lado, lado, passo), `lado ${lado}`).toBeLessThanOrEqual(MAX_FLOOR_SAMPLES * 1.01)
    }
  })

  it('o passo nunca fica menor que o pedido', () => {
    expect(floorSampleStep(caixa(12800, 12800), 50)).toBe(50)
  })

  it('teto desligado (0 ou Infinity) devolve o passo pedido', () => {
    expect(floorSampleStep(caixa(12800, 12800), 2, Infinity)).toBe(2)
    expect(floorSampleStep(caixa(12800, 12800), 2, 0)).toBe(2)
  })

  it('chão de 12 800 px contorna rápido e com o retângulo certo', () => {
    const lado = 12800
    const peca: FloorPiece = { id: 'g', shape: { kind: 'rect', cx: lado / 2, cy: lado / 2, w: lado, h: lado }, op: 'add', modifiers: {} }
    const t0 = performance.now()
    const [poligono] = buildFloorOutline([peca], { clip: caixa(lado, lado) })
    const ms = performance.now() - t0
    const xs = poligono.outer.map((p) => p.x)
    const ys = poligono.outer.map((p) => p.y)
    expect(Math.min(...xs)).toBeCloseTo(0, 0)
    expect(Math.max(...xs)).toBeCloseTo(lado, 0)
    expect(Math.min(...ys)).toBeCloseTo(0, 0)
    expect(Math.max(...ys)).toBeCloseTo(lado, 0)
    // Eram ~2 s antes do teto; folga larga para máquina carregada.
    expect(ms).toBeLessThan(1500)
  })

  it('balde de 100 × 100 casas contorna em menos de 2 s (eram ~10 s)', () => {
    const cells = []
    for (let c = 0; c < 100; c++) for (let r = 0; r < 100; r++) cells.push({ col: c, row: r })
    const peca: FloorPiece = { id: 'b', shape: { kind: 'blocos', cell: 64, cells }, op: 'add', modifiers: {} }
    const t0 = performance.now()
    const poligonos = buildFloorOutline([peca], { clip: caixa(6400, 6400) })
    expect(performance.now() - t0).toBeLessThan(2000)
    expect(poligonos).toHaveLength(1)
    expect(poligonos[0].holes).toHaveLength(0)
  })
})

describe('blocosDistance com índice numérico — mesmo resultado, inclusive em coordenada negativa', () => {
  it('dentro negativo, fora positivo, borda 0, célula de índice negativo', () => {
    const forma = { kind: 'blocos' as const, cell: 10, cells: [{ col: -1, row: -1 }, { col: 0, row: -1 }] }
    expect(blocosDistance(forma, -5, -5)).toBeCloseTo(-5)
    expect(blocosDistance(forma, 5, -5)).toBeCloseTo(-5)
    // Divisa interna entre as duas células não é borda.
    expect(blocosDistance(forma, 0, -5)).toBeLessThan(0)
    expect(blocosDistance(forma, 5, 5)).toBeCloseTo(5)
    expect(blocosDistance(forma, -10, -5)).toBeCloseTo(0)
  })
})
