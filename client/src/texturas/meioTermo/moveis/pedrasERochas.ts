/**
 * PEDRAS E ROCHAS de cima com volume (11/11/2026, lote 2 dos objetos novos):
 * um grupo NATURAL de rochas, o parente não talhado dos escombros de pedra
 * (`escombrosDePedra.ts`, blocos de parede com argamassa e pó). A rocha
 * grande (com o ombro mais baixo encostado nela), duas médias na frente e as
 * pedrinhas em volta.
 *
 * Cada rocha é uma ENCOSTA e um PATAMAR: do contorno torto a encosta sobe até
 * o alto chato da rocha. A encosta é uma roda de facetas sem risco entre
 * elas, cada uma com o tom do lado para onde olha (clara virada para a luz, de
 * cima à esquerda; escura virada contra), e o patamar fica puxado para o lado
 * da luz: a encosta de sombra aparece larga e a de luz, fina. É o que dá o
 * volume a 25% de zoom e separa a rocha (torta, sem aresta reta, sem topo
 * retangular) do bloco talhado. Por cima, as rachaduras, que descem do
 * patamar pela encosta, e os tufos de musgo, nas beiras e nas frestas entre
 * as rochas.
 *
 * Material: `pedra`; o musgo é fixo. As medidas saem do menor lado da pegada
 * (2 x 1,5 casas de partida) e as posições, de frações dela: o objeto
 * esticado afasta as rochas, não as deforma.
 */
import { hash, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, dentroDe, elipse, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca, type Peca } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** De onde vem a luz no chão (cima à esquerda), para o tom de cada faceta. */
const LUZ_X = -0.79
const LUZ_Y = -0.61
/** O tom das facetas da encosta: o do meio (a faceta que não olha nem para a luz nem contra) e quanto a luz o muda. */
const TOM_DA_ENCOSTA = 0.72
const LUZ_NA_ENCOSTA = 0.34
/** O patamar, rachado em duas facetas: o tom do meio e quanto a do lado da luz clareia (e a outra escurece). */
const TOM_DO_PATAMAR = 0.98
const LUZ_NO_PATAMAR = 0.09
/** Quanto cada vértice do patamar sai do lugar (fração do que ele guarda do contorno): sem isto o patamar é cópia do contorno. */
const TORTO = 0.2
/** A beira escura em volta da rocha: quanto ela passa do contorno (px do protótipo) e o tom. */
const BEIRA = 0.7
const TOM_DA_BEIRA = 0.46
/** O musgo: o verde-oliva do Meio-Termo puxado para a pedra, para não gritar em cima do cinza. */
const TOM_DO_MUSGO: Rgb = rgb(tomDoMeio('musgo', 0.84))
const QUANTO_DE_PEDRA_NO_MUSGO = 0.16
/** Um tufo de musgo é um punhado de bolinhas: quantas por px² de mancha e o raio delas (px do protótipo). */
const BOLINHAS_POR_AREA = 0.11
const RAIO_DA_BOLINHA = 1.5
/** A sombra que uma rocha faz na vizinha: a cor, a borda, a força e quanto da sombra de verdade (a diferença de altura). */
const SOMBRA_NA_VIZINHA: MaterialDaPeca = { classe: 'liso', rgb: [0x24, 0x22, 0x20] }
const BORDA_DA_SOMBRA_NA_VIZINHA = 1.6
const FORCA_DA_SOMBRA_NA_VIZINHA = 0.32
const QUANTO_DA_SOMBRA_NA_VIZINHA = 0.7
/**
 * O escuro em que o pixel escuro demais é levantado (o piso de luz): um cinza quente, de luminância linear
 * 0,056. Com o escuro de sempre (o da nogueira) a beira da pedra cinza, na sombra, saía marrom.
 */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/** Uma mancha de musgo: o meio e os dois raios. */
type Mancha = readonly [number, number, number, number]

interface Rocha {
  /** O meio, em frações da meia pegada. */
  readonly x: number
  readonly y: number
  /** O raio, em fração do menor meio lado. */
  readonly raio: number
  /** O contorno em volta do meio, em frações do raio, no sentido do relógio na tela. */
  readonly contorno: readonly Ponto[]
  /** Quanto do contorno o patamar guarda: o resto é a encosta. */
  readonly patamar: number
  /** Para onde o patamar escorrega, em frações do raio: o lado da luz (rocha não é cone certinho). */
  readonly alto: Ponto
  /** Entre que vértices o patamar racha em duas facetas. */
  readonly racha: readonly [number, number]
  /** As rachaduras, em frações do raio. */
  readonly trincas: readonly (readonly Ponto[])[]
  /** O musgo, em frações do raio da rocha. */
  readonly musgo: readonly Mancha[]
  /** Altura em casas: a mais alta faz sombra mais longe. */
  readonly altura: number
  readonly tom: number
  /** O rumo das camadas da pedra (o arenito e a ardósia): o mesmo em todas as facetas da rocha. */
  readonly veio: number
}

