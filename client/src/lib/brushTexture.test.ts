import { describe, expect, it } from 'vitest'
import { computeMarkerStroke, computePencilSegments, readFreehandTexture, type BrushPoint } from './brushTexture'

function zigzag(count: number): BrushPoint[] {
  return Array.from({ length: count }, (_, i) => ({ x: i * 11, y: (i % 2) * 7 }))
}

describe('computePencilSegments', () => {
  it('produz exatamente points.length - 1 segmentos, cada um ligando o par consecutivo certo', () => {
    const points = zigzag(6)
    const segments = computePencilSegments(points, 4)
    expect(segments).toHaveLength(5)
    for (let i = 0; i < segments.length; i += 1) {
      expect(segments[i].from).toEqual(points[i])
      expect(segments[i].to).toEqual(points[i + 1])
    }
  })

  it('menos de 2 pontos: retorna [] (nada pra desenhar) — cobre traço vazio e traço de 1 ponto só', () => {
    expect(computePencilSegments([], 4)).toEqual([])
    expect(computePencilSegments([{ x: 0, y: 0 }], 4)).toEqual([])
  })

  it('determinístico: mesmo input produz exatamente o mesmo output em 2 chamadas separadas (regra dura: sem Math.random)', () => {
    const points = zigzag(12)
    const a = computePencilSegments(points, 5)
    const b = computePencilSegments(points, 5)
    expect(a).toEqual(b)
  })

  it('largura de cada segmento fica no intervalo [0.55, 1.0] * baseWidth — nunca mais grosso que o traço de caneta, nunca sumindo', () => {
    const points = zigzag(30)
    const baseWidth = 6
    for (const segment of computePencilSegments(points, baseWidth)) {
      expect(segment.width).toBeGreaterThanOrEqual(baseWidth * 0.55)
      expect(segment.width).toBeLessThanOrEqual(baseWidth * 1.0)
    }
  })

  it('alpha de cada segmento fica no intervalo [0.5, 0.85] — sempre visível, nunca opaco igual à caneta', () => {
    const points = zigzag(30)
    for (const segment of computePencilSegments(points, 6)) {
      expect(segment.alpha).toBeGreaterThanOrEqual(0.5)
      expect(segment.alpha).toBeLessThanOrEqual(0.85)
    }
  })

  it('gera variedade real de largura e alpha entre segmentos — não é um valor constante disfarçado de textura', () => {
    const points = zigzag(30)
    const segments = computePencilSegments(points, 6)
    const widths = new Set(segments.map((s) => s.width))
    const alphas = new Set(segments.map((s) => s.alpha))
    expect(widths.size).toBeGreaterThan(1)
    expect(alphas.size).toBeGreaterThan(1)
  })

  it('pontos duplicados consecutivos (mão parada durante o traço): segmento de comprimento zero não quebra, largura/alpha continuam no intervalo válido', () => {
    const points: BrushPoint[] = [{ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 20, y: 15 }]
    const segments = computePencilSegments(points, 4)
    expect(segments).toHaveLength(2)
    for (const segment of segments) {
      expect(Number.isFinite(segment.width)).toBe(true)
      expect(Number.isFinite(segment.alpha)).toBe(true)
    }
  })
})

describe('computeMarkerStroke', () => {
  it('mais grosso que a caneta e translúcido — os dois eixos que o usuário pediu (N1)', () => {
    const { width, alpha } = computeMarkerStroke(6)
    expect(width).toBeGreaterThan(6)
    expect(alpha).toBeLessThan(1)
    expect(alpha).toBeGreaterThan(0)
  })

  it('determinístico e proporcional à largura base — dobrar baseWidth dobra o width de saída', () => {
    const a = computeMarkerStroke(4)
    const b = computeMarkerStroke(8)
    expect(b.width).toBeCloseTo(a.width * 2)
    expect(a.alpha).toBe(computeMarkerStroke(4).alpha)
  })

  it('baseWidth 0: não produz largura negativa nem NaN (campo width theoretically ausente/zerado)', () => {
    const { width, alpha } = computeMarkerStroke(0)
    expect(width).toBe(0)
    expect(Number.isFinite(alpha)).toBe(true)
  })
})

describe('readFreehandTexture', () => {
  it('objeto sem campo texture (mapa legado, Drawing criado antes desta fase): cai em "pen" — undefined === "pen", regra dura do briefing', () => {
    expect(readFreehandTexture({ kind: 'freehand' })).toBe('pen')
  })

  it('texture "pencil"/"marker" explícitos: lidos corretamente', () => {
    expect(readFreehandTexture({ kind: 'freehand', texture: 'pencil' })).toBe('pencil')
    expect(readFreehandTexture({ kind: 'freehand', texture: 'marker' })).toBe('marker')
  })

  it('texture "pen" explícito: continua "pen"', () => {
    expect(readFreehandTexture({ kind: 'freehand', texture: 'pen' })).toBe('pen')
  })

  it('valor desconhecido/corrompido no campo texture: cai em "pen" em vez de propagar lixo (leitura validada, não cega)', () => {
    expect(readFreehandTexture({ kind: 'freehand', texture: 'giz-de-cera' })).toBe('pen')
  })
})
