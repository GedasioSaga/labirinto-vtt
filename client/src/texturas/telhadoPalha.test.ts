import { describe, expect, it } from 'vitest'
import type { PontoDoTelhado } from '../lib/telhado/aguas'
import { MODELOS_DO_TETO, NOME_DO_MODELO, PALETA_DO_TETO, corPadraoDoModelo } from '../lib/telhado/paletas'
import { CURSO_DA_PALHA_PX, fileiraDaPalha, ondaDoFioDaPalha, pintarTelhado, type ImagemDoTelhado } from './telhado'
import { PALHA_DO_ESTILO, falhasDaCor, medirCorDoTelhado } from './telhadoPalha.testkit'
import { escalaDaTexturaDoTelhado } from '../pixi/telhadosRenderer'

/**
 * TELHADO DE PALHA (fatia MT6): o 3º modelo, palha em espinha de peixe. O
 * teste mede os pixels: a palha não é telha pintada de amarelo, a cor fica
 * contida (alvo do estilo, POR TELHADO, no OKLab), os fios ondulam de leve
 * (nada de risco reto nem grade) e a beira do beiral é franjada.
 */

const p = (x: number, y: number): PontoDoTelhado => ({ x, y })
const RET = [p(40, 60), p(320, 60), p(320, 220), p(40, 220)]
const L = [p(0, 0), p(240, 0), p(240, 100), p(100, 100), p(100, 240), p(0, 240)]
/** Sala grande para medir os fios na água de cima (norte): ali u = x e v = y + beiral. */
const GRANDE = [p(0, 0), p(400, 0), p(400, 300), p(0, 300)]

