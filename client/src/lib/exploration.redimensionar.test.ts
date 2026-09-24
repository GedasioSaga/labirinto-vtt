/**
 * Aumentar (ou diminuir) o mapa com a MESMA grade não pode apagar o que o
 * jogador já explorou: `resizeExploration` copia a memória para a planta nova,
 * no mesmo lugar do mundo. O que é novo (a faixa que cresceu) nasce preto, e o
 * que saiu do mapa não volta se ele crescer de novo.
 */
import { describe, expect, it } from 'vitest'
import type { RegionPoint } from '../types/map'
import { countExploredCells, createExploration, isPointExplored, markAll, markRings, resizeExploration } from './exploration'

const GRADE = 50

function quadrado(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

/** Mina de 30 x 10 quadrados com o canto de cima à esquerda explorado. */
function minaComCanto() {
  const exp = createExploration({ width: 30 * GRADE, height: 10 * GRADE, grid: GRADE })
  markRings(exp, [quadrado(0, 0, 300, 300)])
  return exp
}

describe('resizeExploration', () => {
  it('Mina +20 quadrados: o canto explorado fica no mesmo lugar e a faixa nova nasce preta', () => {
    const antes = minaComCanto()
    const depois = resizeExploration(antes, { width: 50 * GRADE, height: 10 * GRADE, grid: GRADE })

    expect(depois.cell).toBe(antes.cell)
    expect(depois.cols).toBe(antes.cols + (20 * GRADE) / antes.cell)
    expect(depois.rows).toBe(antes.rows)
    // Mesmo explorado, célula por célula, e no mesmo ponto do mundo.
    expect(countExploredCells(depois)).toBe(countExploredCells(antes))
    expect(isPointExplored(depois, { x: 150, y: 150 })).toBe(true)
    expect(isPointExplored(depois, { x: 290, y: 20 })).toBe(true)
    // O resto da mina e a faixa nova seguem pretos.
    expect(isPointExplored(depois, { x: 1000, y: 150 })).toBe(false)
    expect(isPointExplored(depois, { x: 2000, y: 150 })).toBe(false)
    expect(isPointExplored(depois, { x: 2490, y: 490 })).toBe(false)
    // O contorno lembrado (a borda lisa) vem junto.
    expect(depois.rings.length).toBe(antes.rings.length)
    expect(depois.ringVertices).toBe(antes.ringVertices)
    // A memória antiga não é mexida: quem ainda a lê não vê o tamanho mudar por baixo.
    expect(antes.cols).toBe(30 * 4)
  })

  it('crescer para baixo também: a linha de cada célula não escorrega', () => {
    const antes = minaComCanto()
    const depois = resizeExploration(antes, { width: 30 * GRADE, height: 25 * GRADE, grid: GRADE })
    expect(depois.rows).toBe(25 * 4)
    expect(countExploredCells(depois)).toBe(countExploredCells(antes))
    expect(isPointExplored(depois, { x: 150, y: 290 })).toBe(true)
    expect(isPointExplored(depois, { x: 150, y: 320 })).toBe(false)
    expect(isPointExplored(depois, { x: 150, y: 1200 })).toBe(false)
  })

  it('diminuir corta o que saiu do mapa, e crescer de novo não traz de volta', () => {
    const exp = createExploration({ width: 30 * GRADE, height: 10 * GRADE, grid: GRADE })
    markAll(exp)
    const menor = resizeExploration(exp, { width: 10 * GRADE, height: 10 * GRADE, grid: GRADE })
    expect(menor.cols).toBe(10 * 4)
    expect(countExploredCells(menor)).toBe(10 * 4 * 10 * 4)
    const deNovoMaior = resizeExploration(menor, { width: 30 * GRADE, height: 10 * GRADE, grid: GRADE })
    expect(isPointExplored(deNovoMaior, { x: 250, y: 250 })).toBe(true)
    // O que foi cortado volta preto: pode ser outra planta lá agora.
    expect(isPointExplored(deNovoMaior, { x: 1000, y: 250 })).toBe(false)
    expect(countExploredCells(deNovoMaior)).toBe(10 * 4 * 10 * 4)
  })

  it('contorno lembrado que sai do mapa menor é descartado; o que cabe fica', () => {
    const exp = createExploration({ width: 30 * GRADE, height: 10 * GRADE, grid: GRADE })
    markRings(exp, [quadrado(0, 0, 300, 300)])
    markRings(exp, [quadrado(1000, 0, 1400, 300)])
    expect(exp.rings.length).toBe(2)
    const menor = resizeExploration(exp, { width: 10 * GRADE, height: 10 * GRADE, grid: GRADE })
    expect(menor.rings.length).toBe(1)
    expect(menor.ringVertices).toBe(menor.rings[0]?.points.length)
    const deNovoMaior = resizeExploration(menor, { width: 30 * GRADE, height: 10 * GRADE, grid: GRADE })
    expect(isPointExplored(deNovoMaior, { x: 1200, y: 150 })).toBe(false)
  })

  it('mapa enorme engrossa a célula: só vira explorada a célula nova coberta INTEIRA pela memória', () => {
    const antes = minaComCanto()
    // 400 x 200 quadrados passa do teto de células com a célula de 12,5 px: ela dobra.
    const depois = resizeExploration(antes, { width: 400 * GRADE, height: 200 * GRADE, grid: GRADE })
    expect(depois.cell).toBe(antes.cell * 2)
    expect(isPointExplored(depois, { x: 150, y: 150 })).toBe(true)
    // Célula grossa que só metade estava explorada não acende (bitset conservador).
    const bitsetAntes = countExploredCells(antes)
    expect(countExploredCells(depois)).toBeGreaterThan(0)
    expect(countExploredCells(depois) * 4).toBeLessThanOrEqual(bitsetAntes)
    expect(isPointExplored(depois, { x: 1000, y: 150 })).toBe(false)
  })
})
