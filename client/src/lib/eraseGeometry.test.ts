import { describe, expect, it } from 'vitest'
import {
  clipPolylineByCircle,
  eraseFromDrawing,
  eraseDecisionForWall,
  eraseDecisionForRegion,
  eraseDecisionForStair,
  eraseDecisionForToken,
  eraseDecisionForProp,
} from './eraseGeometry'
import type { Drawing, Prop, Region, Stair, Token, Wall } from '../types/map'

// ─────────────────────────────────────────────────────────────
// clipPolylineByCircle — a geometria crua por trás de freehand/curve/line.
// ─────────────────────────────────────────────────────────────

describe('clipPolylineByCircle', () => {
  it('apagar exatamente no meio produz DOIS pedaços', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }, { x: 40, y: 0 }]
    const result = clipPolylineByCircle(points, { x: 20, y: 0 }, 5)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 15, y: 0 }])
    expect(result[1]).toEqual([{ x: 25, y: 0 }, { x: 30, y: 0 }, { x: 40, y: 0 }])
  })

  it('apagar a ponta encurta o traço (1 pedaço, mais curto)', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }]
    const result = clipPolylineByCircle(points, { x: 0, y: 0 }, 5)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual([{ x: 5, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }])
  })

  it('raio maior que o traço inteiro apaga tudo (lista vazia)', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }]
    const result = clipPolylineByCircle(points, { x: 10, y: 0 }, 1000)

    expect(result).toEqual([])
  })

  it('raio que não encosta devolve o traço inteiro, sem dividir', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }]
    const result = clipPolylineByCircle(points, { x: 1000, y: 1000 }, 5)

    expect(result).toEqual([[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }]])
  })

  it('traço com 2 pontos só (equivalente a uma linha) também divide corretamente', () => {
    const points = [{ x: 0, y: 0 }, { x: 40, y: 0 }]
    const result = clipPolylineByCircle(points, { x: 20, y: 0 }, 5)

    expect(result).toEqual([
      [{ x: 0, y: 0 }, { x: 15, y: 0 }],
      [{ x: 25, y: 0 }, { x: 40, y: 0 }],
    ])
  })

  it('traço com pontos repetidos não quebra nem divide por zero', () => {
    const points = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }]
    expect(() => clipPolylineByCircle(points, { x: 0, y: 0 }, 2)).not.toThrow()

    const result = clipPolylineByCircle(points, { x: 0, y: 0 }, 2)
    expect(result).toEqual([[{ x: 2, y: 0 }, { x: 10, y: 0 }]])
  })

  it('pontos repetidos FORA do círculo são preservados sem duplicar geometria estranha', () => {
    const points = [{ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 110, y: 100 }]
    const result = clipPolylineByCircle(points, { x: 0, y: 0 }, 5)

    expect(result).toEqual([[{ x: 100, y: 100 }, { x: 110, y: 100 }]])
  })
})

// ─────────────────────────────────────────────────────────────
// eraseFromDrawing — por kind.
// ─────────────────────────────────────────────────────────────

describe('eraseFromDrawing — freehand', () => {
  const base: Drawing = {
    id: 'f1',
    kind: 'freehand',
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }, { x: 40, y: 0 }],
    color: '#fff',
    width: 2,
  }

  it('apagar o meio gera 2 traços novos, preservando color/width', () => {
    const result = eraseFromDrawing(base, { x: 20, y: 0 }, 5)
    expect(result).toHaveLength(2)
    for (const drawing of result) {
      expect(drawing.kind).toBe('freehand')
      expect(drawing.id).not.toBe('f1')
      if (drawing.kind === 'freehand') {
        expect(drawing.color).toBe('#fff')
        expect(drawing.width).toBe(2)
      }
    }
  })

  it('raio que não encosta devolve a MESMA referência do Drawing original', () => {
    const result = eraseFromDrawing(base, { x: -1000, y: -1000 }, 5)
    expect(result).toEqual([base])
    expect(result[0]).toBe(base)
  })

  it('raio maior que o traço inteiro apaga tudo', () => {
    const result = eraseFromDrawing(base, { x: 20, y: 0 }, 1000)
    expect(result).toEqual([])
  })

  it('preserva `cap` quando definido, e omite quando ausente', () => {
    const withCap: Drawing = { ...base, cap: 'butt' }
    const result = eraseFromDrawing(withCap, { x: 20, y: 0 }, 5)
    expect(result).toHaveLength(2)
    for (const drawing of result) {
      if (drawing.kind === 'freehand') expect(drawing.cap).toBe('butt')
    }

    const withoutCapResult = eraseFromDrawing(base, { x: 20, y: 0 }, 5)
    for (const drawing of withoutCapResult) {
      expect('cap' in drawing).toBe(false)
    }
  })
})