/** As rochas, de trás para a frente: o ombro da grande, a grande, as duas médias e as duas pedras pequenas. */
const ROCHAS: readonly Rocha[] = [
  {
    x: -0.62, y: 0.32, raio: 0.47,
    contorno: [[-0.7, -0.74], [0.1, -0.9], [0.8, -0.6], [1, 0], [0.7, 0.62], [0.1, 0.92], [-0.56, 0.76], [-1, 0.2], [-0.94, -0.36]],
    patamar: 0.66, alto: [-0.4, -0.3], racha: [2, 6],
    trincas: [[[-0.5, 0.1], [-0.3, 0.2], [-0.24, 0.44], [-0.04, 0.6]]],
    musgo: [[-0.6, 0.5, 0.3, 0.2], [0.3, 0.74, 0.3, 0.14]],
    altura: 0.34, tom: 0.92, veio: 0.9,
  },
  {
    x: -0.3, y: -0.2, raio: 0.74,
    contorno: [[-0.5, -0.92], [0.02, -1], [0.5, -0.84], [0.72, -0.52], [1, -0.3], [0.94, 0.2], [0.7, 0.44], [0.6, 0.8], [0.1, 0.98], [-0.36, 0.8], [-0.78, 0.62], [-1, 0.12], [-0.84, -0.3], [-0.92, -0.62]],
    patamar: 0.7, alto: [-0.42, -0.38], racha: [1, 8],
    trincas: [
      [[-0.3, -0.62], [-0.22, -0.4], [-0.3, -0.2], [-0.12, -0.02], [-0.16, 0.2], [0.02, 0.36], [0, 0.58]],
      [[-0.3, -0.2], [-0.5, -0.14], [-0.62, -0.2]],
      [[0.3, -0.52], [0.36, -0.3], [0.5, -0.2], [0.56, 0.02]],
    ],
    musgo: [[0.34, -0.7, 0.3, 0.13], [0.5, 0.56, 0.24, 0.2], [-0.74, -0.44, 0.14, 0.24]],
    altura: 0.62, tom: 1, veio: 0.3,
  },
  {
    x: 0.56, y: -0.36, raio: 0.5,
    contorno: [[-0.95, -0.1], [-0.6, -0.6], [0, -0.74], [0.5, -0.52], [1, -0.22], [0.9, 0.3], [0.42, 0.5], [0.1, 0.74], [-0.5, 0.6], [-0.9, 0.36]],
    patamar: 0.7, alto: [-0.3, -0.5], racha: [2, 7],
    trincas: [[[0.34, -0.5], [0.2, -0.28], [0.28, -0.08], [0.1, 0.12], [0.16, 0.34]]],
    musgo: [[-0.56, -0.36, 0.26, 0.16], [0.6, 0.26, 0.24, 0.13]],
    altura: 0.36, tom: 0.93, veio: -0.5,
  },
  {
    x: 0.28, y: 0.52, raio: 0.45,
    contorno: [[-0.6, -0.8], [0.1, -0.92], [0.7, -0.62], [1, -0.05], [0.8, 0.5], [0.3, 0.9], [-0.3, 0.82], [-0.9, 0.5], [-1, -0.2]],
    patamar: 0.7, alto: [-0.46, -0.32], racha: [1, 5],
    trincas: [[[-0.5, -0.3], [-0.3, -0.2], [-0.26, 0.02], [-0.06, 0.14], [0, 0.42]]],
    musgo: [[0.36, -0.66, 0.26, 0.13], [-0.7, 0.36, 0.14, 0.2]],
    altura: 0.3, tom: 1.05, veio: 1.1,
  },
  {
    x: -0.16, y: 0.84, raio: 0.14,
    contorno: [[-0.7, -0.7], [0.3, -0.9], [1, -0.2], [0.7, 0.7], [-0.2, 0.9], [-1, 0.2]],
    patamar: 0.62, alto: [-0.4, -0.36], racha: [0, 3], trincas: [], musgo: [],
    altura: 0.1, tom: 0.96, veio: 0.8,
  },
  {
    x: 0.84, y: 0.44, raio: 0.13,
    contorno: [[-0.8, -0.5], [0, -0.9], [0.9, -0.4], [0.8, 0.5], [0, 0.9], [-0.9, 0.4]],
    patamar: 0.62, alto: [-0.4, -0.36], racha: [1, 4], trincas: [], musgo: [],
    altura: 0.09, tom: 1.02, veio: -0.2,
  },
]

