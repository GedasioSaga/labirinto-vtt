import { describe, expect, it } from 'vitest'
import { dentroDoPoligono, prepararAguas, type PontoDoTelhado } from '../lib/telhado/aguas'
import { PALETA_DO_TETO, type ModeloDoTeto } from '../lib/telhado/paletas'
import { comecarTelhado, pintarTelhado, type ImagemDoTelhado } from './telhado'
import { alcanceDaChamine, caixaDaChamine, chamineDoPoligono, LADO_DA_CHAMINE_PX, type CaixaNoMapa } from './meioTermo/chamine'
import { luminanciaDoRgb } from './meioTermo/barranco'

/** Os mesmos bytes (sem Buffer: o tsconfig do app não tem os tipos do Node). */
function mesmosBytes(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false
  return true
}

/**
 * CHAMINÉ no telhado (fatia MT10, `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`
 * seção 3): quadrada, de pedra, com face lateral, juntas, boca de metal e
 * sombra no telhado, na água de trás, a meio caminho entre o beiral e o cume.
 * O aceite é o do protótipo aprovado (`vila-meio-termo/README.md`, prova k):
 * a chaminé muda de 83% a 100% da caixa dela contra o MESMO telhado pintado
 * sem ela. Fora do alcance dela (corpo, face e sombra), nenhum byte muda.
 */

const CASA = 50
const DIFERENCA = 8

function sala(casasW: number, casasH: number): readonly PontoDoTelhado[] {
  return [{ x: 0, y: 0 }, { x: casasW * CASA, y: 0 }, { x: casasW * CASA, y: casasH * CASA }, { x: 0, y: casasH * CASA }]
}
const EL: readonly PontoDoTelhado[] = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 150 }, { x: 150, y: 150 }, { x: 150, y: 300 }, { x: 0, y: 300 }]
const COR: Record<ModeloDoTeto, string> = { telhas: PALETA_DO_TETO.telhas[0].hex, madeira: PALETA_DO_TETO.madeira[0].hex, palha: PALETA_DO_TETO.palha[0].hex }
const MODELOS: readonly ModeloDoTeto[] = ['telhas', 'madeira', 'palha']

/** Percorre os pixels da imagem cujo centro (em px do mapa) cai dentro de `caixa` (ou fora, com `fora`). */
function cadaPixel(img: ImagemDoTelhado, caixa: CaixaNoMapa, fora: boolean, visita: (o: number) => void): void {
  for (let py = 0; py < img.altura; py += 1) {
    const y = img.origemY + (py + 0.5) / img.escala
    for (let px = 0; px < img.largura; px += 1) {
      const x = img.origemX + (px + 0.5) / img.escala
      const dentro = x >= caixa.x0 && x <= caixa.x1 && y >= caixa.y0 && y <= caixa.y1
      if (dentro !== fora) visita((py * img.largura + px) * 4)
    }
  }
}

function difere(a: Uint8ClampedArray, b: Uint8ClampedArray, o: number): boolean {
  return Math.max(Math.abs(a[o] - b[o]), Math.abs(a[o + 1] - b[o + 1]), Math.abs(a[o + 2] - b[o + 2])) >= DIFERENCA
}

function fracaoQueMuda(com: ImagemDoTelhado, sem: ImagemDoTelhado, caixa: CaixaNoMapa): number {
  let total = 0
  let mudou = 0
  cadaPixel(com, caixa, false, (o) => {
    total += 1
    if (difere(com.pixels, sem.pixels, o)) mudou += 1
  })
  return total === 0 ? 0 : mudou / total
}

function bytesForaIguais(com: ImagemDoTelhado, sem: ImagemDoTelhado, caixa: CaixaNoMapa): number {
  let diferentes = 0
  cadaPixel(com, caixa, true, (o) => {
    for (let c = 0; c < 4; c += 1) if (com.pixels[o + c] !== sem.pixels[o + c]) diferentes += 1
  })
  return diferentes
}

function saturacaoHsv(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max
}

