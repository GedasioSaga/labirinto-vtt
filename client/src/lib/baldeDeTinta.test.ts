import { describe, expect, it } from 'vitest'
import type { Drawing, DrawingPoint, MapData } from '../types/map'
import { areaDoBalde, baldeDeTintaNoPonto, ehPinturaDeBalde, inserirPinturaDeBalde } from './baldeDeTinta'

/** Mapa 10x10 de 70 px: 700x700 px de mundo, uma célula de balde por px. */
function mapa(drawings: Drawing[], extra: Partial<Pick<MapData, 'walls' | 'lines' | 'regions'>> = {}) {
  return { width: 10, height: 10, grid: 70, drawings, ...extra }
}

function retangulo(id: string, x: number, y: number, w: number, h: number): Drawing {
  return { id, kind: 'rect', x, y, w, h, color: '#000000', width: 4, filled: false, fillAlpha: 0 }
}

/** Par-ou-ímpar, a mesma regra do preenchimento do Pixi. */
function dentro(pontos: DrawingPoint[], x: number, y: number): boolean {
  let dentroDoPoligono = false
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i, i += 1) {
    const a = pontos[i]
    const b = pontos[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) dentroDoPoligono = !dentroDoPoligono
  }
  return dentroDoPoligono
}

describe('areaDoBalde', () => {
  it('enche o interior de um retângulo desenhado e para no traço', () => {
    const area = areaDoBalde(mapa([retangulo('r', 100, 100, 200, 200)]), { x: 200, y: 200 })
    expect(area).not.toBeNull()
    const pontos = area ?? []
    expect(dentro(pontos, 200, 200)).toBe(true)
    expect(dentro(pontos, 110, 290)).toBe(true)
    expect(dentro(pontos, 50, 50)).toBe(false)
    expect(dentro(pontos, 350, 200)).toBe(false)
    for (const p of pontos) {
      expect(p.x).toBeGreaterThanOrEqual(96)
      expect(p.x).toBeLessThanOrEqual(304)
      expect(p.y).toBeGreaterThanOrEqual(96)
      expect(p.y).toBeLessThanOrEqual(304)
    }
  })

  it('enche um quadrado feito à mão com o Pincel', () => {
    const quadrado: Drawing = {
      id: 'f',
      kind: 'freehand',
      points: [{ x: 400, y: 400 }, { x: 600, y: 400 }, { x: 600, y: 600 }, { x: 400, y: 600 }, { x: 400, y: 400 }],
      color: '#000000',
      width: 6,
    }
    const pontos = areaDoBalde(mapa([quadrado]), { x: 500, y: 500 }) ?? []
    expect(dentro(pontos, 500, 500)).toBe(true)
    expect(dentro(pontos, 300, 300)).toBe(false)
  })

  it('enche em volta de uma forma fechada lá dentro e deixa o buraco vazio', () => {
    const drawings = [retangulo('fora', 100, 100, 400, 400), retangulo('dentro', 250, 250, 100, 100)]
    const pontos = areaDoBalde(mapa(drawings), { x: 150, y: 150 }) ?? []
    expect(dentro(pontos, 150, 150)).toBe(true)
    expect(dentro(pontos, 450, 450)).toBe(true)
    expect(dentro(pontos, 300, 200)).toBe(true)
    expect(dentro(pontos, 300, 300)).toBe(false)
    expect(dentro(pontos, 50, 50)).toBe(false)
  })

  it('deixa vários buracos vazios, inclusive dois na mesma altura', () => {
    const drawings = [
      retangulo('fora', 50, 50, 600, 600),
      retangulo('a', 150, 150, 80, 80),
      retangulo('b', 400, 150, 80, 80),
      retangulo('c', 250, 400, 120, 60),
    ]
    const pontos = areaDoBalde(mapa(drawings), { x: 100, y: 600 }) ?? []
    expect(dentro(pontos, 100, 600)).toBe(true)
    expect(dentro(pontos, 320, 190)).toBe(true)
    expect(dentro(pontos, 600, 100)).toBe(true)
    expect(dentro(pontos, 190, 190)).toBe(false)
    expect(dentro(pontos, 440, 190)).toBe(false)
    expect(dentro(pontos, 310, 430)).toBe(false)
  })

  it('sem nenhum traço enche o mapa inteiro até a borda', () => {
    const pontos = areaDoBalde(mapa([]), { x: 10, y: 10 }) ?? []
    expect(dentro(pontos, 1, 1)).toBe(true)
    expect(dentro(pontos, 699, 699)).toBe(true)
  })

  it('para em parede, linha do mapa e borda de sala', () => {
    const walls = [
      { id: 'w', x1: 0, y1: 200, x2: 700, y2: 200, blocksLight: true, blocksMove: true, door: null },
    ] as unknown as MapData['walls']
    const pontos = areaDoBalde(mapa([], { walls }), { x: 100, y: 100 }) ?? []
    expect(dentro(pontos, 100, 100)).toBe(true)
    expect(dentro(pontos, 100, 300)).toBe(false)
  })

  it('não enche quando o clique cai em cima do traço ou fora do mapa', () => {
    const map = mapa([retangulo('r', 100, 100, 200, 200)])
    expect(areaDoBalde(map, { x: 100, y: 200 })).toBeNull()
    expect(areaDoBalde(map, { x: -5, y: 10 })).toBeNull()
    expect(areaDoBalde(map, { x: 800, y: 10 })).toBeNull()
  })

  it('atravessa a tinta de um balde anterior', () => {
    const tinta: Drawing = {
      id: 't',
      kind: 'polygon',
      points: [{ x: 150, y: 150 }, { x: 250, y: 150 }, { x: 250, y: 250 }, { x: 150, y: 250 }],
      color: '#ff0000',
      width: 0,
      filled: true,
      fillAlpha: 1,
    }
    const pontos = areaDoBalde(mapa([tinta, retangulo('r', 100, 100, 200, 200)]), { x: 120, y: 120 }) ?? []
    expect(dentro(pontos, 200, 200)).toBe(true)
    expect(dentro(pontos, 280, 280)).toBe(true)
  })
})

