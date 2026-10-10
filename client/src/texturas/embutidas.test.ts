/**
 * A BIBLIOTECA INICIAL medida, não só olhada: cada ladrilho
 * - repete sem emenda (a diferença entre a última coluna e a primeira é a de
 *   duas colunas vizinhas quaisquer);
 * - não estoura: sem branco puro, saturação no máximo a das cores de bioma do
 *   mapa do usuário (a mais forte, o #bd993f das dunas, tem croma 0,49), e o
 *   contraste de luz contido;
 * - não tem listra fina: a variação de pixel para pixel é pequena e parecida
 *   nas duas direções;
 * - sai igual toda vez (cada tela pinta a sua, e todas precisam ver o mesmo).
 */
import { describe, expect, it } from 'vitest'
import { TEXTURAS_EMBUTIDAS } from './embutidas'
import { pixelsDoLadrilho } from './ladrilhos'

const LADO = 128

interface Medidas {
  emendaX: number
  emendaY: number
  vizinhoX: number
  vizinhoY: number
  maiorCanal: number
  cromaMedia: number
  cromaMaxima: number
  desvioDaLuz: number
  faixaDaLuz: number
}

function luzDe(d: Uint8ClampedArray, i: number): number {
  return (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
}

function medir(d: Uint8ClampedArray, lado: number): Medidas {
  const L = (x: number, y: number) => luzDe(d, (y * lado + x) * 4)
  let emendaX = 0
  let emendaY = 0
  let vizinhoX = 0
  let vizinhoY = 0
  for (let k = 0; k < lado; k += 1) {
    emendaX += Math.abs(L(lado - 1, k) - L(0, k))
    emendaY += Math.abs(L(k, lado - 1) - L(k, 0))
  }
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado - 1; x += 1) {
      vizinhoX += Math.abs(L(x + 1, y) - L(x, y))
      vizinhoY += Math.abs(L(y, x + 1) - L(y, x))
    }
  }
  const luzes: number[] = []
  let maiorCanal = 0
  let somaCroma = 0
  let cromaMaxima = 0
  for (let i = 0; i < d.length; i += 4) {
    maiorCanal = Math.max(maiorCanal, d[i], d[i + 1], d[i + 2])
    const croma = (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) / 255
    somaCroma += croma
    cromaMaxima = Math.max(cromaMaxima, croma)
    luzes.push(luzDe(d, i))
  }
  const media = luzes.reduce((a, b) => a + b, 0) / luzes.length
  const desvio = Math.sqrt(luzes.reduce((a, b) => a + (b - media) ** 2, 0) / luzes.length)
  const ordem = [...luzes].sort((a, b) => a - b)
  const faixa = ordem[Math.floor(ordem.length * 0.99)] - ordem[Math.floor(ordem.length * 0.01)]
  return {
    emendaX: emendaX / lado,
    emendaY: emendaY / lado,
    vizinhoX: vizinhoX / (lado * (lado - 1)),
    vizinhoY: vizinhoY / (lado * (lado - 1)),
    maiorCanal,
    cromaMedia: somaCroma / (d.length / 4),
    cromaMaxima,
    desvioDaLuz: desvio,
    faixaDaLuz: faixa,
  }
}

describe('biblioteca inicial de texturas', () => {
  it('tem as nove texturas pedidas, com id e nome únicos', () => {
    const ids = TEXTURAS_EMBUTIDAS.map((t) => t.id)
    expect(ids).toEqual(['areia', 'duna', 'grama', 'floresta', 'pinheiros', 'pantano', 'terra', 'pedra', 'neve'])
    expect(new Set(TEXTURAS_EMBUTIDAS.map((t) => t.nome)).size).toBe(ids.length)
  })

  for (const textura of TEXTURAS_EMBUTIDAS) {
    describe(textura.nome, () => {
      const pixels = pixelsDoLadrilho(textura.cor, LADO)
      const m = medir(pixels, LADO)

      it('repete sem emenda nas duas direções', () => {
        // A emenda é só mais um par de vizinhos: no máximo 1,6 vez a média deles (e algum ruído de amostra).
        expect(m.emendaX).toBeLessThanOrEqual(m.vizinhoX * 1.6 + 0.004)
        expect(m.emendaY).toBeLessThanOrEqual(m.vizinhoY * 1.6 + 0.004)
      })

      it('não estoura: sem branco puro, saturação e contraste contidos', () => {
        expect(m.maiorCanal).toBeLessThanOrEqual(245)
        expect(m.cromaMaxima).toBeLessThanOrEqual(0.5)
        expect(m.cromaMedia).toBeLessThanOrEqual(0.42)
        expect(m.desvioDaLuz).toBeLessThanOrEqual(0.09)
        expect(m.faixaDaLuz).toBeLessThanOrEqual(0.4)
      })

      it('não tem listra fina: pouca variação de pixel a pixel, igual nas duas direções', () => {
        expect(m.vizinhoX).toBeLessThanOrEqual(0.035)
        expect(m.vizinhoY).toBeLessThanOrEqual(0.035)
        const razao = m.vizinhoX / m.vizinhoY
        expect(razao).toBeGreaterThan(0.6)
        expect(razao).toBeLessThan(1 / 0.6)
      })

      it('sai igual toda vez, e a volta inteira (u + 1) cai na mesma cor', () => {
        expect(pixelsDoLadrilho(textura.cor, 16)).toEqual(pixelsDoLadrilho(textura.cor, 16))
        for (const [u, v] of [
          [0.13, 0.71],
          [0.5, 0.02],
          [0.97, 0.44],
        ]) {
          const a = textura.cor(u, v)
          const b = textura.cor(u + 1, v + 1)
          for (const desloca of [16, 8, 0]) expect(Math.abs(((a >> desloca) & 255) - ((b >> desloca) & 255))).toBeLessThanOrEqual(2)
        }
      })
    })
  }
})