/** As pedrinhas soltas: o meio (frações da meia pegada), o raio (fração do menor meio lado) e o ângulo. */
const PEDRINHAS: readonly (readonly [number, number, number, number])[] = [
  [-0.93, 0.82, 0.05, 0.4],
  [-0.4, 0.93, 0.045, 2.1],
  [0.04, 0.93, 0.035, 1.2],
  [0.68, 0.82, 0.065, -0.6],
  [0.95, 0.12, 0.045, 0.9],
  [0.93, -0.84, 0.05, 2.6],
  [-0.95, -0.6, 0.045, -1.1],
  [0.16, -0.93, 0.04, 0.3],
  [0.92, 0.72, 0.03, 1.7],
]

/** O musgo no chão, ao pé das rochas e na fresta entre elas: o meio em frações da meia pegada, os raios em frações do menor meio lado. */
const MUSGO_NO_CHAO: readonly Mancha[] = [
  [-0.86, 0.9, 0.12, 0.05],
  [0.08, 0.16, 0.08, 0.1],
  [0.95, -0.04, 0.05, 0.1],
  [0.52, 0.93, 0.1, 0.04],
]

/** O lado para onde o contorno roda (1 no sentido do relógio na tela): a normal de cada lance sai para fora por ele. */
function sentido(pontos: readonly Ponto[]): number {
  let area = 0
  for (let i = 0; i < pontos.length; i += 1) {
    const [x0, y0] = pontos[i]
    const [x1, y1] = pontos[(i + 1) % pontos.length]
    area += x0 * y1 - x1 * y0
  }
  return area >= 0 ? 1 : -1
}

/** Quanto o lance de `a` a `b` olha para a luz, de -1 (contra) a 1 (de frente). */
function luzNoLance(a: Ponto, b: Ponto, lado: number): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  return lado * ((dy / l) * LUZ_X - (dx / l) * LUZ_Y)
}

/** A forma um pouco mais gorda: a mesma distância, `folga` px para fora. */
function engordada(f: Forma, folga: number): Forma {
  return { b: [f.b[0] - folga, f.b[1] - folga, f.b[2] + folga, f.b[3] + folga], d: (x, y) => f.d(x, y) - folga }
}

/** A forma posta (dx, dy) para o lado: a sombra de uma rocha em cima da vizinha. */
function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/**
 * Um tufo de musgo: um punhado de bolinhas sorteadas dentro da mancha de meio (cx, cy) e raios (rx, ry), em
 * px do protótipo, cada uma com o seu tom. `dentro` = a rocha em que ele pega (o tufo não passa da beira dela).
 */
function tufoDeMusgo(c: ContextoDoMovel, L: Peca[], cx: number, cy: number, rx: number, ry: number, pedra: MaterialDaPeca, dentro: Forma | null, sem: number): void {
  const cor: MaterialDaPeca = { classe: 'folha', rgb: misturar(TOM_DO_MUSGO, pedra.rgb, QUANTO_DE_PEDRA_NO_MUSGO) }
  const bolinhas = Math.max(3, Math.round(Math.PI * rx * ry * BOLINHAS_POR_AREA))
  for (let i = 0; i < bolinhas; i += 1) {
    // Mais bolinhas perto do meio da mancha (a raiz do sorteio as espalharia por igual).
    const longe = hash(i, sem, 135)
    const t = hash(i, sem, 136) * 2 * Math.PI
    const r = RAIO_DA_BOLINHA * (0.7 + 0.7 * hash(i, sem, 137))
    const bolinha = elipse(cx + Math.cos(t) * rx * longe, cy + Math.sin(t) * ry * longe, r, r * 0.86)
    L.push(c.peca(dentro === null ? bolinha : dentroDe(bolinha, dentro), cor, { bisel: r * 0.7, contorno: 0.26, tom: 0.82 + 0.3 * hash(i, sem, 138), semente: sem * 31 + i }))
  }
}

