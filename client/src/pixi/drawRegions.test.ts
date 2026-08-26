import { describe, expect, it } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { computeHatchSegments, createRegionsRenderer, scanlineIntersections } from './drawRegions'
import type { Region, RegionPoint } from '../types/map'

/** Conta instruções `action: 'fill'` realmente empilhadas no GraphicsContext da instância. */
function countFillInstructions(g: Graphics): number {
  return g.context.instructions.filter((instruction) => instruction.action === 'fill').length
}

/** Conta instruções `action: 'stroke'` realmente empilhadas no GraphicsContext da instância. */
function countStrokeInstructions(g: Graphics): number {
  return g.context.instructions.filter((instruction) => instruction.action === 'stroke').length
}

/** Ray-casting par-ímpar clássico, independente da implementação testada. */
function isPointInPolygon(point: { x: number; y: number }, polygon: RegionPoint[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

describe('scanlineIntersections', () => {
  it('polígono convexo simples: uma faixa contínua', () => {
    const square = [
      { u: 0, v: 0 },
      { u: 10, v: 0 },
      { u: 10, v: 10 },
      { u: 0, v: 10 },
    ]
    expect(scanlineIntersections(square, 5)).toEqual([0, 10])
  })

  it('polígono côncavo (U): scanline acima da base cruza as duas pernas separadamente', () => {
    const u = [
      { u: 0, v: 0 },
      { u: 10, v: 0 },
      { u: 10, v: 10 },
      { u: 7, v: 10 },
      { u: 7, v: 3 },
      { u: 3, v: 3 },
      { u: 3, v: 10 },
      { u: 0, v: 10 },
    ]
    // v=5 fica acima da base (v 0-3): só as pernas (u 0-3 e u 7-10) existem ali.
    const atLegs = scanlineIntersections(u, 5)
    expect(atLegs).toHaveLength(4)
    expect(atLegs[0]).toBeCloseTo(0)
    expect(atLegs[1]).toBeCloseTo(3)
    expect(atLegs[2]).toBeCloseTo(7)
    expect(atLegs[3]).toBeCloseTo(10)

    // v=1 fica dentro da base: uma faixa contínua de ponta a ponta.
    const atBase = scanlineIntersections(u, 1)
    expect(atBase).toHaveLength(2)
    expect(atBase[0]).toBeCloseTo(0)
    expect(atBase[1]).toBeCloseTo(10)
  })
})

describe('computeHatchSegments', () => {
  it('região retangular: todo segmento fica dentro do contorno', () => {
    const square: RegionPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    const segments = computeHatchSegments(square)
    expect(segments.length).toBeGreaterThan(0)
    for (const seg of segments) {
      const midpoint = { x: (seg.x1 + seg.x2) / 2, y: (seg.y1 + seg.y2) / 2 }
      expect(isPointInPolygon(midpoint, square)).toBe(true)
    }
  })

  it('região em L (côncava): nenhum segmento vaza para o entalhe removido', () => {
    // L-shape: quadrado 100x100 com o quadrante [40,100]x[40,100] recortado.
    const lShape: RegionPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 40 },
      { x: 40, y: 40 },
      { x: 40, y: 100 },
      { x: 0, y: 100 },
    ]
    const segments = computeHatchSegments(lShape)
    expect(segments.length).toBeGreaterThan(0)
    for (const seg of segments) {
      const midpoint = { x: (seg.x1 + seg.x2) / 2, y: (seg.y1 + seg.y2) / 2 }
      // Nunca vaza pro contorno: o ponto médio de cada segmento tem que estar dentro do L.
      expect(isPointInPolygon(midpoint, lShape)).toBe(true)
      // Explícito: nunca cai dentro do entalhe recortado.
      const inNotch = midpoint.x > 40 && midpoint.x < 100 && midpoint.y > 40 && midpoint.y < 100
      expect(inNotch).toBe(false)
    }
  })

  it('região menor que o espaçamento da hachura: nenhum segmento gerado', () => {
    const tiny: RegionPoint[] = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 0, y: 3 },
    ]
    expect(computeHatchSegments(tiny)).toEqual([])
  })
})

