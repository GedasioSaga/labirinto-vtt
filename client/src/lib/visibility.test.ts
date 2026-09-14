import { describe, expect, it } from 'vitest'
import type { FloorPiece, Wall } from '../types/map'
import { pointInRing } from './floorContour'
import { createEmptyMap } from './mapFactory'
import { computeVisibility, visionSegments, type Segment } from './visibility'

function wall(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

describe('computeVisibility', () => {
  it('sem obstáculo: aproxima o círculo de alcance', () => {
    const poly = computeVisibility({ x: 0, y: 0 }, [], 100)
    expect(poly.length).toBeGreaterThanOrEqual(32)
    for (const p of poly) expect(Math.hypot(p.x, p.y)).toBeCloseTo(100)
    expect(pointInRing({ x: 50, y: 50 }, poly)).toBe(true)
    expect(pointInRing({ x: 120, y: 0 }, poly)).toBe(false)
  })

  it('parede esconde o que está atrás e mostra o que está ao lado', () => {
    const segments: Segment[] = [{ x1: 50, y1: -20, x2: 50, y2: 20 }]
    const poly = computeVisibility({ x: 0, y: 0 }, segments, 200)
    expect(pointInRing({ x: 100, y: 0 }, poly)).toBe(false)
    expect(pointInRing({ x: 40, y: 0 }, poly)).toBe(true)
    expect(pointInRing({ x: 100, y: 60 }, poly)).toBe(true)
  })

  it('raio zero ou negativo devolve polígono vazio', () => {
    expect(computeVisibility({ x: 0, y: 0 }, [], 0)).toEqual([])
  })

  it('benchmark: 800 segmentos × 8 origens', () => {
    const segments: Segment[] = []
    for (let i = 0; i < 800; i += 1) {
      const x = (i * 37) % 2000
      const y = (i * 91) % 2000
      segments.push({ x1: x, y1: y, x2: x + 30 + (i % 5) * 10, y2: y + ((i % 7) - 3) * 10 })
    }
    const start = performance.now()
    for (let k = 0; k < 8; k += 1) {
      const poly = computeVisibility({ x: 250 * k + 100, y: 250 * k + 100 }, segments, 600)
      expect(poly.length).toBeGreaterThan(0)
    }
    console.log(`computeVisibility benchmark: 800 segmentos x 8 origens = ${(performance.now() - start).toFixed(1)} ms`)
  })
})

/** Implementação ingênua original (O(raios × segmentos)), congelada como oráculo de equivalência. */
function referenceVisibility(origin: { x: number; y: number }, segments: Segment[], radius: number) {
  if (radius <= 0) return []
  const dist = (s: Segment) => {
    const ex = s.x2 - s.x1
    const ey = s.y2 - s.y1
    const l = ex * ex + ey * ey
    const t = l > 0 ? Math.min(1, Math.max(0, ((origin.x - s.x1) * ex + (origin.y - s.y1) * ey) / l)) : 0
    return Math.hypot(origin.x - (s.x1 + ex * t), origin.y - (s.y1 + ey * t))
  }
  const nearby = segments.filter((s) => dist(s) <= radius)
  const angles: number[] = []
  for (let i = 0; i < 64; i += 1) angles.push((i / 64) * Math.PI * 2 - Math.PI)
  for (const s of nearby) {
    for (const [px, py] of [[s.x1, s.y1], [s.x2, s.y2]]) {
      const a = Math.atan2(py - origin.y, px - origin.x)
      angles.push(a - 1e-4, a, a + 1e-4)
    }
  }
  angles.sort((a, b) => a - b)
  return angles.map((angle) => {
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    let nearest = radius
    for (const s of nearby) {
      const ex = s.x2 - s.x1
      const ey = s.y2 - s.y1
      const denom = dx * ey - dy * ex
      if (Math.abs(denom) < 1e-12) continue
      const wx = s.x1 - origin.x
      const wy = s.y1 - origin.y
      const t = (wx * ey - wy * ex) / denom
      if (t < 1e-6 || t >= nearest) continue
      const u = (wx * dy - wy * dx) / denom
      if (u >= 0 && u <= 1) nearest = t
    }
    return { x: origin.x + dx * nearest, y: origin.y + dy * nearest }
  })
}

/** PRNG determinístico (mulberry32) para cenários reproduzíveis. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('computeVisibility: equivalência com a varredura ingênua', () => {
  function expectSamePolygon(origin: { x: number; y: number }, segments: Segment[], radius: number) {
    const expected = referenceVisibility(origin, segments, radius)
    const actual = computeVisibility(origin, segments, radius)
    expect(actual.length).toBe(expected.length)
    let worst = 0
    for (let i = 0; i < expected.length; i += 1) {
      worst = Math.max(worst, Math.abs(actual[i].x - expected[i].x), Math.abs(actual[i].y - expected[i].y))
    }
    expect(worst).toBeLessThanOrEqual(1e-6)
  }

  it('segmentos aleatórios, origens aleatórias (seed fixa)', () => {
    const rand = mulberry32(20260914)
    for (let scenario = 0; scenario < 60; scenario += 1) {
      const segments: Segment[] = []
      const count = 1 + Math.floor(rand() * 300)
      for (let i = 0; i < count; i += 1) {
        const x = rand() * 2000 - 1000
        const y = rand() * 2000 - 1000
        const len = rand() < 0.1 ? rand() * 1500 : rand() * 80
        const ang = rand() * Math.PI * 2
        segments.push({ x1: x, y1: y, x2: x + Math.cos(ang) * len, y2: y + Math.sin(ang) * len })
      }
      const origin = { x: rand() * 1600 - 800, y: rand() * 1600 - 800 }
      expectSamePolygon(origin, segments, 50 + rand() * 900)
    }
  })

  it('casos degenerados: origem em extremidade, sobre segmento, colinear, costura em ±π e grade', () => {
    const rand = mulberry32(7)
    const segments: Segment[] = [
      { x1: 0, y1: 0, x2: 100, y2: 0 }, // origem na extremidade
      { x1: -50, y1: 0, x2: 50, y2: 0 }, // origem sobre o segmento
      { x1: 20, y1: 0, x2: 80, y2: 0 }, // colinear com a origem
      { x1: -100, y1: -30, x2: -100, y2: 30 }, // atravessa a costura ±π
      { x1: -100, y1: 0, x2: -60, y2: 0 }, // colinear na costura ±π
      { x1: 30, y1: 30, x2: 30, y2: 30 }, // comprimento zero
      { x1: -5000, y1: 1e-4, x2: 5000, y2: 1e-4 }, // longo e colado na origem
      { x1: -5000, y1: 0.01, x2: 5000, y2: 0.01 }, // longo, arco quase π
    ]
    // Grade com extremidades compartilhadas, como contorno de chão.
    for (let i = -5; i <= 5; i += 1) {
      segments.push({ x1: i * 40, y1: -200, x2: i * 40, y2: 200 })
      segments.push({ x1: -200, y1: i * 40, x2: 200, y2: i * 40 })
    }
    const origins = [{ x: 0, y: 0 }, { x: 40, y: 40 }, { x: -100, y: 0 }, { x: 30, y: 30 }, { x: 0, y: 1e-4 }]
    for (let i = 0; i < 20; i += 1) origins.push({ x: Math.round(rand() * 10) * 40 - 200, y: Math.round(rand() * 10) * 40 - 200 })
    for (const origin of origins) {
      for (const radius of [1, 45, 300, 800]) expectSamePolygon(origin, segments, radius)
    }
  })
})

describe('visionSegments', () => {
  it('inclui parede blocksLight, ignora porta aberta e parede que não bloqueia luz', () => {
    const map = {
      ...createEmptyMap('m', 'M', 500, 500, 40),
      walls: [
        wall('a', 0, 0, 10, 0),
        wall('b', 0, 0, 0, 10, { door: { open: true, locked: false, kind: 'normal' } }),
        wall('c', 5, 5, 6, 6, { door: { open: false, locked: false, kind: 'normal' } }),
        wall('d', 1, 1, 2, 2, { blocksLight: false }),
      ],
    }
    expect(visionSegments(map)).toEqual([
      { x1: 0, y1: 0, x2: 10, y2: 0 },
      { x1: 5, y1: 5, x2: 6, y2: 6 },
    ])
  })

  it('contorno do chão vira segmentos fechados e é cacheado pela referência de map.floor', () => {
    const floor: FloorPiece[] = [{ id: 'f', shape: { kind: 'rect', cx: 100, cy: 100, w: 100, h: 100 }, op: 'add', modifiers: {} }]
    const map = { ...createEmptyMap('m', 'M', 500, 500, 40), floor }
    const first = visionSegments(map)
    expect(first.length).toBeGreaterThanOrEqual(4)
    for (const s of first) {
      for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) {
        expect(x).toBeGreaterThan(45)
        expect(x).toBeLessThan(155)
        expect(y).toBeGreaterThan(45)
        expect(y).toBeLessThan(155)
      }
    }
    const second = visionSegments({ ...map, walls: [] })
    expect(second).toEqual(first)
    // Chão bloqueia visão: de dentro não se vê fora.
    const poly = computeVisibility({ x: 100, y: 100 }, first, 300)
    expect(pointInRing({ x: 120, y: 100 }, poly)).toBe(true)
    expect(pointInRing({ x: 250, y: 100 }, poly)).toBe(false)
  })
})