/** A rocha: a sombra, a beira escura, a encosta de facetas, o patamar em duas metades, as rachaduras e o musgo. */
function montarRocha(c: ContextoDoMovel, cena: Cena, L: Peca[], r: Rocha, pedra: MaterialDaPeca, k: number): Forma {
  const P = c.peca
  const raio = r.raio * Math.min(c.hw, c.hh)
  const cx = r.x * c.hw
  const cy = r.y * c.hh
  const pe = r.contorno.map(([x, y]): Ponto => [cx + x * raio, cy + y * raio])
  const alto = r.contorno.map(([x, y], i): Ponto => {
    // Cada vértice encolhe um pouco mais ou um pouco menos, e o patamar inteiro escorrega para o lado da luz.
    const guarda = r.patamar * (1 + TORTO * (hash(i, 1, 150 + k) - 0.5))
    return [cx + (r.alto[0] * (1 - r.patamar) + x * guarda) * raio, cy + (r.alto[1] * (1 - r.patamar) + y * guarda) * raio]
  })
  const contorno = poligono(pe)
  const lado = sentido(pe)
  const n = pe.length
  const sem = 4000 + k * 100
  cena.sombras.push({ forma: contorno, z: c.g * r.altura, forca: 0.3 }, contato(contorno, 0.3))
  L.push(P(engordada(contorno, BEIRA), pedra, { eixo: r.veio, tabua: 0, bisel: 1, tom: r.tom * TOM_DA_BEIRA, contorno: 0.3, semente: sem, projeta: { dist: 1 + c.g * r.altura * 0.08, forca: 0.3 } }))
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    const tom = TOM_DA_ENCOSTA + LUZ_NA_ENCOSTA * luzNoLance(pe[i], pe[j], lado)
    L.push(P(poligono([pe[i], pe[j], alto[j], alto[i]]), pedra, { eixo: r.veio, tabua: 0, bisel: 0.4, tom: r.tom * tom, contorno: 0.04, semente: sem + 1 + i }))
  }
  // O patamar, rachado em duas facetas: a do lado da luz mais clara.
  const [de, ate] = r.racha
  const metades = [alto.slice(de, ate + 1), [...alto.slice(ate), ...alto.slice(0, de + 1)]]
  const luzDoMeio = metades.map((metade) => metade.reduce((soma, [x, y]) => soma + x * LUZ_X + y * LUZ_Y, 0) / metade.length)
  metades.forEach((metade, m) => {
    const daLuz = luzDoMeio[m] > luzDoMeio[1 - m]
    L.push(P(poligono(metade), pedra, { eixo: r.veio, tabua: 0, bisel: 1.3, tom: r.tom * (TOM_DO_PATAMAR + (daLuz ? LUZ_NO_PATAMAR : -LUZ_NO_PATAMAR)), contorno: 0.14, semente: sem + 80 + m }))
  })
  for (const [t, trinca] of r.trincas.entries()) {
    L.push(P(cadeia(trinca.map(([x, y]): Ponto => [cx + x * raio, cy + y * raio]), 0.3), pedra, { tabua: 0, bisel: 0, tom: 0.42, contorno: 0, semente: sem + 90 + t }))
  }
  for (const [m, [mx, my, rx, ry]] of r.musgo.entries()) tufoDeMusgo(c, L, cx + mx * raio, cy + my * raio, rx * raio, ry * raio, pedra, contorno, sem + 95 + m)
  return contorno
}

export const montarPedrasERochas: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const R = Math.min(hw, hh)
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA

  // O musgo do chão e as pedrinhas primeiro: ficam por baixo das rochas.
  MUSGO_NO_CHAO.forEach(([fx, fy, rx, ry], k) => tufoDeMusgo(c, L, fx * hw, fy * hh, rx * R, ry * R, pedra, null, 4900 + k))
  PEDRINHAS.forEach(([fx, fy, raio, ang], k) => {
    const r = raio * R
    const pedrinha = elipseGirada(fx * hw, fy * hh, r, r * 0.72, ang)
    cena.sombras.push({ forma: pedrinha, z: r * 0.8, forca: 0.26 }, contato(pedrinha, 0.26))
    L.push(P(pedrinha, pedra, { tabua: 0, bisel: r * 0.75, tom: 0.86 + 0.24 * hash(k, 5, 134), contorno: 0.32, semente: 4920 + k }))
  })

  // As rochas, de trás para a frente; cada uma recebe a sombra das que vieram antes e são mais altas.
  const postas: { readonly contorno: Forma; readonly altura: number }[] = []
  ROCHAS.forEach((rocha, k) => {
    const contorno = montarRocha(c, cena, L, rocha, pedra, k)
    for (const [v, vizinha] of postas.entries()) {
      const queda = (vizinha.altura - rocha.altura) * g * QUANTO_DA_SOMBRA_NA_VIZINHA
      if (queda <= 0) continue
      const sombra = dentroDe(deslocada(vizinha.contorno, SOMBRA_X * queda, SOMBRA_Y * queda), contorno)
      L.push(P(sombra, SOMBRA_NA_VIZINHA, { bisel: 0, contorno: 0, alfa: FORCA_DA_SOMBRA_NA_VIZINHA, suave: BORDA_DA_SOMBRA_NA_VIZINHA, semente: 4950 + k * 10 + v }))
    }
    postas.push({ contorno, altura: rocha.altura })
  })
}
