/**
 * BALISTA de cima com volume (lote L03 dos objetos novos, 14/11/2026: o cerco
 * e a defesa). A besta gigante de torção, armada, apontando para a direita: o
 * PÉ em X (quatro pernas do eixo até os cantos, com as sapatas de ferro), em
 * cima dele o CORPO comprido com o canal escuro do virote e a cremalheira de
 * ferro dos dois lados, o SARILHO atrás (o rolo e as manivelas de cruz), na
 * frente a CAIXA DE TORÇÃO cintada de ferro, com as duas meadas de corda
 * vistas de topo nas arruelas, cada uma com a barra de apertar, e os dois
 * BRAÇOS de madeira saindo dela e curvando para trás, com a ponteira de
 * ferro. A CORDA vai das pontas dos braços até a GARRA, que segura o VIROTE
 * no canal: a haste clara, a ponta de ferro saindo pela frente e as penas de
 * madeira atrás.
 *
 * A 25% de zoom sobra o V da corda com os braços em arco, a barra do corpo e o
 * virote atravessando a caixa: é o que diz "balista" e não "catapulta" (que é
 * um quadro com uma concha). Material: `madeira` (o pé, o corpo, a caixa, os
 * braços e o sarilho); as ferragens, as cordas, o virote e as penas são fixos.
 * As medidas saem da pegada (2 x 2 casas de partida): o comprimento da
 * largura, o través da altura; o que é redondo sai do menor lado.
 */
import { rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, barra, caixa, capsula, elipse, poligono, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type ClasseDaPeca, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** As ferragens (cintas, sapatas, arruelas, garra): ferro batido, um pouco mais escuro que o da tabela. */
const FERRAGEM: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }
/** A ponta do virote: o ferro mais claro, afiado. */
const PONTA: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.08)) }
/** A corda dos braços: tendão trançado, clara, para o V se ver em cima da madeira e do chão. */
const CORDA_DO_ARCO: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xc9, 0xa6] }
/** As meadas de torção: cânhamo cru, mais escuro e mais quente que a corda clara da cerca (a do canhão). */
const TOM_DO_CANHAMO: Rgb = [0xc4, 0xac, 0x7e]
const TORCAO_DO_CANHAMO: Rgb = [0x8e, 0x76, 0x50]
const CANHAMO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DO_CANHAMO }
/** A haste do virote: freixo claro, quase cru. */
const HASTE: MaterialDaPeca = { classe: 'madeira', rgb: [0xc2, 0xa2, 0x76] }
/** As penas do virote, de madeira fina pintada de vermelho gasto: o sinal de "flecha" visto do alto. */
const PENA: MaterialDaPeca = { classe: 'madeira', rgb: [0x9a, 0x4a, 0x3c] }
/** O fundo do canal do virote: a madeira escura, sem cor. */
const FUNDO_DO_CANAL: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x30, 0x26] }

// ---------- a luz do cilindro ----------

/** De onde vem a luz (a do motor: de cima à esquerda, 52° acima do chão). */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
const FORCA_NA_MADEIRA = 0.9
const FORCA_NA_CORDA = 0.8

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** A luz de través de um CILINDRO deitado (o rolo, a haste): `onde` vai de -1 a 1 entre as beiras; 0 no lombo. */
function texDeCilindro(onde: (x: number, y: number) => number, paraALuz: number, forca: number, classe: ClasseDaPeca): Textura {
  const doMaterial = texturaDaClasse(classe)
  return (u, v, x, y, p, s, escala) => {
    const q = limitar(onde(x, y), -1, 1)
    s[3] += forca * (paraALuz * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1))
    if (doMaterial !== null) doMaterial(u, v, x, y, p, s, escala)
  }
}

/** Comprimento de uma volta de fio (px do protótipo): ~3 pixels no tamanho de mesa. */
const PASSO_DO_FIO = 3.2
/** Quantos fios da meada a volta inteira mostra de topo: com 7 a meada virava uma flor; com 12, um rolo torcido. */
const VOLTAS_DA_MEADA = 12

