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
const BRANCO: Rgb = [255, 255, 255]
const PRETO: Rgb = [0, 0, 0]

describe('nome da ficha no mapa do jogador: tinta e contorno', () => {
  it('controle: com branco e preto puros, o serrilhado passa por #a1887f e longe de #81c784 (a regra morde e separa)', () => {
    // Morde: o cinza 144 fica a 17 por canal de #a1887f, dentro da régua.
    expect(distanciaDaRampa(BRANCO, PRETO, rgbDeHex('#a1887f'))).toBeLessThanOrEqual(TOLERANCIA_DA_REGUA)
    // Separa: #81c784 é a cor de sinal mais perto dos cinzas depois de #a1887f
    // (35 por canal). Sem esta linha, uma medida que desse "perto" para toda cor
    // passaria na de cima sem medir nada.
    expect(distanciaDaRampa(BRANCO, PRETO, rgbDeHex('#81c784'))).toBeGreaterThan(TOLERANCIA_DA_REGUA + FOLGA_DE_ARREDONDAMENTO)
  })

  it('a paleta de sinais tem cores para comparar', () => {
    expect(SIGNAL_COLORS.length).toBeGreaterThan(0)
  })

  it.each(SIGNAL_COLORS)('o serrilhado entre tinta e contorno nunca passa pela cor de sinal %s', (hex) => {
    expect(distanciaDaRampa(TINTA, CONTORNO, rgbDeHex(hex))).toBeGreaterThan(TOLERANCIA_DA_REGUA + FOLGA_DE_ARREDONDAMENTO)
  })

  // A régua do laser do jogador (e2e/task-jornada-laser-do-jogador.spec.ts)
  // conta "chão de cena" por matiz: verde-água quando G e B passam de 1,8·R+8
  // e ficam a menos de 30 um do outro; magenta, o mesmo com R e B sobre G. O
  // contorno 0x000f28 (0,15,40) era verde-água puro: o nome 'Machado' punha
  // 158 pixels "do Salão" na tela de quem estava na Cripta.
  const verdeAgua = ([r, g, b]: Rgb) => g > r * 1.8 + 8 && b > r * 1.8 + 8 && Math.abs(g - b) < 30
  const magenta = ([r, g, b]: Rgb) => r > g * 1.8 + 8 && b > g * 1.8 + 8 && Math.abs(r - b) < 30

  it('controle: o contorno antigo 0x000f28 lia como chão verde-água (a regra morde)', () => {
    expect(verdeAgua(rgbDeNumero(0x000f28))).toBe(true)
  })

  it('nenhum ponto da rampa tinta↔contorno lê como chão de cena (verde-água ou magenta)', () => {
    const lidos: string[] = []
    for (let passo = 0; passo <= PASSOS_DA_RAMPA; passo += 1) {
      const t = passo / PASSOS_DA_RAMPA
      const ponto = [0, 1, 2].map((c) => Math.round(CONTORNO[c] + t * (TINTA[c] - CONTORNO[c]))) as unknown as Rgb
      if (verdeAgua(ponto) || magenta(ponto)) lidos.push(ponto.join(','))
    }
    expect(lidos).toEqual([])
  })

  it('o contorno continua quase preto: contraste com a tinta acima de 18:1 (preto puro dá 21:1)', () => {
    expect(contraste(TINTA, CONTORNO)).toBeGreaterThan(18)
  })
})
