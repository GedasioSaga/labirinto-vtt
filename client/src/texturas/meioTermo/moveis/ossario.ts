/**
 * OSSÁRIO (lote L06 de 24/11/2026, item 57, tema da cripta do mapa 8; desenho próprio, só a ideia do objeto). A PILHA
 * DE CRÂNIOS E OSSOS arrumada contra a parede, como nas catacumbas: sobre a soleira de pedra, a massa de PONTAS DE
 * OSSO (os fêmures empilhados de topo), escura e funda, e nela os CRÂNIOS em três andares desencontrados, de tamanhos,
 * espaços e tons diferentes; uns de lado, um de queixo para cima. O alto sobe em DEGRAUS irregulares, com três
 * crânios saindo do contorno e um osso comprido passando da beira: uma pilha que foi sendo feita, não uma forma.
 *
 * A pilha tem de ler como MASSA FUNDA, e não como pão de forma nem bandeja de ovos. Por isso: as pontas de osso são
 * uma TEXTURA um tom mais escura e mais fria que os crânios (células macias, de contraste baixo, que some quase todo
 * no tamanho de mesa), o fundo entre os ossos é quase preto, cada andar de crânios faz sombra marcada no de baixo e
 * a pilha inteira pousa numa sombra larga debaixo da soleira.
 *
 * DESENHADO DE FRENTE nas duas vistas (perfil `EM_PE`), como o nicho funerário e o columbário do lote L05: de cima,
 * uma pilha de ossos contra a parede seria uma faixa de calotas. A parede é a beira de cima da pegada.
 * Material: `pedra` (a soleira); o osso, a teia e o musgo são fixos.
 *
 * Revisão do diretor de arte (24/11/2026): a silhueta era um domo liso e as duas fiadas, de oito ou nove crânios
 * iguais em passo fixo, listravam; a sombra pousada era um traço fino.
 */
import { hash, limitar01 } from '../../ruido'
import { cadeia, caixa, capsula, dentroDe, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'
import { ESCURO_DA_PEDRA } from './apoioDasReferencias'
import { MUSGO, MUSGO_DA_CRIPTA, musgoPreso } from './pedestalComCristal'

/** A altura da pilha em casas (a sombra comprida) e quanto ela sobe acima da pegada (o teto do plano é 0,2). */
const ALTURA = 0.85
const SUBIDA = 0.18
/** O pé (px acima da beira de baixo da pegada), a soleira e a sobra dos lados (px). */
const PE = 2
const SOLEIRA = 5.6
const LADO = 2
/** O crânio: a meia largura de partida (px); cada um a muda em até 15% para mais ou para menos. */
const CRANIO = 4.5
/** A célula das pontas de osso (px) e o contraste dela no tamanho de mesa (abaixo de 1,5 pixel por px). */
const CELULA = 3.7
const CONTRASTE_DE_MESA = 0.45
/**
 * O osso dos crânios (o marfim velho do nicho funerário), o das PONTAS (um tom mais escuro e mais frio: é o fundo
 * da pilha), o escuro entre os ossos (quase preto), as órbitas e a teia.
 */
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xca, 0xae] }
const PONTAS: MaterialDaPeca = { classe: 'liso', rgb: [0xa2, 0x9f, 0x92] }
const FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x29, 0x26] }
const ORBITA: MaterialDaPeca = { classe: 'liso', rgb: [0x34, 0x2e, 0x29] }
const TEIA: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xd2, 0xc8] }
/** A sombra pousada: a faixa do pé que a faz (px) e a força; a de cada andar no de baixo (o alto da faixa, px, e o alfa). */
const SOMBRA_POUSADA = { faixa: 6.4, forca: 0.36 } as const
const SOMBRA_DO_ANDAR = { alto: 5, alfa: 0.7 } as const
const SEMENTE = 5700

function suave01(t: number): number {
  const x = limitar01(t)
  return x * x * (3 - 2 * x)
}

