import { describe, expect, it } from 'vitest'
import { geometriaDaCerca } from '../../../lib/mobilia'
import { oklabDoRgb, type OpcaoDeMaterial, type Oklab } from '../materiais'
import { G } from './contexto'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel } from './index'
import { ALFA_DE_PECA, ALFA_OPACO, distanciaOklab } from './medidas.testkit'
import type { LimitesDaImagem } from './motor'

/**
 * As correções da revisão da MT3 (designer e revisor de testes), cada uma
 * medida nos pixels: a cerca curva segue o arco, a corda não se confunde com o
 * pinho, e o resto nos blocos abaixo.
 */

interface Imagem {
  readonly limites: LimitesDaImagem
  readonly pixels: Uint8ClampedArray
}

/** O pixel da imagem que cobre o ponto (x, y) em px do protótipo, ou -1 fora dela. */
function indice(im: Imagem, S: number, x: number, y: number): number {
  const i = Math.floor((x - im.limites.x0) * S)
  const j = Math.floor((y - im.limites.y0) * S)
  if (i < 0 || j < 0 || i >= im.limites.W || j >= im.limites.H) return -1
  return (j * im.limites.W + i) * 4
}

function alfaEm(im: Imagem, S: number, x: number, y: number): number {
  const o = indice(im, S, x, y)
  return o < 0 ? 0 : im.pixels[o + 3]
}

/** OKLab médio dos pixels opacos cujo centro passa em `dentro` (px do protótipo). */
function oklabOnde(im: Imagem, S: number, dentro: (x: number, y: number) => boolean): Oklab {
  let L = 0
  let a = 0
  let b = 0
  let n = 0
  for (let j = 0; j < im.limites.H; j += 1) {
    for (let i = 0; i < im.limites.W; i += 1) {
      const o = (j * im.limites.W + i) * 4
      if (im.pixels[o + 3] < ALFA_OPACO) continue
      if (!dentro(im.limites.x0 + (i + 0.5) / S, im.limites.y0 + (j + 0.5) / S)) continue
      const [Li, ai, bi] = oklabDoRgb(im.pixels[o], im.pixels[o + 1], im.pixels[o + 2])
      L += Li
      a += ai
      b += bi
      n += 1
    }
  }
  if (n === 0) throw new Error('nenhum pixel na região')
  return [L / n, a / n, b / n]
}

function cerca(casasW: number, materiais: readonly OpcaoDeMaterial[], curva = 0): DesenhoDoMovel {
  return { tipo: 'cerca', lado: 'frente', materiais, casasW, casasH: 0.25, semente: 7, curva }
}

describe('A1: a ligação da cerca curva segue o arco (os mourões ficam onde a seleção e o clique os esperam)', () => {
  /** A da folha (90° em 3 casas) e a do app (120° em 150 px de grade 50 = 3 casas). */
  const CURVAS = [90, 120, -120, 180] as const
  const RAIO_DO_ARAME = 0.9
  const AFASTAMENTO_DO_ARAME = 1.3

  for (const nivel of [1, 3]) {
    const S = escalaDoNivel(nivel)
    for (const curva of CURVAS) {
      it(`${curva}° em 3 casas, nível ${nivel}: no MEIO do arco entre dois mourões há vara e corda opacas; os dois fios do arame passam a R ± 1,3`, () => {
        const geometria = geometriaDaCerca(3 * G, 0.25 * G, curva)
        if (geometria === null || geometria.arco === null) throw new Error('cerca sem arco')
        const { center, radius, startAngle, sweep } = geometria.arco
        const vaos = geometria.mouroes.length - 1
        const meio = (i: number, r: number): [number, number] => {
          const a = startAngle + (sweep * (i + 0.5)) / vaos
          return [center.x + Math.cos(a) * r, center.y + Math.sin(a) * r]
        }
        for (const ligacao of ['varas', 'corda'] as const) {
          const im = pintarMovel(cerca(3, ['carvalho', ligacao], curva), S)
          for (let i = 0; i < vaos; i += 1) {
            const [x, y] = meio(i, radius)
            expect(alfaEm(im, S, x, y), `${ligacao}, vão ${i}`).toBeGreaterThanOrEqual(ALFA_OPACO)
          }
        }
        const arame = pintarMovel(cerca(3, ['velha', 'arame'], curva), S)
        for (let i = 0; i < vaos; i += 1) {
          for (const lado of [-1, 1]) {
            const [x, y] = meio(i, radius + lado * AFASTAMENTO_DO_ARAME)
            expect(alfaEm(arame, S, x, y), `arame, vão ${i}, lado ${lado}`).toBeGreaterThanOrEqual(ALFA_DE_PECA)
          }
          // Entre os dois fios, no raio do eixo, o chão aparece (não é um fio grosso só): só no nível 3 o vão tem um pixel inteiro.
          if (nivel === 3) {
            const [x, y] = meio(i, radius)
            expect(alfaEm(arame, S, x, y), `arame, vão ${i}, eixo`).toBeLessThan(ALFA_OPACO)
          }
        }
        expect(RAIO_DO_ARAME).toBeLessThan(AFASTAMENTO_DO_ARAME)
      })
    }
  }

  it('a cerca reta continua reta: no eixo, entre os mourões, a vara é opaca de ponta a ponta', () => {
    const S = escalaDoNivel(3)
    const geometria = geometriaDaCerca(3 * G, 0.25 * G, 0)
    if (geometria === null) throw new Error('cerca sem geometria')
    const im = pintarMovel(cerca(3, ['carvalho', 'varas']), S)
    for (let i = 1; i < geometria.mouroes.length; i += 1) {
      const a = geometria.mouroes[i - 1].x + geometria.raio
      const b = geometria.mouroes[i].x - geometria.raio
      for (let t = 0.1; t <= 0.9; t += 0.1) expect(alfaEm(im, S, a + (b - a) * t, 0)).toBeGreaterThanOrEqual(ALFA_OPACO)
    }
  })
})