/**
 * A MEADA vista de topo, dentro da arruela: as voltas de corda giram em volta do meio (a torção), com a cor
 * escura nos vãos, e a luz de bola por cima (a meada estufa no meio).
 */
function texDaMeadaDeTopo(cx: number, cy: number, raio: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = x - cx
    const dy = y - cy
    const r = Math.hypot(dx, dy) / raio
    const a = Math.atan2(dy, dx)
    const volta = Math.sin(a * VOLTAS_DA_MEADA + r * 9)
    const t = limitar((volta - 0.1) / 0.9, 0, 1)
    s[0] += (TORCAO_DO_CANHAMO[0] - s[0]) * t
    s[1] += (TORCAO_DO_CANHAMO[1] - s[1]) * t
    s[2] += (TORCAO_DO_CANHAMO[2] - s[2]) * t
    const q = limitar(r, 0, 1)
    s[3] += FORCA_NA_CORDA * (((LUZ_X * dx + LUZ_Y * dy) / raio) * 0.6 + LUZ_Z * (Math.sqrt(1 - q * q) - 1)) + ruido(x * 0.7, y * 0.7) * 0.04 + 0.06
  }
}

/** As voltas da corda no rolo do sarilho: atravessam o rolo, com a luz de cilindro. */
function texDeCordaEnrolada(aoLongo: (x: number, y: number) => number, onde: (x: number, y: number) => number, paraALuz: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = limitar(onde(x, y), -1, 1)
    const volta = Math.sin(((aoLongo(x, y) + q * 1.6) / PASSO_DO_FIO) * Math.PI * 2)
    const t = limitar((volta - 0.1) / 0.9, 0, 1)
    s[0] += (TORCAO_DO_CANHAMO[0] - s[0]) * t
    s[1] += (TORCAO_DO_CANHAMO[1] - s[1]) * t
    s[2] += (TORCAO_DO_CANHAMO[2] - s[2]) * t
    s[3] += FORCA_NA_CORDA * (paraALuz * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1)) + ruido(x * 0.7, y * 0.7) * 0.04 + 0.06
  }
}

// ---------- a régua ----------

interface Regua {
  readonly X: (f: number) => number
  readonly Y: (f: number) => number
  readonly k: number
}

// ---------- o pé ----------

/** As quatro pernas do pé em X: do eixo até perto de cada canto, com a sapata de ferro na ponta. */
const PONTA_DA_PERNA = 0.455
const LARGURA_DA_PERNA = 0.062
const ALTURA_DA_PERNA = 0.16
/** O pião no meio do X, onde o corpo gira: só a beira dele aparece em volta do corpo. */
const RAIO_DO_PIAO = 0.1

function montarPe(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  const larg = k * LARGURA_DA_PERNA
  const pernas: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
  pernas.forEach(([sx, sy], i) => {
    const px = sx * X(PONTA_DA_PERNA)
    const py = sy * Y(PONTA_DA_PERNA)
    const perna = barra(0, 0, px, py, larg)
    cena.sombras.push({ forma: perna, z: c.g * ALTURA_DA_PERNA, forca: 0.3 }, contato(perna, 0.3))
    L.push(P(perna, mad, { eixo: Math.atan2(py, px), tabua: 0, bisel: 1, tom: 0.72, contorno: 0.3, semente: 5100 + i }))
    // A sapata: a ponta da perna calçada de ferro, com o cravo.
    const comp = Math.hypot(px, py)
    const ux = px / comp
    const uy = py / comp
    const recuo = k * 0.07
    L.push(P(barra(px - ux * recuo, py - uy * recuo, px, py, larg + 1), FERRAGEM, { eixo: Math.atan2(py, px), tabua: 0, bisel: 0.6, tom: 0.95, contorno: 0.24, metal: 0.3, semente: 5104 + i }))
    L.push(P(elipse(px - ux * recuo * 0.45, py - uy * recuo * 0.45, k * 0.013, k * 0.013), FERRAGEM, { bisel: 0.6, tom: 1.25, contorno: 0.1, metal: 0.4 }))
  })
  // O pião redondo no cruzamento das pernas.
  const piao = elipse(0, 0, k * RAIO_DO_PIAO, k * RAIO_DO_PIAO)
  cena.sombras.push({ forma: piao, z: c.g * 0.5, forca: 0.3 })
  L.push(P(piao, mad, { tabua: 0, bisel: 1.4, tom: 0.92, contorno: 0.3, polar: { cx: 0, cy: 0, r: k * RAIO_DO_PIAO }, semente: 5110 }))
  L.push(P(anel(0, 0, k * RAIO_DO_PIAO, k * RAIO_DO_PIAO, k * RAIO_DO_PIAO * 0.84, k * RAIO_DO_PIAO * 0.84), FERRAGEM, { tabua: 0, bisel: 0.5, tom: 1.0, contorno: 0.22, metal: 0.3, semente: 5111 }))
}

