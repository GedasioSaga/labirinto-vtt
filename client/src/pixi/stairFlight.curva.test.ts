import { describe, expect, it } from 'vitest'
import { curvedFlightRing, planCurvedStairFlight, type CurvedStairFlight } from './stairFlight'
import { stairArcOf } from '../lib/stairCurve'
import type { StairDirection, StairSegment } from '../types/map'
import type { Point } from './world'

const SEGMENTO: StairSegment = { x1: 0, y1: 0, x2: 280, y2: 0 }
const LARGURA = 70
const CURVA = 100

function planejar(direction: StairDirection = 'up', curva = CURVA, scale = 1): CurvedStairFlight {
  const flight = planCurvedStairFlight(SEGMENTO, LARGURA, direction, curva, scale, 1)
  if (flight === null) throw new Error('lance curvo válido devolveu null')
  return flight
}

function arco() {
  const a = stairArcOf(SEGMENTO, CURVA)
  if (a === null) throw new Error('sem arco')
  return a
}

const distancia = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y)
/** Produto vetorial de (b − a) por (c − a): zero quando os três pontos estão na mesma reta. */
const cruzado = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

describe('planCurvedStairFlight — a escada curva em arco', () => {
  it('a placa é o anel do arco: todo ponto entre o raio de dentro e o de fora', () => {
    const { center, radius } = arco()
    const flight = planejar()
    for (const ponto of flight.plate) {
      const d = distancia(ponto, center)
      expect(d).toBeGreaterThanOrEqual(radius - LARGURA / 2 - 1e-6)
      expect(d).toBeLessThanOrEqual(radius + LARGURA / 2 + 1e-6)
    }
    expect(flight.plate.length).toBeGreaterThan(8)
  })

  it('a placa começa e termina nas bordas retas das pontas: as pontas da escada não saem do lugar', () => {
    const flight = planejar()
    // Os dois cantos de cada ponta, a meia largura de (0,0) e de (280,0), na mesma reta radial.
    const pertoDe = (alvo: Point) => flight.plate.some((p) => distancia(p, alvo) < LARGURA / 2 + 1e-6 && Math.abs(distancia(p, alvo) - LARGURA / 2) < 1e-6)
    expect(pertoDe({ x: 0, y: 0 })).toBe(true)
    expect(pertoDe({ x: 280, y: 0 })).toBe(true)
  })

  it('os degraus são radiais (o traço aponta para o centro) e de moldura a moldura', () => {
    const { center, radius } = arco()
    const flight = planejar()
    expect(flight.treads.length).toBeGreaterThan(5)
    for (const [a, b] of flight.treads) {
      expect(Math.abs(cruzado(center, a, b))).toBeLessThan(1e-6)
      const dentro = Math.min(distancia(a, center), distancia(b, center))
      const fora = Math.max(distancia(a, center), distancia(b, center))
      expect(dentro).toBeGreaterThan(radius - LARGURA / 2)
      expect(fora).toBeLessThan(radius + LARGURA / 2)
    }
  })

  it('os degraus nunca se cruzam: ângulos distintos, em ordem, e o raio de dentro maior que zero', () => {
    const { center } = arco()
    const flight = planejar('up', 140) // a curva máxima desta escada: meia volta
    const angulos = flight.treads.map(([a]) => Math.atan2(a.y - center.y, a.x - center.x))
    for (let i = 1; i < angulos.length; i += 1) expect(angulos[i]).not.toBeCloseTo(angulos[i - 1], 6)
    for (const [a, b] of flight.treads) expect(Math.min(distancia(a, center), distancia(b, center))).toBeGreaterThan(0)
  })

  it('o patamar fica no topo: perto de (x2,y2) subindo, de (x1,y1) descendo', () => {
    const sobe = planejar('up')
    const desce = planejar('down')
    if (sobe.landing === null || desce.landing === null) throw new Error('esperava patamar')
    const meio = (pontos: readonly Point[]) => ({ x: pontos.reduce((s, p) => s + p.x, 0) / pontos.length, y: pontos.reduce((s, p) => s + p.y, 0) / pontos.length })
    expect(distancia(meio(sobe.landing), { x: 280, y: 0 })).toBeLessThan(distancia(meio(sobe.landing), { x: 0, y: 0 }))
    expect(distancia(meio(desce.landing), { x: 0, y: 0 })).toBeLessThan(distancia(meio(desce.landing), { x: 280, y: 0 }))
  })

  it('de longe os degraus rareiam, como no lance reto', () => {
    expect(planejar('up', CURVA, 0.2).treads.length).toBeLessThan(planejar('up', CURVA, 1).treads.length)
  })

  it('o anel de seleção fica por fora da placa', () => {
    const { center, radius } = arco()
    const flight = planejar()
    const anel = curvedFlightRing(flight, 2)
    const fora = Math.max(...anel.map((p) => distancia(p, center)))
    const dentro = Math.min(...anel.map((p) => distancia(p, center)))
    expect(fora).toBeCloseTo(radius + LARGURA / 2 + 2, 6)
    expect(dentro).toBeCloseTo(radius - LARGURA / 2 - 2, 6)
  })

  it('curva zero ou lance zero não é lance curvo', () => {
    expect(planCurvedStairFlight(SEGMENTO, LARGURA, 'up', 0, 1, 1)).toBeNull()
    expect(planCurvedStairFlight({ x1: 3, y1: 3, x2: 3, y2: 3 }, LARGURA, 'up', 40, 1, 1)).toBeNull()
  })
})
