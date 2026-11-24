/**
 * OSSÁRIO (lote L06 de 24/11/2026, item 57, tema da cripta do mapa 8; desenho próprio, só a ideia do objeto). A PILHA
 * DE CRÂNIOS E OSSOS arrumada contra a parede, como nas catacumbas: sobre a soleira de pedra, fiadas de PONTAS DE
 * OSSO (os fêmures empilhados de topo) alternadas com duas fiadas de CRÂNIOS virados para fora, e por cima o monte
 * irregular: mais quatro crânios tombados e ossos compridos deitados.
 *
 * A pilha tem de ler como MASSA, e não como trinta círculos. Por isso: as pontas de osso são uma TEXTURA (células
 * macias, de contraste baixo, que some quase todo no tamanho de mesa), os crânios encostam uns nos outros e dividem o
 * tom (só uns poucos saem mais escuros, virados ou sem vizinho), cada fiada faz sombra na de baixo, e o fundo escuro
 * entre os ossos amarra tudo numa silhueta só.
 *
 * DESENHADO DE FRENTE nas duas vistas (perfil `EM_PE`), como o nicho funerário e o columbário do lote L05: de cima,
 * uma pilha de ossos contra a parede seria uma faixa de calotas. A parede é a beira de cima da pegada.
 * Material: `pedra` (a soleira); o osso, a teia e o musgo são fixos.
 */
import { hash, limitar01 } from '../../ruido'
import { cadeia, caixa, capsula, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'
import { ESCURO_DA_PEDRA } from './apoioDasReferencias'
import { MUSGO_DA_CRIPTA } from './pedestalComCristal'

/** A altura da pilha em casas (a sombra comprida) e quanto ela sobe acima da pegada (o teto do plano é 0,2). */
const ALTURA = 0.85
const SUBIDA = 0.12
/** O pé (px acima da beira de baixo da pegada), a soleira e a sobra dos lados (px). */
const PE = 2
const SOLEIRA = 5.6
const LADO = 2
/** O crânio: a meia largura (px) e o passo de um ao outro na fiada. */
const CRANIO = 4.5
const PASSO = 9.5
/** A célula das pontas de osso (px) e o contraste dela no tamanho de mesa (abaixo de 1,5 pixel por px). */
const CELULA = 3.7
const CONTRASTE_DE_MESA = 0.45
/** O osso (o marfim velho do nicho funerário e dos ossos), o fundo entre os ossos, as órbitas e a teia. */
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: [0xd2, 0xc6, 0xaa] }
const FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x54, 0x4a, 0x3e] }
const ORBITA: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x33, 0x2c] }
const TEIA: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xd2, 0xc8] }
const SEMENTE = 5700

function suave01(t: number): number {
  const x = limitar01(t)
  return x * x * (3 - 2 * x)
}

/**
 * As PONTAS DE OSSO: células redondas desencontradas, cada uma clara no meio e escura na fresta; uma em cada cinco tem
 * o furo do tutano. Uma peça só para o monte inteiro: a distância é contada no ponto, sem uma peça por osso.
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
        const cx = i + 0.5 + meio + (hash(i, j, semente) - 0.5) * 0.34
        const cy = j + 0.5 + (hash(i, j, semente + 1) - 0.5) * 0.3
        const d = Math.hypot(gx - cx, gy - cy)
        if (d < menor) {
          menor = d
          dona = hash(i, j, semente + 2)
        }
      }
    }
    let luz = 0.1 - 0.34 * suave01((menor - 0.24) / 0.34) + (dona - 0.5) * 0.12
    if (dona < 0.2 && menor < 0.14) luz -= 0.2
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
  /** Tombada (radianos): as do monte de cima. */
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
  L.push(P(forma, OSSO, { tabua: 0, bisel: s * 0.44, tom: cv.tom, contorno: 0.28, projeta: { dist: 0.8, forca: 0.26 }, semente }))
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

