import { describe, expect, it } from 'vitest'
import type { Point } from '../pixi/world'
import { arredondarTracado, PASSO_ANGULAR } from './arredondarTracado'
import { ROOM_CIRCLE_SIDES } from './roomCircle'

const distancia = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)

/** Maior mudança de direção entre dois trechos seguidos, em radianos. */
function maiorDobra(pontos: Point[], fechado: boolean): number {
  const n = pontos.length
  let maior = 0
  const inicio = fechado ? 0 : 1
  const fim = fechado ? n : n - 1
  for (let i = inicio; i < fim; i++) {
    const anterior = pontos[(i - 1 + n) % n]
    const canto = pontos[i]
    const seguinte = pontos[(i + 1) % n]
    const ux = canto.x - anterior.x
    const uy = canto.y - anterior.y
    const wx = seguinte.x - canto.x
    const wy = seguinte.y - canto.y
    maior = Math.max(maior, Math.abs(Math.atan2(ux * wy - uy * wx, ux * wx + uy * wy)))
  }
  return maior
}

const QUADRADO: Point[] = [
  { x: 0, y: 0 },
  { x: 200, y: 0 },
  { x: 200, y: 200 },
  { x: 0, y: 200 },
]

describe('arredondarTracado', () => {
  it('quadrado fechado vira círculo: todo ponto fica à mesma distância do centro', () => {
    const saida = arredondarTracado(QUADRADO, true)

    expect(saida.length).toBeGreaterThan(QUADRADO.length)
    for (const ponto of saida) expect(distancia(ponto, { x: 100, y: 100 })).toBeCloseTo(100, 6)
  })

  it('curva lisa: nenhuma dobra entre dois trechos passa do passo angular', () => {
    expect(maiorDobra(arredondarTracado(QUADRADO, true), true)).toBeLessThanOrEqual(PASSO_ANGULAR + 1e-9)
  })

  it('sem parede demais: o quadrado arredondado não passa dos lados da Sala Circular', () => {
    expect(arredondarTracado(QUADRADO, true).length).toBeLessThanOrEqual(ROOM_CIRCLE_SIDES)
  })

  it('fechado: o último ponto não repete o primeiro, nem quando o traçado volta ao começo', () => {
    const saida = arredondarTracado(QUADRADO, true)

    expect(distancia(saida[0], saida[saida.length - 1])).toBeGreaterThan(1e-6)
    expect(arredondarTracado([...QUADRADO, QUADRADO[0]], true)).toEqual(saida)
  })

  it('linha aberta: as pontas ficam onde foram clicadas e só o canto do meio vira curva', () => {
    const linha = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
    ]
    const saida = arredondarTracado(linha, false)

    expect(saida[0]).toEqual(linha[0])
    expect(saida[saida.length - 1]).toEqual(linha[2])
    expect(saida).not.toContainEqual(linha[1])
    expect(saida.length).toBeGreaterThan(linha.length)
    expect(maiorDobra(saida, false)).toBeLessThanOrEqual(PASSO_ANGULAR + 1e-9)
  })

  it('2 pontos: não há canto para arredondar, a linha volta igual', () => {
    const linha = [
      { x: 0, y: 0 },
      { x: 128, y: 64 },
    ]
    expect(arredondarTracado(linha, false)).toEqual(linha)
    expect(arredondarTracado(linha, true)).toEqual(linha)
  })

  it('lista vazia continua vazia', () => {
    expect(arredondarTracado([], false)).toEqual([])
    expect(arredondarTracado([], true)).toEqual([])
  })

  it('ponto clicado duas vezes não gera trecho de comprimento zero', () => {
    const comRepetidos = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
    ]
    const saida = arredondarTracado(comRepetidos, false)

    expect(saida).toEqual(
      arredondarTracado(
        [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
          { x: 200, y: 200 },
        ],
        false,
      ),
    )
    for (let i = 1; i < saida.length; i++) expect(distancia(saida[i - 1], saida[i])).toBeGreaterThan(1e-6)
  })

  it('ângulo raso (três pontos em linha reta) fica como está', () => {
    const reta = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
    ]
    expect(arredondarTracado(reta, false)).toEqual(reta)
  })

  it('voltar pelo mesmo caminho mantém o canto, sem curva de raio zero', () => {
    const idaEVolta = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 100, y: 0 },
    ]
    expect(arredondarTracado(idaEVolta, false)).toEqual(idaEVolta)
  })

  it('retângulo vira pílula: lados curtos viram meia-volta e os longos mantêm um trecho reto', () => {
    const retangulo = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 200 },
      { x: 0, y: 200 },
    ]
    const saida = arredondarTracado(retangulo, true)

    for (const ponto of saida) {
      const noLadoReto =
        (Math.abs(ponto.y) < 1e-9 || Math.abs(ponto.y - 200) < 1e-9) && ponto.x >= 100 - 1e-9 && ponto.x <= 300 + 1e-9
      const naMeiaVolta =
        Math.abs(distancia(ponto, { x: 100, y: 100 }) - 100) < 1e-6 ||
        Math.abs(distancia(ponto, { x: 300, y: 100 }) - 100) < 1e-6
      expect(noLadoReto || naMeiaVolta).toBe(true)
    }
    expect(Math.min(...saida.map((ponto) => ponto.x))).toBeCloseTo(0, 6)
    expect(Math.max(...saida.map((ponto) => ponto.x))).toBeCloseTo(400, 6)
    expect(maiorDobra(saida, true)).toBeLessThanOrEqual(PASSO_ANGULAR + 1e-9)
  })

  it('não altera o traçado recebido', () => {
    const copia = QUADRADO.map((ponto) => ({ ...ponto }))
    arredondarTracado(QUADRADO, true)
    expect(QUADRADO).toEqual(copia)
  })
})