// ---------- o corpo e o sarilho ----------

/** O corpo: de onde a onde vai e a meia largura; o canal do virote no meio dele. */
const CORPO_DE = -0.46
const CORPO_ATE = 0.3
const MEIO_CORPO = 0.07
const MEIO_CANAL = 0.022
const ALTURA_DO_CORPO = 0.86
/** A cremalheira dos dois lados do corpo, entre a garra e o sarilho: os dentes de ferro. */
const CREMALHEIRA_DE = -0.36
const CREMALHEIRA_ATE = -0.08
const DENTES = 7
/** O sarilho: o rolo atravessado atrás, as voltas de corda e as manivelas de cruz. */
const SARILHO = -0.405
const RAIO_DO_ROLO = 0.032
const PONTA_DO_ROLO = 0.2
const MANIVELA_DE = -0.47
const MANIVELA_ATE = -0.34

function montarCorpo(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  const corpo = caixa(X(CORPO_DE), -Y(MEIO_CORPO), X(CORPO_ATE), Y(MEIO_CORPO), 1)
  cena.sombras.push({ forma: corpo, z: c.g * ALTURA_DO_CORPO, solta: true, forca: 0.32 })
  L.push(P(corpo, mad, { eixo: 0, tabua: 0, bisel: 1.2, tom: 0.94, contorno: 0.3, semente: 5120, projeta: { dist: 1, forca: 0.26 } }))
  // O canal do virote: o rasgo escuro ao comprido, aberto de ponta a ponta.
  L.push(P(caixa(X(CORPO_DE) + 1.5, -Y(MEIO_CANAL), X(CORPO_ATE), Y(MEIO_CANAL), 0.4), FUNDO_DO_CANAL, { bisel: 0.4, contorno: 0.1, recesso: { k: 1.2, forca: 0.3 }, semente: 5121 }))
  // A cremalheira: a tira de ferro dos dois lados do canal, com os dentes que a garra trava ao armar.
  for (const lado of [-1, 1]) {
    const y0 = lado * Y(MEIO_CANAL) + lado * 0.4
    const y1 = lado * Y(MEIO_CORPO) - lado * 1
    L.push(P(caixa(X(CREMALHEIRA_DE), Math.min(y0, y1), X(CREMALHEIRA_ATE), Math.max(y0, y1), 0.3), FERRAGEM, { tabua: 0, bisel: 0.5, tom: 0.92, contorno: 0.2, metal: 0.25, semente: 5123 + lado }))
    for (let i = 0; i < DENTES; i += 1) {
      const x = X(CREMALHEIRA_DE) + ((X(CREMALHEIRA_ATE) - X(CREMALHEIRA_DE)) * (i + 0.5)) / DENTES
      L.push(P(caixa(x - k * 0.006, Math.min(y0, y1), x + k * 0.006, Math.max(y0, y1), 0.2), FERRAGEM, { tabua: 0, bisel: 0.3, tom: 0.66, contorno: 0, metal: 0.1 }))
    }
  }
  // As cintas de ferro do corpo, na frente da cremalheira e no pé do sarilho.
  for (const [i, onde] of [-0.02, -0.44].entries()) {
    L.push(P(caixa(X(onde) - k * 0.016, -Y(MEIO_CORPO) - 0.6, X(onde) + k * 0.016, Y(MEIO_CORPO) + 0.6, 0.4), FERRAGEM, { tabua: 0, bisel: 0.5, tom: 1.02, contorno: 0.22, metal: 0.35, semente: 5126 + i }))
  }

  // O sarilho: o rolo de um lado ao outro do corpo, as voltas de corda e as manivelas.
  const x = X(SARILHO)
  const r = k * RAIO_DO_ROLO
  const rolo = caixa(x - r, -Y(PONTA_DO_ROLO), x + r, Y(PONTA_DO_ROLO), r * 0.8)
  cena.sombras.push({ forma: rolo, z: c.g * (ALTURA_DO_CORPO + 0.04), solta: true, forca: 0.28 })
  L.push(P(rolo, mad, { eixo: QUARTO, tabua: 0, bisel: 0.6, tom: 1.0, contorno: 0.3, textura: texDeCilindro((px) => (px - x) / r, LUZ_X, FORCA_NA_MADEIRA, 'madeira'), semente: 5130 }))
  const rv = r * 1.3
  L.push(P(caixa(x - rv, -Y(0.06), x + rv, Y(0.06), rv * 0.6), CANHAMO, { bisel: 0.6, contorno: 0.28, textura: texDeCordaEnrolada((_px, py) => py, (px) => (px - x) / rv, LUZ_X), semente: 5131, projeta: { dist: 0.7, forca: 0.26 } }))
  for (const lado of [-1, 1]) {
    const y = lado * (Y(PONTA_DO_ROLO) - k * 0.012)
    const barraDaCruz = capsula(X(MANIVELA_DE), y, X(MANIVELA_ATE), y, k * 0.017)
    cena.sombras.push({ forma: barraDaCruz, z: c.g * (ALTURA_DO_CORPO + 0.04), solta: true, forca: 0.26 })
    L.push(P(barraDaCruz, mad, { eixo: 0, tabua: 0, bisel: k * 0.013, tom: 1.06, contorno: 0.3, semente: 5133 + lado }))
    L.push(P(caixa(x - k * 0.022, y - k * 0.022, x + k * 0.022, y + k * 0.022, 0.6), mad, { tabua: 0, bisel: 0.6, tom: 1.18, contorno: 0.3, semente: 5136 + lado, projeta: { dist: 0.5, forca: 0.24 } }))
  }
}