/**
 * As PONTAS DE OSSO: células redondas de TAMANHOS diferentes, bem fora da grade (cada uma anda até três quartos da
 * célula: em fiadas certas liam como bandeja de ovos), claras no meio e quase pretas na fresta; uma em cada cinco
 * tem o furo do tutano. Uma peça só para o monte inteiro: a distância é contada no ponto, sem uma peça por osso.
 */
function texPontasDeOsso(semente: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const gx = x / CELULA
    const gy = y / (CELULA * 0.9)
    const linha = Math.floor(gy)
    let menor = 9
    let dona = 0
    for (let dj = -1; dj <= 1; dj += 1) {
      const j = linha + dj
      // A fiada ímpar anda meia célula.
      const meio = (j & 1) * 0.5
      const base = Math.floor(gx - meio)
      for (let di = -1; di <= 1; di += 1) {
        const i = base + di
        const cx = i + 0.5 + meio + (hash(i, j, semente) - 0.5) * 0.76
        const cy = j + 0.5 + (hash(i, j, semente + 1) - 0.5) * 0.7
        // O osso grosso e o fino: a ponta de um fêmur ao lado da de uma costela.
        const d = Math.hypot(gx - cx, gy - cy) / (0.7 + 0.56 * hash(i, j, semente + 3))
        if (d < menor) {
          menor = d
          dona = hash(i, j, semente + 2)
        }
      }
    }
    let luz = 0.1 - 0.56 * suave01((menor - 0.24) / 0.3) + (dona - 0.5) * 0.24
    if (dona < 0.2 && menor < 0.14) luz -= 0.24
    s[3] += luz * (escala < 1.5 ? CONTRASTE_DE_MESA : 1)
  }
}

interface Caveira {
  readonly x: number
  readonly y: number
  /** A meia largura do crânio (px). */
  readonly s: number
  readonly tom: number
  /** Para que lado ela olha: -1 a esquerda, 0 de frente, 1 a direita. */
  readonly virada: number
  /** Tombada (radianos): de lado (perto de meia volta de quarto) ou de queixo para cima (perto de meia volta). */
  readonly tombo: number
}

/** Um ponto do desenho da caveira (em meias larguras, a partir do meio do crânio), tombado e posto no lugar. */
function noCranio(cv: Caveira, u: number, v: number): Ponto {
  const [co, si] = [Math.cos(cv.tombo), Math.sin(cv.tombo)]
  return [cv.x + (u * co - v * si) * cv.s, cv.y + (u * si + v * co) * cv.s]
}

/** A caveira de frente: o crânio com a maxila (sem a mandíbula, como nos ossários), as órbitas, o nariz e os dentes. */
function caveira(c: ContextoDoMovel, L: Peca[], cv: Caveira, semente: number): void {
  const P = c.peca
  const { s, virada: v } = cv
  const [mx, my] = noCranio(cv, v * 0.12, 0.84)
  const forma: Forma = uniao(elipseGirada(cv.x, cv.y, s, s * 1.05, cv.tombo), elipseGirada(mx, my, s * 0.56, s * 0.46, cv.tombo))
  L.push(P(forma, OSSO, { tabua: 0, bisel: s * 0.44, tom: cv.tom, contorno: 0.3, projeta: { dist: 1.2, forca: 0.34 }, semente }))
  // As órbitas: a de trás encolhe quando a caveira vira.
  for (const lado of [-1, 1]) {
    const longe = lado === -v ? 0.66 : 1
    const [ox, oy] = noCranio(cv, lado * 0.39 + v * 0.2, 0.18)
    L.push(P(elipseGirada(ox, oy, s * 0.24 * longe, s * 0.26, cv.tombo), ORBITA, { tabua: 0, bisel: 0, contorno: 0, recesso: { k: 0.5, forca: 0.3 }, semente: semente + 1 }))
  }
  L.push(P(poligono([noCranio(cv, v * 0.24, 0.42), noCranio(cv, v * 0.24 + 0.13, 0.72), noCranio(cv, v * 0.24 - 0.13, 0.72)]), ORBITA, { tabua: 0, bisel: 0, contorno: 0, semente: semente + 2 }))
  L.push(P(cadeia([noCranio(cv, v * 0.14 - 0.4, 1.02), noCranio(cv, v * 0.14 + 0.4, 1.02)], 0.2), ORBITA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.7, semente: semente + 3 }))
}

