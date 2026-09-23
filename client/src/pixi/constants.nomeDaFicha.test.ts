import { describe, expect, it } from 'vitest'
import { SIGNAL_COLORS } from '../lib/signals'
import { TOKEN_NAME_FILL_COLOR, TOKEN_NAME_OUTLINE_COLOR } from './constants'

// O serrilhado de uma letra mistura a tinta com o contorno: cada pixel da
// borda é um ponto da rampa tinta↔contorno. As jornadas leem "tem sinal na
// tela" contando pixels a ±20 por canal da cor de sinal do jogador; se a
// rampa do nome passa por essa cor, o nome de uma ficha vira "sinal" sem
// ninguém ter sinalizado (medido: 16 pixels a 2,6x de zoom, régua
// e2e/task-jornada-zoom-no-celular.spec.ts, teste 2).

type Rgb = readonly [number, number, number]

const rgbDeNumero = (cor: number): Rgb => [(cor >> 16) & 0xff, (cor >> 8) & 0xff, cor & 0xff]
const rgbDeHex = (hex: string): Rgb => rgbDeNumero(Number.parseInt(hex.slice(1), 16))

/** Tolerância por canal com que as jornadas reconhecem a cor do sinal na foto da tela. */
const TOLERANCIA_DA_REGUA = 20
/** Folga para o arredondamento de 8 bits do canvas do texto e do filtro da GPU. */
const FOLGA_DE_ARREDONDAMENTO = 5
const PASSOS_DA_RAMPA = 2000

/** Menor distância (maior diferença entre canais) de um ponto da rampa tinta↔contorno até `cor`. */
function distanciaDaRampa(tinta: Rgb, contorno: Rgb, cor: Rgb): number {
  let menor = Number.POSITIVE_INFINITY
  for (let passo = 0; passo <= PASSOS_DA_RAMPA; passo += 1) {
    const t = passo / PASSOS_DA_RAMPA
    let maior = 0
    for (let canal = 0; canal < 3; canal += 1) {
      const valor = contorno[canal] + t * (tinta[canal] - contorno[canal])
      maior = Math.max(maior, Math.abs(valor - cor[canal]))
    }
    menor = Math.min(menor, maior)
  }
  return menor
}

/** Luminância relativa da WCAG 2.x. */
function luminancia(cor: Rgb): number {
  const linear = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(cor[0]) + 0.7152 * linear(cor[1]) + 0.0722 * linear(cor[2])
}

function contraste(a: Rgb, b: Rgb): number {
  const [clara, escura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (clara + 0.05) / (escura + 0.05)
}

const TINTA = rgbDeNumero(TOKEN_NAME_FILL_COLOR)
const CONTORNO = rgbDeNumero(TOKEN_NAME_OUTLINE_COLOR)

describe('nome da ficha no mapa do jogador: tinta e contorno', () => {
  it('controle: com branco e preto puros, o serrilhado passa por #a1887f (a regra morde)', () => {
    expect(distanciaDaRampa([255, 255, 255], [0, 0, 0], rgbDeHex('#a1887f'))).toBeLessThanOrEqual(TOLERANCIA_DA_REGUA)
  })

  it('a paleta de sinais tem cores para comparar', () => {
    expect(SIGNAL_COLORS.length).toBeGreaterThan(0)
  })

  it.each(SIGNAL_COLORS)('o serrilhado entre tinta e contorno nunca passa pela cor de sinal %s', (hex) => {
    expect(distanciaDaRampa(TINTA, CONTORNO, rgbDeHex(hex))).toBeGreaterThan(TOLERANCIA_DA_REGUA + FOLGA_DE_ARREDONDAMENTO)
  })

  it('o contorno continua quase preto: contraste com a tinta acima de 18:1 (preto puro dá 21:1)', () => {
    expect(contraste(TINTA, CONTORNO)).toBeGreaterThan(18)
  })
})
