import { describe, expect, it } from 'vitest'
import { countExploredCells, createExploration, isPointExplored, markRings, mergeExploration } from './exploration'

/** MEMÓRIA POR FICHA: somar a memória da ficha à do jogador. */
const MAPA = { width: 400, height: 400, grid: 40 }

const quadrado = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

describe('mergeExploration', () => {
  it('soma células e contornos da origem sem apagar o que o destino já tinha', () => {
    const jogador = createExploration(MAPA)
    const ficha = createExploration(MAPA)
    markRings(jogador, [quadrado(0, 0, 200, 200)])
    markRings(ficha, [quadrado(200, 200, 400, 400)])
    const antes = countExploredCells(jogador)

    mergeExploration(jogador, ficha)
    expect(isPointExplored(jogador, { x: 100, y: 100 })).toBe(true)
    expect(isPointExplored(jogador, { x: 300, y: 300 })).toBe(true)
    expect(countExploredCells(jogador)).toBe(antes + countExploredCells(ficha))
    expect(jogador.rings.length).toBe(2)
  })

  it('SEGURANÇA: célula e contorno que tocam a área proibida de agora não passam', () => {
    const jogador = createExploration(MAPA)
    const ficha = createExploration(MAPA)
    markRings(ficha, [quadrado(0, 0, 400, 400)])
    const cofre = quadrado(40, 40, 160, 160)

    mergeExploration(jogador, ficha, [cofre])
    expect(isPointExplored(jogador, { x: 100, y: 100 })).toBe(false)
    expect(isPointExplored(jogador, { x: 300, y: 300 })).toBe(true)
    // O contorno da ficha abraça o cofre: fica de fora inteiro (só o bitset conservador passa).
    expect(jogador.rings).toEqual([])
  })

  it('grades diferentes (outro mapa) não se somam', () => {
    const jogador = createExploration(MAPA)
    const outra = createExploration({ width: 800, height: 400, grid: 40 })
    markRings(outra, [quadrado(0, 0, 400, 400)])

    mergeExploration(jogador, outra)
    expect(countExploredCells(jogador)).toBe(0)
    expect(countExploredCells(outra)).toBeGreaterThan(0)
  })
})
