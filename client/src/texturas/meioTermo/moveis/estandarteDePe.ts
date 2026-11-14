/**
 * ESTANDARTE DE PÉ (objetos de 14/11/2026, grupo Castelo: "bandeira com
 * brasão no mastro, cor trocável"). EM PÉ, desenhado DE FRENTE nas duas
 * vistas, como a lápide e o quadro de avisos: visto do alto, o pano pendurado
 * vira um risco e não diz nada. O pé fica embaixo na pegada (o chão) e a ponta
 * do mastro em cima; o giro deita a imagem, como na lápide.
 *
 * De cima para baixo: a PONTA de lança de metal no alto do mastro, a
 * TRAVESSA com as duas maçanetas, os CORDÕES de metal com a borla de cada
 * lado, o PANO em rabo de andorinha (as duas caudas e o corte em V), com o
 * galão de metal na beira e as dobras do pano caindo, o BRASÃO no meio (o
 * escudo de metal com a asna da cor do pano, mais escura) e o MASTRO de
 * madeira até o PÉ de cavalete (a sapata e as duas escoras). A sombra é a de
 * coisa alta e fina: um risco comprido do pé para baixo à direita.
 *
 * Materiais: `pano` (a cor trocável), `madeira` (o mastro e o pé) e `metal`
 * (a ponta, as maçanetas, os cordões, o galão e o escudo).
 */
import { caixa, capsula, dentroDe, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type MontarMovel } from './contexto'

/** A altura do estandarte, em casas (a sombra comprida). */
const ALTURA = 1.8

/** As medidas, em fração da largura (x) e da altura (y, de cima para baixo). */
const PONTA = 0.1
const Y_DA_TRAVESSA = 0.13
const MEIA_TRAVESSA = 0.47
const MEIO_PANO = 0.37
const Y_DAS_CAUDAS = 0.7
const Y_DO_CORTE = 0.6
const RAIO_DO_MASTRO = 0.045
const GROSSURA_DA_TRAVESSA = 0.028
const Y_DA_BORLA = 0.46
/** O pé de cavalete: a meia largura e o alto da sapata, e onde as escoras saem do mastro. */
const MEIA_SAPATA = 0.36
const ALTO_DA_SAPATA = 0.05
const Y_DAS_ESCORAS = 0.82
/** O galão de metal na beira do pano (px do protótipo). */
const GALAO = 1.5
/** O escudo do brasão: o meio (fração da altura) e a meia largura (fração da largura, e o teto dela em fração da altura). */
const Y_DO_ESCUDO = 0.37
const MEIO_ESCUDO = 0.2
const MEIO_ESCUDO_PELA_ALTURA = 0.09
/** As dobras do pano: o passo (px do protótipo) e a luz delas. */
const PASSO_DAS_DOBRAS = 8.5
const LUZ_DAS_DOBRAS = 0.1

/** O pano em rabo de andorinha, recuado `k` px das beiras dos lados e de baixo (o de dentro do galão). */
function contornoDoPano(w: number, yTopo: number, yCaudas: number, yCorte: number, k: number): Forma {
  const a = MEIO_PANO * w - k
  const pontos: Ponto[] = [[-a, yTopo], [a, yTopo], [a, yCaudas - k * 1.6], [0, yCorte - k * 1.4], [-a, yCaudas - k * 1.6]]
  return poligono(pontos)
}

/** O pano pendurado: o tecido do material com as dobras de pé, mais fundas embaixo, onde o pano cai livre. */
function texPano(yTopo: number, alto: number): Textura {
  const doPano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (doPano !== null) doPano(u, v, x, y, p, s, escala)
    const desce = Math.min(1, Math.max(0, (y - yTopo) / alto))
    s[3] += Math.sin((x / PASSO_DAS_DOBRAS) * 2 * Math.PI + desce * 1.4) * LUZ_DAS_DOBRAS * (0.5 + desce)
  }
}

/** A borla de metal pendurada no cordão, com a cabeça em (x, y). */
function borla(x: number, y: number, r: number): Forma {
  return uniao(elipse(x, y, r * 0.8, r * 0.7), poligono([[x - r * 0.6, y], [x + r * 0.6, y], [x + r, y + r * 2.6], [x - r, y + r * 2.6]]))
}

