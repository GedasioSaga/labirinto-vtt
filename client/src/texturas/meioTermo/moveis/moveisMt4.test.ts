import { describe, expect, it } from 'vitest'
import type { OpcaoDeMaterial } from '../materiais'
import { G, type LadoDoMovel } from './contexto'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel, type TipoComTextura } from './index'
import { ALFA_DE_PECA, ALFA_OPACO, digitalDosPixels, distanciaOklab, medirImagem, oklabMedio } from './medidas.testkit'

/**
 * As 9 PEÇAS NOVAS do lote 1 (MT4), "de cima com volume" e, na barraca e na
 * carroça, de lado: cada uma em até 3 materiais, nos níveis 1, 2 e 3, pelos
 * critérios de pixel da MT2/MT3 (cobre a pegada, cor contida por peça, claro,
 * contorno nunca preto, preto levantado, opaca), mais o que diz o que cada
 * peça É: volume (sombra no chão e luz no chanfro) a 1x e a 3x, mesas
 * coerentes com a mesa antiga, poço com borda de pedra, água escura e balde,
 * lampião aceso (vidro âmbar, sem chama), lápide com 3 desenhos, barraca e carroça
 * reconhecíveis de lado.
 *
 * A semente aqui é fixa (7); a do app e a varredura das 1000 estão em
 * `pixi/rasterDosMoveis.sementesMt4.test.ts`.
 */

const COBERTURA_MINIMA = 0.25
const SATURACAO_P95_MAXIMA = 0.62
const BRILHO_MEDIO_MINIMO = 0.17
const CONTORNO_MINIMO = 0.06
const LUMINANCIA_LINEAR_MINIMA = 0.03
const OPACIDADE_DOS_OPACOS_MINIMA = 0.98
const OPACIDADE_DO_MIOLO_MINIMA = 0.96
/**
 * Fração máxima do MIOLO das peças abaixo do alfa opaco (242). A média do
 * miolo (0,96) não morde uma peça inteira meio transparente: o anel do vaso com
 * alfa x 0,9 fica ~0,93 em cima da sombra de contato, sai do grupo dos opacos e
 * a média do miolo ainda dá ~0,965. Contar os pixels morde: ali são ~42% do miolo.
 * O teto é 5%, não 2%: a fresta de menos de 1 pixel entre o tampo e a travessa
 * da mesa quadrada no nível 1 já dá 4,2% (medido), e é a mesma fresta da mesa
 * antiga. O vaso tem ainda a prova direta no anel (`vaso: o anel da boca é uma
 * camada só, opaca`).
 */
const MIOLO_TRANSLUCIDO_MAXIMO = 0.05
const NIVEIS = [1, 2, 3] as const

/** Fração dos pixels de miolo (peça com os 4 vizinhos também de peça) com alfa abaixo do opaco. */
function mioloTranslucido(px: Uint8ClampedArray, W: number, H: number): number {
  const dePeca = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && px[(y * W + x) * 4 + 3] >= ALFA_DE_PECA
  let miolo = 0
  let translucidos = 0
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!dePeca(x, y) || !dePeca(x - 1, y) || !dePeca(x + 1, y) || !dePeca(x, y - 1) || !dePeca(x, y + 1)) continue
      miolo += 1
      if (px[(y * W + x) * 4 + 3] < ALFA_OPACO) translucidos += 1
    }
  }
  return miolo > 0 ? translucidos / miolo : 0
}

interface Caso {
  readonly tipo: TipoComTextura
  readonly lado: LadoDoMovel
  readonly casasW: number
  readonly casasH: number
  readonly materiais: readonly (readonly OpcaoDeMaterial[])[]
  readonly variante?: number
  readonly rotulo?: string
}

