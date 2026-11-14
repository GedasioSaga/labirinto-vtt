import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'
import { facesDaRocha, pintarRocha, tomDaRocha, type TonsDaRocha } from './_rochaFacetada'

/**
 * Cristais (item 144 dos carimbos de 14/11/2026): um ninho de cinco prismas
 * de ametista nascendo de um calombo de rocha da caverna, o grande no meio
 * quase em pé e os outros abrindo para fora. Cada prisma é sextavado, com a
 * ponta de seis facetas, e cada face toma o tom pela direção para onde olha
 * em 3D (a luz de cima à esquerda e do alto, a das pedras da serra); a face
 * mais clara do grande leva um reflexo. O violeta é contido (o roxo da
 * ametista puxado para o cinza) e frio, ao lado do ciano dos cogumelos que
 * brilham. O giro gira o ninho inteiro em volta do eixo e cada prisma no
 * próprio eixo; a luz não gira.
 */

const CRISTAL_ESCURO: Rgb = [76, 54, 116]
const CRISTAL_MEIO: Rgb = [126, 94, 172]
const CRISTAL_CLARO: Rgb = [180, 156, 218]
const CRISTAL_REFLEXO: Rgb = [228, 218, 242]
/** A rocha da caverna, cinza com um fio do violeta dos cristais. */
const ROCHA: TonsDaRocha = { escura: [78, 74, 82], meia: [112, 106, 112], clara: [148, 142, 142] }
/** O calombo de onde os prismas nascem: o pé deles fica afundado no alto dele. */
const CALOMBO = { raio: 0.25, altura: 0.11 } as const
/** A luz do alto do calombo (o topo, de frente para o céu: a do `_rochaFacetada.ts`, um pouco abaixo). */
const LUZ_DO_ALTO = 0.5

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

/** O tom de uma face pelo quanto ela olha para a luz. */
function tomDoCristal(luz: number): Rgb {
  const t = Math.min(1, Math.max(0, (luz + 0.8) / 1.3))
  return t > 0.5 ? misturar(CRISTAL_MEIO, CRISTAL_CLARO, (t - 0.5) * 2) : misturar(CRISTAL_ESCURO, CRISTAL_MEIO, t * 2)
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

const PRISMAS: readonly Prisma[] = [
  { dx: 0, dy: 0, elevacao: 1.5, comprimento: 0.58, largura: 0.2, desvio: 0 },
  { dx: -0.17, dy: 0.05, elevacao: 1.02, comprimento: 0.38, largura: 0.14, desvio: 0.25 },
  { dx: 0.17, dy: -0.04, elevacao: 1.1, comprimento: 0.44, largura: 0.15, desvio: -0.2 },
  { dx: 0.08, dy: 0.17, elevacao: 0.95, comprimento: 0.24, largura: 0.11, desvio: 0.35 },
  { dx: -0.09, dy: -0.16, elevacao: 1.2, comprimento: 0.3, largura: 0.12, desvio: -0.3 },
]

interface FaceDoCristal {
  readonly pontos: readonly Ponto[]
  readonly luz: number
}

interface CristalNaTela {
  /** O do meio, o grande: só ele leva o reflexo. */
  readonly grande: boolean
  readonly pe: Ponto
  readonly largura: number
  readonly fundo: number
  readonly corpo: readonly FaceDoCristal[]
  readonly ponta: readonly FaceDoCristal[]
}

/** As faces visíveis de um prisma: os lados (do pé ao ombro) e as facetas da ponta. */
function cristal(p: Prisma, i: number, giro: number, semente: number): CristalNaTela {
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  // O pé afundado no calombo: mais alto no meio dele, mais baixo na beira.
  const naBeira = Math.hypot(p.dx, p.dy) / CALOMBO.raio
  const base: V3 = [p.dx * c - p.dy * s, p.dx * s + p.dy * c - 0.02 / ACHATA, CALOMBO.altura * (0.75 - 0.45 * naBeira)]
  const azimute = (p.dx === 0 && p.dy === 0 ? 0 : Math.atan2(p.dy, p.dx)) + giro + p.desvio
  const eixo: V3 = [Math.cos(p.elevacao) * Math.cos(azimute), Math.cos(p.elevacao) * Math.sin(azimute), Math.sin(p.elevacao)]
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
  const bico = somar(base, eixo, comprimento + p.largura * 0.85)
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
    if (escalar(faceta, OLHO) > 0.02) ponta.push({ pontos: [naTela(s1), naTela(s2), naTela(bico)], luz: escalar(faceta, LUZ_3D) + 0.08 })
  })
  return { grande: i === 0, pe: naTela(base), largura: p.largura, fundo: escalar(base, OLHO), corpo, ponta }
}

/** O reflexo na face mais clara do grande: uma faixa larga perto da quina da luz, do meio para o ombro. */
function reflexo(face: FaceDoCristal): Ponto[] {
  const [a, b, c, d] = face.pontos
  const em = (s: number, t: number): Ponto => {
    const baixo: Ponto = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]
    const cima: Ponto = [d[0] + (c[0] - d[0]) * s, d[1] + (c[1] - d[1]) * s]
    return [baixo[0] + (cima[0] - baixo[0]) * t, baixo[1] + (cima[1] - baixo[1]) * t]
  }
  return [em(0.16, 0.3), em(0.5, 0.36), em(0.5, 0.9), em(0.16, 0.86)]
}

/** A lasca de rocha em volta do pé de um prisma: seis quinas, achatada como o chão. */
function lasca(x: number, y: number, raio: number, semente: number, i: number): Ponto[] {
  return Array.from({ length: 6 }, (_, k): Ponto => {
    const a = (k * Math.PI) / 3 + sorteio(semente, 60 + i * 6 + k) * 0.5
    const d = raio * (0.75 + 0.45 * sorteio(semente, 100 + i * 6 + k))
    return [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5]
  })
}

function desenharCristais(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // O calombo de rocha de onde eles nascem: um bloco baixo e lascado (o das rochas do lote).
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
  const grandes = PRISMAS.map((p, i) => cristal(p, i, giro, semente)).sort((a, b) => a.fundo - b.fundo)
  grandes.forEach((c, i) => {
    for (const face of [...c.corpo, ...c.ponta]) poligono(g, face.pontos, css(tomDoCristal(face.luz)))
    if (c.grande && c.corpo.length > 0) {
      const maisClara = c.corpo.reduce((m, f) => (f.luz > m.luz ? f : m))
      poligono(g, reflexo(maisClara), css(CRISTAL_REFLEXO, 0.55))
    }
    // O pé de cada um some numa lasca de rocha (o corte reto do prisma não aparece), no tom do alto do
    // calombo: mais clara que ele, a lasca virava ladrilho.
    const [x, y] = c.pe
    poligono(g, lasca(x, y + c.largura * 0.08, c.largura * 0.56, semente, i), css(tomDaRocha(ROCHA, LUZ_DO_ALTO)))
  })
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'cristais',
  nome: 'Cristais',
  tamanho: 8,
  sombra: 'em-pe',
  desenhar: desenharCristais,
}

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [CRISTAL_ESCURO, CRISTAL_MEIO, CRISTAL_CLARO, CRISTAL_REFLEXO, ROCHA.escura, ROCHA.meia, ROCHA.clara]
