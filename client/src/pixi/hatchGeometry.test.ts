import { describe, expect, it } from 'vitest'
import { buildHatchGeometry, clusterAngle, hashCell, type HatchCluster, type HatchGeometry } from './hatchGeometry'
import { HATCH_BAND_CELLS, HATCH_CLUSTER_SPACING_CELLS, HATCH_REACH_NOISE_CELLS } from './dungeonStyle'
import type { FloorPolygon } from '../lib/floorContour'
import type { Region, RegionPoint, Wall } from '../types/map'

const G = 64

function rectRoom(id: string, x0: number, y0: number, x1: number, y1: number): { region: Region; walls: Wall[] } {
  const points = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
  return polyRoom(id, points)
}

function polyRoom(id: string, points: RegionPoint[]): { region: Region; walls: Wall[] } {
  const region: Region = { id, points, tag: '', fillColor: '#e9e1cf', fillPattern: 'solid', data: {} }
  const walls: Wall[] = points.map((p, e) => {
    const q = points[(e + 1) % points.length]
    return { id: `${id}-w${e}`, x1: p.x, y1: p.y, x2: q.x, y2: q.y, blocksLight: true, blocksMove: true, door: null, regionId: id, regionEdgeIndex: e }
  })
  return { region, walls }
}

function geometryOf(rooms: { region: Region; walls: Wall[] }[], floorPolygons: FloorPolygon[] = [], extraWalls: Wall[] = []): HatchGeometry {
  return buildHatchGeometry({ walls: [...rooms.flatMap((r) => r.walls), ...extraWalls], regions: rooms.map((r) => r.region), floorPolygons, grid: G })
}

function insidePolygon(points: RegionPoint[], x: number, y: number): boolean {
  let inside = false
  for (let a = 0, b = points.length - 1; a < points.length; b = a++) {
    const pa = points[a]
    const pb = points[b]
    if (pa.y > y !== pb.y > y && x < ((pb.x - pa.x) * (y - pa.y)) / (pb.y - pa.y) + pa.x) inside = !inside
  }
  return inside
}

function segmentDistance(x: number, y: number, w: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>): number {
  const vx = w.x2 - w.x1
  const vy = w.y2 - w.y1
  const len2 = vx * vx + vy * vy
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - w.x1) * vx + (y - w.y1) * vy) / len2)) : 0
  return Math.hypot(x - (w.x1 + t * vx), y - (w.y1 + t * vy))
}

/** Parâmetros completos do cacho (posição, ângulo e traços), para comparar entre mapas. */
function clusterSignature(geometry: HatchGeometry, cluster: HatchCluster): string {
  const strokes = geometry.strokes.slice(cluster.strokeStart * 4, (cluster.strokeStart + cluster.strokeCount) * 4)
  return JSON.stringify([cluster.x, cluster.y, cluster.angle, strokes])
}

function byCell(geometry: HatchGeometry): Map<string, string> {
  const map = new Map<string, string>()
  for (const cluster of geometry.clusters) map.set(`${cluster.i},${cluster.j}`, clusterSignature(geometry, cluster))
  return map
}

const WALL_HALF = G * 0.125
const MAX_REACH = (HATCH_BAND_CELLS + HATCH_REACH_NOISE_CELLS) * G

