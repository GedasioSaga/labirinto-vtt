import { describe, expect, it } from 'vitest'
import type { RegionPoint } from '../types/map'
import {
  createExploration,
  decodeExploration,
  encodeExploration,
  type Exploration,
  forEachExploredNotch,
  forEachExploredRun,
  MAX_MEMORY_VERTICES,
  markRings,
} from './exploration'

// Bug: longe do jogador a borda da memória saía em escadinha. Passado o teto
// de vértices (MAX_MEMORY_VERTICES), `rememberRing` para de guardar contornos
// e a memória nova só existe no bitset, que o PlayerView desenhava como um
// retângulo por trecho de linha. A borda precisa sair lisa só com o bitset.

const MAP = { width: 640, height: 640, grid: 64 } // em px; célula de 16 px

/** Memória que já estourou o teto: o anel não é guardado, só o bitset. */
function memoryWithoutRings(ring: RegionPoint[]): Exploration {
  const exp = createExploration(MAP)
  exp.ringVertices = MAX_MEMORY_VERTICES
  markRings(exp, [ring])
  expect(exp.rings).toHaveLength(0)
  return exp
}

function insideTriangle(p: RegionPoint, t: number[]): boolean {
  const [ax, ay, bx, by, cx, cy] = t
  const d1 = (p.x - bx) * (ay - by) - (ax - bx) * (p.y - by)
  const d2 = (p.x - cx) * (by - cy) - (bx - cx) * (p.y - cy)
  const d3 = (p.x - ax) * (cy - ay) - (cx - ax) * (p.y - ay)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return !(neg && pos)
}

/** O que a máscara de memória cobre: os retângulos do bitset mais os dentes. */
function coverage(exp: Exploration): { covers: (p: RegionPoint) => boolean; notches: number } {
  const triangles: number[][] = []
  forEachExploredNotch(exp, (ax, ay, bx, by, cx, cy) => triangles.push([ax, ay, bx, by, cx, cy]))
  const covers = (p: RegionPoint): boolean => {
    const col = Math.floor(p.x / exp.cell)
    const row = Math.floor(p.y / exp.cell)
    let inRun = false
    forEachExploredRun(exp, (r, c0, c1) => {
      if (r === row && col >= c0 && col < c1) inRun = true
    })
    return inRun || triangles.some((t) => insideTriangle(p, t))
  }
  return { covers, notches: triangles.length }
}

/** Pontos ao longo da borda diagonal a -> b, deslocados `offset` para dentro. */
function alongEdge(a: RegionPoint, b: RegionPoint, inward: RegionPoint, offset: number): RegionPoint[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  let nx = -dy / len
  let ny = dx / len
  if (nx * (inward.x - a.x) + ny * (inward.y - a.y) < 0) {
    nx = -nx
    ny = -ny
  }
  const out: RegionPoint[] = []
  for (let k = 0; k <= 200; k += 1) {
    const t = 0.15 + (0.7 * k) / 200
    out.push({ x: a.x + dx * t + nx * offset, y: a.y + dy * t + ny * offset })
  }
  return out
}

const CASES: { name: string; ring: RegionPoint[]; a: RegionPoint; b: RegionPoint }[] = [
  { name: '45 graus', ring: [{ x: 0, y: 0 }, { x: 632, y: 0 }, { x: 0, y: 632 }], a: { x: 632, y: 0 }, b: { x: 0, y: 632 } },
  {
    name: 'rasa (1:3)',
    ring: [{ x: 0, y: 0 }, { x: 640, y: 0 }, { x: 640, y: 5 }, { x: 0, y: 213 }],
    a: { x: 640, y: 5 },
    b: { x: 0, y: 213 },
  },
  {
    name: 'íngreme (3:1)',
    ring: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 213, y: 640 }, { x: 0, y: 640 }],
    a: { x: 5, y: 0 },
    b: { x: 213, y: 640 },
  },
]

describe('borda da memória sem contorno guardado (bitset puro)', () => {
  for (const c of CASES) {
    it(`diagonal ${c.name}: cobre até 0,8 célula da borda vista, sem escadinha`, () => {
      const exp = memoryWithoutRings(c.ring)
      const { covers } = coverage(exp)
      const buracos = alongEdge(c.a, c.b, { x: 0, y: 0 }, 0.8 * exp.cell).filter((p) => !covers(p))
      expect(buracos).toEqual([])
    })

    it(`diagonal ${c.name}: nunca passa da borda que o jogador viu`, () => {
      const exp = memoryWithoutRings(c.ring)
      const { covers } = coverage(exp)
      const vazou = alongEdge(c.a, c.b, { x: 0, y: 0 }, -0.05 * exp.cell).filter((p) => covers(p))
      expect(vazou).toEqual([])
    })
  }

  it('sala retangular não ganha dente: o canto de verdade continua em ângulo reto', () => {
    const exp = memoryWithoutRings([{ x: 96, y: 96 }, { x: 480, y: 96 }, { x: 480, y: 400 }, { x: 96, y: 400 }])
    expect(coverage(exp).notches).toBe(0)
  })

  it('memória vinda de gravação antiga (sem contornos no fio) também sai lisa', () => {
    const exp = memoryWithoutRings(CASES[0].ring)
    const wire = encodeExploration(exp)
    delete (wire as { rings?: unknown }).rings
    const lida = decodeExploration(wire)
    expect(lida).not.toBeNull()
    if (!lida) return
    expect(lida.rings).toHaveLength(0)
    const { covers } = coverage(lida)
    const buracos = alongEdge(CASES[0].a, CASES[0].b, { x: 0, y: 0 }, 0.8 * lida.cell).filter((p) => !covers(p))
    expect(buracos).toEqual([])
  })
})