/** Tamanho padrão de cada peça (`lib/mobilia/pecasNovas.ts`); os materiais cobrem o mais escuro e o mais cinza de cada lugar. */
const CASOS_MT4: readonly Caso[] = [
  { tipo: 'mesaQuadrada', lado: 'frente', casasW: 1, casasH: 1, materiais: [['carvalho'], ['nogueira'], ['velha']] },
  { tipo: 'mesaRedonda', lado: 'frente', casasW: 1.25, casasH: 1.25, materiais: [['carvalho'], ['nogueira'], ['velha']] },
  { tipo: 'lapide', lado: 'frente', casasW: 0.6, casasH: 0.35, variante: 0, materiais: [['granito'], ['arenito'], ['ardosia']], rotulo: 'arco' },
  { tipo: 'lapide', lado: 'frente', casasW: 0.6, casasH: 0.35, variante: 1, materiais: [['granito'], ['ardosia']], rotulo: 'reta' },
  { tipo: 'lapide', lado: 'frente', casasW: 0.6, casasH: 0.35, variante: 2, materiais: [['granito'], ['ardosia']], rotulo: 'cruz' },
  { tipo: 'vaso', lado: 'frente', casasW: 0.5, casasH: 0.5, materiais: [['barro'], ['arenito'], ['granito']] },
  { tipo: 'lampiao', lado: 'frente', casasW: 0.5, casasH: 0.5, materiais: [['ferro'], ['latao']] },
  { tipo: 'quadroDeAvisos', lado: 'frente', casasW: 1, casasH: 0.4, materiais: [['nogueira'], ['pinho'], ['velha']] },
  { tipo: 'poco', lado: 'frente', casasW: 1.5, casasH: 1.5, materiais: [['granito', 'carvalho'], ['arenito', 'nogueira'], ['ardosia', 'velha']] },
  { tipo: 'barraca', lado: 'frente', casasW: 2, casasH: 2, materiais: [['vinho', 'pinho'], ['azul', 'nogueira'], ['ocre', 'velha']] },
  { tipo: 'barraca', lado: 'lado', casasW: 2, casasH: 2, materiais: [['vinho', 'pinho'], ['musgo', 'nogueira'], ['linho', 'velha']] },
  { tipo: 'carroca', lado: 'frente', casasW: 2, casasH: 1.25, materiais: [['nogueira', 'ferro'], ['pinho', 'latao'], ['velha', 'ferro']] },
  { tipo: 'carroca', lado: 'lado', casasW: 2, casasH: 1.25, materiais: [['nogueira', 'ferro'], ['carvalho', 'latao'], ['velha', 'ferro']] },
]

function desenho(caso: Pick<Caso, 'tipo' | 'lado' | 'casasW' | 'casasH' | 'variante'>, materiais: readonly OpcaoDeMaterial[], semente = 7): DesenhoDoMovel {
  return { tipo: caso.tipo, lado: caso.lado, materiais, casasW: caso.casasW, casasH: caso.casasH, semente, variante: caso.variante }
}

function nomeDo(caso: Caso, materiais: readonly OpcaoDeMaterial[]): string {
  return `${caso.tipo}${caso.lado === 'lado' ? ' de lado' : ''}${caso.rotulo === undefined ? '' : ` (${caso.rotulo})`} ${materiais.join('+')}`
}

interface Imagem {
  readonly px: Uint8ClampedArray
  readonly W: number
  readonly H: number
  readonly S: number
  readonly x0: number
  readonly y0: number
}

function imagem(d: DesenhoDoMovel, nivel: number): Imagem {
  const S = escalaDoNivel(nivel)
  const { limites, pixels } = pintarMovel(d, S)
  return { px: pixels, W: limites.W, H: limites.H, S, x0: limites.x0, y0: limites.y0 }
}

/** O pixel do ponto (x, y) em px do protótipo (centro do móvel na origem). */
function noPonto(im: Imagem, x: number, y: number): number {
  const i = Math.min(im.W - 1, Math.max(0, Math.floor((x - im.x0) * im.S)))
  const j = Math.min(im.H - 1, Math.max(0, Math.floor((y - im.y0) * im.S)))
  return (j * im.W + i) * 4
}