describe('A6: a corda é palha clara, longe do pinho dos mourões', () => {
  /** Distância OKLab mínima entre a corda e o topo dos mourões de pinho (antes: 0,035 a 0,045). */
  const DISTANCIA_MINIMA = 0.06

  for (const nivel of [1, 3]) {
    it(`cerca reta de pinho e corda no nível ${nivel}: a cor média da corda fica a ≥ ${DISTANCIA_MINIMA} do topo dos mourões, mais clara e mais cinza`, () => {
      const S = escalaDoNivel(nivel)
      const geometria = geometriaDaCerca(2 * G, 0.25 * G, 0)
      if (geometria === null) throw new Error('cerca sem geometria')
      const im = pintarMovel(cerca(2, ['pinho', 'corda']), S)
      const rp = geometria.raio
      const xs = geometria.mouroes.map((m) => m.x)
      const naCorda = (x: number, y: number): boolean => Math.abs(y) < 0.8 && xs.some((m, i) => i > 0 && x > xs[i - 1] + rp * 1.6 && x < m - rp * 1.6)
      const noTopo = (x: number, y: number): boolean => xs.some((m) => Math.hypot(x - m, y) < rp * 0.6)
      const corda = oklabOnde(im, S, naCorda)
      const topo = oklabOnde(im, S, noTopo)
      expect(distanciaOklab(corda, topo)).toBeGreaterThanOrEqual(DISTANCIA_MINIMA)
      // Mais clara (L) e menos colorida (croma) que o pinho.
      expect(corda[0]).toBeGreaterThan(topo[0])
      expect(Math.hypot(corda[1], corda[2])).toBeLessThan(Math.hypot(topo[1], topo[2]))
    })
  }

  it('a torção se lê no nível 1: no eixo da corda a luz sobe e desce de novo a cada ~8 pixels, com amplitude de ≥ 8% do brilho', () => {
    const S = escalaDoNivel(1)
    const geometria = geometriaDaCerca(2 * G, 0.25 * G, 0)
    if (geometria === null) throw new Error('cerca sem geometria')
    const im = pintarMovel(cerca(2, ['pinho', 'corda']), S)
    const rp = geometria.raio
    const [m0, m1] = geometria.mouroes
    const brilhos: number[] = []
    for (let x = m0.x + rp * 1.6; x < m1.x - rp * 1.6; x += 1 / S) {
      const o = indice(im, S, x, 0)
      brilhos.push(0.2126 * im.pixels[o] + 0.7152 * im.pixels[o + 1] + 0.0722 * im.pixels[o + 2])
    }
    const media = brilhos.reduce((s, b) => s + b, 0) / brilhos.length
    let vales = 0
    for (let i = 1; i + 1 < brilhos.length; i += 1) if (brilhos[i] < brilhos[i - 1] && brilhos[i] <= brilhos[i + 1] && brilhos[i] < media) vales += 1
    expect(vales).toBeGreaterThanOrEqual(3)
    expect((Math.max(...brilhos) - Math.min(...brilhos)) / media).toBeGreaterThanOrEqual(0.08)
  })
})
