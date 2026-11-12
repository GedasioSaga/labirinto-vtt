import { describe, expect, it } from 'vitest'
import type { Drawing, DrawingPoint, Wall } from '../types/map'
import { areaDoBalde, areaFechadaPorParedes } from './baldeDeTinta'
import { dentroDoPoligono } from './baldeDeTextura'
import contornosDeAntes from './__fixtures__/contornosDoBalde.json'

/**
 * A ÁREA FECHADA POR PAREDES do Balde da ferramenta Texturas (pedido de
 * 12/11/2026: "colocar textura em lugar só com apertar sendo o limite as
 * paredes"): só as paredes cercam (a porta também, aberta ou não), e a área que
 * não fecha não sai.
 */

function parede(id: string, x1: number, y1: number, x2: number, y2: number, porta = false): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: porta ? { open: true, locked: false, kind: 'normal' } : null }
}

/** O L do print, em paredes soltas, com uma porta ABERTA na parede de baixo. */
const L: Wall[] = [
  parede('topo', 70, 70, 350, 70),
  parede('degrau-v', 350, 70, 350, 210),
  parede('degrau-h', 350, 210, 560, 210),
  parede('direita', 560, 210, 560, 490),
  parede('baixo-1', 560, 490, 350, 490),
  parede('porta', 350, 490, 280, 490, true),
  parede('baixo-2', 280, 490, 70, 490),
  parede('esquerda', 70, 490, 70, 70),
]

function areaDe(pontos: readonly DrawingPoint[]): number {
  let soma = 0
  for (let i = 0; i < pontos.length; i += 1) {
    const a = pontos[i]
    const b = pontos[(i + 1) % pontos.length]
    soma += a.x * b.y - b.x * a.y
  }
  return Math.abs(soma) / 2
}

describe('areaFechadaPorParedes', () => {
  it('o L fechado por paredes soltas, com a porta aberta: a área é o L inteiro, até as paredes, sem vazar pela porta', () => {
    const area = areaFechadaPorParedes({ width: 10, height: 10, grid: 70, walls: L }, { x: 150, y: 300 })
    if (area === null) throw new Error('o L não fechou')
    expect(dentroDoPoligono({ x: 150, y: 300 }, area)).toBe(true)
    expect(dentroDoPoligono({ x: 500, y: 400 }, area)).toBe(true)
    // Rente à parede (a 2 px dela): sem faixa vazia.
    expect(dentroDoPoligono({ x: 72, y: 72 }, area)).toBe(true)
    expect(dentroDoPoligono({ x: 450, y: 140 }, area)).toBe(false)
    expect(dentroDoPoligono({ x: 315, y: 600 }, area)).toBe(false)
    // 280 x 140 em cima + 490 x 280 embaixo.
    expect(areaDe(area)).toBeGreaterThan(176_400 * 0.98)
    expect(areaDe(area)).toBeLessThan(176_400 * 1.02)
  })

  it('a área que não fecha (sem a parede da esquerda) não sai; o clique em cima da parede também não', () => {
    const aberto = L.filter((w) => w.id !== 'esquerda')
    expect(areaFechadaPorParedes({ width: 10, height: 10, grid: 70, walls: aberto }, { x: 150, y: 300 })).toBeNull()
    expect(areaFechadaPorParedes({ width: 10, height: 10, grid: 70, walls: L }, { x: 200, y: 70 })).toBeNull()
  })

  it('mapa de 200 x 200 casas com muitas paredes: o tempo do clique (medido e mostrado)', () => {
    const grade = 70
    const lado = 200 * grade
    const walls: Wall[] = [
      // As quatro bordas do mapa: a parede em cima da borda fecha a área.
      parede('n', 0, 0, lado, 0),
      parede('l', lado, 0, lado, lado),
      parede('s', lado, lado, 0, lado),
      parede('o', 0, lado, 0, 0),
    ]
    // A metade de cima cheia de salas de 7 x 7 casas; a de baixo, um salão aberto.
    const passo = 7 * grade
    for (let y = passo; y <= lado / 2; y += passo) walls.push(parede(`h${y}`, 0, y, lado, y))
    for (let x = passo; x < lado; x += passo) walls.push(parede(`v${x}`, x, 0, x, lado / 2))
    const mapa = { width: 200, height: 200, grid: grade, walls }

    const t0 = performance.now()
    const sala = areaFechadaPorParedes(mapa, { x: passo * 3.5, y: passo * 1.5 })
    const t1 = performance.now()
    const salao = areaFechadaPorParedes(mapa, { x: lado / 2, y: lado * 0.75 })
    const t2 = performance.now()
    const pequeno = areaFechadaPorParedes({ width: 10, height: 10, grid: 70, walls: L }, { x: 150, y: 300 })
    const t3 = performance.now()
    console.log(
      `[tempo] ${walls.length} paredes; clique numa sala de 7x7: ${Math.round(t1 - t0)} ms; no salão de 200x100: ${Math.round(t2 - t1)} ms; no L de um mapa 10x10: ${Math.round(t3 - t2)} ms`,
    )

    expect(sala).not.toBeNull()
    expect(salao).not.toBeNull()
    expect(pequeno).not.toBeNull()
    expect(t2 - t1).toBeLessThan(5000)
  })

  /**
   * O ATALHO NÃO MUDA O RESULTADO (o clique passou de 231 ms para menos de 150
   * num salão de 200 x 100 casas olhando só a borda da grade e os vértices com
   * aresta): os contornos são os mesmos, ponto por ponto, que a conta de antes
   * devolvia (`__fixtures__/contornosDoBalde.json`, gravado com ela).
   */
  it('o contorno é o mesmo de antes: o L do print, o L aberto, a sala e o salão do mapa grande e o balde do Pincel num círculo', () => {
    const grade = 70
    const lado = 200 * grade
    const walls: Wall[] = [parede('n', 0, 0, lado, 0), parede('l', lado, 0, lado, lado), parede('s', lado, lado, 0, lado), parede('o', 0, lado, 0, 0)]
    const passo = 7 * grade
    for (let y = passo; y <= lado / 2; y += passo) walls.push(parede(`h${y}`, 0, y, lado, y))
    for (let x = passo; x < lado; x += passo) walls.push(parede(`v${x}`, x, 0, x, lado / 2))
    const grande = { width: 200, height: 200, grid: grade, walls }
    const pontosDoCirculo: DrawingPoint[] = []
    for (let i = 0; i <= 40; i += 1) {
      const angulo = (2 * Math.PI * (i % 40)) / 40
      pontosDoCirculo.push({ x: 3500 + 1200 * Math.cos(angulo), y: 3500 + 1200 * Math.sin(angulo) })
    }
    const circulo: Drawing = { id: 'c', kind: 'freehand', points: pontosDoCirculo, color: '#000000', width: 4 }

    const agora = {
      lDoPrint: areaFechadaPorParedes({ width: 10, height: 10, grid: 70, walls: L }, { x: 150, y: 300 }),
      lAberto: areaFechadaPorParedes({ width: 10, height: 10, grid: 70, walls: L.filter((w) => w.id !== 'esquerda') }, { x: 150, y: 300 }),
      salaNoMapaGrande: areaFechadaPorParedes(grande, { x: passo * 3.5, y: passo * 1.5 }),
      salaoNoMapaGrande: areaFechadaPorParedes(grande, { x: 7000, y: 10500 }),
      pincelNoCirculo: areaDoBalde({ width: 100, height: 100, grid: 70, drawings: [circulo] }, { x: 3500, y: 3500 }),
    }
    expect(JSON.parse(JSON.stringify(agora))).toEqual(contornosDeAntes)
  })
})
