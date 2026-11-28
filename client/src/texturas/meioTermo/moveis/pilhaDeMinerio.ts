/**
 * PILHA DE MINÉRIO (L04 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Cavernas e
 * mina): o minério que saiu do veio, amontoado no chão da galeria à espera do carrinho. Um MONTE de pedaços de pedra
 * quebrada a picareta, os grandes no alto e os miúdos rolados para a beira, sobre o CASCALHO escuro que a quebra
 * deixou; em volta, uns pedaços soltos.
 *
 * Três versões no mesmo tipo (`versoes/pilhaDeMinerioVersoes.ts`), pelo que o pedaço traz:
 * - FERRO (a 1ª, `montarPilhaDeMinerio`): a pedra com as manchas de ferrugem (a hematita parda-avermelhada e a
 *   limonita ocre) e a quebra cinza do metal pegando a luz;
 * - OURO (`montarPilhaDeMinerioDeOuro`): o veio e as pintas de ouro na pedra (o ouro de `tesouroDeOuro.ts`, o mesmo
 *   do Monte de ouro), umas pepitas no alto e dois brilhos;
 * - CRISTAL (`montarPilhaDeMinerioDeCristal`): pontas de ametista nascendo das pedras (o violeta dos Cristais,
 *   `carimbos/novos/cristais.ts`), sem luz própria.
 *
 * O PEDAÇO é exportado (`pintarPedacoDeMinerio`): o carrinho de mina leva a mesma carga e a escora quebrada, o mesmo
 * entulho (a pedra sem minério). Cada pedaço é uma pedra de quinas tortas com a FACE DA QUEBRA, mais clara e puxada
 * para a luz (de cima à esquerda), e faz sombra nos de baixo: a pilha é pintada da beira para o alto.
 *
 * Material: `pedra` (a ganga, a rocha de cada pedaço e o cascalho); o minério é fixo. As medidas saem do menor lado da
 * pegada (1 x 1 casa de partida) e os lugares, de frações dela: esticada, a pilha se espalha sem deformar os pedaços.
 * Sem luz.
 */
import { hash } from '../../ruido'
import { cadeia, dentroDe, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type Cena, type CriarPeca, type MaterialDaPeca } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'
import { circulo, ondular, OURO, pintarBrilho, pintarPepita } from './tesouroDeOuro'

export type Minerio = 'ferro' | 'ouro' | 'cristal' | 'entulho'

// ---------- as cores fixas do minério ----------

/**
 * A hematita: o pardo-avermelhado da ferrugem, apagado (saturação HSL 0,33). Na primeira folha (0,41, opaca a 0,82)
 * as manchas liam fatias de calabresa em cima da pedra.
 */
const FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x7e, 0x54, 0x42] }
/** A limonita: o ocre do ferro molhado, mais claro e mais amarelo que a ferrugem. */
const LIMONITA: MaterialDaPeca = { classe: 'liso', rgb: [0x92, 0x76, 0x52] }
/** A quebra fresca do minério de ferro: o cinza-aço que pega a luz. */
const ACO_DO_MINERIO: MaterialDaPeca = { classe: 'metal', rgb: [0x86, 0x84, 0x82] }
/** A ametista dos Cristais (`carimbos/novos/cristais.ts`): o escuro da beira, o meio e o reflexo. */
const AMETISTA_ESCURA: MaterialDaPeca = { classe: 'liso', rgb: [76, 54, 116] }
const AMETISTA: MaterialDaPeca = { classe: 'liso', rgb: [126, 94, 172] }
const AMETISTA_CLARA: MaterialDaPeca = { classe: 'liso', rgb: [180, 156, 218] }
const REFLEXO_DA_AMETISTA: MaterialDaPeca = { classe: 'liso', rgb: [228, 218, 242] }

// ---------- as medidas do pedaço (frações do raio dele) ----------

/** As quinas do pedaço, o raio mínimo e o a mais de cada uma, e a aspereza da beira. */
const QUINAS = 7
const QUINA_MINIMA = 0.72
const QUINA_A_MAIS = 0.34
const ASPEREZA = 0.06
/** O pedaço visto de cima é um nada achatado (pedra deitada). */
const ACHATADO = 0.88
/** A sombra que o pedaço faz nas peças de baixo (px) e a força dela. */
const PROJECAO_DO_PEDACO = 1.3
const FORCA_DA_PROJECAO = 0.38
/** A face da quebra: o quanto encolhe, o quanto vai para a luz e o quanto clareia. */
const FACE_DA_QUEBRA = { encolhe: 0.56, paraALuz: 0.16, clareia: 1.1 } as const
/** A luz do motor no chão (de cima à esquerda), para onde a face da quebra e o reflexo vão. */
const LUZ: Ponto = [-0.79, -0.61]

