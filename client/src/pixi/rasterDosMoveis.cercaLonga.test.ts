import { describe, expect, it } from 'vitest'
import type { Prop } from '../types/map'
import { cordaDaCerca } from '../lib/mobilia'
import { CURVE_EPSILON_PX, curvaForTurnDegrees } from '../lib/stairCurve'
import { escalaDoNivel, GRADE_DE_REFERENCIA, montarCena } from '../texturas/meioTermo/moveis'
import { pintarCenaEmPassos } from '../texturas/meioTermo/moveis/motor'
import {
  chaveDoMovel,
  escalaECortes,
  escalaELimites,
  LADO_MAXIMO_DA_IMAGEM,
  PASSO_DA_FLECHA,
  PIXELS_MAXIMOS_EM_LADRILHOS,
  RasterDosMoveis,
  retanguloNoMundo,
  textoDaChave,
} from './rasterDosMoveis'

/**
 * Revisão da MT3, a cerca de comprimento livre: a longa sai em LADRILHOS na
 * escala do nível (antes, uma imagem só cortada no lado máximo: a de 20 casas
 * no nível 3 caía para 1/3 da escala), e a curva entra na chave pela FLECHA
 * (antes, pela volta de 5 em 5 graus: volta abaixo de 2,5° saía reta e o erro
 * crescia com o comprimento).
 */

const CASA = GRADE_DE_REFERENCIA
/** A cerca reta de 100 casas no nível 3 é a única que perde escala: ainda ≥ 2,25 pixels de imagem por px de mundo. */
const ESCALA_MINIMA_DA_CERCA = 0.75
/** Bytes de uma imagem do lado máximo, as duas cópias: o teto que a cerca inteira respeita. */
const BYTES_MAXIMOS = LADO_MAXIMO_DA_IMAGEM * LADO_MAXIMO_DA_IMAGEM * 4 * 2

function cerca(casas: number, volta = 0): Prop {
  return { id: 'c', src: '', x: 0, y: 0, width: casas * CASA, height: CASA / 4, linkedMapPath: null, mobilia: 'cerca', mobiliaCurva: volta === 0 ? undefined : volta }
}

function chaveDe(prop: Prop, nivel: number): NonNullable<ReturnType<typeof chaveDoMovel>> {
  const c = chaveDoMovel(prop, nivel, 1)
  if (c === null) throw new Error('cerca sem chave')
  return c
}

function filaControlada(): { agendar: (fatia: () => void) => void; rodarTudo: () => void } {
  const fatias: (() => void)[] = []
  return { agendar: (fatia) => fatias.push(fatia), rodarTudo: () => { while (fatias.length > 0) fatias.shift()?.() } }
}

