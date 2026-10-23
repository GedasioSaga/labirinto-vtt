import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { geometriaDaCerca } from '../../../lib/mobilia'
import type { FormaDoTapete } from '../../../types/map'
import type { OpcaoDeMaterial } from '../materiais'
import { CINZA, G, type LadoDoMovel } from './contexto'
import { escalaDoNivel, montarCena, pintarMovel, type DesenhoDoMovel, type TipoComTextura } from './index'
import { ALFA_DE_PECA, ALFA_OPACO, digitalDosPixels, medirImagem } from './medidas.testkit'
import { distanciaAoMotivo, PERIODO_DO_MOTIVO } from './tapete'

/**
 * Os 5 móveis da fatia MT3 (cerca reta e curva, armário, aparador, fogueira e
 * tapete), cada um em 3 materiais, nas vistas que o tipo tem
 * (`TIPOS_COM_VISTA`), nos níveis 1, 2 e 3, pelos mesmos critérios da MT2
 * (`moveis.test.ts`): a imagem cobre a pegada, a cor é contida, nada some de
 * tão escuro, o contorno nunca é preto, o preto é levantado e a peça é opaca.
 * Mais o que é de cada tipo: a cerca acompanha o comprimento e a curva sem
 * esticar o padrão, a fogueira parada não tem chama, e a borda do tapete se
 * repete por casa.
 *
 * A semente aqui é fixa (7); a do app e a varredura das 1000 estão em
 * `pixi/rasterDosMoveis.sementesMt3.test.ts`.
 */

const COBERTURA_MINIMA = 0.25
const SATURACAO_P95_MAXIMA = 0.62
const BRILHO_MEDIO_MINIMO = 0.17
const CONTORNO_MINIMO = 0.06
const LUMINANCIA_LINEAR_MINIMA = 0.03
const OPACIDADE_DOS_OPACOS_MINIMA = 0.98
const OPACIDADE_DO_MIOLO_MINIMA = 0.96
const GERAR_A_3X_MS = 50
const NIVEIS = [1, 2, 3] as const

interface Caso {
  readonly tipo: TipoComTextura
  readonly lado: LadoDoMovel
  readonly casasW: number
  readonly casasH: number
  readonly materiais: readonly (readonly OpcaoDeMaterial[])[]
  readonly forma?: FormaDoTapete
  readonly curva?: number
  readonly rotulo?: string
}

/**
 * Tamanho padrão de cada tipo e vista (`lib/mobilia.ts`). Os materiais cobrem
 * a madeira mais escura (nogueira), a mais cinza (velha) e, em cada tipo, a
 * escolha mais diferente do padrão; na cerca, as 3 ligações.
 */
const CASOS_MT3: readonly Caso[] = [
  { tipo: 'cerca', lado: 'frente', casasW: 2, casasH: 0.25, materiais: [['carvalho', 'varas'], ['nogueira', 'corda'], ['velha', 'arame']] },
  { tipo: 'cerca', lado: 'frente', casasW: 2, casasH: 0.25, curva: 90, materiais: [['carvalho', 'varas'], ['pinho', 'corda'], ['velha', 'arame']], rotulo: 'curva 90' },
  { tipo: 'cerca', lado: 'frente', casasW: 3, casasH: 0.25, curva: 180, materiais: [['nogueira', 'arame']], rotulo: 'meia volta' },
  { tipo: 'cerca', lado: 'frente', casasW: 0.25, casasH: 3, materiais: [['cerejeira', 'varas']], rotulo: 'em pé' },
  { tipo: 'armario', lado: 'frente', casasW: 1, casasH: 0.5, materiais: [['pinho', 'ferro'], ['nogueira', 'latao'], ['velha', 'ferro']] },
  { tipo: 'armario', lado: 'lado', casasW: 1, casasH: 1.5, materiais: [['pinho', 'ferro'], ['nogueira', 'latao'], ['velha', 'latao']] },
  { tipo: 'aparador', lado: 'frente', casasW: 2, casasH: 0.5, materiais: [['nogueira', 'latao'], ['cerejeira', 'latao'], ['velha', 'ferro']] },
  { tipo: 'aparador', lado: 'lado', casasW: 2, casasH: 0.9, materiais: [['nogueira', 'latao'], ['pinho', 'ferro'], ['velha', 'latao']] },
  { tipo: 'fogueira', lado: 'frente', casasW: 1, casasH: 1, materiais: [['granito', 'lenhaCarvalho'], ['arenito', 'lenhaPinho'], ['ardosia', 'lenhaBetula']] },
  { tipo: 'fogueira', lado: 'lado', casasW: 1, casasH: 1.25, materiais: [['granito', 'lenhaCarvalho'], ['arenito', 'lenhaPinho'], ['ardosia', 'lenhaBetula']] },
  { tipo: 'tapete', lado: 'frente', casasW: 3, casasH: 2, materiais: [['azul'], ['vinho'], ['linho']] },
  { tipo: 'tapete', lado: 'frente', casasW: 2, casasH: 2, forma: 'redondo', materiais: [['ocre'], ['musgo'], ['azul']], rotulo: 'redondo' },
  { tipo: 'tapete', lado: 'lado', casasW: 3, casasH: 0.25, materiais: [['azul'], ['vinho'], ['linho']] },
  { tipo: 'tapete', lado: 'lado', casasW: 2, casasH: 0.25, forma: 'redondo', materiais: [['ocre']], rotulo: 'redondo' },
  { tipo: 'tapete', lado: 'frente', casasW: 2, casasH: 3, materiais: [['vinho']], rotulo: 'em pé' },
]