/** Sorteio fixo de 0 a 1 do pedaço: a mesma semente dá a mesma pedra. */
function sorteio(semente: number, i: number): number {
  return hash(semente, i, 9101)
}

/** O contorno torto do pedaço: `QUINAS` quinas em volta do meio, cada uma num raio. */
function quinasDoPedaco(x: number, y: number, r: number, semente: number): Ponto[] {
  const giro = sorteio(semente, 0) * Math.PI * 2
  return Array.from({ length: QUINAS }, (_, i): Ponto => {
    const a = giro + (i / QUINAS) * Math.PI * 2 + (sorteio(semente, 1 + i) - 0.5) * 0.5
    const raio = r * (QUINA_MINIMA + QUINA_A_MAIS * sorteio(semente, 10 + i))
    return [x + Math.cos(a) * raio, y + Math.sin(a) * raio * ACHATADO]
  })
}

/** As manchas de ferrugem e de limonita e a quebra cinza do aço, dentro da pedra. */
function pintarFerro(P: CriarPeca, cena: Cena, rocha: Forma, x: number, y: number, r: number, semente: number): void {
  const L = cena.partes
  const a = sorteio(semente, 30) * Math.PI
  const ox = (sorteio(semente, 31) - 0.5) * r * 0.6
  const oy = (sorteio(semente, 32) - 0.5) * r * 0.5
  const mancha = dentroDe(ondular(elipseGirada(x + ox, y + oy, r * 0.58, r * 0.34, a), r * 0.12, 1.6, semente * 0.7), rocha)
  L.push(P(mancha, FERRUGEM, { bisel: r * 0.1, contorno: 0, alfa: 0.62, suave: r * 0.16, ruga: 1.4, tom: 0.9 + 0.14 * sorteio(semente, 33), semente: semente + 1 }))
  if (sorteio(semente, 34) > 0.5) {
    const b = a + 1.7
    const ocre = dentroDe(elipseGirada(x - ox * 0.8, y - oy * 0.9 + r * 0.18, r * 0.3, r * 0.18, b), rocha)
    L.push(P(ocre, LIMONITA, { bisel: r * 0.08, contorno: 0, alfa: 0.5, suave: r * 0.12, ruga: 1.2, semente: semente + 2 }))
  }
  // A quebra cinza do metal, do lado da luz: um caco pequeno e liso que brilha.
  const bx = x + LUZ[0] * r * 0.34
  const by = y + LUZ[1] * r * 0.3
  const caco = poligono([
    [bx - r * 0.2, by - r * 0.02],
    [bx - r * 0.02, by - r * 0.16],
    [bx + r * 0.18, by - r * 0.04],
    [bx + r * 0.02, by + r * 0.12],
  ])
  L.push(P(dentroDe(caco, rocha), ACO_DO_MINERIO, { bisel: r * 0.06, contorno: 0.12, metal: 0.62, tom: 1.04, semente: semente + 3 }))
}

/**
 * O veio de ouro torto atravessado na pedra e as pintas (a ideia do minério de `tesouroDeOuro.ts`). O veio é uma
 * linha quebrada de quatro lances, fina; na primeira folha, reto e com um galho no meio, cada pedaço lia um X amarelo.
 */
function pintarOuro(P: CriarPeca, cena: Cena, rocha: Forma, x: number, y: number, r: number, semente: number): void {
  const a = sorteio(semente, 40) * Math.PI
  const [ca, sa] = [Math.cos(a), Math.sin(a)]
  const [na, nb] = [-sa, ca]
  const pontos: Ponto[] = [-0.85, -0.3, 0.25, 0.8].map((t, i): Ponto => {
    const desvio = (sorteio(semente, 41 + i) - 0.5) * r * 0.5
    return [x + ca * r * t + na * desvio, y + sa * r * t * 0.88 + nb * desvio]
  })
  let ouro: Forma = cadeia(pontos, r * 0.065)
  for (let i = 0; i < 4; i += 1) {
    const b = sorteio(semente, 45 + i) * Math.PI * 2
    const d = r * (0.28 + 0.4 * sorteio(semente, 49 + i))
    ouro = uniao(ouro, circulo(x + Math.cos(b) * d, y + Math.sin(b) * d, r * (0.06 + 0.06 * sorteio(semente, 53 + i))))
  }
  const dentro: Forma = { b: ouro.b, d: (px, py) => Math.max(ouro.d(px, py), rocha.d(px, py) + r * 0.1) }
  cena.partes.push(P(dentro, OURO, { bisel: r * 0.06, contorno: 0.14, metal: 0.6, tom: 1.1, semente: semente + 4 }))
}