describe('B10: a cerca longa em ladrilhos, na escala do nível', () => {
  for (const casas of [7, 20, 40, 100]) {
    for (const nivel of [1, 3]) {
      it(`${casas} casas, nível ${nivel}: ladrilhos até o lado máximo, memória de uma imagem cheia, escala ≥ ${ESCALA_MINIMA_DA_CERCA} da do nível`, () => {
        const { desenho } = chaveDe(cerca(casas), nivel)
        const { S, cortes } = escalaECortes('cerca', nivel, montarCena(desenho))
        for (const c of cortes) expect(Math.max(c.W, c.H)).toBeLessThanOrEqual(LADO_MAXIMO_DA_IMAGEM)
        const pixels = cortes.reduce((s, c) => s + c.W * c.H, 0)
        expect(pixels).toBeLessThanOrEqual(PIXELS_MAXIMOS_EM_LADRILHOS)
        expect(pixels * 4 * 2).toBeLessThanOrEqual(BYTES_MAXIMOS)
        if (casas === 100 && nivel === 3) expect(S / escalaDoNivel(nivel)).toBeGreaterThanOrEqual(ESCALA_MINIMA_DA_CERCA)
        else expect(S).toBe(escalaDoNivel(nivel))
      })
    }
  }

  it('antes (uma imagem cortada no lado máximo) a cerca de 20 casas no nível 3 caía abaixo de 40% da escala', () => {
    const { desenho } = chaveDe(cerca(20), 3)
    expect(escalaELimites(3, montarCena(desenho)).S / escalaDoNivel(3)).toBeLessThan(0.4)
    expect(escalaECortes('cerca', 3, montarCena(desenho)).S).toBe(escalaDoNivel(3))
  })

  it('os ladrilhos juntos dão a imagem inteira, pixel por pixel (sem emenda no ruído nem na borda)', () => {
    const { desenho } = chaveDe(cerca(20, 30), 3)
    const cena = montarCena(desenho)
    const { S, limites, cortes } = escalaECortes('cerca', 3, cena)
    expect(cortes.length).toBeGreaterThan(1)
    const inteira = new Uint8ClampedArray(limites.W * limites.H * 4)
    for (const p = pintarCenaEmPassos(cena, S, limites, inteira, true); !p.next().done; );
    let diferentes = 0
    let opacos = 0
    for (const c of cortes) {
      const parte = { x0: limites.x0 + c.i0 / S, y0: limites.y0 + c.j0 / S, W: c.W, H: c.H }
      const pixels = new Uint8ClampedArray(c.W * c.H * 4)
      for (const p = pintarCenaEmPassos(cena, S, parte, pixels, true); !p.next().done; );
      for (let j = 0; j < c.H; j += 1) {
        for (let i = 0; i < c.W; i += 1) {
          const o = (j * c.W + i) * 4
          const oi = ((c.j0 + j) * limites.W + c.i0 + i) * 4
          if (pixels[o + 3] > 0) opacos += 1
          for (let k = 0; k < 4; k += 1) if (pixels[o + k] !== inteira[oi + k]) diferentes += 1
        }
      }
    }
    expect(opacos).toBeGreaterThan(1000)
    expect(diferentes).toBe(0)
  })

  it('cerca curva grande (o limite): cabe no teto, nunca pior que a imagem única de antes', () => {
    for (const [casas, volta] of [[40, 90], [100, 180]] as const) {
      const { desenho } = chaveDe(cerca(casas, volta), 3)
      const cena = montarCena(desenho)
      const { S, cortes } = escalaECortes('cerca', 3, cena)
      for (const c of cortes) expect(Math.max(c.W, c.H)).toBeLessThanOrEqual(LADO_MAXIMO_DA_IMAGEM)
      expect(cortes.reduce((s, c) => s + c.W * c.H, 0)).toBeLessThanOrEqual(PIXELS_MAXIMOS_EM_LADRILHOS)
      expect(S).toBeGreaterThanOrEqual(escalaELimites(3, cena).S)
    }
  })

  it('no raster: a cerca de 40 casas no nível 3 fica pronta em ladrilhos, o cache conta todos, e colados lado a lado cobrem a imagem', () => {
    const fila = filaControlada()
    const raster = new RasterDosMoveis({ agendar: fila.agendar })
    const prop = cerca(40)
    const imagem = raster.imagemDoMovel(prop, 3, 1)
    if (imagem === null) throw new Error('sem imagem')
    fila.rodarTudo()
    expect(imagem.pronta).toBe(true)
    expect(imagem.S).toBe(escalaDoNivel(3))
    expect(imagem.ladrilhos.length).toBeGreaterThan(1)
    expect(imagem.textura).toBe(imagem.ladrilhos[0].textura)
    for (const l of imagem.ladrilhos) expect(Math.max(l.textura.source.width, l.textura.source.height)).toBeLessThanOrEqual(LADO_MAXIMO_DA_IMAGEM)
    expect(raster.bytes).toBe(imagem.ladrilhos.reduce((s, l) => s + l.limites.W * l.limites.H, 0) * 4 * 2)
    const todo = retanguloNoMundo(imagem, prop.width, prop.height)
    const partes = imagem.ladrilhos.map((l) => retanguloNoMundo(imagem, prop.width, prop.height, l.limites))
    expect(partes[0].x).toBeCloseTo(todo.x, 9)
    for (let k = 1; k < partes.length; k += 1) expect(partes[k].x).toBeCloseTo(partes[k - 1].x + partes[k - 1].w, 9)
    expect(partes[partes.length - 1].x + partes[partes.length - 1].w).toBeCloseTo(todo.x + todo.w, 9)
  })
})

describe('B11: a curva da cerca na chave pela flecha, não pela volta de 5 em 5 graus', () => {
  const PASSO = PASSO_DA_FLECHA * GRADE_DE_REFERENCIA

  it('volta de 2° numa cerca de 20 casas não sai reta (antes arredondava para 0°)', () => {
    const c = chaveDe(cerca(20, 2), 1)
    expect(c.curva).toBeGreaterThan(0)
    expect(textoDaChave(c)).not.toBe(textoDaChave(chaveDe(cerca(20), 1)))
  })

  for (const casas of [2, 5, 10, 20, 50, 100]) {
    it(`${casas} casas: a flecha desenhada fica a no máximo meio passo (${PASSO_DA_FLECHA / 2} casa) da real, em qualquer volta`, () => {
      const corda = cordaDaCerca(casas * CASA, CASA / 4)
      if (corda === null) throw new Error('sem corda')
      for (let volta = -180; volta <= 180; volta += 0.7) {
        const real = curvaForTurnDegrees(volta, corda.comprimento)
        const desenhada = curvaForTurnDegrees(chaveDe(cerca(casas, volta), 1).curva, corda.comprimento)
        if (Math.abs(real) < CURVE_EPSILON_PX) continue
        expect(Math.abs(desenhada - real), `volta ${volta.toFixed(1)}`).toBeLessThanOrEqual(PASSO / 2 + 1e-9)
      }
    })
  }

  it('chaves iguais só para flechas a menos de um passo, e o número de chaves cresce com a flecha (não com a volta)', () => {
    const casas = 20
    const corda = cordaDaCerca(casas * CASA, CASA / 4)
    if (corda === null) throw new Error('sem corda')
    const porChave = new Map<string, number[]>()
    for (let volta = 0.1; volta <= 180; volta += 0.1) {
      const texto = textoDaChave(chaveDe(cerca(casas, volta), 1))
      const lista = porChave.get(texto) ?? []
      lista.push(curvaForTurnDegrees(volta, corda.comprimento))
      porChave.set(texto, lista)
    }
    for (const [texto, flechas] of porChave) expect(Math.max(...flechas) - Math.min(...flechas), texto).toBeLessThanOrEqual(PASSO + 1e-9)
    const flechaMaxima = curvaForTurnDegrees(180, corda.comprimento)
    // Um passo de flecha por chave, mais as voltas redondas de 5 em 5 graus (36 de 5° a 180°) que cabem na tolerância.
    expect(porChave.size).toBeLessThanOrEqual(Math.ceil(flechaMaxima / PASSO) + 1 + 36)
  })
})
