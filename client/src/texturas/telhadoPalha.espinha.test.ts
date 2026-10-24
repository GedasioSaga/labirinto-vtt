import { describe, expect, it } from 'vitest'
import type { PontoDoTelhado } from '../lib/telhado/aguas'
import { pintarTelhado, type ImagemDoTelhado } from './telhado'
import { PALHA_DO_ESTILO } from './telhadoPalha.testkit'

/**
 * A ESPINHA DA PALHA MEDIDA NOS PIXELS (revisão da MT6). O teste antigo dos
 * fios comparava os pixels com `fileiraDaPalha`, que é a mesma conta do
 * pintor: zerar o V, inverter o V, zerar a deriva, o tom por feixe, a luz por
 * braço ou o fio deixava tudo verde. Aqui nada vem do pintor: só os números
 * do desenho (fileira de 7 px, V a cada 12 px) e valores FIXOS.
 *
 * Água de cima (norte) da sala de 400 x 300 a 4x: ali a régua é o x e a
 * altura é y + 8 (o beiral). Em cada coluna, a borda de cada fileira é o maior
 * degrau de escuro para claro subindo para a cumeeira; o perfil da borda ao
 * longo do x é ajustado a um V de 12 px (fase e altura por mínimos quadrados).
 */

const p = (x: number, y: number): PontoDoTelhado => ({ x, y })
const GRANDE = [p(0, 0), p(400, 0), p(400, 300), p(0, 300)]
const K = 4
const BEIRAL = 8
const CURSO = 7
const PASSO = 12
const X0 = 130
const X1 = 270

function luz(img: ImagemDoTelhado, ix: number, iy: number): number {
  const o = (iy * img.largura + ix) * 4
  return 0.2126 * img.pixels[o] + 0.7152 * img.pixels[o + 1] + 0.0722 * img.pixels[o + 2]
}
const ixDe = (img: ImagemDoTelhado, x: number): number => Math.floor((x - img.origemX) * img.escala)
const iyDe = (img: ImagemDoTelhado, v: number): number => Math.floor((v - BEIRAL - img.origemY) * img.escala)

/** A borda da fileira `n` na coluna `x`: o maior degrau escuro → claro entre 7n − 1,8 e 7n + 5 (v, px do mapa). */
function borda(img: ImagemDoTelhado, x: number, n: number): number {
  const ix = ixDe(img, x)
  const i0 = iyDe(img, CURSO * n - 1.8)
  const i1 = iyDe(img, CURSO * n + 5)
  let melhor = i0
  let degrau = -Infinity
  for (let iy = i0; iy < i1; iy += 1) {
    const d = luz(img, ix, iy + 1) - luz(img, ix, iy)
    if (d > degrau) {
      degrau = d
      melhor = iy
    }
  }
  return img.origemY + (melhor + 1) / img.escala + BEIRAL
}

/** 0 no fundo do V, 1 no bico. */
const triangulo = (t: number): number => {
  const fr = t - Math.floor(t)
  return fr < 0.5 ? 2 * fr : 2 * (1 - fr)
}

interface Fileira {
  readonly n: number
  /** Onde fica o fundo do V (o ponto mais perto do beiral), módulo 12. */
  readonly fundo: number
  /** Bico menos fundo (px do mapa); positivo = o bico aponta para a cumeeira. */
  readonly altura: number
  /** A borda medida em cada x (passo de 1/K). */
  readonly bordas: readonly number[]
}

/** Ajusta a borda da fileira a `a + altura × V(x − fundo)` e guarda a fase de maior altura. */
function medirFileira(img: ImagemDoTelhado, n: number): Fileira {
  const xs: number[] = []
  const bordas: number[] = []
  for (let x = X0; x < X1; x += 1 / K) {
    xs.push(x + 0.5 / K)
    bordas.push(borda(img, x + 0.5 / K, n))
  }
  let melhor = { fundo: 0, altura: -Infinity }
  for (let fundo = 0; fundo < PASSO; fundo += 0.125) {
    let st = 0
    let sb = 0
    let stt = 0
    let stb = 0
    for (let i = 0; i < xs.length; i += 1) {
      const t = triangulo((xs[i] - fundo) / PASSO)
      st += t
      sb += bordas[i]
      stt += t * t
      stb += t * bordas[i]
    }
    const m = xs.length
    const altura = (m * stb - st * sb) / (m * stt - st * st)
    if (altura > melhor.altura) melhor = { fundo, altura }
  }
  return { n, ...melhor, bordas }
}

