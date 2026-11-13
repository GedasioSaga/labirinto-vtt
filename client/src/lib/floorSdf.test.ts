import { describe, expect, it } from 'vitest'
import type { FloorPiece } from '../types/map'
import { compileFloor, pieceBounds, pieceDistance, pontosDoCorredor, shapeCenter, valueNoise } from './floorSdf'

function rect(id: string, cx: number, cy: number, w: number, h: number, extra: Partial<FloorPiece> = {}): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w, h }, op: 'add', modifiers: {}, ...extra }
}

describe('pieceDistance', () => {
  it('retângulo: negativo no centro, zero na borda, distância exata fora', () => {
    const piece = rect('r', 0, 0, 100, 40)
    expect(pieceDistance(piece, 0, 0)).toBeCloseTo(-20)
    expect(pieceDistance(piece, 50, 0)).toBeCloseTo(0)
    expect(pieceDistance(piece, 60, 0)).toBeCloseTo(10)
    expect(pieceDistance(piece, 53, 24)).toBeCloseTo(5)
  })

  it('rotação de 90° troca largura e altura', () => {
    const piece = rect('r', 0, 0, 100, 40, { rotation: 90 })
    expect(pieceDistance(piece, 0, 45)).toBeLessThan(0)
    expect(pieceDistance(piece, 45, 0)).toBeGreaterThan(0)
  })

  it('arredondamento de retângulo não muda o tamanho externo no meio do lado, só o canto', () => {
    const sharp = rect('r', 0, 0, 100, 100)
    const round = rect('r', 0, 0, 100, 100, { modifiers: { rounding: 20 } })
    expect(pieceDistance(round, 50, 0)).toBeCloseTo(pieceDistance(sharp, 50, 0))
    expect(pieceDistance(round, 49, 49)).toBeGreaterThan(0)
    expect(pieceDistance(sharp, 49, 49)).toBeLessThan(0)
  })

  it('elipse: dentro/fora corretos nos eixos', () => {
    const piece: FloorPiece = { id: 'e', shape: { kind: 'ellipse', cx: 10, cy: 10, rx: 50, ry: 20 }, op: 'add', modifiers: {} }
    expect(pieceDistance(piece, 10, 10)).toBeLessThan(0)
    expect(pieceDistance(piece, 59, 10)).toBeLessThan(0)
    expect(pieceDistance(piece, 61, 10)).toBeGreaterThan(0)
    expect(pieceDistance(piece, 10, 31)).toBeGreaterThan(0)
  })

  it('polígono regular: hexágono contém o centro e não contém ponto além do raio', () => {
    const piece: FloorPiece = { id: 'p', shape: { kind: 'polygon', cx: 0, cy: 0, radius: 30, sides: 6 }, op: 'add', modifiers: {} }
    expect(pieceDistance(piece, 0, 0)).toBeLessThan(0)
    expect(pieceDistance(piece, 0, -31)).toBeGreaterThan(0)
  })

  it('corredor: largura interpolada ao longo do segmento', () => {
    const piece: FloorPiece = {
      id: 'c',
      shape: { kind: 'corridor', points: [{ x: 0, y: 0, width: 10 }, { x: 100, y: 0, width: 30 }] },
      op: 'add',
      modifiers: {},
    }
    expect(pieceDistance(piece, 0, 4)).toBeLessThan(0)
    expect(pieceDistance(piece, 0, 6)).toBeGreaterThan(0)
    expect(pieceDistance(piece, 100, 14)).toBeLessThan(0)
    expect(pieceDistance(piece, 50, 9)).toBeLessThan(0)
    expect(pieceDistance(piece, 50, 11)).toBeGreaterThan(0)
  })

  it('engordar desloca a borda para fora e o retângulo envolvente cresce junto; emagrecer desloca para dentro', () => {
    const fat = rect('r', 0, 0, 100, 40, { modifiers: { grow: 3 } })
    expect(pieceDistance(fat, 52, 0)).toBeLessThan(0)
    expect(pieceBounds(fat).maxX).toBeCloseTo(53)
    const thin = rect('r', 0, 0, 100, 40, { modifiers: { grow: -3 } })
    expect(pieceDistance(thin, 48, 0)).toBeGreaterThan(0)
    expect(pieceBounds(thin).maxX).toBeCloseTo(50)
  })

  it('ruído é determinístico pela semente e limitado a [-1, 1]', () => {
    for (let i = 0; i < 200; i += 1) {
      const n = valueNoise(i * 0.37, i * 0.91, 42)
      expect(n).toBe(valueNoise(i * 0.37, i * 0.91, 42))
      expect(Math.abs(n)).toBeLessThanOrEqual(1)
    }
    expect(valueNoise(3.3, 4.4, 1)).not.toBe(valueNoise(3.3, 4.4, 2))
  })
})