describe('eraseFromDrawing — curve', () => {
  it('mesmo comportamento de freehand, mas mantém kind "curve"', () => {
    const curve: Drawing = {
      id: 'c1',
      kind: 'curve',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }, { x: 40, y: 0 }],
      color: '#0f0',
      width: 3,
    }
    const result = eraseFromDrawing(curve, { x: 20, y: 0 }, 5)
    expect(result).toHaveLength(2)
    expect(result.every((d) => d.kind === 'curve')).toBe(true)
  })
})

describe('eraseFromDrawing — line', () => {
  const line: Drawing = { id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 40, y2: 0, color: '#00f', width: 2 }

  it('apagar o meio de uma linha gera DUAS linhas', () => {
    const result = eraseFromDrawing(line, { x: 20, y: 0 }, 5)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ kind: 'line', x1: 0, y1: 0, x2: 15, y2: 0 })
    expect(result[1]).toMatchObject({ kind: 'line', x1: 25, y1: 0, x2: 40, y2: 0 })
  })

  it('apagar a ponta encurta a linha (1 linha só)', () => {
    const result = eraseFromDrawing(line, { x: 0, y: 0 }, 5)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ kind: 'line', x1: 5, y1: 0, x2: 40, y2: 0 })
  })

  it('raio que não encosta devolve a mesma referência', () => {
    const result = eraseFromDrawing(line, { x: 1000, y: 1000 }, 5)
    expect(result[0]).toBe(line)
  })

  it('raio maior que a linha inteira apaga tudo', () => {
    const result = eraseFromDrawing(line, { x: 20, y: 0 }, 1000)
    expect(result).toEqual([])
  })
})

describe('eraseFromDrawing — formas fechadas (circle/rect/ellipse/polygon/text): decisão binária', () => {
  it('circle: círculo da borracha tocando remove inteiro; não tocando preserva referência', () => {
    const circle: Drawing = { id: 'ci1', kind: 'circle', cx: 0, cy: 0, radius: 10, color: '#f00', width: 1, filled: true, fillAlpha: 0.5 }
    expect(eraseFromDrawing(circle, { x: 0, y: 0 }, 5)).toEqual([])
    const kept = eraseFromDrawing(circle, { x: 1000, y: 1000 }, 5)
    expect(kept[0]).toBe(circle)
  })

  it('rect: mesma regra, usando o centro real do retângulo (x/y é canto)', () => {
    const rect: Drawing = { id: 'r1', kind: 'rect', x: 0, y: 0, w: 20, h: 10, color: '#f00', width: 1, filled: true, fillAlpha: 0.5 }
    expect(eraseFromDrawing(rect, { x: 10, y: 5 }, 3)).toEqual([])
    const kept = eraseFromDrawing(rect, { x: -1000, y: -1000 }, 3)
    expect(kept[0]).toBe(rect)
  })

  it('ellipse: mesma regra, aproximada pela caixa delimitadora', () => {
    const ellipse: Drawing = { id: 'e1', kind: 'ellipse', cx: 0, cy: 0, rx: 20, ry: 10, color: '#f00', width: 1, filled: true, fillAlpha: 0.5 }
    expect(eraseFromDrawing(ellipse, { x: 0, y: 0 }, 3)).toEqual([])
    const kept = eraseFromDrawing(ellipse, { x: 1000, y: 1000 }, 3)
    expect(kept[0]).toBe(ellipse)
  })

  it('polygon: aresta tocada remove; longe preserva referência', () => {
    const polygon: Drawing = {
      id: 'p1',
      kind: 'polygon',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      color: '#f00',
      width: 1,
      filled: false,
      fillAlpha: 0,
    }
    expect(eraseFromDrawing(polygon, { x: 5, y: 0 }, 2)).toEqual([])
    const kept = eraseFromDrawing(polygon, { x: 1000, y: 1000 }, 2)
    expect(kept[0]).toBe(polygon)
  })

  it('text: caixa aproximada por comprimento×fontSize remove quando tocada', () => {
    const text: Drawing = { id: 't1', kind: 'text', x: 0, y: 0, text: 'Sala', fontSize: 20, color: '#fff' }
    expect(eraseFromDrawing(text, { x: 0, y: 5 }, 3)).toEqual([])
    const kept = eraseFromDrawing(text, { x: 1000, y: 1000 }, 3)
    expect(kept[0]).toBe(text)
  })
})