export const montarOssario: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const x = hw - LADO
  const yPe = hh - PE
  const ySoleira = yPe - SOLEIRA
  const yAlto = -hh - SUBIDA * g

  // As fiadas, de baixo para cima (o y do alto de cada uma): pontas, crânios, pontas, crânios, pontas e o monte.
  const altoDosCranios = CRANIO * 2.25
  const faixa = (ySoleira - yAlto - altoDosCranios * 2 - 9.5) / 3
  const yPontas1 = ySoleira - faixa
  const yCranios1 = yPontas1 - altoDosCranios
  const yPontas2 = yCranios1 - faixa
  const yCranios2 = yPontas2 - altoDosCranios
  const yPontas3 = yCranios2 - faixa * 0.8
  const xDoMonte = x - 9

  // A sombra da pilha e o contato no pé.
  cena.sombras.push({ forma: caixa(-x, yPe - 1.5, x, yPe, 0.6), z: g * ALTURA, forca: 0.3 }, contato(caixa(-x - 1.5, yPe - 1.2, x + 1.5, yPe + 1.2, 1), 0.32))

  // O MONTE: uma silhueta só, mais larga embaixo e irregular em cima. Por trás, a beira escura; na frente, a massa
  // de pontas de osso que aparece entre as fiadas de crânios.
  const contorno: Ponto[] = [
    [-x + 1.5, ySoleira + 0.4], [-x + 2.2, yCranios1 + 2], [-x + 4.8, yCranios2 + 4], [-x + 8.6, yPontas3 + 2.2], [-x + 13.4, yPontas3 - 1.8],
    [-x * 0.36, yPontas3 - 3.2], [0, yPontas3 - 2], [x * 0.3, yPontas3 - 3.6], [x - 13, yPontas3 - 1.2], [x - 8.2, yPontas3 + 3],
    [x - 4.4, yCranios2 + 5], [x - 2, yCranios1 + 2.4], [x - 1.5, ySoleira + 0.4],
  ]
  const monte = poligono(contorno)
  const beira: Forma = { b: [monte.b[0] - 1.3, monte.b[1] - 1.3, monte.b[2] + 1.3, monte.b[3] + 1.3], d: (px, py) => monte.d(px, py) - 1.3 }
  L.push(P(beira, FUNDO, { tabua: 0, bisel: 1.2, contorno: 0.3, semente: SEMENTE }))
  L.push(P(monte, OSSO, { tabua: 0, bisel: 1.6, tom: 0.74, contorno: 0.22, textura: texPontasDeOsso(SEMENTE + 10), semente: SEMENTE + 4 }))

  // A SOLEIRA de pedra: o alto claro e a face, com as juntas.
  L.push(P(caixa(-x - 1.4, ySoleira, x + 1.4, ySoleira + 1.5, 0.4), pedra, { tabua: 0, bisel: 0.4, tom: 1.1, contorno: 0.24, semente: SEMENTE + 1 }))
  L.push(P(caixa(-x - 1.4, ySoleira + 1.5, x + 1.4, yPe, 0.5), pedra, { tabua: 0, bisel: 0.8, tom: 0.74, contorno: 0.3, semente: SEMENTE + 2 }))
  for (const xj of [-0.62, -0.18, 0.3, 0.7]) L.push(P(caixa(xj * x - 0.3, ySoleira + 2, xj * x + 0.3, yPe - 0.5, 0.2), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.6, alfa: 0.7, semente: SEMENTE + 3 }))

  // A sombra macia debaixo de cada fiada de crânios e do monte de cima: a fiada de cima pesa na de baixo.
  for (const [y, meia, k] of [[yPontas1, x - 3, 0], [yPontas2, x - 4, 1], [yPontas3, xDoMonte + 2, 2]] as const) {
    L.push(P(caixa(-meia, y - 0.6, meia, y + 2.6, 1.3), FUNDO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.34, suave: 1.1, semente: SEMENTE + 7 + k }))
  }

  // As duas fiadas de CRÂNIOS: encostados, a de cima desencontrada meio passo; um lugar vazio em cada uma.
  const fiadas: readonly { y: number; ate: number; desencontro: number; vazio: number; tom: number }[] = [
    { y: yCranios1 + CRANIO * 1.02, ate: x - 3.4, desencontro: 0, vazio: 7, tom: 0.92 },
    { y: yCranios2 + CRANIO * 1.02, ate: x - 7, desencontro: 0.5, vazio: 2, tom: 0.98 },
  ]
  fiadas.forEach((fiada, k) => {
    const quantos = Math.max(2, Math.floor((2 * fiada.ate) / PASSO))
    const x0 = -((quantos - 1) * PASSO) / 2 + (fiada.desencontro - 0.25) * 2
    for (let i = 0; i < quantos; i += 1) {
      const cx = x0 + i * PASSO + (hash(i, k, SEMENTE + 20) - 0.5) * 1.1
      const cy = fiada.y + (hash(i, k, SEMENTE + 21) - 0.5) * 1.2
      if (i === fiada.vazio) {
        // O lugar vazio: dois ossos compridos de topo e um pedaço de costela no escuro.
        L.push(P(ossoComprido([cx - 2.6, cy + 2.6], [cx + 1.8, cy - 1.4], 0.9), OSSO, { tabua: 0, bisel: 0.7, tom: 0.7, contorno: 0.26, semente: SEMENTE + 30 + k }))
        continue
      }
      const sorte = hash(i, k, SEMENTE + 22)
      const virada = sorte < 0.16 ? -1 : sorte > 0.86 ? 1 : 0
      // Poucos saem do tom da fiada: um em cada sete é mais escuro (o osso manchado).
      const tom = fiada.tom + (hash(i, k, SEMENTE + 23) - 0.5) * 0.08 - (hash(i, k, SEMENTE + 24) < 0.14 ? 0.16 : 0)
      caveira(c, L, { x: cx, y: cy, s: CRANIO * (0.94 + 0.1 * hash(i, k, SEMENTE + 25)), tom, virada, tombo: (hash(i, k, SEMENTE + 26) - 0.5) * 0.16 }, SEMENTE + 40 + k * 60 + i * 5)
    }
  })

  // O MONTE de cima: os ossos compridos deitados e os quatro crânios tombados.
  const yMonte = yPontas3 - 0.6
  const ossos: readonly (readonly [number, number, number, number])[] = [
    [-0.66, 0.6, -0.4, -1.4],
    [-0.14, -0.6, 0.12, 0.4],
    [0.38, -1, 0.64, 0.5],
    [-0.3, -5.4, 0.2, -6.4],
  ]
  ossos.forEach(([ax, ay, bx, by], i) => {
    L.push(P(ossoComprido([ax * xDoMonte, yMonte + ay], [bx * xDoMonte, yMonte + by], i === 3 ? 1.2 : 1.05), OSSO, { tabua: 0, bisel: 0.9, tom: 0.9 + 0.04 * i, contorno: 0.28, projeta: { dist: 0.8, forca: 0.24 }, semente: SEMENTE + 170 + i }))
  })
  const doMonte: readonly (readonly [number, number, number, number])[] = [
    [-0.78, -2.6, -0.5, -1],
    [-0.27, -3.6, 0.22, 0],
    [0.25, -3.2, -0.3, 1],
    [0.76, -2.4, 0.42, 0],
  ]
  doMonte.forEach(([fx, dy, tombo, virada], i) => {
    caveira(c, L, { x: fx * xDoMonte, y: yMonte + dy, s: CRANIO * 0.98, tom: 1.02, virada, tombo }, SEMENTE + 180 + i * 5)
  })

  // A TEIA no canto de cima, à direita, e o MUSGO no pé da soleira.
  const [tx, ty] = [x - 1, yPontas3 - 1]
  const teia = { tabua: 0, bisel: 0, contorno: 0, alfa: 0.42 }
  for (const [ax, ay] of [[-9, 0.6], [-7.6, -4.4], [-3.4, -7.4], [0.4, -8]] as const) L.push(P(cadeia([[tx, ty], [tx + ax, ty + ay]], 0.16), TEIA, { ...teia, semente: SEMENTE + 200 }))
  for (const k of [0.45, 0.78]) L.push(P(cadeia([[tx - 9 * k, ty + 0.6 * k], [tx - 7.2 * k, ty - 4 * k], [tx - 3.2 * k, ty - 6.6 * k], [tx + 0.4 * k, ty - 8 * k]], 0.14), TEIA, { ...teia, alfa: 0.34, semente: SEMENTE + 201 }))
  L.push(P(elipse(-x + 9, yPe - 0.8, 8, 1.6), MUSGO_DA_CRIPTA, { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.5, suave: 0.9, semente: SEMENTE + 202 }))
  L.push(P(elipse(x * 0.4, ySoleira + 0.6, 5, 1.2), MUSGO_DA_CRIPTA, { tabua: 0, bisel: 0.3, contorno: 0.1, alfa: 0.42, suave: 0.8, semente: SEMENTE + 203 }))
}
