import { expect } from 'vitest'
import type { Point } from '../../pixi/world'
import type { DoorState, Wall } from '../../types/map'
import { isTokenPathClear, segmentsIntersect } from '../collision'
import type { FichaNoCaminho, PontoDoCaminho } from './busca'
import { TOLERANCIA_ENTRE_FICHAS } from './busca'
import { distanciaAoTraco, type MapaDoCaminho } from './malha'

/** Ajudantes dos testes do motor de caminhamento (só teste importa este arquivo). */

export const GRID = 64

export function mapa(walls: Wall[], largura = 15, altura = 10): MapaDoCaminho {
  return { walls, grid: GRID, width: largura, height: altura }
}

export function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

export function porta(estado: Partial<DoorState> = {}): DoorState {
  return { open: false, locked: false, kind: 'normal', ...estado }
}

/** Uma parede vertical em `x`, do topo ao fundo do mapa, com um vão (ou porta) de `y0` a `y1`. */
export function paredeComVao(x: number, y0: number, y1: number, altura: number, noVao: Partial<Wall> | null = null): Wall[] {
  const walls = [parede('cima', x, 0, x, y0), parede('baixo', x, y1, x, altura * GRID)]
  if (noVao !== null) walls.push(parede('vao', x, y0, x, y1, noVao))
  return walls
}

/** A parede como ficou depois que o NPC abriu a porta `abertas`. */
function comPortasAbertas(walls: readonly Wall[], abertas: ReadonlySet<string>): Wall[] {
  return walls.map((w) => (w.door !== null && abertas.has(w.id) ? { ...w, door: { ...w.door, open: true } } : w))
}

/**
 * Cada traço do caminho é andável: pela regra do arrasto (janela barra), não
 * cruza parede, porta fechada nem trancada (a que o caminho abre conta aberta
 * do ponto `abrir` ao ponto `fechar`), e não encosta em ficha.
 */
export function confereCaminho(pontos: readonly PontoDoCaminho[], walls: readonly Wall[], raio: number, fichas: readonly FichaNoCaminho[] = []): void {
  const abertas = new Set<string>()
  for (let i = 1; i < pontos.length; i += 1) {
    const a = pontos[i - 1]
    const b = pontos[i]
    if (a === undefined || b === undefined) continue
    if (a.abrir !== undefined) abertas.add(a.abrir)
    const agora = comPortasAbertas(walls, abertas).map((w) => (w.janela === true ? { ...w, blocksMove: true } : w))
    expect(isTokenPathClear(a, b, agora, GRID), `traço ${i} pela regra do arrasto`).toBe(true)
    for (const w of agora) {
      const passa = !w.blocksMove || (w.door !== null && w.door.open && !w.door.locked && w.door.secret !== true)
      if (passa) continue
      expect(segmentsIntersect(a, b, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }), `traço ${i} cruza ${w.id}`).toBe(false)
    }
    for (const f of fichas) {
      expect(distanciaAoTraco(f.x, f.y, a.x, a.y, b.x, b.y), `traço ${i} encosta em ${f.id}`).toBeGreaterThanOrEqual(raio + f.raio - GRID * TOLERANCIA_ENTRE_FICHAS - 1e-6)
    }
    if (b.fechar !== undefined) abertas.delete(b.fechar)
  }
}

export function inicioEFim(pontos: readonly Point[]): [Point | undefined, Point | undefined] {
  return [pontos[0], pontos[pontos.length - 1]]
}