describe('baldeDeTintaNoPonto', () => {
  it('cria um polígono cheio, sem traço, com a cor do desenho', () => {
    const pintura = baldeDeTintaNoPonto(mapa([retangulo('r', 100, 100, 200, 200)]), { x: 200, y: 200 }, '#3366ff', 'novo')
    expect(pintura).toMatchObject({ id: 'novo', kind: 'polygon', color: '#3366ff', width: 0, filled: true, fillAlpha: 1 })
    expect(pintura && ehPinturaDeBalde(pintura)).toBe(true)
  })

  it('devolve null quando não há o que encher', () => {
    expect(baldeDeTintaNoPonto(mapa([]), { x: -1, y: -1 }, '#3366ff', 'novo')).toBeNull()
  })
})

describe('inserirPinturaDeBalde', () => {
  const tinta = (id: string): Drawing => ({ id, kind: 'polygon', points: [], color: '#f00', width: 0, filled: true, fillAlpha: 1 })

  it('põe a pintura antes de todo traço quando ainda não há tinta', () => {
    const lista = inserirPinturaDeBalde([retangulo('a', 0, 0, 1, 1), retangulo('b', 0, 0, 1, 1)], tinta('t'))
    expect(lista.map((d) => d.id)).toEqual(['t', 'a', 'b'])
  })

  it('põe a pintura nova logo depois da última tinta, ainda por baixo dos traços', () => {
    const lista = inserirPinturaDeBalde([tinta('t1'), retangulo('a', 0, 0, 1, 1), tinta('t2'), retangulo('b', 0, 0, 1, 1)], tinta('t3'))
    expect(lista.map((d) => d.id)).toEqual(['t1', 'a', 't2', 't3', 'b'])
  })
})
