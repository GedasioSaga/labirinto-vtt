import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'
import { facesDaRocha, pintarRocha, tomDaRocha, type TonsDaRocha } from './_rochaFacetada'

/**
 * Cristais ciano (lote L06 de 24/11/2026, item 59, o enfeite que mais se repete na cripta do mapa 8; versão dos
 * Cristais, desenho próprio no estilo Meio-Termo). Um NINHO de prismas ciano frio nascendo de um calombo de rocha: o
 * grande no meio quase em pé e os outros abrindo para fora. Cada prisma é sextavado, com a ponta de seis facetas, e
 * cada face toma o tom pela direção para onde olha (a luz de cima à esquerda e do alto, a das pedras); o pé é mais
 * fundo e a ponta acende, porque a luz vem de dentro (o miolo claro pintado na face mais acesa). O ciano é o do lote
 * (`texturas/meioTermo/moveis/pedestalComCristal.ts`): contido, puxado para o azul-acinzentado, nunca neon.
 *
 * Dos oito desenhos (um a cada 45° do giro), seis são o ninho, cada um com a sua arrumação, e dois (o 3 e o 6) são as
 * LASCAS SOLTAS: duas ou três lascas pequenas deitadas no chão, sem rocha, para espalhar perto dos jazigos.
 *
 * O cristal ILUMINA em volta (a tabela `LUZ_DOS_CARIMBOS` de `lib/luzDoFogo.ts`, parada, sem tremer: luz de pedra não
 * treme como fogo). O brilho é pintado no corpo, como nos Cristais verdes; nada pulsa. O giro gira o ninho em volta
 * do eixo e cada prisma no próprio eixo; a luz não gira.
 */

const CRISTAL_FUNDO: Rgb = [58, 114, 128]
const CRISTAL_ESCURO: Rgb = [82, 148, 162]
const CRISTAL_MEIO: Rgb = [122, 188, 199]
const CRISTAL_CLARO: Rgb = [174, 224, 229]
/** O reflexo da quina e o miolo aceso: o ciano quase branco da luz de dentro. */
const CRISTAL_REFLEXO: Rgb = [228, 244, 242]
/** A rocha da cripta, cinza frio com um fio do ciano dos cristais. */
const ROCHA: TonsDaRocha = { escura: [66, 72, 76], meia: [100, 106, 108], clara: [140, 146, 144] }
/** O calombo de onde os prismas nascem: o pé deles fica afundado no alto dele. */
const CALOMBO = { raio: 0.25, altura: 0.11 } as const
/** A luz do alto do calombo (o topo, de frente para o céu, como a dos Cristais). */
const LUZ_DO_ALTO = 0.5
/** Os desenhos que são as lascas soltas, e não o ninho. */
const DESENHOS_DE_LASCAS: readonly number[] = [3, 6]

type V3 = readonly [number, number, number]
type Ponto = readonly [number, number]

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function normalizar(v: V3): V3 {
  const n = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / n, v[1] / n, v[2] / n]
}

