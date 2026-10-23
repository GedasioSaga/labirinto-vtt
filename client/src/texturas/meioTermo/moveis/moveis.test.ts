import { describe, expect, it } from 'vitest'
import { oklabDoHex, type OpcaoDeMaterial, type Oklab } from '../materiais'
import { G, type LadoDoMovel } from './contexto'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel, type TipoComTextura } from './index'
import { digitalDosPixels, distanciaOklab, medirImagem, oklabMedio } from './medidas.testkit'

/**
 * Os 6 móveis "de cima com volume" da fatia MT2, cada um em 3 materiais, nos
 * níveis 1, 2 e 3, medidos pelos critérios do plano
 * (`docs/planos/meio-termo-texturas-objetos-2026-10-23.md`, linha MT2): a
 * imagem cobre a pegada, a cor é contida, nada some de tão escuro e o
 * contorno nunca é preto. Mais o piso do preto levantado (luminância linear
 * ≥ 0,03 em todo pixel opaco, revisão de design da MT2) e a peça inteira
 * opaca.
 *
 * Aqui a semente é fixa (7); a semente que o app dá (o hash do desenho, 0 a
 * 999) e a varredura das 1000 estão em `pixi/rasterDosMoveis.sementes.test.ts`.
 */

const COBERTURA_MINIMA = 0.25
const SATURACAO_P95_MAXIMA = 0.62
const BRILHO_MEDIO_MINIMO = 0.17
const CONTORNO_MINIMO = 0.06
const LUMINANCIA_LINEAR_MINIMA = 0.03
const OPACIDADE_DOS_OPACOS_MINIMA = 0.98
/** O miolo das peças: morde a peça a 90% de opacidade, que os pixels opacos nem contam (`medidas.testkit.ts`). */
const OPACIDADE_DO_MIOLO_MINIMA = 0.96
const GERAR_A_3X_MS = 50
const NIVEIS = [1, 2, 3] as const

interface Caso {
  readonly tipo: TipoComTextura
  readonly lado: LadoDoMovel
  readonly casasW: number
  readonly casasH: number
  readonly materiais: readonly (readonly OpcaoDeMaterial[])[]
  /** Nome extra no título (tamanho fora do padrão). */
  readonly rotulo?: string
}

/**
 * Tamanho padrão de cada tipo (`lib/mobilia.ts`, exato: a chave arredonda só
 * de 0,1 em 0,1 e o desenho usa o tamanho do objeto). Os materiais cobrem a
 * madeira mais escura (nogueira), a mais cinza (velha: o pior contorno com
 * latão e ferro) e a combinação mais saturada da cama (pinho + azul + azul).
 */
const CASOS: readonly Caso[] = [
  { tipo: 'barril', lado: 'frente', casasW: 0.7, casasH: 0.7, materiais: [['carvalho', 'ferro'], ['nogueira', 'latao'], ['velha', 'ferro']] },
  { tipo: 'caixa', lado: 'frente', casasW: 0.8, casasH: 0.8, materiais: [['pinho'], ['cerejeira'], ['nogueira']] },
  { tipo: 'bau', lado: 'frente', casasW: 1, casasH: 0.6, materiais: [['nogueira', 'latao'], ['carvalho', 'ferro'], ['cerejeira', 'latao'], ['velha', 'latao']] },
  { tipo: 'bau', lado: 'lado', casasW: 0.6, casasH: 0.6, materiais: [['nogueira', 'latao'], ['pinho', 'ferro'], ['velha', 'latao']] },
  { tipo: 'catre', lado: 'frente', casasW: 1, casasH: 2, materiais: [['carvalho', 'vinho', 'linho'], ['nogueira', 'azul', 'musgo'], ['pinho', 'ocre', 'vinho'], ['pinho', 'azul', 'azul']] },
  { tipo: 'mesa', lado: 'frente', casasW: 2, casasH: 1, materiais: [['carvalho'], ['nogueira'], ['velha']] },
  { tipo: 'cadeira', lado: 'frente', casasW: 0.5, casasH: 0.5, materiais: [['carvalho', 'palha'], ['nogueira', 'mesma'], ['pinho', 'palha']] },
  { tipo: 'cadeira', lado: 'lado', casasW: 0.5, casasH: 0.75, materiais: [['carvalho', 'palha'], ['nogueira', 'mesma'], ['cerejeira', 'palha']] },
  // Fora do padrão: a mesa grande de 4 x 2 casas e o barril e a caixa no menor tamanho que ainda se lê (0,3 casa).
  { tipo: 'mesa', lado: 'frente', casasW: 4, casasH: 2, materiais: [['nogueira']], rotulo: 'grande' },
  { tipo: 'barril', lado: 'frente', casasW: 0.3, casasH: 0.3, materiais: [['velha', 'latao']], rotulo: 'mínimo' },
  { tipo: 'caixa', lado: 'frente', casasW: 0.3, casasH: 0.3, materiais: [['nogueira']], rotulo: 'mínimo' },
]