/** Grade de retângulos contíguos (sem gap), reproduzindo o layout real que disparava o bug. */
function buildContiguousGridRegions(cols: number, rows: number, size = 50): Region[] {
  const regions: Region[] = []
  let n = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * size
      const y = row * size
      regions.push({
        id: `region-${n++}`,
        points: [
          { x, y },
          { x: x + size, y },
          { x: x + size, y: y + size },
          { x, y: y + size },
        ],
        tag: '',
        fillColor: '#1e7a1e',
        fillPattern: 'solid',
        data: {},
      })
    }
  }
  return regions
}

describe('createRegionsRenderer', () => {
  it('regressão: 20 regiões contíguas resultam em 20 Graphics filhos, nenhuma pulada', () => {
    const regions = buildContiguousGridRegions(5, 4) // 20 regiões, mesmo padrão do bug real (14 OK / 17 quebra)
    const container = new Container()
    const renderer = createRegionsRenderer()

    renderer.draw(container, regions, null)

    expect(container.children.length).toBe(regions.length)

    // Correlaciona child→região pelo label (setado em drawRegions.ts) em vez de
    // assumir a ordem do array — prova que TODA região da lista de fato ganhou
    // um Graphics próprio, não só que a contagem bate.
    const drawnIds = new Set(container.children.map((child) => child.label))
    expect(drawnIds.size).toBe(regions.length)
    for (const region of regions) {
      expect(drawnIds.has(region.id)).toBe(true)
    }

    // O bug original: Graphics existia (contagem batia) mas nascia sem fill
    // visível porque o path acumulado corrompia fill/stroke/hachura na mesma
    // instância. Contagem de children não pega isso — inspecionar o conteúdo
    // real do GraphicsContext sim: cada região precisa ter exatamente 1
    // instrução `fill` de fato empilhada.
    for (const child of container.children) {
      expect(countFillInstructions(child as Graphics)).toBe(1)
    }
  })

  it('cada região tem seu próprio Graphics: nenhuma instância é compartilhada entre regiões', () => {
    const regions = buildContiguousGridRegions(5, 4)
    const container = new Container()
    const renderer = createRegionsRenderer()

    renderer.draw(container, regions, null)

    const uniqueChildren = new Set(container.children)
    expect(uniqueChildren.size).toBe(container.children.length)
  })

  it('reutiliza o Graphics existente em redraws e remove o de regiões que saíram do array', () => {
    const regions = buildContiguousGridRegions(5, 4)
    const container = new Container()
    const renderer = createRegionsRenderer()

    renderer.draw(container, regions, null)
    const firstChild = container.children[0]

    const withoutFirst = regions.slice(1)
    renderer.draw(container, withoutFirst, null)

    expect(container.children.length).toBe(withoutFirst.length)
    expect(container.children.includes(firstChild)).toBe(false)

    renderer.draw(container, withoutFirst, null)
    expect(container.children.length).toBe(withoutFirst.length)
  })

  it('mantém apenas 1 fill acumulado por Graphics mesmo com hachura (isolamento entre regiões)', () => {
    const regions = buildContiguousGridRegions(4, 5).map((r) => ({ ...r, fillPattern: 'hatch' as const }))
    const container = new Container()
    const renderer = createRegionsRenderer()

    renderer.draw(container, regions, null)

    expect(container.children.length).toBe(regions.length)

    // A causa raiz do bug era hachura + fill acumulando no mesmo path de uma
    // instância compartilhada. Com 1 Graphics por região isso não pode voltar a
    // acontecer — a prova real é inspecionar o GraphicsContext de cada instância:
    // exatamente 1 `fill` (o preenchimento base da região) e exatamente 2
    // `stroke` (contorno da região + traço da hachura), nunca mais que isso.
    for (const child of container.children) {
      const g = child as Graphics
      expect(countFillInstructions(g)).toBe(1)
      expect(countStrokeInstructions(g)).toBe(2)
    }
  })
})