function escalar(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function vetorial(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function somar(a: V3, b: V3, k = 1): V3 {
  return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
}

/** Luz em 3D (x à direita, y para a frente no chão, z para cima): de cima à esquerda e do alto. */
const LUZ_3D = normalizar([-0.5, -0.55, 0.67])
/** A direção de quem vê: o ponto que anda nela não sai do lugar na tela. */
const OLHO = normalizar([0, 1, ACHATA])

function naTela(p: V3): Ponto {
  return [p[0], p[1] * ACHATA - p[2]]
}

/** O tom de uma face pelo quanto ela olha para a luz (-1 a 1) e por onde fica no prisma (o pé fundo, a ponta acesa). */
function tomDoCristal(luz: number): Rgb {
  const t = Math.min(1, Math.max(0, (luz + 1.02) / 1.5))
  if (t < 0.3) return misturar(CRISTAL_FUNDO, CRISTAL_ESCURO, t / 0.3)
  if (t < 0.62) return misturar(CRISTAL_ESCURO, CRISTAL_MEIO, (t - 0.3) / 0.32)
  return misturar(CRISTAL_MEIO, CRISTAL_CLARO, (t - 0.62) / 0.38)
}

function poligono(g: CanvasRenderingContext2D, pontos: readonly Ponto[], cor: string): void {
  g.fillStyle = cor
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
  g.fill()
}

interface Prisma {
  /** O pé no chão, antes do giro (o y do chão sem achatar). */
  readonly dx: number
  readonly dy: number
  /** O quanto ele fica em pé (radianos acima do chão; pi/2 = de pé). */
  readonly elevacao: number
  readonly comprimento: number
  readonly largura: number
  /** O quanto ele abre para o lado, além de apontar para fora do ninho. */
  readonly desvio: number
}

/** O ninho: o grande no meio e os outros em volta. Os dois últimos só entram em alguns desenhos. */
const PRISMAS: readonly Prisma[] = [
  { dx: 0, dy: 0, elevacao: 1.48, comprimento: 0.6, largura: 0.19, desvio: 0 },
  { dx: -0.16, dy: 0.05, elevacao: 1.0, comprimento: 0.4, largura: 0.14, desvio: 0.25 },
  { dx: 0.17, dy: -0.04, elevacao: 1.1, comprimento: 0.46, largura: 0.15, desvio: -0.2 },
  { dx: 0.07, dy: 0.17, elevacao: 0.92, comprimento: 0.25, largura: 0.11, desvio: 0.35 },
  { dx: -0.09, dy: -0.16, elevacao: 1.22, comprimento: 0.31, largura: 0.12, desvio: -0.3 },
  { dx: 0.2, dy: 0.1, elevacao: 0.78, comprimento: 0.2, largura: 0.09, desvio: 0.2 },
  { dx: -0.2, dy: -0.06, elevacao: 0.84, comprimento: 0.22, largura: 0.09, desvio: -0.15 },
]

/** As lascas soltas: pequenas, quase deitadas, espalhadas (a terceira só entra num dos dois desenhos). */
const LASCAS: readonly Prisma[] = [
  { dx: -0.11, dy: 0.02, elevacao: 0.24, comprimento: 0.31, largura: 0.11, desvio: 2.2 },
  { dx: 0.14, dy: -0.07, elevacao: 0.34, comprimento: 0.23, largura: 0.095, desvio: -0.4 },
  { dx: 0.02, dy: 0.16, elevacao: 0.18, comprimento: 0.18, largura: 0.085, desvio: 1 },
]

interface FaceDoCristal {
  readonly pontos: readonly Ponto[]
  readonly luz: number
}

interface CristalNaTela {
  readonly pe: Ponto
  readonly largura: number
  readonly fundo: number
  readonly corpo: readonly FaceDoCristal[]
  readonly ponta: readonly FaceDoCristal[]
}

/** As faces visíveis de um prisma: os lados (do pé ao ombro) e as facetas da ponta. `alto` = a altura do pé no calombo. */
function cristal(p: Prisma, i: number, giro: number, semente: number, alto: number): CristalNaTela {
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  const base: V3 = [p.dx * c - p.dy * s, p.dx * s + p.dy * c - 0.02 / ACHATA, alto]
  const azimute = (p.dx === 0 && p.dy === 0 ? 0 : Math.atan2(p.dy, p.dx)) + giro + p.desvio
  const elevacao = p.elevacao + (sorteio(semente, 10 + i) - 0.5) * 0.14
  const eixo: V3 = [Math.cos(elevacao) * Math.cos(azimute), Math.cos(elevacao) * Math.sin(azimute), Math.sin(elevacao)]
  const t = normalizar(vetorial(eixo, [0, 1, 0]))
  const q = vetorial(eixo, t)
  const raio = p.largura * 0.55
  const fase = giro * 0.8 + sorteio(semente, 30 + i) * (Math.PI / 3)
  const cantos: V3[] = Array.from({ length: 6 }, (_, j) => {
    const a = fase + (j * Math.PI) / 3
    return somar(somar([0, 0, 0], t, Math.cos(a) * raio), q, Math.sin(a) * raio)
  })
  const comprimento = p.comprimento * (0.88 + 0.24 * sorteio(semente, 40 + i))
  const ombro = somar(base, eixo, comprimento)
  const bico = somar(base, eixo, comprimento + p.largura * 0.9)
  const corpo: FaceDoCristal[] = []
  const ponta: FaceDoCristal[] = []
  cantos.forEach((o, j) => {
    const o2 = cantos[(j + 1) % 6]
    const normal = normalizar(somar(o, o2))
    if (escalar(normal, OLHO) > 0.02) {
      corpo.push({ pontos: [naTela(somar(base, o)), naTela(somar(base, o2)), naTela(somar(ombro, o2)), naTela(somar(ombro, o))], luz: escalar(normal, LUZ_3D) })
    }
    const s1 = somar(ombro, o)
    const s2 = somar(ombro, o2)
    let faceta = normalizar(vetorial(somar(s2, s1, -1), somar(bico, s1, -1)))
    if (escalar(faceta, normal) < 0) faceta = [-faceta[0], -faceta[1], -faceta[2]]
    if (escalar(faceta, OLHO) > 0.02) ponta.push({ pontos: [naTela(s1), naTela(s2), naTela(bico)], luz: escalar(faceta, LUZ_3D) + 0.34 })
  })
  return { pe: naTela(base), largura: p.largura, fundo: escalar(base, OLHO), corpo, ponta }
}

/** O ponto da face a `s` da largura (da primeira quina à segunda) e a `t` do comprimento (do pé ao ombro). */
function naFace(face: FaceDoCristal, s: number, t: number): Ponto {
  const [a, b, c, d] = face.pontos
  const baixo: Ponto = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]
  const cima: Ponto = [d[0] + (c[0] - d[0]) * s, d[1] + (c[1] - d[1]) * s]
  return [baixo[0] + (cima[0] - baixo[0]) * t, baixo[1] + (cima[1] - baixo[1]) * t]
}

/** Um prisma pintado: as faces do corpo (o pé mais fundo), a ponta acesa, o miolo claro e o fio de reflexo. */
function pintarCristal(g: CanvasRenderingContext2D, cr: CristalNaTela): void {
  for (const face of cr.corpo) {
    poligono(g, face.pontos, css(tomDoCristal(face.luz)))
    // O pé mais fundo: a luz de dentro sobe para a ponta.
    poligono(g, [face.pontos[0], face.pontos[1], naFace(face, 1, 0.36), naFace(face, 0, 0.36)], css(CRISTAL_FUNDO, 0.26))
  }
  for (const face of cr.ponta) poligono(g, face.pontos, css(tomDoCristal(face.luz)))
  if (cr.corpo.length === 0) return
  const maisClara = cr.corpo.reduce((m, f) => (f.luz > m.luz ? f : m))
  // O miolo aceso: um fuso claro na face mais acesa, do meio para o ombro.
  poligono(g, [naFace(maisClara, 0.5, 0.3), naFace(maisClara, 0.24, 0.66), naFace(maisClara, 0.5, 0.98), naFace(maisClara, 0.76, 0.66)], css(CRISTAL_REFLEXO, 0.52))
  // O fio de reflexo na quina do lado da luz.
  poligono(g, [naFace(maisClara, 0, 0.2), naFace(maisClara, 0.13, 0.24), naFace(maisClara, 0.13, 0.94), naFace(maisClara, 0, 1)], css(CRISTAL_REFLEXO, 0.6))
}

/** A lasca de rocha em volta do pé de um prisma: seis quinas, achatada como o chão. */
function lasca(x: number, y: number, raio: number, semente: number, i: number): Ponto[] {
  return Array.from({ length: 6 }, (_, k): Ponto => {
    const a = (k * Math.PI) / 3 + sorteio(semente, 60 + i * 6 + k) * 0.5
    const d = raio * (0.75 + 0.45 * sorteio(semente, 100 + i * 6 + k))
    return [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5]
  })
}

/** O ninho: o calombo de rocha e os prismas, de trás para a frente. */
function desenharNinho(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  pintarRocha(
    g,
    facesDaRocha({
      cx: 0,
      cy: -0.02,
      raio: CALOMBO.raio,
      altura: CALOMBO.altura,
      lados: 7,
      aneis: [
        [0, 1],
        [1, 0.62],
      ],
      recuo: 0.05,
      aspereza: 0.35,
      picos: 0.6,
      giro: giro + 0.4,
      semente,
    }),
    ROCHA,
  )
  // Os dois menores entram só em parte dos desenhos: cada ninho tem a sua arrumação.
  const quantos = 5 + (semente % 3)
  const prismas = PRISMAS.slice(0, quantos).map((p, i) => {
    // O pé afundado no calombo: mais alto no meio dele, mais baixo na beira.
    const naBeira = Math.min(1, Math.hypot(p.dx, p.dy) / CALOMBO.raio)
    return cristal(p, i, giro, semente, CALOMBO.altura * (0.75 - 0.45 * naBeira))
  })
  prismas.sort((a, b) => a.fundo - b.fundo)
  prismas.forEach((cr, i) => {
    pintarCristal(g, cr)
    // O pé de cada um some numa lasca de rocha (o corte reto do prisma não aparece), no tom do alto do calombo.
    const [x, y] = cr.pe
    poligono(g, lasca(x, y + cr.largura * 0.08, cr.largura * 0.56, semente, i), css(tomDaRocha(ROCHA, LUZ_DO_ALTO)))
  })
}

/** As lascas soltas: duas ou três lascas pequenas deitadas no chão, cada uma com a migalha de rocha no pé. */
function desenharLascas(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const quantas = semente === DESENHOS_DE_LASCAS[0] ? 3 : 2
  const lascas = LASCAS.slice(0, quantas).map((p, i) => cristal(p, i, giro, semente, 0.012))
  lascas.sort((a, b) => a.fundo - b.fundo)
  lascas.forEach((cr, i) => {
    const [x, y] = cr.pe
    poligono(g, lasca(x, y + cr.largura * 0.1, cr.largura * 0.5, semente, i), css(tomDaRocha(ROCHA, LUZ_DO_ALTO * 0.6)))
    pintarCristal(g, cr)
  })
}

function desenharCristaisCiano(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  if (DESENHOS_DE_LASCAS.includes(semente)) desenharLascas(g, giro, semente)
  else desenharNinho(g, giro, semente)
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'cristais-ciano',
  nome: 'Cristais ciano',
  tamanho: 8,
  sombra: 'em-pe',
  desenhar: desenharCristaisCiano,
}

/** Todas as cores chapadas do desenho (as faces saem destas, misturadas pela luz). */
export const paleta: readonly Rgb[] = [CRISTAL_FUNDO, CRISTAL_ESCURO, CRISTAL_MEIO, CRISTAL_CLARO, CRISTAL_REFLEXO, ROCHA.escura, ROCHA.meia, ROCHA.clara]
