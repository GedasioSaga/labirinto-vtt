import { describe, expect, it } from 'vitest'
import {
  computeVisibleTriEdges,
  computeVisibleTriVertices,
  findTriCell,
  snapToTriCenter,
  snapToTriVertex,
  triCellCentroid,
  triCellVertices,
} from './triGrid'

describe('snapToTriVertex', () => {
  it('size inválido retorna o ponto sem alterar', () => {
    expect(snapToTriVertex(33, 47, 0)).toEqual({ x: 33, y: 47 })
  })

  it('ponto exatamente num vértice não muda', () => {
    const vertex = snapToTriVertex(0, 0, 64)
    const snapped = snapToTriVertex(vertex.x, vertex.y, 64)
    expect(snapped.x).toBeCloseTo(vertex.x, 5)
    expect(snapped.y).toBeCloseTo(vertex.y, 5)
  })

  it('ponto perto de um vértice gruda nele, não no vizinho', () => {
    const vertex = snapToTriVertex(500, -300, 64)
    const nudged = snapToTriVertex(vertex.x + 2, vertex.y - 1, 64)
    expect(nudged.x).toBeCloseTo(vertex.x, 5)
    expect(nudged.y).toBeCloseTo(vertex.y, 5)
  })
})

describe('triCellVertices', () => {
  it('triângulo "up" tem 3 lados de comprimento `size`', () => {
    const [a, b, c] = triCellVertices({ q: 2, r: -1, orientation: 'up' }, 64)
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(64, 5)
    expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeCloseTo(64, 5)
    expect(Math.hypot(a.x - c.x, a.y - c.y)).toBeCloseTo(64, 5)
  })

  it('triângulo "down" também tem 3 lados de comprimento `size`', () => {
    const [a, b, c] = triCellVertices({ q: 2, r: -1, orientation: 'down' }, 64)
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(64, 5)
    expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeCloseTo(64, 5)
    expect(Math.hypot(a.x - c.x, a.y - c.y)).toBeCloseTo(64, 5)
  })

  it('"up" e "down" da mesma célula (q, r) compartilham a aresta oposta ao vértice de origem', () => {
    const up = triCellVertices({ q: 0, r: 0, orientation: 'up' }, 64)
    const down = triCellVertices({ q: 0, r: 0, orientation: 'down' }, 64)
    // up = [(0,0), (1,0), (0,1)] e down = [(1,0), (0,1), (1,1)] em axial —
    // o lado compartilhado é (1,0)-(0,1): up[1]/up[2] e down[0]/down[1].
    expect(up[1]).toEqual(down[0])
    expect(up[2]).toEqual(down[1])
  })
})

describe('triCellCentroid', () => {
  it('é a média dos 3 vértices', () => {
    const cell = { q: 1, r: 1, orientation: 'up' as const }
    const [a, b, c] = triCellVertices(cell, 64)
    const centroid = triCellCentroid(cell, 64)
    expect(centroid.x).toBeCloseTo((a.x + b.x + c.x) / 3, 5)
    expect(centroid.y).toBeCloseTo((a.y + b.y + c.y) / 3, 5)
  })
})

describe('findTriCell', () => {
  it('size inválido retorna célula (0,0) "up" sem lançar', () => {
    expect(findTriCell(33, 47, 0)).toEqual({ q: 0, r: 0, orientation: 'up' })
  })

  it('ponto no vértice de origem (q0, r0) cai na célula "up" desse (q0, r0)', () => {
    const [origin] = triCellVertices({ q: 3, r: -2, orientation: 'up' }, 64)
    // levemente deslocado pra dentro do triângulo 'up', não em cima da aresta
    const cell = findTriCell(origin.x + 0.01, origin.y + 0.01, 64)
    expect(cell).toEqual({ q: 3, r: -2, orientation: 'up' })
  })

  it('ponto perto do vértice oposto (q0+1, r0+1) cai na célula "down"', () => {
    const [, , farCorner] = triCellVertices({ q: 0, r: 0, orientation: 'down' }, 64)
    const cell = findTriCell(farCorner.x - 0.01, farCorner.y - 0.01, 64)
    expect(cell).toEqual({ q: 0, r: 0, orientation: 'down' })
  })

  it('centroide de uma célula "up" é reconhecido como pertencendo a ela', () => {
    const cell = { q: -1, r: 2, orientation: 'up' as const }
    const centroid = triCellCentroid(cell, 64)
    expect(findTriCell(centroid.x, centroid.y, 64)).toEqual(cell)
  })

  it('centroide de uma célula "down" é reconhecido como pertencendo a ela', () => {
    const cell = { q: -1, r: 2, orientation: 'down' as const }
    const centroid = triCellCentroid(cell, 64)
    expect(findTriCell(centroid.x, centroid.y, 64)).toEqual(cell)
  })
})

describe('snapToTriCenter', () => {
  it('size inválido retorna o ponto sem alterar', () => {
    expect(snapToTriCenter(33, 47, 0)).toEqual({ x: 33, y: 47 })
  })

  it('ponto exatamente no centroide de um triângulo não muda', () => {
    const cell = { q: 4, r: -3, orientation: 'down' as const }
    const centroid = triCellCentroid(cell, 64)
    const snapped = snapToTriCenter(centroid.x, centroid.y, 64)
    expect(snapped.x).toBeCloseTo(centroid.x, 5)
    expect(snapped.y).toBeCloseTo(centroid.y, 5)
  })
})

describe('computeVisibleTriVertices', () => {
  it('size inválido retorna vazio', () => {
    expect(computeVisibleTriVertices(0, { left: 0, top: 0, right: 100, bottom: 100 })).toEqual([])
  })

  it('viewport razoável retorna vértices cobrindo a área (não vazio, não gigantesco)', () => {
    const vertices = computeVisibleTriVertices(64, { left: 0, top: 0, right: 640, bottom: 480 })
    expect(vertices.length).toBeGreaterThan(10)
    expect(vertices.length).toBeLessThan(500)
  })
})

describe('computeVisibleTriEdges', () => {
  it('size inválido retorna vazio', () => {
    expect(computeVisibleTriEdges(0, { left: 0, top: 0, right: 100, bottom: 100 })).toEqual([])
  })

  it('toda aresta tem comprimento `size` (malha regular)', () => {
    const edges = computeVisibleTriEdges(64, { left: 0, top: 0, right: 320, bottom: 240 })
    expect(edges.length).toBeGreaterThan(0)
    for (const edge of edges) {
      expect(Math.hypot(edge.b.x - edge.a.x, edge.b.y - edge.a.y)).toBeCloseTo(64, 5)
    }
  })

  it('viewport razoável retorna quantidade de arestas coerente (não vazio, não gigantesco)', () => {
    const edges = computeVisibleTriEdges(64, { left: 0, top: 0, right: 640, bottom: 480 })
    expect(edges.length).toBeGreaterThan(30)
    expect(edges.length).toBeLessThan(1500)
  })
})
