import { describe, expect, it } from 'vitest'
import type { PontoDoTelhado } from '../lib/telhado/aguas'
import { PALETA_DO_TETO } from '../lib/telhado/paletas'
import { pintarTelhado, type ImagemDoTelhado } from './telhado'
import { luminanciaDoRgb } from './meioTermo/barranco'
import { LARGURA_DA_CUMEEIRA_AMARRADA_PX, PASSO_DA_AMARRA_PX } from './meioTermo/cumeeiraAmarrada'

/** Os mesmos bytes (sem Buffer: o tsconfig do app não tem os tipos do Node). */
function mesmosBytes(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false
  return true
}

/**
 * CUMEEIRA AMARRADA da palha (reabre na MT10, seção "MT6 medido" do plano):
 * pintada POR CIMA, depois do laço, só nos pixels a até 3,4 px do cume, sem
 * mexer na folga do bloco rápido. Uma faixa de palha em feixe com amarras a
 * cada 9 px, como `vila-estilo-mother/prototipo/mother.js:1026-1038`. Só na
 * palha, só na cumeeira (o espigão continua com a faixa clara de 2,4 px).
 */

const PALHA = PALETA_DO_TETO.palha[0].hex
/** 6 x 4 casas de 50: cumeeira em y = 100, de x = 100 a x = 200 (telhado de quatro águas). */
const SALA: readonly PontoDoTelhado[] = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }]
const CUME_Y = 100

function aoMapa(img: ImagemDoTelhado, px: number, py: number): [number, number] {
  return [img.origemX + (px + 0.5) / img.escala, img.origemY + (py + 0.5) / img.escala]
}

function luzEm(img: ImagemDoTelhado, o: number): number {
  return luminanciaDoRgb([img.pixels[o], img.pixels[o + 1], img.pixels[o + 2]])
}

describe('cumeeira amarrada da palha', () => {
  for (const escala of [1, 2, 4]) {
    it(`a ${escala}x: só muda o que está a até 3,4 px do cume, e muda quase todo o miolo da faixa`, () => {
      const com = pintarTelhado(SALA, 'palha', PALHA, escala, { cumeeiraAmarrada: true })
      const sem = pintarTelhado(SALA, 'palha', PALHA, escala)
      let longeMudou = 0
      let miolo = 0
      let mioloMudou = 0
      for (let py = 0; py < com.altura; py += 1) {
        for (let px = 0; px < com.largura; px += 1) {
          const o = (py * com.largura + px) * 4
          const [x, y] = aoMapa(com, px, py)
          const mudou = com.pixels[o] !== sem.pixels[o] || com.pixels[o + 1] !== sem.pixels[o + 1] || com.pixels[o + 2] !== sem.pixels[o + 2] || com.pixels[o + 3] !== sem.pixels[o + 3]
          const pertoDoCume = Math.abs(y - CUME_Y) <= LARGURA_DA_CUMEEIRA_AMARRADA_PX && x >= 100 - LARGURA_DA_CUMEEIRA_AMARRADA_PX && x <= 200 + LARGURA_DA_CUMEEIRA_AMARRADA_PX
          if (!pertoDoCume && mudou) longeMudou += 1
          if (Math.abs(y - CUME_Y) < 2.4 && x > 110 && x < 190) {
            miolo += 1
            if (Math.abs(luzEm(com, o) - luzEm(sem, o)) > 0.004 || mudou) mioloMudou += 1
          }
        }
      }
      expect(longeMudou).toBe(0)
      expect(miolo).toBeGreaterThan(0)
      expect(mioloMudou / miolo).toBeGreaterThanOrEqual(0.85)
    })
  }

  it('amarras a cada 9 px ao longo do cume (a 4x, os vales de luz no meio da faixa)', () => {
    const img = pintarTelhado(SALA, 'palha', PALHA, 4, { cumeeiraAmarrada: true })
    const py = Math.floor((CUME_Y - img.origemY) * img.escala)
    const luz: number[] = []
    const xs: number[] = []
    for (let px = 0; px < img.largura; px += 1) {
      const [x] = aoMapa(img, px, py)
      if (x < 108 || x > 192) continue
      xs.push(x)
      luz.push(luzEm(img, (py * img.largura + px) * 4))
    }
    const ordenada = [...luz].sort((a, b) => a - b)
    const mediana = ordenada[Math.floor(ordenada.length / 2)]
    // Um vale = a menor luz de cada trecho seguido abaixo de 80% da mediana.
    const vales: number[] = []
    let i = 0
    while (i < luz.length) {
      if (luz[i] >= mediana * 0.8) {
        i += 1
        continue
      }
      let melhor = i
      while (i < luz.length && luz[i] < mediana * 0.8) {
        if (luz[i] < luz[melhor]) melhor = i
        i += 1
      }
      vales.push(xs[melhor])
    }
    expect(vales.length).toBeGreaterThanOrEqual(7)
    const passos = vales.slice(1).map((x, k) => x - vales[k]).sort((a, b) => a - b)
    const passoMediano = passos[Math.floor(passos.length / 2)]
    expect(Math.abs(passoMediano - PASSO_DA_AMARRA_PX)).toBeLessThanOrEqual(0.6)
  })

  it('sem preto: a faixa inteira fica com luminância >= 0,06', () => {
    const img = pintarTelhado(SALA, 'palha', PALETA_DO_TETO.palha[5].hex, 3, { cumeeiraAmarrada: true })
    let menor = 1
    for (let py = 0; py < img.altura; py += 1) {
      for (let px = 0; px < img.largura; px += 1) {
        const [x, y] = aoMapa(img, px, py)
        if (Math.abs(y - CUME_Y) > LARGURA_DA_CUMEEIRA_AMARRADA_PX || x < 100 || x > 200) continue
        menor = Math.min(menor, luzEm(img, (py * img.largura + px) * 4))
      }
    }
    expect(menor).toBeGreaterThanOrEqual(0.06)
  })

  it('telha e madeira ignoram o pedido (os mesmos bytes)', () => {
    for (const modelo of ['telhas', 'madeira'] as const) {
      const cor = PALETA_DO_TETO[modelo][0].hex
      const com = pintarTelhado(SALA, modelo, cor, 2, { cumeeiraAmarrada: true })
      const sem = pintarTelhado(SALA, modelo, cor, 2)
      expect(mesmosBytes(com.pixels, sem.pixels)).toBe(true)
    }
  })
})