describe('chaminé: onde ela fica', () => {
  it('na água de trás (a de cima), a meio caminho do beiral ao cume, na metade da direita, inteira dentro da sala', () => {
    for (const [poligono, alturaDaAgua] of [
      [sala(4, 3), 75],
      [sala(6, 4), 100],
      [sala(3, 2), 50],
    ] as const) {
      const c = chamineDoPoligono(poligono)
      expect(c).not.toBeNull()
      if (c === null) continue
      const geo = prepararAguas(poligono)
      if (geo === null) throw new Error('polígono inválido')
      const largura = poligono[1].x
      expect(c.x).toBeGreaterThan(largura / 2)
      expect(c.y).toBeGreaterThan(0.3 * alturaDaAgua)
      expect(c.y).toBeLessThan(0.7 * alturaDaAgua)
      const caixa = caixaDaChamine(c)
      for (const [x, y] of [[caixa.x0, caixa.y0], [caixa.x1, caixa.y0], [caixa.x0, caixa.y1], [caixa.x1, caixa.y1]]) {
        expect(dentroDoPoligono(geo, x, y)).toBe(true)
      }
      expect(caixa.x1 - caixa.x0).toBeGreaterThanOrEqual(LADO_DA_CHAMINE_PX)
    }
  })

  it('na sala em L também cai dentro, e a mesma sala dá sempre o mesmo lugar', () => {
    const c = chamineDoPoligono(EL)
    const geo = prepararAguas(EL)
    expect(c).not.toBeNull()
    if (c === null || geo === null) return
    const caixa = caixaDaChamine(c)
    for (const [x, y] of [[caixa.x0, caixa.y0], [caixa.x1, caixa.y0], [caixa.x0, caixa.y1], [caixa.x1, caixa.y1]]) {
      expect(dentroDoPoligono(geo, x, y)).toBe(true)
    }
    expect(chamineDoPoligono(EL)).toEqual(c)
  })

  it('sala pequena demais fica sem chaminé, sem lançar e com os mesmos bytes', () => {
    const minuscula: readonly PontoDoTelhado[] = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }]
    expect(chamineDoPoligono(minuscula)).toBeNull()
    const com = pintarTelhado(minuscula, 'telhas', COR.telhas, 2, { chamine: true })
    const sem = pintarTelhado(minuscula, 'telhas', COR.telhas, 2)
    expect(mesmosBytes(com.pixels, sem.pixels)).toBe(true)
    expect(chamineDoPoligono([])).toBeNull()
  })
})

describe('chaminé: os pixels', () => {
  for (const modelo of MODELOS) {
    for (const escala of [1, 3]) {
      it(`${modelo} a ${escala}x: muda de 83% a 100% da caixa e nada fora do alcance`, () => {
        for (const poligono of [sala(4, 3), sala(6, 4), EL]) {
          const c = chamineDoPoligono(poligono)
          if (c === null) throw new Error('sem chaminé')
          const com = pintarTelhado(poligono, modelo, COR[modelo], escala, { chamine: true })
          const sem = pintarTelhado(poligono, modelo, COR[modelo], escala)
          const fracao = fracaoQueMuda(com, sem, caixaDaChamine(c))
          expect(fracao).toBeGreaterThanOrEqual(0.83)
          expect(fracao).toBeLessThanOrEqual(1)
          expect(bytesForaIguais(com, sem, alcanceDaChamine(c))).toBe(0)
        }
      })
    }
  }

  it('sem contorno preto e com a cor contida: luminância >= 0,06 e saturação p95 <= 0,62 na caixa', () => {
    for (const modelo of MODELOS) {
      const poligono = sala(4, 3)
      const c = chamineDoPoligono(poligono)
      if (c === null) throw new Error('sem chaminé')
      const com = pintarTelhado(poligono, modelo, COR[modelo], 3, { chamine: true })
      const luz: number[] = []
      const sat: number[] = []
      cadaPixel(com, caixaDaChamine(c), false, (o) => {
        const p = com.pixels
        luz.push(luminanciaDoRgb([p[o], p[o + 1], p[o + 2]]))
        sat.push(saturacaoHsv(p[o], p[o + 1], p[o + 2]))
      })
      sat.sort((a, b) => a - b)
      expect(Math.min(...luz)).toBeGreaterThanOrEqual(0.06)
      expect(sat[Math.floor(sat.length * 0.95)]).toBeLessThanOrEqual(0.62)
    }
  })

  it('sem extras, com {} e com tudo false: os mesmos bytes de antes', () => {
    for (const modelo of MODELOS) {
      const base = pintarTelhado(sala(4, 3), modelo, COR[modelo], 1)
      for (const extras of [{}, { chamine: false, cumeeiraAmarrada: false }]) {
        const outra = pintarTelhado(sala(4, 3), modelo, COR[modelo], 1, extras)
        expect(mesmosBytes(outra.pixels, base.pixels)).toBe(true)
      }
    }
  })

  it('em pedaços de linhas dá os mesmos bytes de pintar de uma vez (chaminé e cumeeira amarrada)', () => {
    for (const modelo of MODELOS) {
      for (const pedaco of [1, 3, 7]) {
        const extras = { chamine: true, cumeeiraAmarrada: true }
        const inteira = pintarTelhado(sala(6, 4), modelo, COR[modelo], 1.5, extras)
        const pintura = comecarTelhado(sala(6, 4), modelo, COR[modelo], 1.5, extras)
        while (!pintura.pintarLinhas(pedaco)) {
          /* pinta mais um pedaço */
        }
        expect(mesmosBytes(pintura.imagem.pixels, inteira.pixels)).toBe(true)
      }
    }
  })

  it('sem Math.random: duas pinturas iguais', () => {
    const a = pintarTelhado(EL, 'palha', COR.palha, 2, { chamine: true, cumeeiraAmarrada: true })
    const b = pintarTelhado(EL, 'palha', COR.palha, 2, { chamine: true, cumeeiraAmarrada: true })
    expect(mesmosBytes(a.pixels, b.pixels)).toBe(true)
  })
})