function desenho(caso: Caso, materiais: readonly OpcaoDeMaterial[], semente = 7): DesenhoDoMovel {
  return { tipo: caso.tipo, lado: caso.lado, materiais, casasW: caso.casasW, casasH: caso.casasH, semente, forma: caso.forma, curva: caso.curva }
}

function nomeDo(caso: Caso, materiais: readonly OpcaoDeMaterial[]): string {
  const extra = caso.rotulo === undefined ? '' : ` (${caso.rotulo} ${caso.casasW}x${caso.casasH})`
  return `${caso.tipo}${caso.lado === 'lado' ? ' de lado' : ''} ${materiais.join('+')}${extra}`
}

describe('móveis da MT3 de cima: pixels medidos', () => {
  for (const caso of CASOS_MT3) {
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

describe('móveis da MT3: mesma entrada, mesma imagem', () => {
  for (const caso of CASOS_MT3.filter((c) => c.materiais.length > 1)) {
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

/** Larguras (em pixels) dos trechos opacos seguidos de uma linha da imagem. */
function trechosOpacos(px: Uint8ClampedArray, W: number, linha: number): number[] {
  const trechos: number[] = []
  let atual = 0
  for (let x = 0; x < W; x += 1) {
    if (px[(linha * W + x) * 4 + 3] >= ALFA_OPACO) atual += 1
    else if (atual > 0) {
      trechos.push(atual)
      atual = 0
    }
  }
  if (atual > 0) trechos.push(atual)
  return trechos
}

describe('cerca: a imagem acompanha o comprimento e a curva sem esticar o padrão', () => {
  const S = escalaDoNivel(3)
  const cerca = (casasW: number, curva: number, ligacao: OpcaoDeMaterial = 'arame'): DesenhoDoMovel => ({ tipo: 'cerca', lado: 'frente', materiais: ['carvalho', ligacao], casasW, casasH: 0.25, semente: 7, curva })

  it('reta de 2, 3, 4,5 e 7 casas: um mourão a cada ~1 casa, do mesmo tamanho em pixels, e a imagem cresce com o comprimento', () => {
    const larguras: number[] = []
    for (const casas of [2, 3, 4.5, 7]) {
      const d = cerca(casas, 0)
      const geometria = geometriaDaCerca(casas * G, 0.25 * G, 0)
      if (geometria === null) throw new Error('cerca sem geometria')
      const { limites, pixels } = pintarMovel(d, S)
      // No eixo da cerca de arame só os mourões são opacos (os fios correm afastados dele): a linha de pixels mais perto de y = 0.
      const linha = Math.round(-limites.y0 * S - 0.5)
      const trechos = trechosOpacos(pixels, limites.W, linha)
      expect(trechos.length, `${casas} casas`).toBe(geometria.mouroes.length)
      larguras.push(...trechos)
      const vaos = geometria.mouroes.slice(1).map((m, i) => m.x - geometria.mouroes[i].x)
      for (const vao of vaos) expect(vao / G, `${casas} casas`).toBeGreaterThan(0.75)
      for (const vao of vaos) expect(vao / G, `${casas} casas`).toBeLessThan(1.34)
      expect(limites.W / S, `${casas} casas`).toBeGreaterThan(casas * G)
    }
    // O mourão tem a mesma largura em toda cerca (±1 pixel): o padrão não estica.
    expect(Math.max(...larguras) - Math.min(...larguras)).toBeLessThanOrEqual(1)
  })

  it('curva de 90 e de 180 graus: os mourões seguem o arco do desenho de linhas, a imagem dobra junto e o mourão segue redondo', () => {
    const reta = pintarMovel(cerca(3, 0), S)
    for (const curva of [90, 180]) {
      const geometria = geometriaDaCerca(3 * G, 0.25 * G, curva)
      if (geometria === null || geometria.arco === null) throw new Error('cerca sem arco')
      const curvada = pintarMovel(cerca(3, curva), S)
      // A curva arqueia para baixo (a normal da cerca deitada): a imagem cresce pela flecha do arco.
      const ys = geometria.mouroes.map((m) => m.y)
      const flecha = Math.max(...ys) - Math.min(...ys)
      expect(flecha, `${curva}°`).toBeGreaterThan(G * 0.5)
      expect(curvada.limites.H - reta.limites.H, `${curva}°`).toBeGreaterThanOrEqual(Math.floor(flecha * S) - 2)
      // Cada mourão da geometria é opaco no centro na imagem curvada.
      for (const m of geometria.mouroes) {
        const i = Math.floor((m.x - curvada.limites.x0) * S)
        const j = Math.floor((m.y - curvada.limites.y0) * S)
        expect(curvada.pixels[(j * curvada.limites.W + i) * 4 + 3], `${curva}° mourão em (${m.x.toFixed(1)}, ${m.y.toFixed(1)})`).toBeGreaterThanOrEqual(ALFA_OPACO)
      }
      // O mourão é a mesma elipse da reta (raio da espessura), não esticado pela curva.
      const cena = montarCena(cerca(3, curva))
      const topos = cena.partes.filter((p) => p.mat === cena.partes[cena.partes.length - 1].mat && p.forma.b[2] - p.forma.b[0] < G * 0.3)
      for (const t of topos) expect((t.forma.b[2] - t.forma.b[0]) / (t.forma.b[3] - t.forma.b[1])).toBeCloseTo(1, 6)
    }
  })
})

describe('fogueira parada: sem chama na imagem', () => {
  const S = escalaDoNivel(3)

  it('de lado, o alto do objeto (onde a chama animada sobe) fica sem peça pintada', () => {
    const d: DesenhoDoMovel = { tipo: 'fogueira', lado: 'lado', materiais: ['granito', 'lenhaCarvalho'], casasW: 1, casasH: 1.25, semente: 7 }
    const { limites, pixels } = pintarMovel(d, S)
    const hh = (1.25 * G) / 2
    // A lenha sobe até 0,56 da altura (a partir de cima), menos o raio dela: acima de 0,5 só pode haver o vazio.
    const limite = -hh + 0.5 * 1.25 * G
    const linhas = Math.floor((limite - limites.y0) * S)
    let pintados = 0
    for (let j = 0; j < linhas; j += 1) for (let i = 0; i < limites.W; i += 1) if (pixels[(j * limites.W + i) * 4 + 3] >= ALFA_DE_PECA) pintados += 1
    expect(pintados).toBe(0)
  })

  it('de cima e de lado, toda peça é pedra, lenha ou cinza (nenhuma camada de chama)', () => {
    for (const lado of ['frente', 'lado'] as const) {
      const cena = montarCena({ tipo: 'fogueira', lado, materiais: ['granito', 'lenhaCarvalho'], casasW: 1, casasH: lado === 'lado' ? 1.25 : 1, semente: 7 })
      for (const p of cena.partes) expect(p.mat === CINZA || p.mat.classe === 'pedra' || p.mat.classe === 'casca', `${lado}: ${p.mat.classe}`).toBe(true)
    }
  })
})

describe('tapete: a borda se repete por casa', () => {
  it('o motivo é periódico em meia casa (logo, em uma casa) e simétrico em volta do centro', () => {
    for (const borda of [6.7, 13.4]) {
      for (let s = -3 * G; s <= 3 * G; s += 0.37) {
        for (const v of [-borda / 3, 0, borda / 4]) {
          expect(distanciaAoMotivo(s + G, v, borda)).toBeCloseTo(distanciaAoMotivo(s, v, borda), 9)
          expect(distanciaAoMotivo(s + PERIODO_DO_MOTIVO, v, borda)).toBeCloseTo(distanciaAoMotivo(s, v, borda), 9)
          expect(distanciaAoMotivo(-s, v, borda)).toBeCloseTo(distanciaAoMotivo(s, v, borda), 9)
        }
      }
    }
  })

  it('nos pixels: no meio da faixa de cima de tapetes de 3 e 4 casas, cada casa de borda repete a anterior (correlação ≥ 0,9)', () => {
    const S = escalaDoNivel(3)
    const umaCasa = Math.round(G * S)
    for (const casasW of [3, 4]) {
      const d: DesenhoDoMovel = { tipo: 'tapete', lado: 'frente', materiais: ['vinho'], casasW, casasH: 2, semente: 7 }
      const { limites, pixels } = pintarMovel(d, S)
      const borda = 0.12 * 2 * G
      const linha = Math.floor((-G + borda / 2 - limites.y0) * S)
      const brilho = (i: number): number => {
        const o = (linha * limites.W + i) * 4
        return 0.2126 * pixels[o] + 0.7152 * pixels[o + 1] + 0.0722 * pixels[o + 2]
      }
      const centro = Math.floor((0 - limites.x0) * S)
      const a: number[] = []
      const b: number[] = []
      for (let k = -umaCasa; k < 0; k += 1) {
        a.push(brilho(centro + k))
        b.push(brilho(centro + k + umaCasa))
      }
      const media = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length
      const ma = media(a)
      const mb = media(b)
      let cov = 0
      let va = 0
      let vb = 0
      for (let i = 0; i < a.length; i += 1) {
        cov += (a[i] - ma) * (b[i] - mb)
        va += (a[i] - ma) ** 2
        vb += (b[i] - mb) ** 2
      }
      expect(cov / Math.sqrt(va * vb), `${casasW} casas`).toBeGreaterThanOrEqual(0.9)
    }
  })
})

/** Os casos do tamanho padrão, no primeiro material: os que o tempo mede. */
const CASOS_DO_TEMPO = CASOS_MT3.filter((c) => c.rotulo === undefined || c.rotulo === 'curva 90' || c.rotulo === 'redondo')

describe('móveis da MT3: tempo de geração a 3x (teto folgado da suíte)', () => {
  /** Como na MT2: a melhor de 3 contra o dobro do orçamento; a medida de verdade é o bench `BENCH_MOVEIS=1`. */
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

const BENCH = import.meta.env.BENCH_MOVEIS === '1'

describe.skipIf(!BENCH)('BENCH_MOVEIS=1: tempo da MT3 a 3x, frio e morno, contra os 50 ms', () => {
  /** Mornas depois da fria: a mediana delas é o que a fila paga em regime. */
  const MORNAS = 5
  it('registra a geração fria (a primeira de cada caso) e a mediana morna de cada móvel', () => {
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
    // Saída do bench (pedida por variável de ambiente), como no da MT2: com BENCH_MOVEIS_ARQUIVO=<caminho> o registro vai para o arquivo.
    const registro = ['BENCH_MOVEIS da MT3 a 3x', ...linhas].join('\n')
    console.info(registro)
    const arquivo: unknown = import.meta.env.BENCH_MOVEIS_ARQUIVO
    if (typeof arquivo === 'string' && arquivo !== '') writeFileSync(arquivo, new TextEncoder().encode(`${registro}\n`))
    for (const mediana of medianas) expect(mediana).toBeLessThanOrEqual(GERAR_A_3X_MS)
  })
})
