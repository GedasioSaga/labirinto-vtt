import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'
import { facesDaRocha, pintarRocha, pontoNaFace, tomDaRocha, type FaceDaRocha, type TonsDaRocha } from './_rochaFacetada'

/**
 * Cristais ciano (lote L06 de 24/11/2026, item 59, o enfeite que mais se repete na cripta do mapa 8; versão dos
 * Cristais, desenho próprio no estilo Meio-Termo). Um NINHO de prismas ciano frio nascendo de um calombo de rocha: o
 * grande no meio quase em pé e os outros ABRINDO EM LEQUE, cada um pendendo para o lado em que está. Cada prisma é
 * sextavado, com a ponta de seis facetas; as faces à vista ficam em TRÊS TONS bem separados (a acesa, a do meio e a
 * da sombra, dois degraus da rampa abaixo da acesa), o pé é mais fundo e o MIOLO CLARO fica perto da ponta da face
 * acesa: a luz vem de dentro. O ciano é o do lote (`texturas/meioTermo/moveis/pedestalComCristal.ts`): contido,
 * puxado para o azul-acinzentado, nunca neon.
 *
 * O calombo é PEDRA, não buraco: a face de cima clara, com a beira acesa pelos cristais, e o escuro só no pé.
 *
 * Dos oito desenhos (um a cada 45° do giro), seis são o ninho, cada um com a sua arrumação, e dois (o 3 e o 6) são as
 * LASCAS SOLTAS: duas ou três lascas pequenas deitadas no chão, sem rocha, para espalhar perto dos jazigos.
 *
 * O cristal ILUMINA em volta (a tabela `LUZ_DOS_CARIMBOS` de `lib/luzDoFogo.ts`, parada, sem tremer: luz de pedra não
 * treme como fogo). O brilho é pintado no corpo, como nos Cristais verdes; nada pulsa. O giro gira o ninho em volta
 * do eixo e cada prisma no próprio eixo; a luz não gira e o leque continua aberto para os dois lados.
 *
 * A sombra é a `baixa` (revisão do diretor de arte, 24/11/2026): a comprida do `em-pe` pesava demais num enfeite que
 * se repete às dezenas.
 */

const CRISTAL_FUNDO: Rgb = [58, 114, 128]
const CRISTAL_ESCURO: Rgb = [82, 148, 162]
const CRISTAL_MEIO: Rgb = [122, 188, 199]
const CRISTAL_CLARO: Rgb = [174, 224, 229]
/** O reflexo da quina e o miolo aceso: o ciano quase branco da luz de dentro. */
const CRISTAL_REFLEXO: Rgb = [228, 244, 242]
/** A rocha da cripta, cinza frio com um fio do ciano dos cristais: clara o bastante para ler pedra, e não buraco. */
const ROCHA: TonsDaRocha = { escura: [88, 94, 97], meia: [126, 133, 134], clara: [170, 177, 174] }
/** O escuro do pé do calombo, só na base. */
const ROCHA_NO_PE: Rgb = [58, 63, 67]
/** O calombo de onde os prismas nascem: o pé deles fica afundado no alto dele. */
const CALOMBO = { raio: 0.25, altura: 0.12 } as const
/** Quanto as faces do calombo clareiam além da luz das pedras, e a luz do alto dele (o topo, de frente para o céu). */
const CLAREIA_DO_CALOMBO = 0.22
const LUZ_DO_ALTO = 0.62
/** Os desenhos que são as lascas soltas, e não o ninho. */
const DESENHOS_DE_LASCAS: readonly number[] = [3, 6]
/**
 * O LEQUE: quanto o prisma da beira do ninho pende para o seu lado (radianos, uns 30°) e o mínimo que qualquer um
 * que não seja o do meio pende (uns 12°: dois prismas de pé lado a lado viravam cerca).
 */
const ABRE_DO_LEQUE = 0.54
const PENDE_NO_MINIMO = 0.21
/** A que distância do meio (unidades) o prisma já pende o leque inteiro. */
const BEIRA_DO_NINHO = 0.2
/** O tom de cada face à vista, da acesa à da sombra (0 a 1 na rampa): mais de dois degraus de uma à outra. */
const TOM_ACESO = 0.97
const TOM_NA_SOMBRA = 0.1

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