describe('hatchGeometry — hachura vetorial por cachos num grid global', () => {
  it('hashCell é determinístico e fica em [0, 1)', () => {
    for (let i = -20; i < 20; i++) {
      const v = hashCell(i, i * 3 - 7, 5)
      expect(v).toBe(hashCell(i, i * 3 - 7, 5))
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('determinismo: a mesma entrada dá exatamente a mesma geometria', () => {
    const a = geometryOf([rectRoom('a', 0, 0, 256, 256)])
    const b = geometryOf([rectRoom('a', 0, 0, 256, 256)])
    expect(a.clusters.length).toBeGreaterThan(20)
    expect(b).toEqual(a)
  })

  it('cacho nunca dentro do piso (sala retangular, sala em L e chão por peças)', () => {
    const rect = rectRoom('r', 0, 0, 384, 320)
    const l = polyRoom('l', [
      { x: 640, y: 0 },
      { x: 1088, y: 0 },
      { x: 1088, y: 192 },
      { x: 832, y: 192 },
      { x: 832, y: 448 },
      { x: 640, y: 448 },
    ])
    const corridor: FloorPolygon = { outer: [{ x: 0, y: 640 }, { x: 640, y: 640 }, { x: 640, y: 704 }, { x: 0, y: 704 }], holes: [] }
    const geometry = geometryOf([rect, l], [corridor])
    expect(geometry.clusters.length).toBeGreaterThan(100)
    for (const c of geometry.clusters) {
      expect(insidePolygon(rect.region.points, c.x, c.y)).toBe(false)
      expect(insidePolygon(l.region.points, c.x, c.y)).toBe(false)
      expect(insidePolygon(corridor.outer, c.x, c.y)).toBe(false)
    }
  })

  it('todo cacho fica dentro do alcance máximo da faixa (0,5 + 0,15 célula além da face)', () => {
    const room = rectRoom('r', 0, 0, 384, 320)
    const geometry = geometryOf([room])
    for (const c of geometry.clusters) {
      const d = Math.min(...room.walls.map((w) => segmentDistance(c.x, c.y, w))) - WALL_HALF
      expect(d).toBeLessThanOrEqual(MAX_REACH + 1e-9)
    }
  })

  it('parede interna não gera hachura (nem traço, nem papel)', () => {
    const interior: Wall = { id: 'i', x1: 0, y1: 0, x2: 256, y2: 0, blocksLight: true, blocksMove: true, door: null, wallKind: 'interior' }
    const geometry = buildHatchGeometry({ walls: [interior], regions: [], floorPolygons: [], grid: G })
    expect(geometry.clusters).toHaveLength(0)
    expect(geometry.strokes).toHaveLength(0)
    expect(geometry.paperPolygons).toHaveLength(0)
    expect(geometry.paperRects).toHaveLength(0)
  })

  it('parede interna dentro de sala não muda a hachura da sala', () => {
    const room = rectRoom('r', 0, 0, 384, 320)
    const interior: Wall = { id: 'i', x1: 128, y1: 0, x2: 128, y2: 320, blocksLight: true, blocksMove: true, door: null, wallKind: 'interior' }
    expect(geometryOf([room], [], [interior])).toEqual(geometryOf([room]))
  })

  it('porta não abre a faixa: a parede com porta continua gerando cachos', () => {
    const room = rectRoom('r', 0, 0, 384, 320)
    const withDoor = { ...room, walls: room.walls.map((w, e) => (e === 1 ? { ...w, door: { open: false, locked: false, kind: 'normal' as const } } : w)) }
    expect(geometryOf([withDoor])).toEqual(geometryOf([room]))
  })

  it('vizinhas a 1 célula compartilham os cachos: mesma célula, mesmos traços, sem duplicata', () => {
    const a = rectRoom('a', 0, 0, 384, 320)
    const b = rectRoom('b', 448, 0, 832, 320)
    const onlyA = byCell(geometryOf([a]))
    const onlyB = byCell(geometryOf([b]))
    const both = geometryOf([a, b])
    const bothCells = byCell(both)
    expect(bothCells.size).toBe(both.clusters.length)
    let shared = 0
    for (const [key, signature] of onlyA) {
      if (onlyB.has(key)) {
        shared++
        expect(onlyB.get(key)).toBe(signature)
        expect(bothCells.get(key)).toBe(signature)
      }
    }
    expect(shared).toBeGreaterThan(10)
    for (const [key, signature] of bothCells) {
      const fromOne = onlyA.get(key) ?? onlyB.get(key)
      // Cacho novo só pode aparecer onde o filtro de ponta solta ganhou vizinho da outra sala.
      if (fromOne !== undefined) expect(signature).toBe(fromOne)
    }
  })

  it('salas encostadas: nenhum cacho no piso de nenhuma, e a junção não duplica célula', () => {
    const a = rectRoom('a', 0, 0, 384, 320)
    const b = rectRoom('b', 384, 0, 768, 320)
    const geometry = geometryOf([a, b])
    expect(byCell(geometry).size).toBe(geometry.clusters.length)
    for (const c of geometry.clusters) expect(c.x > 0 && c.x < 768 && c.y > 0 && c.y < 320).toBe(false)
  })

  it('sem buraco: todo ponto da faixa até 0,35 célula tem centro de cacho a menos de 1 espaçamento', () => {
    const room = rectRoom('r', 0, 0, 640, 320)
    const geometry = geometryOf([room])
    const spacing = HATCH_CLUSTER_SPACING_CELLS * G
    for (let x = 32; x <= 608; x += 6.4) {
      for (const t of [0.02, 0.15, 0.3]) {
        const y = -WALL_HALF - t * G
        const nearest = Math.min(...geometry.clusters.map((c) => Math.hypot(c.x - x, c.y - y)))
        expect(nearest).toBeLessThan(spacing)
      }
    }
  })

  it('borda externa irregular: a ponta de traço mais distante por coluna de 0,1 célula varia (desvio ≥ 0,08 célula)', () => {
    const room = rectRoom('r', 0, 0, 1280, 320)
    const geometry = geometryOf([room])
    const outer = new Map<number, number>()
    for (const c of geometry.clusters) {
      if (c.y >= 0 || c.x < 64 || c.x > 1216) continue
      for (let k = c.strokeStart * 4; k < (c.strokeStart + c.strokeCount) * 4; k += 2) {
        const column = Math.floor(geometry.strokes[k] / (0.1 * G))
        outer.set(column, Math.max(outer.get(column) ?? 0, (-geometry.strokes[k + 1] - WALL_HALF) / G))
      }
    }
    const values = [...outer.values()]
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
    expect(values.length).toBeGreaterThan(40)
    expect(std).toBeGreaterThanOrEqual(0.08)
  })

  it('ângulo: vizinho imediato (4 lados) nunca fica a menos de 20° do cacho', () => {
    const minGap = (20 * Math.PI) / 180 - 1e-9
    for (let i = -15; i < 15; i++) {
      for (let j = -15; j < 15; j++) {
        for (const [di, dj] of [[1, 0], [0, 1]]) {
          const diff = Math.abs(clusterAngle(i, j) - clusterAngle(i + di, j + dj)) % Math.PI
          expect(Math.min(diff, Math.PI - diff)).toBeGreaterThanOrEqual(minGap)
        }
      }
    }
  })

  it('só chão por peças (sem parede): hachura em volta do polígono, nada dentro', () => {
    const polygon: FloorPolygon = { outer: [{ x: 0, y: 0 }, { x: 384, y: 0 }, { x: 384, y: 256 }, { x: 0, y: 256 }], holes: [] }
    const geometry = buildHatchGeometry({ walls: [], regions: [], floorPolygons: [polygon], grid: G })
    expect(geometry.clusters.length).toBeGreaterThan(40)
    for (const c of geometry.clusters) expect(insidePolygon(polygon.outer, c.x, c.y)).toBe(false)
  })

  it('escala com a grade: grid 128 dá a mesma geometria de grid 64 multiplicada por 2', () => {
    const small = buildHatchGeometry({ ...rectRoom('r', 0, 0, 256, 256), regions: [rectRoom('r', 0, 0, 256, 256).region], floorPolygons: [], grid: 64 })
    const bigRoom = rectRoom('r', 0, 0, 512, 512)
    const big = buildHatchGeometry({ walls: bigRoom.walls, regions: [bigRoom.region], floorPolygons: [], grid: 128 })
    expect(big.clusters.map((c) => [c.i, c.j])).toEqual(small.clusters.map((c) => [c.i, c.j]))
    big.strokes.forEach((v, k) => expect(v).toBeCloseTo(small.strokes[k] * 2, 6))
  })
})