const IMG = pintarTelhado(GRANDE, 'palha', PALHA_DO_ESTILO, K)
/** Fileiras com a borda entre v = 33 e v = 103 (longe do beiral e da cumeeira). */
const FILEIRAS: readonly Fileira[] = Array.from({ length: 10 }, (_, i) => medirFileira(IMG, 5 + i))

/** Luz média na faixa de 2 a 4 px acima da borda, de `xa` a `xb` (px do mapa). */
function luzNaFaixa(img: ImagemDoTelhado, f: Fileira, xa: number, xb: number): number {
  let s = 0
  let n = 0
  for (let x = xa; x < xb; x += 1 / K) {
    const i = Math.round((x - X0) * K)
    const base = f.bordas[Math.min(f.bordas.length - 1, Math.max(0, i))]
    for (let v = base + 2; v < base + 4; v += 1 / K) {
      s += luz(img, ixDe(img, x), iyDe(img, v))
      n += 1
    }
  }
  return s / n
}

interface Salto {
  readonly noFundo: number[]
  readonly noBico: number[]
}

/** A luz à direita menos a da esquerda (2 px de cada lado, 0,5 px de folga), em cada fundo e em cada bico. */
function saltos(img: ImagemDoTelhado): Salto {
  const noFundo: number[] = []
  const noBico: number[] = []
  for (const f of FILEIRAS) {
    for (let c = Math.ceil((X0 + 3 - f.fundo) / PASSO); f.fundo + c * PASSO + 6 < X1 - 3; c += 1) {
      const fundo = f.fundo + c * PASSO
      const bico = fundo + 6
      noFundo.push(luzNaFaixa(img, f, fundo + 0.5, fundo + 2.5) - luzNaFaixa(img, f, fundo - 2.5, fundo - 0.5))
      noBico.push(luzNaFaixa(img, f, bico + 0.5, bico + 2.5) - luzNaFaixa(img, f, bico - 2.5, bico - 0.5))
    }
  }
  return { noFundo, noBico }
}

const media = (l: readonly number[]): number => l.reduce((s, x) => s + x, 0) / l.length
const desvio = (l: readonly number[]): number => {
  const m = media(l)
  return Math.sqrt(l.reduce((s, x) => s + (x - m) ** 2, 0) / l.length)
}

/** Espalhamento (px, circular no passo de 12) do fundo do V de fileira em fileira. */
function espalhamentoDoFundo(fileiras: readonly Fileira[]): number {
  const c = media(fileiras.map((f) => Math.cos((f.fundo / PASSO) * 2 * Math.PI)))
  const s = media(fileiras.map((f) => Math.sin((f.fundo / PASSO) * 2 * Math.PI)))
  return (PASSO / (2 * Math.PI)) * Math.sqrt(-2 * Math.log(Math.hypot(c, s)))
}

/** RMS da luz menos a média de ±1 px ao longo do x, na faixa de 2 a 4 px acima da borda: o fio fino. */
function fioFino(img: ImagemDoTelhado): number {
  let s = 0
  let n = 0
  for (const f of FILEIRAS) {
    for (let x = X0 + 2; x < X1 - 2; x += 1 / K) {
      const i = Math.round((x - X0) * K)
      const v = f.bordas[i] + 3
      const iy = iyDe(img, v)
      const ix = ixDe(img, x)
      let viz = 0
      for (let d = -K; d <= K; d += 1) viz += luz(img, ix + d, iy)
      s += (luz(img, ix, iy) - viz / (2 * K + 1)) ** 2
      n += 1
    }
  }
  return Math.sqrt(s / n)
}