/**
 * Uma ponta de cristal saindo da pedra, vista de cima: o prisma deitado de lado, com as três faces de cima (a da
 * luz clara, a de cima no meio e a de costas escura), a ponta de facetas e o reflexo na face da luz. `rumo` é o ângulo
 * da ponta na tela; o pé fica enterrado na pedra.
 */
export function pintarPontaDeCristal(P: CriarPeca, cena: Cena, x: number, y: number, comprimento: number, largura: number, rumo: number, semente: number): void {
  const L = cena.partes
  const [ux, uy] = [Math.cos(rumo), Math.sin(rumo)]
  const [nx, ny] = [-uy, ux]
  const meia = largura / 2
  const ombro = comprimento * 0.72
  const em = (t: number, k: number): Ponto => [x + ux * t + nx * meia * k, y + uy * t + ny * meia * k]
  const bico = em(comprimento, 0.05)
  // A face de que lado (+n ou -n) olha para a luz: a de lá é a clara.
  const ladoDaLuz = nx * LUZ[0] + ny * LUZ[1] > 0 ? 1 : -1
  const contornoDaPonta = poligono([em(0, -1.12), em(ombro, -1.12), bico, em(ombro, 1.12), em(0, 1.12)])
  L.push(P(contornoDaPonta, AMETISTA_ESCURA, { bisel: 0, contorno: 0.3, tom: 0.92, projeta: { dist: 1, forca: 0.34 }, semente }))
  const faces: readonly (readonly [number, number, MaterialDaPeca, number])[] = [
    [-1, -0.34, ladoDaLuz < 0 ? AMETISTA_CLARA : AMETISTA_ESCURA, ladoDaLuz < 0 ? 0.98 : 1.18],
    [-0.34, 0.34, AMETISTA, 1.04],
    [0.34, 1, ladoDaLuz > 0 ? AMETISTA_CLARA : AMETISTA_ESCURA, ladoDaLuz > 0 ? 0.98 : 1.18],
  ]
  faces.forEach(([de, ate, mat, tom], i) => {
    const face = poligono([em(0, de), em(ombro, de), bico, em(ombro, ate), em(0, ate)])
    L.push(P(face, mat, { bisel: 0, contorno: 0, tom, semente: semente + 1 + i }))
  })
  // O reflexo: uma faixa clara na face da luz, do meio do corpo ao ombro.
  const k = ladoDaLuz * 0.7
  const reflexo = poligono([em(comprimento * 0.22, k), em(ombro * 0.96, k), em(ombro * 0.9, k * 0.62), em(comprimento * 0.26, k * 0.62)])
  L.push(P(reflexo, REFLEXO_DA_AMETISTA, { bisel: 0, contorno: 0, alfa: 0.7, semente: semente + 5 }))
}

/** Uma ou duas pontas de ametista nascendo do pedaço, viradas para fora do monte. */
function pintarCristal(P: CriarPeca, cena: Cena, x: number, y: number, r: number, rumoParaFora: number, semente: number): void {
  const pontas = sorteio(semente, 60) > 0.45 ? 2 : 1
  for (let i = 0; i < pontas; i += 1) {
    const rumo = rumoParaFora + (i === 0 ? -0.35 : 0.55) + (sorteio(semente, 61 + i) - 0.5) * 0.5
    const comprimento = r * (i === 0 ? 1.25 : 0.9) * (0.9 + 0.2 * sorteio(semente, 63 + i))
    const largura = r * (i === 0 ? 0.5 : 0.38)
    const px = x - Math.cos(rumo) * r * 0.25
    const py = y - Math.sin(rumo) * r * 0.25
    pintarPontaDeCristal(P, cena, px, py, comprimento, largura, rumo, semente + 10 * (i + 1))
  }
}

/**
 * O PEDAÇO de minério em (x, y), raio `r` (px): a pedra no material `pedra`, a face da quebra e o minério. `rumo` é o
 * ângulo para fora do monte (as pontas de cristal apontam para lá). Devolve o contorno da pedra.
 */