function desenho(caso: Caso, materiais: readonly OpcaoDeMaterial[]): DesenhoDoMovel {
  return { tipo: caso.tipo, lado: caso.lado, materiais, casasW: caso.casasW, casasH: caso.casasH, semente: 7 }
}

function nomeDo(caso: Caso, materiais: readonly OpcaoDeMaterial[]): string {
  const extra = caso.rotulo === undefined ? '' : ` (${caso.rotulo} ${caso.casasW}x${caso.casasH})`
  return `${caso.tipo}${caso.lado === 'lado' ? ' de lado' : ''} ${materiais.join('+')}${extra}`
}

describe('móveis do Meio-Termo de cima: pixels medidos', () => {
  for (const caso of CASOS) {
    for (const materiais of caso.materiais) {
      for (const nivel of NIVEIS) {
        it(`${nomeDo(caso, materiais)} no nível ${nivel}: cobre, cor contida, claro, contorno nunca preto, preto levantado, opaca`, () => {
          const S = escalaDoNivel(nivel)
          const { limites, pixels } = pintarMovel(desenho(caso, materiais), S)
          const pegada = caso.casasW * G * S * (caso.casasH * G * S)
          const m = medirImagem(pixels, limites.W, limites.H, pegada)
          expect(m.cobertura).toBeGreaterThanOrEqual(COBERTURA_MINIMA)
          expect(m.saturacaoP95).toBeLessThanOrEqual(SATURACAO_P95_MAXIMA)
          expect(m.brilhoMedio).toBeGreaterThanOrEqual(BRILHO_MEDIO_MINIMO)
          expect(m.contornoMinimo).toBeGreaterThanOrEqual(CONTORNO_MINIMO)
          expect(m.brilhoMinimo).toBeGreaterThanOrEqual(CONTORNO_MINIMO)
          expect(m.luminanciaLinearMinima).toBeGreaterThanOrEqual(LUMINANCIA_LINEAR_MINIMA)
          expect(m.opacidadeDosOpacos).toBeGreaterThanOrEqual(OPACIDADE_DOS_OPACOS_MINIMA)
          expect(m.opacidadeDoMiolo).toBeGreaterThanOrEqual(OPACIDADE_DO_MIOLO_MINIMA)
        })
      }
    }
  }
})

