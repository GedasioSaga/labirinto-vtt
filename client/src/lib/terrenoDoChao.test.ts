import { describe, expect, it } from 'vitest'
import type { FloorPiece, RegionPoint } from '../types/map'
import { pointInRing } from './floorContour'
import { buildCaminhoShape, formasDoTerreno, passosDoTerreno, pontosDosAneis } from './terrenoDoChao'

const G = 64

function quadrado(x0: number, y0: number, lado: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x0 + lado, y: y0 },
    { x: x0 + lado, y: y0 + lado },
    { x: x0, y: y0 + lado },
  ]
}

/** O par-ímpar dos anéis um a um: o que o balde tem de encher (dentro de um anel, fora do buraco). */
function dentroDosAneis(aneis: readonly RegionPoint[][], p: RegionPoint): boolean {
  return aneis.filter((anel) => pointInRing(p, anel)).length % 2 === 1
}

describe('pontosDosAneis (E01 da 0.5.62: cunhas e fiapos no caminho com material)', () => {
  it('a lista única enche, no par-ímpar, exatamente os anéis: nada entre eles, buraco aberto', () => {
    // Três "pedras" longe umas das outras e uma praça com canteiro (anel de fora + buraco).
    const aneis = [quadrado(0, 0, 100), quadrado(300, 20, 20), quadrado(150, 300, 20), quadrado(400, 300, 30), quadrado(0, 400, 200), quadrado(50, 450, 60)]
    const pontos = pontosDosAneis(aneis)
    let conferidos = 0
    for (let y = -10; y <= 610; y += 7) {
      for (let x = -10; x <= 460; x += 7) {
        const p = { x: x + 0.37, y: y + 0.21 }
        expect(pointInRing(p, pontos), `(${p.x}, ${p.y})`).toBe(dentroDosAneis(aneis, p))
        conferidos += 1
      }
    }
    expect(conferidos).toBeGreaterThan(5000)
    // O meio do triângulo dos primeiros pontos (0,0), (300,20), (150,300): a ponte de mão única o enchia.
    expect(pointInRing({ x: 150, y: 107 }, pontos)).toBe(false)
  })

  it('o caminho de calçamento com borda (pedras soltas) arrastado em onda: o passo do balde é a forma, sem fiapo', () => {
    const shape = buildCaminhoShape(
      [
        { x: 4 * G, y: 10 * G },
        { x: 8 * G, y: 6 * G },
        { x: 12 * G, y: 10 * G },
        { x: 16 * G, y: 6 * G },
        { x: 20 * G, y: 10 * G },
      ],
      2 * G,
      G,
    )
    expect(shape).not.toBeNull()
    if (shape === null) return
    const floor: FloorPiece[] = [{ id: 'c', shape, op: 'add', modifiers: {}, material: 'calcamento', borda: 0.6 }]
    const clip = { minX: 0, minY: 0, maxX: 24 * G, maxY: 16 * G }
    const [forma] = formasDoTerreno(floor, G, clip)
    // Pedras soltas: bem mais de um anel, que é onde a ponte de mão única desenhava as cunhas.
    expect(forma.aneis.length).toBeGreaterThan(10)
    const [passo] = passosDoTerreno(floor, G, clip)
    expect(passo.tipo === 'balde' && passo.alvo.tipo === 'area').toBe(true)
    if (passo.tipo !== 'balde' || passo.alvo.tipo !== 'area') return
    const pontos = passo.alvo.pontos
    let erradas = 0
    let dentro = 0
    for (let y = 3 * G; y <= 13 * G; y += G / 8) {
      for (let x = 1 * G; x <= 23 * G; x += G / 8) {
        const p = { x: x + 0.31, y: y + 0.17 }
        const esperado = dentroDosAneis(forma.aneis, p)
        if (pointInRing(p, pontos) !== esperado) erradas += 1
        if (esperado) dentro += 1
      }
    }
    expect(dentro).toBeGreaterThan(1000)
    expect(erradas).toBe(0)
  })
})