// ---------- os braços e a caixa de torção ----------

/** A caixa de torção: de onde a onde vai e a meia largura; as meadas (o través do meio de cada uma e o raio). */
const CAIXA_DE = 0.155
const CAIXA_ATE = 0.3
const MEIA_CAIXA = 0.245
const MEADA_TRAVES = 0.14
const RAIO_DA_MEADA = 0.06
const ALTURA_DA_CAIXA = 1.02
/** Os braços: a raiz (no meio da meada), o ponto de curva e a ponta; a meia grossura na raiz e na ponta. */
const RAIZ_DO_BRACO: Ponto = [0.225, 0.14]
const CURVA_DO_BRACO: Ponto = [0.27, 0.36]
const PONTA_DO_BRACO: Ponto = [0.08, 0.465]
const MEIO_BRACO_NA_RAIZ = 0.042
const MEIO_BRACO_NA_PONTA = 0.02
const PEDACOS_DO_BRACO = 10
const ALTURA_DOS_BRACOS = 0.94
/** A garra que segura a corda armada, atrás do virote. */
const GARRA = -0.215

/** Ponto da curva de Bézier quadrática (a raiz, a curva e a ponta do braço) em `t`. */
function naCurva(a: Ponto, b: Ponto, d: Ponto, t: number): Ponto {
  const s = 1 - t
  return [s * s * a[0] + 2 * s * t * b[0] + t * t * d[0], s * s * a[1] + 2 * s * t * b[1] + t * t * d[1]]
}

