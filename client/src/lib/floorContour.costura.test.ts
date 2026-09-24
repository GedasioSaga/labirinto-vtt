import { describe, expect, it } from 'vitest'
import type { FloorPiece } from '../types/map'
import { buildFloorOutline, pointInRing } from './floorContour'

/**
 * COSTURA ENTRE PEÇAS QUE SE TOCAM. O balde (`floorTool.baldeNoPonto`) enche
 * exatamente o vão que o chão em volta deixa, então a peça nova ENCOSTA na
 * vizinha. Na divisa a distância das duas é 0, e amostra 0 contava como fora:
 * saía uma linha de contorno no meio do chão — desenhada na tela e, pior,
 * virando parede da visão (`lib/visibility.ts`), inclusive na porta.
 */
function retangulo(id: string, x1: number, y1: number, x2: number, y2: number, op: FloorPiece['op'] = 'add'): FloorPiece {
  return { id, shape: { kind: 'rect', cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, w: x2 - x1, h: y2 - y1 }, op, modifiers: {} }
}

function blocos(id: string, c0: number, c1: number, r0: number, r1: number, op: FloorPiece['op'] = 'add'): FloorPiece {
  const cells: { col: number; row: number }[] = []
  for (let col = c0; col <= c1; col += 1) for (let row = r0; row <= r1; row += 1) cells.push({ col, row })
  return { id, shape: { kind: 'blocos', cell: 50, cells }, op, modifiers: {} }
}

/**
 * Algum lado de anel passa por dentro do retângulo aberto (x0..x1, y0..y1)?
 * Pela caixa do lado: exato para os lados retos em eixo que estas peças dão.
 */
function contornoDentro(floor: FloorPiece[], x0: number, x1: number, y0: number, y1: number): boolean {
  return buildFloorOutline(floor).some((poly) =>
    [poly.outer, ...poly.holes].some((ring) =>
      ring.some((a, i) => {
        const b = ring[(i + 1) % ring.length]
        return Math.max(a.x, b.x) > x0 && Math.min(a.x, b.x) < x1 && Math.max(a.y, b.y) > y0 && Math.min(a.y, b.y) < y1
      }),
    ),
  )
}

describe('peças de chão que se tocam viram um chão só', () => {
  it('dois retângulos lado a lado: nenhum contorno na divisa, um anel só', () => {
    const floor = [retangulo('rua', 0, 0, 500, 600), retangulo('predio', 500, 100, 900, 500)]
    expect(contornoDentro(floor, 480, 520, 150, 450)).toBe(false)
    const outline = buildFloorOutline(floor)
    expect(outline.length).toBe(1)
    expect(outline[0].holes).toEqual([])
    // A borda de fora continua onde estava.
    expect(pointInRing({ x: 899, y: 300 }, outline[0].outer)).toBe(true)
    expect(pointInRing({ x: 901, y: 300 }, outline[0].outer)).toBe(false)
    expect(pointInRing({ x: 700, y: 99 }, outline[0].outer)).toBe(false)
  })

  it('rua em blocos com o prédio que o balde encheu: nenhum contorno na divisa', () => {
    const floor = [blocos('rua', 0, 9, 0, 11), blocos('balde', 10, 17, 2, 9)]
    expect(contornoDentro(floor, 480, 520, 150, 450)).toBe(false)
    expect(buildFloorOutline(floor).length).toBe(1)
  })

  it('furo tapado por outra peça do mesmo tamanho: sem contorno em volta do furo', () => {
    const floor = [blocos('rua', 0, 19, 0, 11), blocos('furo', 10, 17, 2, 9, 'subtract'), blocos('balde', 10, 17, 2, 9)]
    expect(contornoDentro(floor, 480, 520, 150, 450)).toBe(false)
    expect(contornoDentro(floor, 550, 850, 80, 120)).toBe(false)
    const outline = buildFloorOutline(floor)
    expect(outline.length).toBe(1)
    expect(outline[0].holes).toEqual([])
  })

  it('controle: vão de verdade entre as peças continua sendo borda', () => {
    const floor = [retangulo('rua', 0, 0, 500, 600), retangulo('predio', 510, 100, 900, 500)]
    expect(contornoDentro(floor, 480, 530, 150, 450)).toBe(true)
    expect(buildFloorOutline(floor).length).toBe(2)
  })

  it('controle: buraco (subtract) encostado na borda continua buraco', () => {
    const floor = [retangulo('sala', 0, 0, 600, 600), retangulo('poco', 200, 200, 400, 400, 'subtract')]
    const outline = buildFloorOutline(floor)
    expect(outline.length).toBe(1)
    expect(outline[0].holes.length).toBe(1)
    expect(pointInRing({ x: 300, y: 300 }, outline[0].holes[0])).toBe(true)
  })
})