describe('compileFloor', () => {
  it('subtrair abre buraco: ponto dentro do buraco fica fora do chão', () => {
    const floor = compileFloor([rect('a', 0, 0, 200, 200), { ...rect('b', 0, 0, 50, 50), op: 'subtract' }])
    expect(floor.sample(0, 0)).toBeGreaterThan(0)
    expect(floor.sample(60, 0)).toBeLessThan(0)
    expect(floor.bounds).toEqual({ minX: -100, minY: -100, maxX: 100, maxY: 100 })
  })

  it('ordem importa: soma depois da subtração tampa o buraco', () => {
    const floor = compileFloor([rect('a', 0, 0, 200, 200), { ...rect('b', 0, 0, 50, 50), op: 'subtract' }, rect('c', 0, 0, 10, 10)])
    expect(floor.sample(0, 0)).toBeLessThan(0)
  })

  it('peça oculta não conta; mapa sem peça "add" não tem bounds', () => {
    expect(compileFloor([rect('a', 0, 0, 10, 10, { hidden: true })]).bounds).toBeNull()
    expect(compileFloor([]).sample(0, 0)).toBe(Infinity)
  })

  it('descarte por retângulo nunca troca o sinal em relação à combinação sem descarte', () => {
    const pieces: FloorPiece[] = [
      rect('a', 0, 0, 300, 120, { rotation: 17, modifiers: { noise: { amplitude: 6, scale: 20, seed: 3 } } }),
      { id: 'e', shape: { kind: 'ellipse', cx: 150, cy: 40, rx: 60, ry: 30 }, op: 'add', modifiers: { rounding: 4 } },
      { ...rect('h', 20, 0, 40, 40, { rotation: 45 }), op: 'subtract' },
      { id: 'c', shape: { kind: 'corridor', points: [{ x: -150, y: 0, width: 12 }, { x: -260, y: 90, width: 30 }] }, op: 'add', modifiers: {} },
    ]
    const floor = compileFloor(pieces)
    const brute = (x: number, y: number) =>
      pieces.reduce((d, p) => (p.op === 'add' ? Math.min(d, pieceDistance(p, x, y)) : Math.max(d, -pieceDistance(p, x, y))), Infinity)
    for (let y = -150; y <= 150; y += 7) {
      for (let x = -300; x <= 250; x += 7) {
        expect(Math.sign(floor.sample(x, y))).toBe(Math.sign(brute(x, y)))
      }
    }
  })

  it('pieceBounds de retângulo girado 45° cresce para envolver a forma', () => {
    const b = pieceBounds(rect('r', 0, 0, 100, 100, { rotation: 45 }))
    expect(b.maxX).toBeCloseTo(Math.SQRT2 * 50)
  })
})

type PontoDoCorredor = { x: number; y: number; width: number }

/** O corredor medido trecho a trecho contra TODOS, a conta de antes da árvore (0.5.61), copiada como referência. */
function corredorTrechoATrecho(px: number, py: number, points: readonly PontoDoCorredor[]): number {
  if (points.length === 0) return Infinity
  if (points.length === 1) return Math.hypot(px - points[0].x, py - points[0].y) - points[0].width / 2
  let best = Infinity
  for (let i = 0; i + 1 < points.length; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const ex = b.x - a.x
    const ey = b.y - a.y
    const lengthSq = ex * ex + ey * ey
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * ex + (py - a.y) * ey) / lengthSq))
    const radius = (a.width + (b.width - a.width) * t) / 2
    best = Math.min(best, Math.hypot(px - a.x - ex * t, py - a.y - ey * t) - radius)
  }
  return best
}