describe('móveis do Meio-Termo de cima: mesma entrada, mesma imagem', () => {
  for (const caso of CASOS.filter((c) => c.materiais.length > 1)) {
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

describe('móveis do Meio-Termo de cima: madeiras que não se confundem (revisão de design da MT2)', () => {
  /** O chão padrão do app, onde a folha de contato e o mapa novo põem os móveis. */
  const CHAO = oklabDoHex('#a8776a')
  const S = escalaDoNivel(3)
  const corDa = (tipo: TipoComTextura, madeira: OpcaoDeMaterial, casasW: number, casasH: number): Oklab => {
    const { limites, pixels } = pintarMovel({ tipo, lado: 'frente', materiais: [madeira], casasW, casasH, semente: 7 }, S)
    return oklabMedio(pixels, limites.W, limites.H)
  }

  it('cerejeira: longe da nogueira (≥ 0,05) e do chão (≥ 0,09), na cor média da caixa pintada', () => {
    const cerejeira = corDa('caixa', 'cerejeira', 0.8, 0.8)
    const nogueira = corDa('caixa', 'nogueira', 0.8, 0.8)
    expect(distanciaOklab(cerejeira, nogueira)).toBeGreaterThanOrEqual(0.05)
    expect(distanciaOklab(cerejeira, CHAO)).toBeGreaterThanOrEqual(0.09)
  })

  it('carvalho e madeira velha: a mesa não some no chão (≥ 0,06 em OKLab, ≥ 0,04 só na luz)', () => {
    for (const madeira of ['carvalho', 'velha'] as const) {
      const mesa = corDa('mesa', madeira, 2, 1)
      expect(distanciaOklab(mesa, CHAO), madeira).toBeGreaterThanOrEqual(0.06)
      expect(CHAO[0] - mesa[0], madeira).toBeGreaterThanOrEqual(0.04)
    }
  })
})

/** Os casos do tamanho padrão, no primeiro material: os que o tempo mede. */
const CASOS_DO_TEMPO = CASOS.filter((c) => c.rotulo === undefined)

describe('móveis do Meio-Termo de cima: tempo de geração a 3x (teto folgado da suíte)', () => {
  /**
   * Na suíte, com outras suítes pesadas rodando ao lado, o relógio oscila: vale
   * a MELHOR de 3 gerações contra o dobro do orçamento. A medida de verdade
   * (fria e morna, contra os 50 ms) é o bench `BENCH_MOVEIS=1`, logo abaixo.
   */
  const RODADAS = 3
  const TETO_FOLGADO_MS = GERAR_A_3X_MS * 2
  for (const caso of CASOS_DO_TEMPO) {
    it(`${nomeDo(caso, caso.materiais[0])} a 3x em até ${TETO_FOLGADO_MS} ms (melhor de ${RODADAS})`, () => {
      const S = escalaDoNivel(3)
      let melhor = Infinity
      for (let i = 0; i < RODADAS; i += 1) {
        const inicio = performance.now()
        pintarMovel(desenho(caso, caso.materiais[0]), S)
        melhor = Math.min(melhor, performance.now() - inicio)
      }
      expect(melhor).toBeLessThanOrEqual(TETO_FOLGADO_MS)
    })
  }
})

/** No vitest, `import.meta.env` traz as variáveis do ambiente do processo. */
const BENCH = import.meta.env.BENCH_MOVEIS === '1'

describe.skipIf(!BENCH)('BENCH_MOVEIS=1: tempo a 3x, frio e morno, contra os 50 ms', () => {
  /** Mornas depois da fria: a mediana delas é o que a fila paga em regime. */
  const MORNAS = 5
  it('registra a geração fria (a primeira de cada tipo) e a mediana morna de cada móvel', () => {
    const S = escalaDoNivel(3)
    const linhas: string[] = []
    const medianas: number[] = []
    for (const caso of CASOS_DO_TEMPO) {
      const d = desenho(caso, caso.materiais[0])
      const inicio = performance.now()
      pintarMovel(d, S)
      const fria = performance.now() - inicio
      const mornas: number[] = []
      for (let i = 0; i < MORNAS; i += 1) {
        const t0 = performance.now()
        pintarMovel(d, S)
        mornas.push(performance.now() - t0)
      }
      mornas.sort((a, b) => a - b)
      const mediana = mornas[Math.floor(MORNAS / 2)]
      medianas.push(mediana)
      linhas.push(`${nomeDo(caso, caso.materiais[0])}: fria ${fria.toFixed(1)} ms, morna (mediana de ${MORNAS}) ${mediana.toFixed(1)} ms`)
    }
    // Saída do bench (pedida por variável de ambiente): o registro das medidas.
    console.info(['BENCH_MOVEIS a 3x', ...linhas].join('\n'))
    for (const mediana of medianas) expect(mediana).toBeLessThanOrEqual(GERAR_A_3X_MS)
  })
})