/** Um osso comprido deitado: a haste e os dois côndilos em cada ponta. */
function ossoComprido(a: Ponto, b: Ponto, r: number): Forma {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
  const l = Math.hypot(dx, dy) || 1
  const [nx, ny] = [(-dy / l) * r * 0.75, (dx / l) * r * 0.75]
  let forma: Forma = capsula(a[0], a[1], b[0], b[1], r)
  for (const [px, py] of [a, b]) forma = uniao(forma, uniao(elipse(px + nx, py + ny, r * 1.1, r * 1.1), elipse(px - nx, py - ny, r * 1.05, r * 1.05)))
  return forma
}

/**
 * Os CRÂNIOS, um por um: x (fração da meia largura da pilha), y (px a partir do andar), o tamanho (fração do de
 * partida, de 0,85 a 1,15), o tom, a virada e o tombo. Nada em passo fixo: os espaços e os tamanhos mudam, dois
 * estão de lado (tombo perto de 1,45) e dois de queixo para cima (tombo perto de 3).
 */
type Linha = readonly [number, number, number, number, number, number]
const ANDAR_DE_BAIXO: readonly Linha[] = [
  [-0.86, 1.6, 0.93, 0.94, 1, 0.06],
  [-0.675, -1.5, 1.12, 1.06, 0, -0.05],
  [-0.5, 2.2, 0.86, 0.84, 0, 1.46],
  [-0.27, -1.9, 1.05, 1, 0, 0.04],
  [-0.055, 1.3, 1.15, 1.08, -1, -0.08],
  [0.2, -0.6, 0.88, 0.78, 0, 0.1],
  [0.355, 2.4, 1.02, 0.96, 0, 3.02],
  [0.8, -1.1, 1.08, 1.04, 1, -0.06],
]
const ANDAR_DO_MEIO: readonly Linha[] = [
  [-0.735, 2.2, 1, 1, 0, 0.12],
  [-0.545, -1.3, 0.86, 0.9, -1, -0.1],
  [-0.31, 1.1, 1.14, 1.06, 0, 0.02],
  [0.09, -1.8, 0.95, 0.96, 0, -1.42],
  [0.3, 2, 1.07, 1.04, 0, 0.08],
  [0.535, -1.5, 0.9, 0.82, 1, 0.14],
]
/** Os do alto, com o y contado em px do alto do monte: três deles SAEM do contorno (o da esquerda, o do cume e o do ombro direito). */
const DO_ALTO: readonly Linha[] = [
  [-0.585, 3.2, 1.02, 1.04, -1, -0.42],
  [-0.24, 4.6, 0.92, 0.94, 0, 2.9],
  [0.16, -4, 1.1, 1.06, 0, 0.26],
  [-0.02, 6.4, 0.86, 0.98, 1, -0.2],
  [0.75, 14.6, 0.98, 1.02, 0, 0.5],
]