/** FNV-1a de 32 bits dos bytes (a mesma de `telhadoSemMudanca.test.ts`). */
function digital(bytes: Uint8ClampedArray): string {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i += 1) {
    h ^= bytes[i]
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

const DIGITAIS_DA_PALHA: Readonly<Record<string, string>> = {
  'ret palha 1x': '93a4a03a',
  'L feno 2x': 'a48ba7a7',
  'L musgo 3x': '80e2fd68',
  'ret livre 0,5x': 'b3b7102e',
  'miniatura palha 2x': 'bc37f5a5',
  '20x14 casas na escala do app (0,94x)': 'fc4f51e2',
}

function luz(img: ImagemDoTelhado, i: number): number {
  return 0.2126 * img.pixels[i] + 0.7152 * img.pixels[i + 1] + 0.0722 * img.pixels[i + 2]
}

function pixel(img: ImagemDoTelhado, x: number, y: number): [number, number, number, number] {
  const i = (Math.floor((y - img.origemY) * img.escala) * img.largura + Math.floor((x - img.origemX) * img.escala)) * 4
  return [img.pixels[i], img.pixels[i + 1], img.pixels[i + 2], img.pixels[i + 3]]
}

/**
 * Onde a coluna `x` (px do mapa) da imagem passa de escuro para claro descendo
 * do beiral (v cresce): a borda da fileira de cima, que é o "fio" da espinha.
 * Procura perto de `vEsperado` e devolve o v (px do mapa) do maior degrau.
 */
function bordaNaColuna(img: ImagemDoTelhado, x: number, vEsperado: number, beiral: number): number {
  const k = img.escala
  const ix = Math.floor((x - img.origemX) * k)
  const yDe = (v: number): number => v - beiral
  const iy0 = Math.max(1, Math.floor((yDe(vEsperado - 2.5) - img.origemY) * k))
  const iy1 = Math.floor((yDe(vEsperado + 2.5) - img.origemY) * k)
  let melhor = iy0
  let degrau = -Infinity
  for (let iy = iy0; iy < iy1; iy += 1) {
    const d = luz(img, ((iy + 1) * img.largura + ix) * 4) - luz(img, (iy * img.largura + ix) * 4)
    if (d > degrau) {
      degrau = d
      melhor = iy
    }
  }
  // Entre os centros dos dois pixels do degrau.
  return img.origemY + (melhor + 1) / k + beiral
}

/** O v em que a coordenada da fileira vale `alvo` na régua `u` (cresce com v: bisseção). */
function vDaFileira(coordenada: (v: number) => number, alvo: number, v0: number, v1: number): number {
  let a = v0
  let b = v1
  for (let i = 0; i < 40; i += 1) {
    const m = (a + b) / 2
    if (coordenada(m) < alvo) a = m
    else b = m
  }
  return (a + b) / 2
}

describe('palha: o 3º modelo do telhado', () => {
  it('está na lista, com nome e 6 cores; a padrão é a palha do estilo', () => {
    expect(MODELOS_DO_TETO).toEqual(['telhas', 'madeira', 'palha'])
    expect(NOME_DO_MODELO.palha).toBe('Palha')
    expect(PALETA_DO_TETO.palha).toHaveLength(6)
    expect(corPadraoDoModelo('palha')).toBe(PALHA_DO_ESTILO)
    expect(new Set(PALETA_DO_TETO.palha.map((c) => c.hex)).size).toBe(6)
  })

  it('pinta palha, não telha amarela: a maioria dos pixels cheios difere da telha na mesma cor', () => {
    const palha = pintarTelhado(RET, 'palha', PALHA_DO_ESTILO, 1)
    const telha = pintarTelhado(RET, 'telhas', PALHA_DO_ESTILO, 1)
    expect(palha.largura).toBe(telha.largura)
    let cheios = 0
    let diferentes = 0
    for (let i = 0; i < telha.pixels.length; i += 4) {
      if (telha.pixels[i + 3] < 255) continue
      cheios += 1
      if (Math.abs(luz(palha, i) - luz(telha, i)) > 4) diferentes += 1
    }
    expect(diferentes / cheios).toBeGreaterThan(0.5)
  })

  it('mesma entrada, mesmos bytes: as digitais da palha são FIXAS (qualquer mudança no desenho fica vermelha)', () => {
    // FNV-1a dos bytes, como em `telhadoSemMudanca.test.ts`. Tiradas depois da revisão de design da MT6
    // (tom 0,05, luz do braço 0,02, fio de ~2 px a 0,1). Mudou o desenho de propósito? Regrave AQUI, com o motivo.
    const grande = [p(0, 0), p(20 * 64, 0), p(20 * 64, 14 * 64), p(0, 14 * 64)]
    const casos: readonly [string, readonly PontoDoTelhado[], string, number][] = [
      ['ret palha 1x', RET, PALHA_DO_ESTILO, 1],
      ['L feno 2x', L, PALETA_DO_TETO.palha[2].hex, 2],
      ['L musgo 3x', L, PALETA_DO_TETO.palha[5].hex, 3],
      ['ret livre 0,5x', RET, '#3f7fbf', 0.5],
      ['miniatura palha 2x', [p(9, 9), p(57, 9), p(57, 37), p(9, 37)], PALHA_DO_ESTILO, 2],
      ['20x14 casas na escala do app (0,94x)', grande, PALHA_DO_ESTILO, escalaDaTexturaDoTelhado(grande)],
    ]
    const atual = Object.fromEntries(casos.map(([nome, poligono, cor, k]) => [nome, digital(pintarTelhado(poligono, 'palha', cor, k).pixels)]))
    // Duas chamadas, os mesmos bytes (a memória curta de sorteios não muda nada entre uma e outra).
    expect(digital(pintarTelhado(L, 'palha', PALETA_DO_TETO.palha[2].hex, 2).pixels)).toBe(atual['L feno 2x'])
    expect(atual).toEqual(DIGITAIS_DA_PALHA)
  })

  it('a cor manda no tom (média perto da escolhida, cor livre também) e a água virada para a luz é a mais clara', () => {
    for (const cor of [...PALETA_DO_TETO.palha.map((c) => c.hex), '#3f7fbf']) {
      const img = pintarTelhado(RET, 'palha', cor, 1)
      const soma = [0, 0, 0]
      let n = 0
      for (let i = 0; i < img.pixels.length; i += 4) {
        if (img.pixels[i + 3] < 255) continue
        for (let c = 0; c < 3; c += 1) soma[c] += img.pixels[i + c]
        n += 1
      }
      const alvo = [1, 3, 5].map((k) => Number.parseInt(cor.slice(k, k + 2), 16))
      for (let c = 0; c < 3; c += 1) expect(Math.abs(soma[c] / n - alvo[c]), `${cor} canal ${c}`).toBeLessThan(26)
    }
    const img = pintarTelhado(RET, 'palha', PALHA_DO_ESTILO, 1)
    const media = (x0: number, y0: number, x1: number, y1: number): number => {
      let s = 0
      let n = 0
      for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) {
        const [r, g, b] = pixel(img, x + 0.5, y + 0.5)
        s += 0.2126 * r + 0.7152 * g + 0.0722 * b
        n += 1
      }
      return s / n
    }
    expect(media(44, 110, 84, 170)).toBeGreaterThan(media(276, 110, 316, 170) * 1.12)
    expect(media(150, 64, 210, 104)).toBeGreaterThan(media(150, 176, 210, 216) * 1.08)
  })

  it('saturação dentro do alvo do estilo, POR TELHADO, nas 6 cores, em 2 formas e 2 escalas', () => {
    const falhas: string[] = []
    const medidas: string[] = []
    for (const cor of PALETA_DO_TETO.palha) {
      for (const [nome, poligono] of [['ret', RET], ['L', L]] as const) {
        for (const k of [1, 3]) {
          const m = medirCorDoTelhado(pintarTelhado(poligono, 'palha', cor.hex, k))
          const f = falhasDaCor(m, cor.hex)
          if (f.length > 0) falhas.push(`${cor.nome} ${nome} ${k}x: ${f.join(', ')}`)
          if (nome === 'ret' && k === 1) medidas.push(`${cor.nome} sat ${m.saturacaoP95.toFixed(3)} croma p95 ${m.cromaP95.toFixed(4)} médio ${m.cromaMedio.toFixed(4)}`)
        }
      }
    }
    console.log(`[medida] palha, sala 280 x 160 a 1x: ${medidas.join('; ')}`)
    expect(falhas).toEqual([])
  })

  it('os fios ondulam de leve: os pixels seguem a borda ondulada, não a reta, e a onda é sutil', () => {
    const K = 4
    const BEIRAL = 8
    const img = pintarTelhado(GRANDE, 'palha', PALHA_DO_ESTILO, K)
    const C = CURSO_DA_PALHA_PX
    let somaOnda = 0
    let somaReta = 0
    let somaModelo = 0
    let n = 0
    const formas: number[][] = []
    // Fileiras com a borda entre y = 25 e y = 95 (longe do beiral e da cumeeira), colunas no meio da água.
    for (let fileira = Math.ceil((25 + BEIRAL) / C) + 1; (fileira + 1) * C < 95 + BEIRAL; fileira += 1) {
      const forma: number[] = []
      for (let ix = 0; ix < 140 * K; ix += 1) {
        const x = 130 + (ix + 0.5) / K
        const comOnda = vDaFileira((v) => fileiraDaPalha(x, v), fileira, fileira * C - 6, fileira * C + 6)
        const reta = vDaFileira((v) => fileiraDaPalha(x, v) - ondaDoFioDaPalha(x, v) / C, fileira, fileira * C - 6, fileira * C + 6)
        const medida = bordaNaColuna(img, x, comOnda, BEIRAL)
        somaOnda += (medida - comOnda) ** 2
        somaReta += (medida - reta) ** 2
        somaModelo += (comOnda - reta) ** 2
        n += 1
        forma.push(medida - fileira * C)
      }
      formas.push(forma)
    }
    const erroOnda = Math.sqrt(somaOnda / n)
    const erroReta = Math.sqrt(somaReta / n)
    const onda = Math.sqrt(somaModelo / n)
    console.log(`[medida] fios a 4x: erro contra a borda ondulada ${erroOnda.toFixed(3)} px, contra a reta ${erroReta.toFixed(3)} px, onda RMS ${onda.toFixed(3)} px, ${formas.length} fileiras`)
    expect(formas.length).toBeGreaterThanOrEqual(6)
    // Os pixels seguem a borda ondulada (erro de meio pixel da imagem), bem mais perto dela que da reta.
    expect(erroOnda).toBeLessThan(0.2)
    expect(erroOnda).toBeLessThan(erroReta * 0.5)
    // Sutil: a onda tem de 0,25 a 1 px do mapa (RMS).
    expect(onda).toBeGreaterThan(0.25)
    expect(onda).toBeLessThan(1)
    // Sem grade: duas fileiras vizinhas não repetem o mesmo desenho de borda.
    for (let f = 1; f < formas.length; f += 1) {
      const a = formas[f - 1]
      const b = formas[f]
      const ma = a.reduce((s, x) => s + x, 0) / a.length
      const mb = b.reduce((s, x) => s + x, 0) / b.length
      const dif = Math.sqrt(a.reduce((s, x, i) => s + (x - ma - (b[i] - mb)) ** 2, 0) / a.length)
      expect(dif, `fileiras ${f - 1} e ${f}`).toBeGreaterThan(0.5)
    }
  })

  it('a ponta do beiral é franjada: na faixa de 1 px da beira há buracos e palha cheia ao longo da borda', () => {
    const K = 4
    const img = pintarTelhado(GRANDE, 'palha', PALHA_DO_ESTILO, K)
    const telha = pintarTelhado(GRANDE, 'telhas', PALHA_DO_ESTILO, K)
    // Linha a 0,9 px da ponta do beiral (a ponta fica em y = -8).
    const y = -8 + 0.9
    let vazios = 0
    let vaziosDaTelha = 0
    let n = 0
    for (let x = 120; x < 280; x += 1 / K) {
      if (pixel(img, x, y)[3] < 128) vazios += 1
      if (pixel(telha, x, y)[3] < 128) vaziosDaTelha += 1
      n += 1
    }
    expect(vaziosDaTelha).toBe(0)
    expect(vazios / n).toBeGreaterThan(0.2)
    expect(vazios / n).toBeLessThan(0.8)
  })
})