function brilho(px: Uint8ClampedArray, o: number): number {
  return (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255
}

/** Brilho médio dos pixels opacos dentro do círculo de raio r0..r1 em volta de (cx, cy). */
function brilhoNoAnel(im: Imagem, cx: number, cy: number, r0: number, r1: number): number {
  let soma = 0
  let n = 0
  for (let j = 0; j < im.H; j += 1) {
    for (let i = 0; i < im.W; i += 1) {
      const x = im.x0 + (i + 0.5) / im.S
      const y = im.y0 + (j + 0.5) / im.S
      const r = Math.hypot(x - cx, y - cy)
      const o = (j * im.W + i) * 4
      if (r < r0 || r > r1 || im.px[o + 3] < ALFA_OPACO) continue
      soma += brilho(im.px, o)
      n += 1
    }
  }
  return n > 0 ? soma / n : NaN
}

/** Trechos opacos seguidos na linha de pixels do y (px do protótipo). */
function trechosNaLinha(im: Imagem, y: number): number[] {
  const j = Math.min(im.H - 1, Math.max(0, Math.floor((y - im.y0) * im.S)))
  const trechos: number[] = []
  let atual = 0
  for (let i = 0; i < im.W; i += 1) {
    if (im.px[(j * im.W + i) * 4 + 3] >= ALFA_DE_PECA) atual += 1
    else if (atual > 0) {
      trechos.push(atual)
      atual = 0
    }
  }
  if (atual > 0) trechos.push(atual)
  return trechos
}

describe('peças novas da MT4: pixels medidos', () => {
  for (const caso of CASOS_MT4) {
    for (const materiais of caso.materiais) {
      for (const nivel of NIVEIS) {
        it(`${nomeDo(caso, materiais)} no nível ${nivel}: cobre, cor contida, claro, contorno nunca preto, preto levantado, opaca`, () => {
          const S = escalaDoNivel(nivel)
          const { limites, pixels } = pintarMovel(desenho(caso, materiais), S)
          const m = medirImagem(pixels, limites.W, limites.H, caso.casasW * G * S * (caso.casasH * G * S))
          expect(m.cobertura).toBeGreaterThanOrEqual(COBERTURA_MINIMA)
          expect(m.saturacaoP95).toBeLessThanOrEqual(SATURACAO_P95_MAXIMA)
          expect(m.brilhoMedio).toBeGreaterThanOrEqual(BRILHO_MEDIO_MINIMO)
          expect(m.contornoMinimo).toBeGreaterThanOrEqual(CONTORNO_MINIMO)
          expect(m.brilhoMinimo).toBeGreaterThanOrEqual(CONTORNO_MINIMO)
          expect(m.luminanciaLinearMinima).toBeGreaterThanOrEqual(LUMINANCIA_LINEAR_MINIMA)
          expect(m.opacidadeDosOpacos).toBeGreaterThanOrEqual(OPACIDADE_DOS_OPACOS_MINIMA)
          expect(m.opacidadeDoMiolo).toBeGreaterThanOrEqual(OPACIDADE_DO_MIOLO_MINIMA)
          expect(mioloTranslucido(pixels, limites.W, limites.H), 'miolo abaixo do opaco').toBeLessThanOrEqual(MIOLO_TRANSLUCIDO_MAXIMO)
        })
      }
    }
  }
})

describe('peças novas da MT4: mesma entrada, mesma imagem', () => {
  for (const caso of CASOS_MT4.filter((c) => c.materiais.length > 1)) {
    it(`${nomeDo(caso, caso.materiais[0])}: duas gerações dão a mesma digital, outro material dá outra`, () => {
      const S = escalaDoNivel(3)
      const a = pintarMovel(desenho(caso, caso.materiais[0]), S)
      const b = pintarMovel(desenho(caso, caso.materiais[0]), S)
      const outro = pintarMovel(desenho(caso, caso.materiais[1]), S)
      expect(digitalDosPixels(b.pixels)).toBe(digitalDosPixels(a.pixels))
      expect(digitalDosPixels(outro.pixels)).not.toBe(digitalDosPixels(a.pixels))
    })
  }
})

describe('peças novas da MT4: volume reconhecível a 1x e a 3x', () => {
  for (const caso of CASOS_MT4) {
    for (const nivel of [1, 3]) {
      it(`${nomeDo(caso, caso.materiais[0])} no nível ${nivel}: faz sombra no chão e tem luz e sombra no corpo`, () => {
        const im = imagem(desenho(caso, caso.materiais[0]), nivel)
        let sombra = 0
        const brilhos: number[] = []
        for (let o = 0; o < im.px.length; o += 4) {
          const a = im.px[o + 3]
          if (a > 8 && a < ALFA_DE_PECA) sombra += 1
          if (a >= ALFA_OPACO) brilhos.push(brilho(im.px, o))
        }
        brilhos.sort((x, y) => x - y)
        const p10 = brilhos[Math.floor(brilhos.length * 0.1)]
        const p90 = brilhos[Math.floor(brilhos.length * 0.9)]
        // Sombra: pelo menos 3% dos pixels da imagem; luz: o chanfro e as faces separam o claro do escuro.
        expect(sombra / (im.W * im.H)).toBeGreaterThan(0.03)
        expect(p90 - p10).toBeGreaterThanOrEqual(0.06)
      })
    }
  }
})

/** Medida de tempo (só com `BENCH_MOVEIS=1`): a fria de cada peça, a primeira do arquivo, e a mediana morna de 5, a 3x. */
const BENCH = import.meta.env.BENCH_MOVEIS === '1'
describe.skipIf(!BENCH)('peças novas da MT4: tempo a 3x (registro)', () => {
  it('fria e mediana morna de cada caso no padrão', () => {
    const S = escalaDoNivel(3)
    const linhas: string[] = []
    for (const caso of CASOS_MT4) {
      const d = desenho(caso, caso.materiais[0])
      const medir = (): number => {
        const t0 = performance.now()
        pintarMovel(d, S)
        return performance.now() - t0
      }
      const fria = medir()
      const mornas = [medir(), medir(), medir(), medir(), medir()].sort((a, b) => a - b)
      linhas.push(`${nomeDo(caso, caso.materiais[0])}: fria ${fria.toFixed(1)} ms, morna ${mornas[2].toFixed(1)} ms`)
      expect(mornas[2], nomeDo(caso, caso.materiais[0])).toBeLessThanOrEqual(50)
    }
    console.log(`[medida MT4 a 3x]\n${linhas.join('\n')}`)
  })
})

describe('peças novas da MT4: o que cada peça é', () => {
  const S3 = 3

  it('mesas quadrada e redonda: tampo solto (sombra além da pegada) e a cor da mesa antiga do mesmo material', () => {
    for (const madeira of ['carvalho', 'nogueira', 'velha'] as const) {
      const antiga = imagem({ tipo: 'mesa', lado: 'frente', materiais: [madeira], casasW: 2, casasH: 1, semente: 7 }, S3)
      for (const tipo of ['mesaQuadrada', 'mesaRedonda'] as const) {
        const lado = tipo === 'mesaQuadrada' ? 1 : 1.25
        const im = imagem({ tipo, lado: 'frente', materiais: [madeira], casasW: lado, casasH: lado, semente: 7 }, S3)
        expect(distanciaOklab(oklabMedio(im.px, im.W, im.H), oklabMedio(antiga.px, antiga.W, antiga.H)), `${tipo} ${madeira}`).toBeLessThan(0.05)
        // A sombra do tampo cai além da pegada, embaixo à direita: logo depois do canto (quadrada) ou da borda na diagonal (redonda).
        const alem = tipo === 'mesaQuadrada' ? (lado * G) / 2 + 3 : (lado * G * Math.SQRT1_2) / 2 + 3
        const fora = im.px[noPonto(im, alem, alem) + 3]
        expect(fora, `${tipo} ${madeira}: sombra fora da pegada`).toBeGreaterThan(8)
        expect(fora).toBeLessThan(ALFA_DE_PECA)
      }
    }
  })

  it('mesa redonda: o canto da pegada é chão, o meio é tampo', () => {
    const lado = 1.25 * G
    const im = imagem({ tipo: 'mesaRedonda', lado: 'frente', materiais: ['carvalho'], casasW: 1.25, casasH: 1.25, semente: 7 }, S3)
    expect(im.px[noPonto(im, -lado / 2 + 2, -lado / 2 + 2) + 3]).toBeLessThan(ALFA_DE_PECA)
    expect(im.px[noPonto(im, 0, 0) + 3]).toBeGreaterThanOrEqual(ALFA_OPACO)
  })

  it('lápide: os 3 desenhos são diferentes entre si', () => {
    const base = { tipo: 'lapide', lado: 'frente', casasW: 0.6, casasH: 0.35 } as const
    const digitais = [0, 1, 2].map((variante) => digitalDosPixels(imagem(desenho({ ...base, variante }, ['granito']), S3).px))
    expect(new Set(digitais).size).toBe(3)
  })

  it('poço: borda de pedra clara, água escura no meio, e o balde em cima da borda', () => {
    for (const materiais of [['granito', 'carvalho'], ['ardosia', 'velha']] as const) {
      const im = imagem({ tipo: 'poco', lado: 'frente', materiais, casasW: 1.5, casasH: 1.5, semente: 7 }, S3)
      const k = (0.75 * G) / 32.5
      const agua = brilhoNoAnel(im, 0, 8 * k, 0, 8 * k)
      const borda = brilhoNoAnel(im, 0, 0, 18.5 * k, 25 * k)
      expect(borda - agua, materiais.join('+')).toBeGreaterThan(0.12)
      expect(im.px[noPonto(im, 17.5 * k, 15.5 * k) + 3], 'balde').toBeGreaterThanOrEqual(ALFA_OPACO)
    }
  })

  it('lampião aceso como no protótipo da vila: vidro âmbar sem chama, miolo claro junto ao chapéu, sem rebites, halo fraco e sombra do poste que se lê a 1x', () => {
    const meia = 0.25 * G
    const k = meia / 6.6
    const saturacao = (px: Uint8ClampedArray, o: number): number => {
      const mx = Math.max(px[o], px[o + 1], px[o + 2])
      return mx > 0 ? (mx - Math.min(px[o], px[o + 1], px[o + 2])) / mx : 0
    }
    for (const metal of ['ferro', 'latao'] as const) {
      const im = imagem({ tipo: 'lampiao', lado: 'frente', materiais: [metal], casasW: 0.5, casasH: 0.5, semente: 7 }, S3)
      // O vidro aparece entre o chapéu (3,4k) e a borda (6,2k): a faixa de cima, quente (R > G > B) e âmbar.
      let somaSat = 0
      let n = 0
      for (let x = -2.5 * k; x <= 2.5 * k; x += 0.5 / S3) {
        const o = noPonto(im, x, -5.6 * k)
        expect(im.px[o], `${metal}: vidro quente`).toBeGreaterThan(im.px[o + 1])
        expect(im.px[o + 1]).toBeGreaterThan(im.px[o + 2])
        somaSat += saturacao(im.px, o)
        n += 1
      }
      expect(somaSat / n, `${metal}: vidro âmbar, não pálido`).toBeGreaterThan(0.3)
      // O miolo aceso, colado no chapéu, é mais claro que o meio do vidro.
      expect(brilho(im.px, noPonto(im, 0, -3.8 * k)), `${metal}: miolo`).toBeGreaterThan(brilho(im.px, noPonto(im, 0, -5 * k)) + 0.03)
      // Sem os 4 rebites das quinas: ali é vidro, não metal.
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) expect(saturacao(im.px, noPonto(im, sx * 5.3 * k, sy * 5.3 * k)), `${metal}: quina ${sx},${sy}`).toBeGreaterThan(0.3)
      // Halo: em cima à esquerda, longe da sombra, a luz quente fraca (alfa até 0,12); nada de corpo fora da pegada.
      const halo = noPonto(im, -0.45 * G, -0.45 * G)
      expect(im.px[halo + 3], `${metal}: halo`).toBeGreaterThan(3)
      expect(im.px[halo + 3]).toBeLessThanOrEqual(0.12 * 255)
      expect(im.px[halo], `${metal}: halo quente`).toBeGreaterThan(im.px[halo + 2])
      for (let j = 0; j < im.H; j += 1) {
        for (let i = 0; i < im.W; i += 1) {
          const x = im.x0 + (i + 0.5) / im.S
          const y = im.y0 + (j + 0.5) / im.S
          if (Math.abs(x) <= meia + 1 && Math.abs(y) <= meia + 1) continue
          expect(im.px[(j * im.W + i) * 4 + 3], `${metal}: fora do corpo em (${x.toFixed(1)}, ${y.toFixed(1)})`).toBeLessThan(ALFA_DE_PECA)
        }
      }
    }
    // A sombra do poste diz "poste": a 1x, além da pegada, forte (alfa >= 0,28) e com 2 px ou mais de largura.
    const im1 = imagem({ tipo: 'lampiao', lado: 'frente', materiais: ['ferro'], casasW: 0.5, casasH: 0.5, semente: 7 }, 1)
    const H = 1.3 * G
    const [px0, py0] = [0.27 * H * 0.93, 0.21 * H * 0.93]
    expect(im1.px[noPonto(im1, px0, py0) + 3], 'sombra do poste').toBeGreaterThanOrEqual(0.28 * 255)
    const [nx, ny] = [-0.21 / Math.hypot(0.21, 0.27), 0.27 / Math.hypot(0.21, 0.27)]
    let largura = 0
    for (let t = -6; t <= 6; t += 1 / im1.S) if (im1.px[noPonto(im1, px0 + nx * t, py0 + ny * t) + 3] >= 0.18 * 255) largura += 1
    expect(largura, 'largura da sombra do poste a 1x, em px').toBeGreaterThanOrEqual(2)
  })

  it('vaso: folhas verdes no meio e a boca do vaso em volta', () => {
    const im = imagem({ tipo: 'vaso', lado: 'frente', materiais: ['barro'], casasW: 0.5, casasH: 0.5, semente: 7 }, S3)
    const meio = noPonto(im, 0, 0)
    expect(im.px[meio + 1]).toBeGreaterThan(im.px[meio])
    const boca = noPonto(im, 0.25 * G * 0.88, 0)
    expect(im.px[boca + 3]).toBeGreaterThanOrEqual(ALFA_OPACO)
    expect(im.px[boca]).toBeGreaterThan(im.px[boca + 1])
  })

  it('vaso: o anel da boca é uma camada só, opaca (alfa >= 250 entre 6,2k e 7,4k, nos níveis 2 e 3)', () => {
    const k = (0.25 * G) / 7.8
    for (const vaso of ['barro', 'arenito', 'granito'] as const) {
      for (const nivel of [2, 3]) {
        const im = imagem({ tipo: 'vaso', lado: 'frente', materiais: [vaso], casasW: 0.5, casasH: 0.5, semente: 7 }, nivel)
        let menor = 255
        for (let j = 0; j < im.H; j += 1) {
          for (let i = 0; i < im.W; i += 1) {
            const r = Math.hypot(im.x0 + (i + 0.5) / im.S, im.y0 + (j + 0.5) / im.S)
            if (r >= 6.2 * k && r <= 7.4 * k) menor = Math.min(menor, im.px[(j * im.W + i) * 4 + 3])
          }
        }
        expect(menor, `${vaso} no nível ${nivel}`).toBeGreaterThanOrEqual(250)
      }
    }
  })

  it('barraca de frente: a água de cima do toldo é mais clara que a de baixo', () => {
    const im = imagem({ tipo: 'barraca', lado: 'frente', materiais: ['vinho', 'pinho'], casasW: 2, casasH: 2, semente: 7 }, S3)
    const cima = brilhoNoAnel(im, -0.55 * G, -0.45 * G, 0, 4)
    const baixo = brilhoNoAnel(im, -0.55 * G, 0.25 * G, 0, 4)
    expect(cima - baixo).toBeGreaterThan(0.04)
  })

  it('barraca de lado: dois esteios com o vão aberto entre eles, o toldo em cima e o balcão embaixo', () => {
    for (const nivel of [1, 3]) {
      const im = imagem({ tipo: 'barraca', lado: 'lado', materiais: ['vinho', 'pinho'], casasW: 2, casasH: 2, semente: 7 }, nivel)
      const h = 2 * G
      const noVao = trechosNaLinha(im, -h / 2 + 0.48 * h)
      expect(noVao.length, `nível ${nivel}: esteios`).toBe(2)
      expect(trechosNaLinha(im, -h / 2 + 0.15 * h).length, 'toldo inteiro').toBe(1)
      expect(trechosNaLinha(im, -h / 2 + 0.8 * h).length, 'balcão inteiro').toBe(1)
    }
  })

  it('carroça de lado: a roda de raios (chão entre eles) e, no chão, só a roda e a ponta do varal', () => {
    for (const nivel of [1, 3]) {
      const im = imagem({ tipo: 'carroca', lado: 'lado', materiais: ['nogueira', 'ferro'], casasW: 2, casasH: 1.25, semente: 7 }, nivel)
      const w = 2 * G
      const h = 1.25 * G
      const R = Math.min(0.4 * h, 0.27 * w)
      const cx = 0.12 * w
      const cy = h / 2 - R
      let vazio = 0
      let cheio = 0
      for (let k = 0; k < 64; k += 1) {
        const a = (k / 64) * 2 * Math.PI
        const o = noPonto(im, cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55)
        if (im.px[o + 3] >= ALFA_DE_PECA) cheio += 1
        else vazio += 1
      }
      expect(cheio, `nível ${nivel}: raios`).toBeGreaterThan(4)
      expect(vazio, `nível ${nivel}: vão entre os raios`).toBeGreaterThan(8)
      expect(trechosNaLinha(im, h / 2 - 1).length, `nível ${nivel}: roda e varal no chão`).toBe(2)
    }
  })
})