export const montarEstandarteDePe: MontarMovel = (c, cena) => {
  const { w, h, hh, g, peca: P } = c
  const pano: MaterialDaPeca = c.m.pano
  const mad = c.m.madeira
  const metal = c.m.metal
  const L = cena.partes
  const y = (f: number): number => -hh + f * h
  const yPe = hh
  const rm = Math.max(1.2, RAIO_DO_MASTRO * w)
  const yTravessa = y(Y_DA_TRAVESSA)
  const yTopoDoPano = yTravessa + GROSSURA_DA_TRAVESSA * h * 0.6
  const yCaudas = y(Y_DAS_CAUDAS)
  const yCorte = y(Y_DO_CORTE)

  // A sombra de coisa alta e fina: o pé do mastro arrastado até a altura, e o contato no meio da sapata. Estreito
  // de propósito: a sombra de baixo que a 3/4 em pé acrescenta (da largura da travessa) tem de crescer além dele.
  const meiaSapata = MEIA_SAPATA * w
  cena.sombras.push(
    { forma: caixa(-rm * 1.6, yPe - 1.4, rm * 1.6, yPe, 0.6), z: g * ALTURA, forca: 0.22 },
    contato(caixa(-meiaSapata * 0.45, yPe - 1.2, meiaSapata * 0.45, yPe + 0.4, 1), 0.2),
  )

  // O MASTRO, da sapata à ponta, e o PÉ de cavalete: a sapata e as duas escoras.
  L.push(P(caixa(-rm, y(PONTA) - 1, rm, yPe - 1, rm * 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: rm * 0.9, contorno: 0.26, semente: 110 }))
  const yEscoras = y(Y_DAS_ESCORAS)
  for (const [i, lado] of [-1, 1].entries()) {
    L.push(P(capsula(lado * rm * 0.6, yEscoras, lado * meiaSapata * 0.82, yPe - ALTO_DA_SAPATA * h * 0.7, rm * 0.7), mad, { eixo: Math.atan2(yPe - yEscoras, lado * meiaSapata), tabua: 0, bisel: rm * 0.6, tom: 0.88, contorno: 0.26, semente: 111 + i }))
  }
  L.push(P(caixa(-meiaSapata, yPe - ALTO_DA_SAPATA * h, meiaSapata, yPe, 1), mad, { tabua: 0, bisel: 1.1, tom: 0.92, contorno: 0.26, semente: 113 }))

  // A PONTA de lança de metal e o colar dela.
  const ponta = poligono([[0, -hh + 0.4], [rm * 1.9, y(PONTA) - rm * 2.2], [rm * 0.9, y(PONTA)], [-rm * 0.9, y(PONTA)], [-rm * 1.9, y(PONTA) - rm * 2.2]])
  L.push(P(ponta, metal, { bisel: rm * 0.8, contorno: 0.28, metal: 0.6, semente: 114 }))
  L.push(P(caixa(-rm * 1.4, y(PONTA) - 0.6, rm * 1.4, y(PONTA) + 1.4, 0.6), metal, { bisel: 0.7, contorno: 0.26, semente: 115 }))

  // Os CORDÕES com a borla, de cada ponta da travessa (por trás do pano).
  const meiaTravessa = MEIA_TRAVESSA * w
  const yBorla = y(Y_DA_BORLA)
  const rb = Math.max(1.3, 0.05 * w)
  for (const [i, lado] of [-1, 1].entries()) {
    const xc = lado * (meiaTravessa - rb * 0.7)
    L.push(P(capsula(xc, yTravessa, xc - lado * rb * 0.3, yBorla, 0.55), metal, { bisel: 0.4, contorno: 0.22, tom: 0.9, semente: 116 + i }))
    L.push(P(borla(xc - lado * rb * 0.3, yBorla, rb), metal, { bisel: rb * 0.5, contorno: 0.26, semente: 118 + i }))
  }

  // O PANO em rabo de andorinha, o galão de metal na beira e o brasão.
  const fora = contornoDoPano(w, yTopoDoPano, yCaudas, yCorte, 0)
  const dentro = contornoDoPano(w, yTopoDoPano, yCaudas, yCorte, GALAO)
  const texturaDoPano = texPano(yTopoDoPano, yCaudas - yTopoDoPano)
  L.push(P(fora, metal, { bisel: 0.6, contorno: 0.28, tom: 0.92, semente: 120 }))
  L.push(P(dentro, pano, { bisel: 0.9, contorno: 0.12, textura: texturaDoPano, semente: 121 }))
  const ye = y(Y_DO_ESCUDO)
  // O estandarte esticado na largura não ganha um escudo maior que o pano: a altura também manda.
  const me = Math.min(MEIO_ESCUDO * w, MEIO_ESCUDO_PELA_ALTURA * h)
  const alto = me * 2.3
  const escudo = (k: number): Forma =>
    poligono([[-me + k, ye - alto * 0.45 + k], [me - k, ye - alto * 0.45 + k], [me - k, ye + alto * 0.05], [me * 0.55 - k * 0.6, ye + alto * 0.36 - k * 0.4], [0, ye + alto * 0.55 - k * 1.3], [-me * 0.55 + k * 0.6, ye + alto * 0.36 - k * 0.4], [-me + k, ye + alto * 0.05]])
  L.push(P(escudo(0), metal, { bisel: 0.9, contorno: 0.3, metal: 0.5, semente: 122, projeta: { dist: 0.9, forca: 0.3 } }))
  // A asna: o V invertido da cor do pano, mais escuro, de beira a beira do escudo.
  const asna = dentroDe(
    poligono([[-me, ye + alto * 0.18], [0, ye - alto * 0.2], [me, ye + alto * 0.18], [me, ye + alto * 0.38], [0, ye + 0.01 * alto], [-me, ye + alto * 0.38]]),
    escudo(0.9),
  )
  L.push(P(asna, pano, { bisel: 0.5, tom: 0.72, contorno: 0.14, semente: 123 }))

  // A TRAVESSA por cima do pano (a bainha passa por ela) e as duas maçanetas.
  const gt = Math.max(1.2, GROSSURA_DA_TRAVESSA * h)
  L.push(P(capsula(-meiaTravessa, yTravessa, meiaTravessa, yTravessa, gt / 2), mad, { tabua: 0, bisel: gt * 0.4, tom: 1.04, contorno: 0.26, semente: 124, projeta: { dist: 0.9, forca: 0.32 } }))
  for (const [i, lado] of [-1, 1].entries()) {
    L.push(P(elipse(lado * meiaTravessa, yTravessa, gt * 0.95, gt * 0.95), metal, { bisel: gt * 0.6, contorno: 0.26, metal: 0.6, semente: 125 + i }))
  }
}
