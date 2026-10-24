import type { DoorState, Wall } from '../../types/map'

/** Ajudantes dos testes do modo batalha (só teste importa este arquivo). */

export const GRID = 64

/** Sorteio com semente (mulberry32): mesma semente, mesmo mapa. */
export function sorteador(semente: number): () => number {
  let a = semente
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Inteiro de `min` a `max`, os dois inclusos. */
export function inteiro(sorteio: () => number, min: number, max: number): number {
  return min + Math.floor(sorteio() * (max - min + 1))
}

/** Parede comum de (x1, y1) a (x2, y2), em CASAS (vira px de mundo aqui). */
export function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1: x1 * GRID, y1: y1 * GRID, x2: x2 * GRID, y2: y2 * GRID, blocksLight: true, blocksMove: true, door: null, ...extra }
}

export function porta(estado: Partial<DoorState> = {}): DoorState {
  return { open: false, locked: false, kind: 'normal', ...estado }
}
