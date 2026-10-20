import { describe, expect, it } from 'vitest'
import { BEIRAL_PX, type PontoDoTelhado } from '../lib/telhado/aguas'
import { COR_PADRAO_DO_TETO, PALETA_DO_TETO, corPadraoDoModelo } from '../lib/telhado/paletas'
import { MAXIMO_DE_PIXELS_DO_TELHADO, escalaDoTelhado, pintarTelhado, type ImagemDoTelhado } from './telhado'

/**
 * TEXTURA DO TELHADO: telha colonial e madeira em tábuas, pintadas na CPU a
 * partir das águas. O teste mede os pixels: mesma entrada dá os mesmos
 * bytes, a cor escolhida manda no tom, fora do beiral é transparente e a
 * água virada para a luz (cima à esquerda) é a mais clara.
 */

const p = (x: number, y: number): PontoDoTelhado => ({ x, y })
const RET = [p(40, 60), p(320, 60), p(320, 220), p(40, 220)]
const L = [p(0, 0), p(240, 0), p(240, 100), p(100, 100), p(100, 240), p(0, 240)]

function pixel(img: ImagemDoTelhado, x: number, y: number): [number, number, number, number] {
  const ix = Math.floor((x - img.origemX) * img.escala)
  const iy = Math.floor((y - img.origemY) * img.escala)
  const i = (iy * img.largura + ix) * 4
  return [img.pixels[i], img.pixels[i + 1], img.pixels[i + 2], img.pixels[i + 3]]
}

/** Luz média (0-255) de uma janela do mapa, só nos pixels cheios. */
function luzMedia(img: ImagemDoTelhado, x0: number, y0: number, x1: number, y1: number): number {
  let soma = 0
  let n = 0
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const [r, g, b, a] = pixel(img, x + 0.5, y + 0.5)
      if (a < 255) continue
      soma += 0.2126 * r + 0.7152 * g + 0.0722 * b
      n += 1
    }
  }
  return soma / n
}

/** Cor média dos pixels cheios da imagem inteira. */
function corMedia(img: ImagemDoTelhado): [number, number, number] {
  const soma = [0, 0, 0]
  let n = 0
  for (let i = 0; i < img.pixels.length; i += 4) {
    if (img.pixels[i + 3] < 255) continue
    soma[0] += img.pixels[i]
    soma[1] += img.pixels[i + 1]
    soma[2] += img.pixels[i + 2]
    n += 1
  }
  return [soma[0] / n, soma[1] / n, soma[2] / n]
}

const hexParaRgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