export function pintarPedacoDeMinerio(P: CriarPeca, cena: Cena, x: number, y: number, r: number, pedra: MaterialDaPeca, minerio: Minerio, semente: number, rumo = -Math.PI / 2): Forma {
  const pontos = quinasDoPedaco(x, y, r, semente)
  const rocha = ondular(poligono(pontos), r * ASPEREZA, 1.3, semente * 0.31)
  const tom = (minerio === 'ferro' ? 0.8 : 0.88) + 0.2 * sorteio(semente, 20)
  cena.partes.push(P(rocha, pedra, { bisel: r * 0.36, contorno: 0.3, tom, projeta: { dist: PROJECAO_DO_PEDACO, forca: FORCA_DA_PROJECAO }, semente }))
  // A face da quebra: a mesma pedra, menor, puxada para a luz e mais clara (o patamar de cima, sem a beira escura).
  const f = FACE_DA_QUEBRA
  const mx = x + LUZ[0] * r * f.paraALuz
  const my = y + LUZ[1] * r * f.paraALuz
  const face = poligono(pontos.map(([px, py]): Ponto => [mx + (px - x) * f.encolhe, my + (py - y) * f.encolhe]))
  cena.partes.push(P(face, pedra, { bisel: r * 0.14, contorno: 0, tom: tom * f.clareia, alfa: 0.8, semente: semente + 7 }))
  // Nem todo pedaço mostra o minério na face de cima: o que não mostra é a ganga (a pedra pura), como no veio de verdade.
  const mostra = sorteio(semente, 21)
  if (minerio === 'ferro' && mostra > 0.15) pintarFerro(P, cena, rocha, x, y, r, semente)
  else if (minerio === 'ouro' && mostra > 0.3) pintarOuro(P, cena, rocha, x, y, r, semente)
  else if (minerio === 'cristal' && sorteio(semente, 70) > 0.3) pintarCristal(P, cena, x, y, r, rumo, semente)
  return rocha
}

// ---------- a pilha ----------

/** Um pedaço da pilha: o meio (frações da meia pegada) e o raio (fração do menor lado). */
type Lugar = readonly [number, number, number]

/**
 * A beira: os miúdos que rolaram para fora, em volta, de tamanhos desiguais. Na primeira folha eram todos do mesmo
 * tamanho e no mesmo raio, e a pilha lia uma pizza: agora o contorno avança e recua.
 */
const BEIRA: readonly Lugar[] = [
  [-0.66, 0.36, 0.1],
  [-0.4, 0.62, 0.07],
  [-0.08, 0.7, 0.11],
  [0.3, 0.62, 0.08],
  [0.6, 0.44, 0.1],
  [0.74, 0.04, 0.085],
  [0.56, -0.4, 0.105],
  [0.2, -0.62, 0.075],
  [-0.2, -0.6, 0.1],
  [-0.56, -0.38, 0.08],
  [-0.74, -0.02, 0.095],
]
/** O meio: os médios, por cima da beira. */
const MEIO: readonly Lugar[] = [
  [-0.36, 0.22, 0.14],
  [0.04, 0.4, 0.13],
  [0.4, 0.18, 0.135],
  [0.3, -0.26, 0.125],
  [-0.06, -0.32, 0.14],
  [-0.42, -0.14, 0.12],
]
/** O alto: os grandes, no fim (por cima de todos), puxados para cima à esquerda (o cume do monte). */
const ALTO: readonly Lugar[] = [
  [-0.12, 0.08, 0.17],
  [0.18, -0.04, 0.15],
  [-0.02, -0.14, 0.12],
]
/** Os soltos, fora do monte, no chão. */
const SOLTOS: readonly Lugar[] = [
  [-0.86, 0.7, 0.055],
  [0.82, 0.74, 0.045],
  [0.86, -0.72, 0.05],
  [-0.8, -0.7, 0.04],
  [0.04, 0.9, 0.035],
]
/** O cascalho de baixo: os lóbulos (meio e raios, frações da meia pegada), a beira ondulada e o tom. */
const LOBULOS: readonly (readonly [number, number, number, number])[] = [
  [-0.04, 0.04, 0.62, 0.56],
  [-0.36, 0.26, 0.4, 0.36],
  [0.36, 0.3, 0.38, 0.34],
  [0.32, -0.26, 0.4, 0.34],
  [-0.3, -0.24, 0.38, 0.36],
]
const CASCALHO = { rx: 0.8, ry: 0.76, onda: 0.05, tom: 0.62 } as const
/** As pedrinhas do cascalho: quantas e o raio (fração do menor lado). */
const PEDRINHAS = 34
const RAIO_DA_PEDRINHA = 0.016
/** A altura do monte (casas): a sombra dele no chão. */
const ALTURA_DO_MONTE = 0.24
/** O quanto cada cristal do monte foge do rumo para fora (radianos, de ponta a ponta). */
const GIRO_DOS_CRISTAIS = 1.9