/** `pieceDistance` de um corredor com a volta inteira de antes (centro, giro, arredondamento, ruído e engorda iguais). */
function pecaTrechoATrecho(piece: FloorPiece, x: number, y: number): number {
  const shape = piece.shape
  if (shape.kind !== 'corridor') throw new Error('só corredor')
  const center = shapeCenter(shape)
  let px = x - center.x
  let py = y - center.y
  const rotation = piece.rotation ?? 0
  if (rotation !== 0) {
    const rad = (-rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const rx = px * cos - py * sin
    py = px * sin + py * cos
    px = rx
  }
  let d = corredorTrechoATrecho(px + center.x, py + center.y, pontosDoCorredor(shape)) - Math.max(0, piece.modifiers.rounding ?? 0)
  const noise = piece.modifiers.noise
  if (noise && noise.amplitude > 0 && noise.scale > 0) d += valueNoise(x / noise.scale, y / noise.scale, noise.seed) * noise.amplitude
  return d - (piece.modifiers.grow ?? 0)
}

describe('corredor longo pela árvore de trechos (FX-CAMINHO-062: 11 s para pôr um caminho de ~90 casas no Goa)', () => {
  it('a distância é a MESMA da volta inteira, número por número, perto, dentro e longe, em árvores de vários tamanhos', { timeout: 30_000 }, () => {
    const G = 64
    const onda: PontoDoCorredor[] = []
    for (let i = 0; i <= 40; i += 1) onda.push({ x: (5 + i * 2.25) * G, y: (50 + 18 * Math.sin(i / 4)) * G, width: 2 * G })
    const pecas: FloorPiece[] = [
      // O caminho do Goa: curva suave de ~600 trechos.
      { id: 'goa', shape: { kind: 'corridor', points: onda, suave: true }, op: 'add', modifiers: {} },
      // Girado, arredondado, com ruído e engorda, sobre a mesma curva.
      { id: 'mexido', shape: { kind: 'corridor', points: onda.slice(0, 20), suave: true }, op: 'add', rotation: 33, modifiers: { rounding: 5, noise: { amplitude: 6, scale: 40, seed: 3 }, grow: 2 } },
    ]
    // Retas de largura variável, com pontos repetidos (trecho de comprimento zero), em árvores de 17 a 160 trechos.
    for (const n of [17, 20, 40, 80, 160]) {
      const pts: PontoDoCorredor[] = []
      for (let i = 0; i <= n; i += 1) {
        const p = { x: 300 + i * 37 + (i % 3) * 11, y: 900 + Math.cos(i / 2) * 140, width: 40 + (i % 5) * 18 }
        pts.push(p)
        if (i % 7 === 3) pts.push({ ...p })
      }
      pecas.push({ id: `retas-${n}`, shape: { kind: 'corridor', points: pts }, op: 'add', modifiers: {} })
    }
    let semente = 12345
    const sorteio = () => {
      semente = (Math.imul(semente, 1103515245) + 12345) >>> 0
      return semente / 4294967296
    }
    let conferidos = 0
    let diferentes = 0
    for (const peca of pecas) {
      const b = pieceBounds(peca)
      const folga = 400
      const pontos: Array<[number, number]> = []
      // Uma varredura em linha (como o contorno pergunta), pontos soltos e os próprios pontos do traço.
      for (let y = b.minY - folga; y <= b.maxY + folga; y += 161.3) for (let x = b.minX - folga; x <= b.maxX + folga; x += 3) pontos.push([x, y])
      for (let k = 0; k < 4000; k += 1) pontos.push([b.minX - folga + sorteio() * (b.maxX - b.minX + 2 * folga), b.minY - folga + sorteio() * (b.maxY - b.minY + 2 * folga)])
      if (peca.shape.kind === 'corridor') for (const p of pontosDoCorredor(peca.shape)) pontos.push([p.x, p.y])
      for (const [x, y] of pontos) {
        conferidos += 1
        if (!Object.is(pieceDistance(peca, x, y), pecaTrechoATrecho(peca, x, y))) diferentes += 1
      }
    }
    expect(conferidos).toBeGreaterThan(50_000)
    expect(diferentes).toBe(0)
  })
})