/** O tom do cristal na rampa, de 0 (o fundo da face na sombra) a 1 (a face acesa). */
function tomDoCristal(t: number): Rgb {
  const k = Math.min(1, Math.max(0, t))
  if (k < 0.3) return misturar(CRISTAL_FUNDO, CRISTAL_ESCURO, k / 0.3)
  if (k < 0.62) return misturar(CRISTAL_ESCURO, CRISTAL_MEIO, (k - 0.3) / 0.32)
  return misturar(CRISTAL_MEIO, CRISTAL_CLARO, (k - 0.62) / 0.38)
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
  readonly comprimento: number
  readonly largura: number
}

/** O ninho: o grande no meio e os outros em volta. Os dois últimos só entram em alguns desenhos. */
const PRISMAS: readonly Prisma[] = [
  { dx: 0, dy: 0, comprimento: 0.6, largura: 0.19 },
  { dx: -0.16, dy: 0.05, comprimento: 0.38, largura: 0.14 },
  { dx: 0.17, dy: -0.04, comprimento: 0.44, largura: 0.15 },
  { dx: 0.07, dy: 0.17, comprimento: 0.24, largura: 0.11 },
  { dx: -0.09, dy: -0.16, comprimento: 0.31, largura: 0.12 },
  { dx: 0.2, dy: 0.1, comprimento: 0.2, largura: 0.09 },
  { dx: -0.2, dy: -0.06, comprimento: 0.22, largura: 0.09 },
]