describe('pintarTelhado', () => {
  it('mesma entrada, mesmos pixels (telhas e madeira)', () => {
    for (const modelo of ['telhas', 'madeira'] as const) {
      const a = pintarTelhado(L, modelo, PALETA_DO_TETO[modelo][2].hex, 1)
      const b = pintarTelhado(L, modelo, PALETA_DO_TETO[modelo][2].hex, 1)
      expect(a.largura).toBeGreaterThan(0)
      expect(b.pixels).toEqual(a.pixels)
    }
  })

  it('a imagem cobre o polígono mais o beiral, na escala pedida', () => {
    const um = pintarTelhado(RET, 'telhas', COR_PADRAO_DO_TETO, 1)
    expect(um.origemX).toBeLessThanOrEqual(40 - BEIRAL_PX)
    expect(um.origemY).toBeLessThanOrEqual(60 - BEIRAL_PX)
    expect(um.origemX + um.largura).toBeGreaterThanOrEqual(320 + BEIRAL_PX)
    expect(um.pixels.length).toBe(um.largura * um.altura * 4)
    const dois = pintarTelhado(RET, 'telhas', COR_PADRAO_DO_TETO, 2)
    expect(dois.escala).toBe(2)
    expect(dois.largura).toBe(um.largura * 2)
  })

  it('fora do polígono + beiral é transparente; no beiral e dentro é cheio', () => {
    const img = pintarTelhado(L, 'madeira', PALETA_DO_TETO.madeira[0].hex, 1)
    expect(pixel(img, 180, 180)[3]).toBe(0) // o vão do L
    expect(pixel(img, 100 + BEIRAL_PX + 2, 170)[3]).toBe(0) // logo além do beiral
    expect(pixel(img, 100 + BEIRAL_PX / 2, 170)[3]).toBe(255) // no beiral
    expect(pixel(img, 50, 50)[3]).toBe(255) // dentro
    const ret = pintarTelhado(RET, 'telhas', COR_PADRAO_DO_TETO, 1)
    // Primeira linha da imagem: o centro do pixel fica meio px além da ponta do beiral.
    expect(ret.origemY).toBe(60 - BEIRAL_PX - 1)
    expect(pixel(ret, 180, ret.origemY + 0.2)[3]).toBe(0)
    expect(pixel(ret, 180, 60 - BEIRAL_PX + 2.5)[3]).toBe(255)
  })

  it('a água virada para a luz (oeste, norte) é mais clara que a oposta (leste, sul)', () => {
    for (const modelo of ['telhas', 'madeira'] as const) {
      const img = pintarTelhado(RET, modelo, corPadraoDoModelo(modelo), 1)
      // Janelas no meio de cada água, longe dos espigões e da cumeeira.
      const oeste = luzMedia(img, 44, 110, 84, 170)
      const leste = luzMedia(img, 276, 110, 316, 170)
      const norte = luzMedia(img, 150, 64, 210, 104)
      const sul = luzMedia(img, 150, 176, 210, 216)
      expect(oeste).toBeGreaterThan(leste * 1.12)
      expect(norte).toBeGreaterThan(sul * 1.08)
    }
  })

  it('a cor manda no tom: a média fica perto da cor escolhida, e a cor livre passa pelo mesmo caminho', () => {
    for (const modelo of ['telhas', 'madeira'] as const) {
      for (const cor of [...PALETA_DO_TETO[modelo].map((c) => c.hex), '#3f7fbf', '#d8c8a0']) {
        const media = corMedia(pintarTelhado(RET, modelo, cor, 1))
        const alvo = hexParaRgb(cor)
        for (let c = 0; c < 3; c += 1) expect(Math.abs(media[c] - alvo[c])).toBeLessThan(26)
      }
    }
    const livre = corMedia(pintarTelhado(RET, 'telhas', '#3f7fbf', 1))
    const barro = corMedia(pintarTelhado(RET, 'telhas', COR_PADRAO_DO_TETO, 1))
    expect(livre[2]).toBeGreaterThan(barro[2] + 60)
    expect(livre[0]).toBeLessThan(barro[0] - 40)
  })

  it('não é chapado: a telha e a tábua têm desenho (desvio da luz dentro de uma água)', () => {
    for (const modelo of ['telhas', 'madeira'] as const) {
      const img = pintarTelhado(RET, modelo, corPadraoDoModelo(modelo), 1)
      const luzes: number[] = []
      for (let y = 66; y < 100; y += 1) for (let x = 150; x < 210; x += 1) luzes.push(luzMedia(img, x, y, x + 1, y + 1))
      const media = luzes.reduce((a, b) => a + b, 0) / luzes.length
      const desvio = Math.sqrt(luzes.reduce((a, b) => a + (b - media) ** 2, 0) / luzes.length)
      expect(desvio).toBeGreaterThan(4)
      // ...mas contido: nada de listra estourada.
      expect(desvio).toBeLessThan(26)
    }
  })

  it('cor inválida vira a padrão do modelo; modelo desconhecido vira telhas', () => {
    const padrao = pintarTelhado(RET, 'madeira', corPadraoDoModelo('madeira'), 1)
    expect(pintarTelhado(RET, 'madeira', 'vermelho', 1).pixels).toEqual(padrao.pixels)
    const telhas = pintarTelhado(RET, 'telhas', COR_PADRAO_DO_TETO, 1)
    expect(pintarTelhado(RET, 'palha' as 'telhas', COR_PADRAO_DO_TETO, 1).pixels).toEqual(telhas.pixels)
  })

  it('polígono quebrado: imagem vazia, sem lançar', () => {
    for (const q of [[], [p(0, 0), p(1, 1)], [p(0, 0), p(10, 0), p(20, 0)], null as unknown as PontoDoTelhado[]]) {
      const img = pintarTelhado(q, 'telhas', COR_PADRAO_DO_TETO, 1)
      expect(img.largura).toBe(0)
      expect(img.pixels.length).toBe(0)
    }
  })

  it('escala estranha não explode a memória', () => {
    expect(pintarTelhado(RET, 'telhas', COR_PADRAO_DO_TETO, Number.NaN).escala).toBe(1)
    expect(pintarTelhado(RET, 'telhas', COR_PADRAO_DO_TETO, -2).escala).toBe(1)
    // Pintar no teto de pixels custa segundos; a conta da escala é conferida sozinha.
    const k = escalaDoTelhado(296, 176, 1e6)
    expect(Math.ceil(296 * k) * Math.ceil(176 * k)).toBeLessThanOrEqual(MAXIMO_DE_PIXELS_DO_TELHADO)
    expect(escalaDoTelhado(296, 176, 2)).toBe(2)
  })
})