/** O braço: a madeira afinando da raiz à ponta, ao longo da curva, como um polígono só. */
function formaDoBraco(a: Ponto, b: Ponto, d: Ponto, meioNaRaiz: number, meioNaPonta: number): Ponto[] {
  const esquerda: Ponto[] = []
  const direita: Ponto[] = []
  for (let i = 0; i <= PEDACOS_DO_BRACO; i += 1) {
    const t = i / PEDACOS_DO_BRACO
    const [x, y] = naCurva(a, b, d, t)
    const [x2, y2] = naCurva(a, b, d, Math.min(1, t + 0.02))
    const [x1, y1] = naCurva(a, b, d, Math.max(0, t - 0.02))
    const comp = Math.hypot(x2 - x1, y2 - y1) || 1
    const nx = -(y2 - y1) / comp
    const ny = (x2 - x1) / comp
    const meio = meioNaRaiz + (meioNaPonta - meioNaRaiz) * t
    esquerda.push([x + nx * meio, y + ny * meio])
    direita.push([x - nx * meio, y - ny * meio])
  }
  return [...esquerda, ...direita.reverse()]
}

function montarArco(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  const pontas: Ponto[] = []
  for (const lado of [-1, 1]) {
    const a: Ponto = [X(RAIZ_DO_BRACO[0]), lado * Y(RAIZ_DO_BRACO[1])]
    const b: Ponto = [X(CURVA_DO_BRACO[0]), lado * Y(CURVA_DO_BRACO[1])]
    const d: Ponto = [X(PONTA_DO_BRACO[0]), lado * Y(PONTA_DO_BRACO[1])]
    const braco = poligono(formaDoBraco(a, b, d, k * MEIO_BRACO_NA_RAIZ, k * MEIO_BRACO_NA_PONTA))
    cena.sombras.push({ forma: braco, z: c.g * ALTURA_DOS_BRACOS, solta: true, forca: 0.32 })
    const [mx, my] = naCurva(a, b, d, 0.5)
    L.push(P(braco, mad, { eixo: Math.atan2(d[1] - a[1], d[0] - a[0]), tabua: 0, bisel: 1.2, tom: 1.08, contorno: 0.32, semente: 5140 + lado, projeta: { dist: 1.2, forca: 0.3 } }))
    // A cinta do meio do braço e a ponteira de ferro com o entalhe da corda.
    L.push(P(elipse(mx, my, k * 0.03, k * 0.03), FERRAGEM, { bisel: 0.6, tom: 1.0, contorno: 0.22, metal: 0.3, semente: 5143 + lado }))
    const [qx, qy] = naCurva(a, b, d, 0.9)
    L.push(P(capsula(qx, qy, d[0], d[1], k * MEIO_BRACO_NA_PONTA * 1.25), FERRAGEM, { bisel: 0.7, tom: 1.06, contorno: 0.26, metal: 0.4, semente: 5146 + lado, projeta: { dist: 0.6, forca: 0.24 } }))
    pontas.push(d)
  }

  // A caixa de torção por cima das raízes dos braços: o quadro de madeira, as cintas e as duas meadas de topo.
  const quadro = caixa(X(CAIXA_DE), -Y(MEIA_CAIXA), X(CAIXA_ATE), Y(MEIA_CAIXA), 1)
  cena.sombras.push({ forma: quadro, z: c.g * ALTURA_DA_CAIXA, solta: true, forca: 0.34 })
  L.push(P(quadro, mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, tom: 0.88, contorno: 0.32, semente: 5150, projeta: { dist: 1.2, forca: 0.3 } }))
  // O vão do meio, por onde passa o virote: o canal continua por dentro da caixa.
  L.push(P(caixa(X(CAIXA_DE), -Y(MEIO_CANAL) - 0.6, X(CAIXA_ATE), Y(MEIO_CANAL) + 0.6, 0.4), FUNDO_DO_CANAL, { bisel: 0.4, contorno: 0.1, recesso: { k: 1.4, forca: 0.32 }, semente: 5151 }))
  // As cintas de ferro na frente e atrás da caixa, de ponta a ponta.
  for (const [i, onde] of [CAIXA_DE, CAIXA_ATE].entries()) {
    const x = X(onde) + (i === 0 ? 1.4 : -1.4)
    L.push(P(caixa(x - k * 0.014, -Y(MEIA_CAIXA) + 0.4, x + k * 0.014, Y(MEIA_CAIXA) - 0.4, 0.4), FERRAGEM, { tabua: 0, bisel: 0.5, tom: 0.98, contorno: 0.22, metal: 0.3, semente: 5152 + i }))
  }
  const xm = (X(CAIXA_DE) + X(CAIXA_ATE)) / 2
  for (const lado of [-1, 1]) {
    const ym = lado * Y(MEADA_TRAVES)
    const r = k * RAIO_DA_MEADA
    // A arruela larga de ferro, a meada estufando dentro dela e a barra que trava a torção, de través.
    L.push(P(elipse(xm, ym, r * 1.32, r * 1.32), FERRAGEM, { tabua: 0, bisel: 0.8, tom: 0.96, contorno: 0.28, metal: 0.3, semente: 5155 + lado, projeta: { dist: 0.8, forca: 0.28 } }))
    L.push(P(elipse(xm, ym, r, r), CANHAMO, { bisel: r * 0.4, tom: 0.86, contorno: 0.2, textura: texDaMeadaDeTopo(xm, ym, r), semente: 5158 + lado }))
    const trava = barra(xm - r * 1.45, ym - lado * r * 0.25, xm + r * 1.45, ym + lado * r * 0.25, k * 0.026)
    L.push(P(trava, FERRAGEM, { eixo: 0, tabua: 0, bisel: 0.6, tom: 1.1, contorno: 0.26, metal: 0.4, semente: 5161 + lado, projeta: { dist: 0.6, forca: 0.3 } }))
  }

  // A corda armada: de cada ponta até a garra, por cima do corpo.
  const xg = X(GARRA)
  for (const [i, [px, py]] of pontas.entries()) {
    const corda = capsula(px, py, xg + k * 0.03, Math.sign(py) * k * 0.012, k * 0.011)
    cena.sombras.push({ forma: corda, z: c.g * ALTURA_DOS_BRACOS, solta: true, forca: 0.24 })
    L.push(P(corda, CORDA_DO_ARCO, { eixo: Math.atan2(-py, xg - px), bisel: k * 0.008, contorno: 0.3, semente: 5164 + i }))
  }
}