// ─────────────────────────────────────────────────────────────
// eraseDecisionFor* — entidades fora de Drawing (remove inteiro / mantém).
// ─────────────────────────────────────────────────────────────

describe('eraseDecisionForWall', () => {
  const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 40, y2: 0, blocksLight: true, blocksMove: true, door: null }

  it('remove quando o círculo toca o segmento', () => {
    expect(eraseDecisionForWall(wall, { x: 20, y: 0 }, 5)).toBe('remove')
  })

  it('mantém quando o círculo não encosta', () => {
    expect(eraseDecisionForWall(wall, { x: 20, y: 1000 }, 5)).toBe('keep')
  })
})

describe('eraseDecisionForRegion', () => {
  const region: Region = {
    id: 'reg1',
    points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }],
    tag: 'region',
    fillColor: '#333',
    fillPattern: 'solid',
    data: {},
  }

  it('remove quando o círculo cai dentro da região, mesmo sem tocar aresta nenhuma', () => {
    expect(eraseDecisionForRegion(region, { x: 10, y: 10 }, 2)).toBe('remove')
  })

  it('remove quando o círculo só toca a borda', () => {
    expect(eraseDecisionForRegion(region, { x: 0, y: 10 }, 2)).toBe('remove')
  })

  it('mantém quando o círculo está totalmente fora', () => {
    expect(eraseDecisionForRegion(region, { x: 1000, y: 1000 }, 2)).toBe('keep')
  })
})

describe('eraseDecisionForStair', () => {
  const stair: Stair = {
    id: 's1',
    shape: 'straight',
    direction: 'up',
    segments: [{ x1: 0, y1: 0, x2: 30, y2: 0 }],
    stepWidth: 24,
  }

  it('remove a escada inteira quando o círculo toca qualquer segmento', () => {
    expect(eraseDecisionForStair(stair, { x: 15, y: 0 }, 3)).toBe('remove')
  })

  it('mantém quando nenhum segmento é tocado', () => {
    expect(eraseDecisionForStair(stair, { x: 15, y: 1000 }, 3)).toBe('keep')
  })
})

describe('eraseDecisionForToken', () => {
  const token: Token = { id: 'tk1', characterId: null, name: 'Herói', x: 100, y: 100, size: 40, image: null }

  it('remove quando os círculos se sobrepõem (borracha + token, tratado como círculo)', () => {
    expect(eraseDecisionForToken(token, { x: 110, y: 100 }, 5)).toBe('remove')
  })

  it('mantém quando os círculos não se tocam', () => {
    expect(eraseDecisionForToken(token, { x: 1000, y: 1000 }, 5)).toBe('keep')
  })
})

describe('eraseDecisionForProp', () => {
  const prop: Prop = { id: 'pr1', src: '/img.png', x: 50, y: 50, width: 20, height: 10, linkedMapPath: null }

  it('remove quando o círculo toca a caixa width×height centrada em (x,y)', () => {
    expect(eraseDecisionForProp(prop, { x: 50, y: 50 }, 1)).toBe('remove')
    expect(eraseDecisionForProp(prop, { x: 59, y: 50 }, 1)).toBe('remove') // beira direita da caixa (x+w/2=60)
  })

  it('mantém quando o círculo está fora da caixa', () => {
    expect(eraseDecisionForProp(prop, { x: 1000, y: 1000 }, 1)).toBe('keep')
  })
})
