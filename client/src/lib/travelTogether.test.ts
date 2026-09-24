/**
 * `lib/travelTogether.ts` — quem está perto de quem pediu e onde cada um
 * chega, sem sessão nem rede.
 *
 * O que se cobra: "perto" é Chebyshev ≤ 2 casas (a diagonal de 2 conta, a
 * terceira casa não); de quem tem duas fichas perto viaja a mais próxima; e as
 * casas de chegada são distintas, em volta do pino, nunca na casa de quem
 * pediu (que chega em cima do pino).
 */
import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { companionSpots, companionsNear, isNear } from './travelTogether'

const GRADE = 50
const casa = (coluna: number, linha: number) => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })

function ficha(id: string, p: { x: number; y: number }): Token {
  return { id, characterId: null, name: id, x: p.x, y: p.y, size: 1, image: null }
}

describe('isNear', () => {
  it('Chebyshev: 2 casas em linha e na diagonal contam; 3 não', () => {
    const ana = casa(10, 5)
    expect(isNear(casa(12, 5), ana, GRADE)).toBe(true)
    expect(isNear(casa(12, 7), ana, GRADE)).toBe(true)
    expect(isNear(casa(8, 3), ana, GRADE)).toBe(true)
    expect(isNear(casa(13, 5), ana, GRADE)).toBe(false)
    expect(isNear(casa(11, 8), ana, GRADE)).toBe(false)
  })
})

describe('companionsNear', () => {
  it('só quem tem ficha perto, na ordem de chegada; de duas fichas perto viaja a mais próxima', () => {
    const ana = casa(10, 5)
    const perto = companionsNear(ana, GRADE, [
      { playerId: 'carla', tokens: [ficha('cajado', casa(14, 5))] },
      { playerId: 'bruno', tokens: [ficha('machado-longe', casa(12, 7)), ficha('machado', casa(11, 5))] },
      { playerId: 'sem-ficha', tokens: [] },
      { playerId: 'davi', tokens: [ficha('arco', casa(9, 4))] },
    ])
    expect(perto.map((c) => [c.playerId, c.token.id])).toEqual([
      ['bruno', 'machado'],
      ['davi', 'arco'],
    ])
  })
})

describe('companionSpots', () => {
  it('uma casa por companheiro, todas distintas, em volta do pino e fora da casa de quem pediu', () => {
    const pino = casa(20, 5)
    const mapa = createEmptyMap('cripta', 'Cripta', 40, 12, GRADE)
    const casas = companionSpots(mapa, pino, { ...pino, size: 1 }, [1, 1, 1, 1, 1, 1])
    const pontos = casas.filter((p): p is { x: number; y: number } => p !== null)
    expect(pontos).toHaveLength(6)
    const chaves = new Set([`${pino.x}|${pino.y}`, ...pontos.map((p) => `${p.x}|${p.y}`)])
    expect(chaves.size).toBe(7)
    expect(pontos.every((p) => Math.max(Math.abs(p.x - pino.x), Math.abs(p.y - pino.y)) <= GRADE)).toBe(true)
  })

  it('ficha que já está no destino ocupa a casa dela', () => {
    const pino = casa(20, 5)
    const ocupada = casa(20, 4)
    const mapa = { ...createEmptyMap('cripta', 'Cripta', 40, 12, GRADE), tokens: [ficha('estatua', ocupada)] }
    const casas = companionSpots(mapa, pino, { ...pino, size: 1 }, Array(8).fill(1))
    expect(casas.some((p) => p !== null && p.x === ocupada.x && p.y === ocupada.y)).toBe(false)
  })
})