describe('palha: a espinha medida nos pixels, com valores fixos', () => {
  const salto = saltos(IMG)
  const medidas = {
    altura: media(FILEIRAS.map((f) => f.altura)),
    menorAltura: Math.min(...FILEIRAS.map((f) => f.altura)),
    deriva: espalhamentoDoFundo(FILEIRAS),
    saltoNoFundo: media(salto.noFundo),
    saltoNoBico: media(salto.noBico),
    tomNoFundo: desvio(salto.noFundo),
    tomNoBico: desvio(salto.noBico),
    fio: fioFino(IMG),
  }
  console.log(`[medida] espinha a 4x: ${Object.entries(medidas).map(([k, v]) => `${k} ${v.toFixed(3)}`).join(', ')} (${salto.noFundo.length} fundos)`)

  it('o V tem de 2,5 a 4 px entre o fundo e o bico, em toda fileira', () => {
    expect(medidas.altura).toBeGreaterThanOrEqual(2.5)
    expect(medidas.altura).toBeLessThanOrEqual(4)
    expect(medidas.menorAltura).toBeGreaterThanOrEqual(2)
  })

  it('o bico aponta para a cumeeira: a costura entre feixes fica no FUNDO do V (a luz do braço muda de lado ao contrário no fundo e no bico)', () => {
    // Na água de cima a metade da direita de cada V (do bico ao fundo seguinte) é a mais clara.
    expect(medidas.saltoNoBico).toBeGreaterThanOrEqual(3)
    expect(medidas.saltoNoFundo).toBeLessThanOrEqual(-3)
  })

  it('cada feixe tem um tom: o salto de luz varia mais na costura (fundo) que no bico, onde o feixe é o mesmo', () => {
    // O ruído (fio, onda, grão) é o mesmo nos dois lugares; o que sobra na costura é a diferença de tom
    // entre dois feixes vizinhos (medido 3,8 níveis de 255 com o tom de ±0,025).
    const diferencaDeTom = Math.sqrt(Math.max(0, medidas.tomNoFundo ** 2 - medidas.tomNoBico ** 2))
    expect(diferencaDeTom).toBeGreaterThanOrEqual(2.5)
    expect(diferencaDeTom).toBeLessThanOrEqual(6)
  })

  it('o bico anda com a altura: o fundo do V muda de lugar de fileira em fileira (sem grade)', () => {
    expect(medidas.deriva).toBeGreaterThanOrEqual(0.6)
  })

  it('os fios finos aparecem: a luz oscila ao longo do x dentro do feixe', () => {
    expect(medidas.fio).toBeGreaterThanOrEqual(6)
  })
})

/**
 * Correlação da luz consigo mesma deslocada de `dx`, `dy` pixels, no miolo da
 * água de baixo (a medida da revisão de design: x de 36% a 64%, y de 74% a 93%).
 */
function autocorrelacao(img: ImagemDoTelhado, dx: number, dy: number): number {
  const x0 = Math.floor(img.largura * 0.36)
  const x1 = Math.floor(img.largura * 0.64)
  const y0 = Math.floor(img.altura * 0.74)
  const y1 = Math.floor(img.altura * 0.93) - dy
  let sa = 0
  let sb = 0
  let n = 0
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1 - dx; x += 1) {
      sa += luz(img, x, y)
      sb += luz(img, x + dx, y + dy)
      n += 1
    }
  }
  sa /= n
  sb /= n
  let c = 0
  let va = 0
  let vb = 0
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1 - dx; x += 1) {
      const a = luz(img, x, y) - sa
      const b = luz(img, x + dx, y + dy) - sb
      c += a * b
      va += a * a
      vb += b * b
    }
  }
  return c / Math.sqrt(va * vb)
}

describe('palha: sem "tricô" (colunas de V que se repetem de fileira em fileira)', () => {
  it('a 3x, a luz pouco se repete a 1 fileira (7 px) e a 1 passo da espinha (12 px)', () => {
    const img = pintarTelhado([p(0, 0), p(384, 0), p(384, 256), p(0, 256)], 'palha', PALHA_DO_ESTILO, 3)
    const fileira = autocorrelacao(img, 0, 3 * CURSO)
    const passo = autocorrelacao(img, 3 * PASSO, 0)
    console.log(`[medida] autocorrelação a 3x: 1 fileira ${fileira.toFixed(3)}, 1 passo ${passo.toFixed(3)} (antes da revisão: 0,324 e 0,674)`)
    expect(fileira).toBeLessThanOrEqual(0.25)
    expect(passo).toBeLessThanOrEqual(0.45)
  })
})
