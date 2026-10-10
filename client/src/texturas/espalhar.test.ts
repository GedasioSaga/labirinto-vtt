/**
 * PONTOS ESPALHADOS no ladrilho (árvores do Bosque, poças do Pântano):
 * - saem iguais toda vez (cada tela sorteia a sua, e todas precisam ver o mesmo);
 * - respeitam a distância mínima também ATRAVÉS da emenda (o ladrilho é um toro);
 * - a busca por vizinhança e a por alcance acham exatamente o que a conta
 *   ingênua (todos contra todos) acha.
 */
import { describe, expect, it } from 'vitest'
import { cobertura, espalhar, naVolta, pontosPerto, pontosQueAlcancam, sorteador, type OpcoesDoEspalhamento } from './espalhar'

const OPCOES: OpcoesDoEspalhamento = {
  semente: 7,
  dardos: 1500,
  grade: 10,
  raio: (s) => 0.01 + 0.02 * s,
  fica: (x, _y, s) => s < 0.3 + 0.7 * x,
  distanciaMinima: (p, q) => p.r + q.r + 0.005,
}

function distanciaNaVolta(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(naVolta(ax - bx), naVolta(ay - by))
}

describe('sorteador', () => {
  it('sai igual com a mesma semente, diferente com outra, sempre em [0, 1)', () => {
    const a = sorteador(42)
    const b = sorteador(42)
    const c = sorteador(43)
    const da = Array.from({ length: 200 }, a)
    expect(Array.from({ length: 200 }, b)).toEqual(da)
    expect(Array.from({ length: 200 }, c)).not.toEqual(da)
    for (const x of da) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})

describe('espalhar', () => {
  const e = espalhar(OPCOES)

  it('sai igual toda vez', () => {
    expect(espalhar(OPCOES).pontos).toEqual(e.pontos)
    expect(e.pontos.length).toBeGreaterThan(100)
  })

  it('nenhum par fica mais perto que a distância mínima, contando a volta pela emenda', () => {
    let pertoDaEmenda = 0
    for (let i = 0; i < e.pontos.length; i += 1) {
      const p = e.pontos[i]
      if (p.x < 0.03 || p.x > 0.97) pertoDaEmenda += 1
      for (let j = i + 1; j < e.pontos.length; j += 1) {
        const q = e.pontos[j]
        expect(distanciaNaVolta(p.x, p.y, q.x, q.y)).toBeGreaterThanOrEqual(OPCOES.distanciaMinima(p, q) - 1e-12)
      }
    }
    // Há pontos encostados na emenda (o teste de cima mediu a volta de verdade).
    expect(pertoDaEmenda).toBeGreaterThan(0)
  })

  it('o "fica" decide onde há mais pontos (o lado direito, mais cheio)', () => {
    const esquerda = e.pontos.filter((p) => p.x < 0.5).length
    const direita = e.pontos.length - esquerda
    expect(direita).toBeGreaterThan(esquerda)
  })
})

describe('busca pelos pontos', () => {
  const e = espalhar(OPCOES)
  const amostras = Array.from({ length: 300 }, (_, k) => [((k * 0.618034) % 1) * 1.0, ((k * 0.414214) % 1) * 1.0] as const)
  amostras.push([0, 0], [0.999, 0.5], [0.5, 0.999], [0.001, 0.999])

  it('pontosPerto acha todo ponto dentro do alcance, uma vez só, com (dx, dy) pela volta', () => {
    const alcance = 0.07
    for (const [u, v] of amostras) {
      const achados: number[] = []
      pontosPerto(e, u, v, alcance, (p, dx, dy, i) => {
        expect(dx).toBeCloseTo(naVolta(u - p.x), 12)
        expect(dy).toBeCloseTo(naVolta(v - p.y), 12)
        if (Math.hypot(dx, dy) < alcance) achados.push(i)
      })
      const esperados = e.pontos.flatMap((p, i) => (distanciaNaVolta(u, v, p.x, p.y) < alcance ? [i] : []))
      expect([...achados].sort((a, b) => a - b)).toEqual(esperados)
    }
  })

  it('pontosQueAlcancam acha todo ponto cujo alcance cobre o lugar', () => {
    const alcanceDe = (p: { r: number }) => p.r * 1.6
    const c = cobertura(e, alcanceDe, 24)
    for (const [u, v] of amostras) {
      const achados = new Set<number>()
      pontosQueAlcancam(e, c, u, v, (p, dx, dy, i) => {
        if (Math.hypot(dx, dy) < alcanceDe(p)) achados.add(i)
      })
      const esperados = e.pontos.flatMap((p, i) => (distanciaNaVolta(u, v, p.x, p.y) < alcanceDe(p) ? [i] : []))
      expect([...achados].sort((a, b) => a - b)).toEqual(esperados)
    }
  })
})