// ---------- o virote e a garra ----------

/** O virote: do entalhe (na garra) à ponta, a meia grossura da haste e o comprimento da ponta de ferro. */
const VIROTE_DE = -0.2
const VIROTE_ATE = 0.49
const MEIA_HASTE = 0.017
const COMPRIMENTO_DA_PONTA = 0.11
const MEIA_PONTA = 0.04
/** As penas: de onde a onde vão ao longo da haste e quanto saem para os lados. */
const PENAS_DE = -0.185
const PENAS_ATE = -0.07
const ABERTURA_DAS_PENAS = 0.05

function montarVirote(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const L = cena.partes
  const meia = k * MEIA_HASTE
  const xPonta = X(VIROTE_ATE) - k * COMPRIMENTO_DA_PONTA
  const haste = caixa(X(VIROTE_DE), -meia, xPonta + 1, meia, meia)
  cena.sombras.push({ forma: haste, z: c.g * (ALTURA_DO_CORPO + 0.05), solta: true, forca: 0.3 })
  // As penas por baixo da haste: duas abertas para os lados (a de cima fica de pé e é a haste que a esconde).
  for (const lado of [-1, 1]) {
    const pena = poligono([
      [X(PENAS_DE), lado * meia * 0.6],
      [X(PENAS_DE) + k * 0.02, lado * Y(ABERTURA_DAS_PENAS)],
      [X(PENAS_ATE) - k * 0.02, lado * Y(ABERTURA_DAS_PENAS) * 0.92],
      [X(PENAS_ATE), lado * meia * 0.6],
    ])
    L.push(P(pena, PENA, { eixo: 0, tabua: 0, bisel: 0.6, tom: 1.0, contorno: 0.3, semente: 5170 + lado, projeta: { dist: 0.8, forca: 0.3 } }))
  }
  L.push(P(haste, HASTE, { eixo: 0, tabua: 0, bisel: 0.6, tom: 1.04, contorno: 0.3, textura: texDeCilindro((_px, py) => py / meia, LUZ_Y, FORCA_NA_MADEIRA, 'madeira'), semente: 5173, projeta: { dist: 1, forca: 0.3 } }))
  // A pena de pé, vista de topo: o filete por cima da haste, no lugar das outras duas.
  L.push(P(caixa(X(PENAS_DE) + 1, -meia * 0.32, X(PENAS_ATE) - 0.6, meia * 0.32, 0.3), PENA, { eixo: 0, tabua: 0, bisel: 0.3, tom: 1.18, contorno: 0.2, semente: 5174 }))
  // A ponta de ferro em folha, saindo pela frente da caixa: o losango comprido com a nervura no meio.
  const ponta = poligono([
    [xPonta - k * 0.012, -meia * 1.05],
    [xPonta + k * COMPRIMENTO_DA_PONTA * 0.38, -k * MEIA_PONTA],
    [X(VIROTE_ATE), 0],
    [xPonta + k * COMPRIMENTO_DA_PONTA * 0.38, k * MEIA_PONTA],
    [xPonta - k * 0.012, meia * 1.05],
  ])
  cena.sombras.push({ forma: ponta, z: c.g * (ALTURA_DO_CORPO + 0.05), solta: true, forca: 0.3 })
  L.push(P(ponta, PONTA, { eixo: 0, tabua: 0, bisel: 0.9, tom: 1.0, contorno: 0.32, metal: 0.55, semente: 5175, projeta: { dist: 0.8, forca: 0.3 } }))
  L.push(P(caixa(xPonta - k * 0.01, -0.35, X(VIROTE_ATE) - k * 0.02, 0.35, 0.3), PONTA, { tabua: 0, bisel: 0.3, tom: 1.3, contorno: 0, metal: 0.6, semente: 5176 }))

  // A garra: o bloco de ferro que corre no canal e prende a corda, com o gatilho atrás.
  const xg = X(GARRA)
  L.push(P(caixa(xg - k * 0.05, -Y(MEIO_CORPO) + 0.8, xg + k * 0.025, Y(MEIO_CORPO) - 0.8, 0.8), FERRAGEM, { tabua: 0, bisel: 0.8, tom: 0.92, contorno: 0.3, metal: 0.35, semente: 5177, projeta: { dist: 0.8, forca: 0.3 } }))
  for (const lado of [-1, 1]) L.push(P(elipse(xg + k * 0.018, lado * k * 0.016, k * 0.012, k * 0.012), FERRAGEM, { bisel: 0.6, tom: 1.25, contorno: 0.1, metal: 0.45 }))
  L.push(P(capsula(xg - k * 0.05, 0, xg - k * 0.1, Y(0.03), k * 0.01), FERRAGEM, { bisel: 0.6, tom: 1.1, contorno: 0.24, metal: 0.4, semente: 5178 }))
}

export const montarBalista: MontarMovel = (c, cena) => {
  const regua: Regua = { X: (f) => f * c.w, Y: (f) => f * c.h, k: Math.min(c.w, c.h) }
  montarPe(c, cena, regua)
  montarCorpo(c, cena, regua)
  montarArco(c, cena, regua)
  montarVirote(c, cena, regua)
}