export const montarOssario: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const x = hw - LADO
  const yPe = hh - PE
  const ySoleira = yPe - SOLEIRA
  const yAlto = -hh - SUBIDA * g
  // O alto do monte fica abaixo do teto: os crânios do cume passam dele.
  const yMonte = yAlto + CRANIO * 1.5
  const alto = ySoleira - yMonte

  // Os andares: o y do meio dos crânios de cada um (o de baixo, o do meio) e o alto do monte.
  const yBaixo = ySoleira - alto * 0.2
  const yMeio = ySoleira - alto * 0.52
  const yCume = yMonte + alto * 0.1

  // A SOMBRA POUSADA: a faixa larga do pé arrastada até a altura da pilha (um quarto de casa debaixo da soleira) e o contato.
  cena.sombras.push({ forma: caixa(-x, yPe - SOMBRA_POUSADA.faixa, x, yPe, 0.6), z: g * ALTURA, forca: SOMBRA_POUSADA.forca }, contato(caixa(-x - 1.5, yPe - 1.2, x + 1.5, yPe + 1.2, 1), 0.36))

  // O MONTE: uma silhueta só, larga embaixo e subindo em DEGRAUS irregulares (o ombro esquerdo, o cume, o ombro
  // direito mais baixo). Por trás, a beira quase preta; na frente, a massa de pontas de osso.
  const em = (fx: number, fy: number): Ponto => [fx * x, ySoleira - fy * alto]
  const contorno: Ponto[] = [
    [-x + 1.5, ySoleira + 0.4], em(-0.965, 0.3), em(-0.925, 0.36), em(-0.85, 0.375), em(-0.835, 0.6), em(-0.75, 0.63), em(-0.715, 0.74), em(-0.63, 0.76),
    em(-0.61, 0.92), em(-0.44, 0.965), em(-0.22, 0.99), em(-0.04, 0.975), em(0.15, 1), em(0.26, 0.97), em(0.285, 0.885), em(0.44, 0.9),
    em(0.48, 0.78), em(0.61, 0.76), em(0.65, 0.66), em(0.8, 0.63), em(0.84, 0.41), em(0.93, 0.385), em(0.965, 0.24), [x - 1.5, ySoleira + 0.4],
  ]
  const monte = poligono(contorno)
  const beira: Forma = { b: [monte.b[0] - 1.3, monte.b[1] - 1.3, monte.b[2] + 1.3, monte.b[3] + 1.3], d: (px, py) => monte.d(px, py) - 1.3 }
  L.push(P(beira, FUNDO, { tabua: 0, bisel: 1.2, contorno: 0.3, semente: SEMENTE }))
  L.push(P(monte, PONTAS, { tabua: 0, bisel: 1.6, tom: 0.8, contorno: 0.22, textura: texPontasDeOsso(SEMENTE + 10), semente: SEMENTE + 4 }))

  // A SOLEIRA de pedra: o alto claro e a face, com as juntas.
  L.push(P(caixa(-x - 1.4, ySoleira, x + 1.4, ySoleira + 1.5, 0.4), pedra, { tabua: 0, bisel: 0.4, tom: 1.1, contorno: 0.24, semente: SEMENTE + 1 }))
  L.push(P(caixa(-x - 1.4, ySoleira + 1.5, x + 1.4, yPe, 0.5), pedra, { tabua: 0, bisel: 0.8, tom: 0.74, contorno: 0.3, semente: SEMENTE + 2 }))
  for (const xj of [-0.62, -0.18, 0.3, 0.7]) L.push(P(caixa(xj * x - 0.3, ySoleira + 2, xj * x + 0.3, yPe - 0.5, 0.2), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.6, alfa: 0.7, semente: SEMENTE + 3 }))

  // A SOMBRA marcada debaixo de cada andar de crânios e do monte de cima: o andar de cima pesa no de baixo.
  const sombraDoAndar = (y: number, meia: number, k: number): void => {
    L.push(P(dentroDe(caixa(-meia, y - 0.8, meia, y + SOMBRA_DO_ANDAR.alto, 1.6), monte), FUNDO, { tabua: 0, bisel: 0, contorno: 0, alfa: SOMBRA_DO_ANDAR.alfa, suave: 1.2, semente: SEMENTE + 7 + k }))
  }
  sombraDoAndar(yBaixo + CRANIO * 1.5, x * 0.93, 0)
  sombraDoAndar(yMeio + CRANIO * 1.5, x * 0.8, 1)
  sombraDoAndar(yCume + CRANIO * 2.3, x * 0.58, 2)

  // Os ossos compridos entre os andares: enchem os vãos (o lugar vazio do andar de baixo, o do meio) e deitam no alto.
  const ossos: readonly (readonly [Ponto, Ponto, number, number])[] = [
    [[0.53 * x, yBaixo + 3.4], [0.66 * x, yBaixo - 2.6], 0.95, 0.72],
    [[0.58 * x, yBaixo - 1.6], [0.68 * x, yBaixo + 3.2], 0.85, 0.66],
    [[-0.17 * x, yMeio + 2.6], [-0.03 * x, yMeio - 2.2], 0.95, 0.74],
    [[-0.48 * x, yCume + 6.6], [-0.31 * x, yCume + 4.4], 1, 0.92],
    [[0.3 * x, yCume + 5], [0.46 * x, yCume + 8], 1, 0.9],
  ]
  ossos.forEach(([a, b, r, tom], i) => {
    L.push(P(ossoComprido(a, b, r), OSSO, { tabua: 0, bisel: 0.8, tom, contorno: 0.28, projeta: { dist: 0.8, forca: 0.26 }, semente: SEMENTE + 170 + i }))
  })
  // O osso comprido que PASSA DA BEIRA: deitado no ombro direito, com a ponta no ar.
  L.push(P(ossoComprido([0.36 * x, yCume + 3], [0.93 * x, yCume + 10.6], 1.25), OSSO, { tabua: 0, bisel: 1, tom: 0.98, contorno: 0.3, projeta: { dist: 1.2, forca: 0.32 }, semente: SEMENTE + 176 }))

  // Os CRÂNIOS: o andar de baixo, o do meio e os do alto.
  const por = (linhas: readonly Linha[], y0: number, k: number): void => {
    linhas.forEach(([fx, dy, tamanho, tom, virada, tombo], i) => {
      caveira(c, L, { x: fx * x, y: y0 + dy, s: CRANIO * tamanho, tom, virada, tombo }, SEMENTE + 40 + k * 60 + i * 5)
    })
  }
  por(ANDAR_DE_BAIXO, yBaixo, 0)
  por(ANDAR_DO_MEIO, yMeio, 1)
  por(DO_ALTO, yCume, 2)

  // A TEIA no ombro direito (do osso que passa da beira até o monte) e o MUSGO no pé da soleira, preso a ela.
  const [tx, ty] = [0.9 * x, yCume + 11]
  const teia = { tabua: 0, bisel: 0, contorno: 0, alfa: 0.4 }
  for (const [ax, ay] of [[-9, 3.6], [-6.4, 7.4], [-2.2, 9.6], [1.6, 9]] as const) L.push(P(cadeia([[tx, ty], [tx + ax, ty + ay]], 0.16), TEIA, { ...teia, semente: SEMENTE + 200 }))
  for (const k of [0.5, 0.82]) L.push(P(cadeia([[tx - 9 * k, ty + 3.6 * k], [tx - 6.4 * k, ty + 7.4 * k], [tx - 2.2 * k, ty + 9.6 * k], [tx + 1.6 * k, ty + 9 * k]], 0.14), TEIA, { ...teia, alfa: 0.32, semente: SEMENTE + 201 }))
  const soleira = caixa(-x - 1.4, ySoleira, x + 1.4, yPe, 0.5)
  L.push(P(musgoPreso(elipse(-x + 9, yPe - 1.4, 8, 1.6), soleira), MUSGO_DA_CRIPTA, { ...MUSGO, semente: SEMENTE + 202 }))
  L.push(P(musgoPreso(elipse(x * 0.4, ySoleira + 1, 5, 1.2), soleira), MUSGO_DA_CRIPTA, { ...MUSGO, bisel: 0.3, alfa: 0.42, suave: 0.8, semente: SEMENTE + 203 }))
}
