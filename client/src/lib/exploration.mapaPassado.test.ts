/**
 * PASSAR O MAPA — a união de duas memórias de exploração. Quem recebe passa a
 * conhecer o que o colega explorou, sem perder o que já conhecia; o que toca
 * zona oculta ativa ou sala secreta NÃO passa, mesmo que o colega tenha visto
 * antes de o mestre esconder.
 */
import { describe, expect, it } from 'vitest'
import type { RegionPoint } from '../types/map'
import { countExploredCells, createExploration, isPointExplored, markRings, mergeExploration } from './exploration'

const MAPA = { width: 1000, height: 500, grid: 50 }

function quadrado(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

describe('mergeExploration — passar o mapa explorado', () => {
  it('quem recebe passa a conhecer o trecho do colega e continua conhecendo o seu', () => {
    const doador = createExploration(MAPA)
    markRings(doador, [quadrado(0, 0, 200, 200)])
    const recebedor = createExploration(MAPA)
    markRings(recebedor, [quadrado(800, 300, 1000, 500)])
    const antes = countExploredCells(recebedor)

    expect(isPointExplored(recebedor, { x: 100, y: 100 })).toBe(false)
    expect(mergeExploration(recebedor, doador)).toBe(true)

    expect(isPointExplored(recebedor, { x: 100, y: 100 })).toBe(true)
    expect(isPointExplored(recebedor, { x: 900, y: 400 })).toBe(true)
    expect(countExploredCells(recebedor)).toBe(antes + countExploredCells(doador))
    // O doador não ganha nada de volta: passar é de mão única.
    expect(isPointExplored(doador, { x: 900, y: 400 })).toBe(false)
  })

  it('o contorno lembrado do colega vem junto (a borda do trecho não volta serrilhada)', () => {
    const doador = createExploration(MAPA)
    markRings(doador, [quadrado(3, 3, 197, 197)])
    const recebedor = createExploration(MAPA)
    mergeExploration(recebedor, doador)
    expect(recebedor.rings.length).toBe(doador.rings.length)
    expect(recebedor.rings.length).toBeGreaterThan(0)
    // Ponto na faixa da borda que o bitset conservador perde: só o contorno o cobre.
    expect(isPointExplored(recebedor, { x: 5, y: 100 })).toBe(true)
  })

  it('zona oculta ativa: o que o colega viu antes de o mestre esconder NÃO passa', () => {
    const doador = createExploration(MAPA)
    markRings(doador, [quadrado(0, 0, 400, 400)])
    expect(isPointExplored(doador, { x: 300, y: 300 })).toBe(true)
    const zona = quadrado(250, 250, 350, 350)
    const recebedor = createExploration(MAPA)
    mergeExploration(recebedor, doador, [zona])

    expect(isPointExplored(recebedor, { x: 300, y: 300 })).toBe(false)
    expect(isPointExplored(recebedor, { x: 100, y: 100 })).toBe(true)
    // Nenhum contorno que encosta na zona viaja: ele desenharia a borda dela.
    expect(recebedor.rings.length).toBe(0)
    expect(countExploredCells(recebedor)).toBeGreaterThan(0)
  })

  it('memória de outro tamanho de mapa não mistura: nada muda e devolve false', () => {
    const doador = createExploration({ width: 2000, height: 500, grid: 50 })
    markRings(doador, [quadrado(0, 0, 200, 200)])
    const recebedor = createExploration(MAPA)
    expect(mergeExploration(recebedor, doador)).toBe(false)
    expect(countExploredCells(recebedor)).toBe(0)
    expect(recebedor.rings).toEqual([])
  })
})