/** O rumo para fora do monte, na tela, do pedaço em (fx, fy). */
function paraFora(fx: number, fy: number): number {
  return fx === 0 && fy === 0 ? -Math.PI / 2 : Math.atan2(fy, fx)
}

function montarPilha(c: ContextoDoMovel, cena: Cena, minerio: Minerio): void {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const s = Math.min(c.w, c.h)
  const L = cena.partes
  const lobulos = LOBULOS.map(([fx, fy, rx, ry]) => elipse(fx * hw, fy * hh, rx * hw, ry * hh)).reduce((a, b) => uniao(a, b))
  const base = ondular(lobulos, s * CASCALHO.onda, 0.45, 9.3)
  cena.sombras.push({ forma: base, z: ALTURA_DO_MONTE * g, forca: 0.24 }, contato(base, 0.22))
  // O cascalho escuro de baixo (a beira esfumada, sem risco) e as pedrinhas dele.
  L.push(P(base, pedra, { bisel: s * 0.05, contorno: 0.12, suave: 1.2, tom: CASCALHO.tom, ruga: 1.8, semente: 9200 }))
  for (let i = 0; i < PEDRINHAS; i += 1) {
    const a = hash(i, 1, 9201) * Math.PI * 2
    const d = Math.sqrt(hash(i, 2, 9201)) * 0.9
    const px = Math.cos(a) * d * hw * CASCALHO.rx
    const py = hh * 0.04 + Math.sin(a) * d * hh * CASCALHO.ry
    const r = s * RAIO_DA_PEDRINHA * (0.7 + 0.7 * hash(i, 3, 9201))
    L.push(P(elipse(px, py, r, r * 0.84), pedra, { bisel: r * 0.5, contorno: 0.22, tom: 0.7 + 0.3 * hash(i, 4, 9201), semente: 9210 + i }))
  }
  // Os soltos no chão, com o contato deles.
  SOLTOS.forEach(([fx, fy, fr], i) => {
    const x = fx * hw
    const y = fy * hh
    const r = fr * s
    cena.sombras.push(contato(elipse(x, y, r, r * ACHATADO), 0.3))
    pintarPedacoDeMinerio(P, cena, x, y, r, pedra, minerio === 'cristal' ? 'entulho' : minerio, 9300 + i * 17, paraFora(fx, fy))
  })
  // O monte, da beira para o alto: cada pedaço faz sombra nos de baixo.
  ;[BEIRA, MEIO, ALTO].forEach((camada, k) => {
    camada.forEach(([fx, fy, fr], i) => {
      // Os cristais saem tortos do monte: todos para fora, em leque, a pilha lia uma flor.
      const torto = minerio === 'cristal' ? (hash(i, 7 + k, 9450) - 0.5) * GIRO_DOS_CRISTAIS : 0
      pintarPedacoDeMinerio(P, cena, fx * hw, fy * hh, fr * s, pedra, minerio, 9400 + k * 200 + i * 17, paraFora(fx, fy) + torto)
    })
  })
  if (minerio === 'ouro') {
    // As pepitas soltas no alto e os dois brilhos.
    const pepitas: readonly Lugar[] = [
      [-0.3, -0.02, 0.04],
      [0.26, 0.24, 0.036],
      [0.1, -0.38, 0.034],
    ]
    pepitas.forEach(([fx, fy, fr], i) => {
      pintarPepita(P, cena, fx * hw, fy * hh, fr * s, 1.02, 9700 + i * 7)
    })
    pintarBrilho(P, cena, -0.2 * hw, -0.12 * hh, 0.07 * s, 9720)
    pintarBrilho(P, cena, 0.3 * hw, 0.3 * hh, 0.05 * s, 9721)
  }
}

export const montarPilhaDeMinerio: MontarMovel = (c, cena) => {
  montarPilha(c, cena, 'ferro')
}

export const montarPilhaDeMinerioDeOuro: MontarMovel = (c, cena) => {
  montarPilha(c, cena, 'ouro')
}

export const montarPilhaDeMinerioDeCristal: MontarMovel = (c, cena) => {
  montarPilha(c, cena, 'cristal')
}