/** As lascas soltas: pequenas, espalhadas (a terceira só entra num dos dois desenhos); `pende` = quase deitadas. */
const LASCAS: readonly (Prisma & { readonly pende: number })[] = [
  { dx: -0.11, dy: 0.02, comprimento: 0.3, largura: 0.11, pende: -1.28 },
  { dx: 0.14, dy: -0.07, comprimento: 0.22, largura: 0.095, pende: 1.16 },
  { dx: 0.02, dy: 0.16, comprimento: 0.17, largura: 0.085, pende: 1.36 },
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

/**
 * As faces visíveis de um prisma: os lados (do pé ao ombro) e as facetas da ponta. `pende` = quanto ele pende de
 * lado NA TELA (radianos a partir de pé; negativo = para a esquerda); `funda` = quanto pende para quem vê (o prisma
 * da frente encurta, o de trás estica); `alto` = a altura do pé no calombo.
 */
function cristal(p: Prisma, i: number, giro: number, semente: number, alto: number, pende: number, funda: number): CristalNaTela {
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  const base: V3 = [p.dx * c - p.dy * s, p.dx * s + p.dy * c - 0.02 / ACHATA, alto]
  const eixo = normalizar([Math.sin(pende), funda, Math.cos(pende)])
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
    if (escalar(faceta, OLHO) > 0.02) ponta.push({ pontos: [naTela(s1), naTela(s2), naTela(bico)], luz: escalar(faceta, LUZ_3D) })
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

/** As faces da mais acesa à menos, cada uma com a sua vez (0 = a acesa, 1 = a da sombra). */
function daAcesaASombra(faces: readonly FaceDoCristal[]): { face: FaceDoCristal; vez: number }[] {
  const ordem = [...faces].sort((a, b) => b.luz - a.luz)
  return ordem.map((face, k) => ({ face, vez: ordem.length > 1 ? k / (ordem.length - 1) : 0 }))
}

/**
 * Um prisma pintado. As faces do corpo em três tons bem separados (a acesa clara, a do meio, a da sombra funda), o
 * pé mais fundo em dois degraus, a ponta acesa e, na face acesa, o clarão que sobe para a ponta com o MIOLO quase
 * branco perto dela, o fio de reflexo na quina e a fratura fina que pega a luz na face do meio.
 */
function pintarCristal(g: CanvasRenderingContext2D, cr: CristalNaTela): void {
  const corpo = daAcesaASombra(cr.corpo)
  for (const { face, vez } of corpo) {
    poligono(g, face.pontos, css(tomDoCristal(TOM_ACESO + (TOM_NA_SOMBRA - TOM_ACESO) * Math.pow(vez, 0.85))))
    // O pé mais fundo: a luz de dentro sobe para a ponta.
    poligono(g, [face.pontos[0], face.pontos[1], naFace(face, 1, 0.4), naFace(face, 0, 0.4)], css(CRISTAL_FUNDO, 0.28))
    poligono(g, [face.pontos[0], face.pontos[1], naFace(face, 1, 0.17), naFace(face, 0, 0.17)], css(CRISTAL_FUNDO, 0.34))
  }
  for (const { face, vez } of daAcesaASombra(cr.ponta)) {
    // A ponta acende: a faceta acesa quase no reflexo, a da sombra ainda um degrau acima da face de baixo dela.
    const cor = vez < 0.34 ? misturar(CRISTAL_CLARO, CRISTAL_REFLEXO, 0.62 - vez) : tomDoCristal(0.86 - 0.52 * vez)
    poligono(g, face.pontos, css(cor))
  }
  if (corpo.length === 0) return
  // A LUZ DE DENTRO sobe para a ponta: toda face clareia do meio para o ombro, em dois degraus.
  for (const { face, vez } of corpo) {
    const forca = 0.3 - 0.14 * vez
    poligono(g, [naFace(face, 0, 0.5), naFace(face, 1, 0.5), face.pontos[2], face.pontos[3]], css(CRISTAL_CLARO, forca))
    poligono(g, [naFace(face, 0, 0.76), naFace(face, 1, 0.76), face.pontos[2], face.pontos[3]], css(CRISTAL_REFLEXO, forca * 0.8))
  }
  const acesa = corpo[0].face
  // O MIOLO quase branco, perto da ponta, na face clara MAIS LARGA (a acesa de lado é uma tira: nela o miolo sumia).
  const larga = corpo.slice(0, 2).reduce((m, f) => (areaDe(f.face) > areaDe(m.face) ? f : m)).face
  poligono(g, [naFace(larga, 0.5, 0.4), naFace(larga, 0.2, 0.74), naFace(larga, 0.24, 1), naFace(larga, 0.78, 1), naFace(larga, 0.8, 0.74)], css(CRISTAL_REFLEXO, 0.3))
  poligono(g, [naFace(larga, 0.5, 0.6), naFace(larga, 0.3, 0.84), naFace(larga, 0.5, 1), naFace(larga, 0.7, 0.84)], css(CRISTAL_REFLEXO, 0.82))
  // O fio de reflexo na quina do lado da luz.
  poligono(g, [naFace(acesa, 0, 0.16), naFace(acesa, 0.14, 0.2), naFace(acesa, 0.14, 0.96), naFace(acesa, 0, 1)], css(CRISTAL_REFLEXO, 0.7))
  // A fratura fina na face da sombra: um risco claro em diagonal, que não chega às quinas.
  if (corpo.length > 2) {
    const sombra = corpo[corpo.length - 1].face
    poligono(g, [naFace(sombra, 0.2, 0.4), naFace(sombra, 0.8, 0.6), naFace(sombra, 0.8, 0.65), naFace(sombra, 0.2, 0.45)], css(CRISTAL_CLARO, 0.42))
  }
}

/** A área da face na tela (o dobro dela, pela fórmula do cadarço): para achar a face mais larga. */
function areaDe(face: FaceDoCristal): number {
  let soma = 0
  face.pontos.forEach((a, i) => {
    const b = face.pontos[(i + 1) % face.pontos.length]
    soma += a[0] * b[1] - b[0] * a[1]
  })
  return Math.abs(soma)
}

/** A lasca de rocha em volta do pé de um prisma: seis quinas, achatada como o chão. */
function lasca(x: number, y: number, raio: number, semente: number, i: number): Ponto[] {
  return Array.from({ length: 6 }, (_, k): Ponto => {
    const a = (k * Math.PI) / 3 + sorteio(semente, 60 + i * 6 + k) * 0.5
    const d = raio * (0.75 + 0.45 * sorteio(semente, 100 + i * 6 + k))
    return [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5]
  })
}

/** O meio de uma face na tela. */
function meioDe(face: FaceDaRocha): Ponto {
  const soma = face.pontos.reduce<[number, number]>((m, p) => [m[0] + p[0], m[1] + p[1]], [0, 0])
  return [soma[0] / face.pontos.length, soma[1] / face.pontos.length]
}

/**
 * O CALOMBO de rocha: as faces claras (pedra, não buraco), o escuro só no pé de cada face de lado, a face de cima
 * banhada pela luz dos cristais e a beira dela ACESA do lado de onde a luz vem.
 */
function pintarCalombo(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const faces = facesDaRocha({
    cx: 0,
    cy: -0.02,
    raio: CALOMBO.raio,
    altura: CALOMBO.altura,
    lados: 7,
    aneis: [
      [0, 1],
      [1, 0.66],
    ],
    recuo: 0.05,
    aspereza: 0.35,
    picos: 0.5,
    giro: giro + 0.4,
    semente,
  })
  pintarRocha(g, faces, ROCHA, CLAREIA_DO_CALOMBO)
  for (const face of faces) {
    if (face.tipo === 'lado') {
      // O pé escuro, só na base.
      poligono(g, [face.pontos[0], face.pontos[1], pontoNaFace(face, 1, 0.3), pontoNaFace(face, 0, 0.3)], css(ROCHA_NO_PE, 0.46))
      continue
    }
    // A face de cima: o banho frio dos cristais e a beira acesa (as arestas de cima e da esquerda, na tela).
    poligono(g, face.pontos, css(CRISTAL_CLARO, 0.2))
    const [mx, my] = meioDe(face)
    face.pontos.forEach((a, k) => {
      const b = face.pontos[(k + 1) % face.pontos.length]
      const [ex, ey] = [(a[0] + b[0]) / 2 - mx, (a[1] + b[1]) / 2 - my]
      // A aresta olha para a luz (de cima à esquerda) quando o meio dela fica para lá do meio da face.
      if (ex * -0.6 + ey * -0.8 <= 0.02) return
      const para = (p: Ponto): Ponto => [p[0] + (mx - p[0]) * 0.16, p[1] + (my - p[1]) * 0.16]
      poligono(g, [a, b, para(b), para(a)], css(CRISTAL_REFLEXO, 0.5))
    })
  }
}

/** Quanto cada prisma do ninho pende de lado: o do meio quase de pé, os outros abrindo em LEQUE para o lado em que estão. */
function pendeNoLeque(p: Prisma, i: number, giro: number, semente: number): number {
  if (i === 0) return (sorteio(semente, 10) - 0.5) * 0.14
  const x = p.dx * Math.cos(giro) - p.dy * Math.sin(giro)
  // Quem fica bem na frente ou atrás do grande escolhe o lado pela vez, para os dois lados ficarem cheios.
  const lado = Math.abs(x) > 0.03 ? Math.sign(x) : i % 2 === 0 ? 1 : -1
  const abre = Math.max(PENDE_NO_MINIMO, Math.min(1, Math.abs(x) / BEIRA_DO_NINHO) * ABRE_DO_LEQUE)
  return lado * abre * (0.86 + 0.28 * sorteio(semente, 10 + i))
}

/** O ninho: o calombo de rocha e os prismas, de trás para a frente. */
function desenharNinho(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  pintarCalombo(g, giro, semente)
  // Os dois menores entram só em parte dos desenhos: cada ninho tem a sua arrumação.
  const quantos = 5 + (semente % 3)
  const prismas = PRISMAS.slice(0, quantos).map((p, i) => {
    // O pé afundado no calombo: mais alto no meio dele, mais baixo na beira.
    const naBeira = Math.min(1, Math.hypot(p.dx, p.dy) / CALOMBO.raio)
    // O que está na frente pende um pouco para quem vê; o de trás, para longe.
    const y = p.dx * Math.sin(giro) + p.dy * Math.cos(giro)
    return cristal(p, i, giro, semente, CALOMBO.altura * (0.75 - 0.45 * naBeira), pendeNoLeque(p, i, giro, semente), i === 0 ? 0 : Math.max(-0.4, Math.min(0.4, y / BEIRA_DO_NINHO)) * 0.5)
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
  const lascas = LASCAS.slice(0, quantas).map((p, i) => cristal(p, i, giro, semente, 0.012, p.pende, 0.2))
  lascas.sort((a, b) => a.fundo - b.fundo)
  lascas.forEach((cr, i) => {
    const [x, y] = cr.pe
    poligono(g, lasca(x, y + cr.largura * 0.1, cr.largura * 0.5, semente, i), css(tomDaRocha(ROCHA, LUZ_DO_ALTO * 0.7)))
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
  sombra: 'baixa',
  desenhar: desenharCristaisCiano,
}

/** Todas as cores chapadas do desenho (as faces saem destas, misturadas pela luz). */
export const paleta: readonly Rgb[] = [CRISTAL_FUNDO, CRISTAL_ESCURO, CRISTAL_MEIO, CRISTAL_CLARO, CRISTAL_REFLEXO, ROCHA.escura, ROCHA.meia, ROCHA.clara, ROCHA_NO_PE]
