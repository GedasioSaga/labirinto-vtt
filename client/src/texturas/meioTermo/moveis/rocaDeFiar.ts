/**
 * ROCA DE FIAR, EM PÉ, de lado (objetos de 14/11/2026, grupo Cidade e vila).
 * De cima a roca é uma tira: a roda vista do alto é o aro dela, e a mesa, a
 * caixa do fuso e a vara da roca viram três riscos de madeira que ninguém lê
 * como roca. Por isso ela é desenhada DE LADO nas duas vistas, como a lápide e
 * o quadro de avisos: a RODA de raios com o cubo e a manivela, a MESA inclinada
 * em três pernas, o PEDAL no chão com a biela que sobe até a manivela, a CAIXA
 * DO FUSO (a travessa em duas colunas, o fuso em U com o carretel de fio e a
 * roldana) e a VARA DA ROCA com o rolo de lã e a fita. A correia sai do aro e
 * abraça a roldana do fuso; o fio sai do rolo de lã para a boca do fuso.
 *
 * O que diz "roca" a 1x: a roda grande de raios ao lado do carretel e do rolo
 * de lã no alto da vara. A sombra cai para baixo e para a direita, mais fraca
 * que a de uma peça cheia: entre os raios passa luz.
 *
 * Girado, o desenho deita junto (é em pé, como a lápide). Materiais: `madeira`
 * (tudo de pau) e `fio` (o carretel e o rolo de lã, um tecido). O ferro do eixo
 * e da manivela, a correia e a fita são fixos.
 */
import { rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, barra, capsula, caixa, elipse, poligono, uniao, type Forma } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { QUARTO, materialDaPeca, type MontarMovel } from './contexto'

/** A roda: o raio (fração da altura), a grossura do aro (fração do raio) e o número de raios. */
const RAIO_DA_RODA = 0.27
const GROSSURA_DO_ARO = 0.13
const RAIOS = 10
/** Os ganchos em cada braço do fuso. */
const GANCHOS = 4
/**
 * O chão (fração da altura, de baixo) e a mesa (frações da altura): a folga
 * entre o pé da roda e a mesa, quanto a ponta do fuso fica mais alta que a da
 * roda e a grossura.
 */
const PE = 0.05
const FOLGA_DA_RODA = 0.03
const INCLINACAO_DA_MESA = 0.1
const GROSSURA_DA_MESA = 0.055
/** As alturas da sombra, em casas: a da mesa e a do alto da roda e da vara. */
const ALTURA_DA_MESA = 0.45
const ALTURA_DA_RODA = 0.85
/** Quanto a sombra é mais fraca que a de uma peça cheia (os raios e as pernas deixam passar luz). */
const FORCA_DA_SOMBRA = 0.18

/** O ferro do eixo e da manivela; a correia (corda clara e fina) e a fita vermelha da roca. */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.95)) }
const CORREIA: MaterialDaPeca = { classe: 'liso', rgb: [0xc9, 0xbc, 0x98] }
const FITA = materialDaPeca('vinho')

export const montarRocaDeFiar: MontarMovel = (c, cena) => {
  const { w, h, hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const fio = c.m.fio
  const la: MaterialDaPeca = { ...fio, fio: 'la' }
  const L = cena.partes
  const lado = Math.min(w, h)
  const yChao = hh - PE * h
  const R = RAIO_DA_RODA * lado
  const xRoda = hw - R - 0.03 * w
  const yRoda = -hh + 0.06 * h + R
  // A mesa inclinada: a ponta da roda (direita) mais baixa que a do fuso (esquerda).
  const xMesa0 = -0.47 * w
  const xMesa1 = hw - 0.02 * w
  const yMesa1 = yRoda + R + FOLGA_DA_RODA * h
  const yMesa0 = yMesa1 - INCLINACAO_DA_MESA * h
  const grossa = GROSSURA_DA_MESA * h
  const naMesa = (x: number): number => yMesa0 + ((x - xMesa0) / (xMesa1 - xMesa0)) * (yMesa1 - yMesa0)
  const perna = 0.032 * w

  // A sombra no chão: a da mesa e a da roda, fracas, e o contato dos pés e do pedal.
  cena.sombras.push(
    { forma: caixa(xMesa0, yChao - 1.5, xMesa1, yChao), z: g * ALTURA_DA_MESA, forca: FORCA_DA_SOMBRA },
    { forma: caixa(xRoda - R * 0.8, yChao - 1.2, xRoda + R * 0.8, yChao), z: g * ALTURA_DA_RODA, forca: FORCA_DA_SOMBRA * 0.8 },
  )
  for (const x of [-0.46 * w, 0.24 * w, 0.4 * w]) cena.sombras.push(contato(caixa(x - perna, yChao - 1, x + perna, yChao + 1, 0.8), 0.32))
  cena.sombras.push(contato(caixa(-0.14 * w, yChao - 1.2, 0.34 * w, yChao + 1, 1), 0.28))

  // As pernas de trás (mais escuras, a mesa faz sombra nelas).
  const pernaDe = (xTopo: number, xPe: number): Forma => barra(xTopo, naMesa(xTopo) + grossa * 0.5, xPe, yChao, perna * 2)
  L.push(P(pernaDe(0.3 * w, 0.24 * w), mad, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom: 0.66, semente: 10 }))

  // A coluna de trás da roda, atrás do aro.
  const coluna = 0.042 * w
  L.push(P(caixa(xRoda + 0.05 * w - coluna / 2, yRoda - 1, xRoda + 0.05 * w + coluna / 2, naMesa(xRoda) + 1, 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom: 0.7, semente: 11 }))

  // A RODA: o aro de pau, os raios e o cubo com a ponta do eixo.
  const aro = GROSSURA_DO_ARO * R
  for (let i = 0; i < RAIOS; i += 1) {
    const a = (i / RAIOS) * Math.PI * 2 + 0.16
    const x1 = xRoda + Math.cos(a) * (R - aro * 0.6)
    const y1 = yRoda + Math.sin(a) * (R - aro * 0.6)
    L.push(P(barra(xRoda, yRoda, x1, y1, 1.35), mad, { eixo: a, tabua: 0, bisel: 0.5, tom: 0.92, contorno: 0.26, semente: 20 + i }))
  }
  L.push(P(anel(xRoda, yRoda, R, R, R - aro, R - aro), mad, { tabua: 0, bisel: 1, tom: 1.04, contorno: 0.28, polar: { cx: xRoda, cy: yRoda, r: R }, semente: 31 }))
  // O sulco da correia no aro: uma linha escura no meio da grossura.
  L.push(P(anel(xRoda, yRoda, R - aro * 0.42, R - aro * 0.42, R - aro * 0.58, R - aro * 0.58), mad, { tabua: 0, bisel: 0, contorno: 0, tom: 0.55, semente: 32 }))
  L.push(P(elipse(xRoda, yRoda, R * 0.16, R * 0.16), mad, { tabua: 0, bisel: R * 0.08, tom: 1.08, contorno: 0.3, semente: 33 }))

  // A MESA inclinada.
  const mesa = poligono([[xMesa0, yMesa0], [xMesa1, yMesa1], [xMesa1, yMesa1 + grossa], [xMesa0, yMesa0 + grossa]])
  L.push(P(mesa, mad, { eixo: Math.atan2(yMesa1 - yMesa0, xMesa1 - xMesa0), tabua: 0, bisel: 1.2, tom: 0.98, contorno: 0.26, semente: 40 }))

  // A coluna da frente da roda, que segura o eixo, por cima da mesa e do aro.
  L.push(P(caixa(xRoda - 0.05 * w - coluna / 2, yRoda - 1.5, xRoda - 0.05 * w + coluna / 2, naMesa(xRoda) + grossa * 0.5, 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 1.02, semente: 41 }))

  // As pernas da frente: duas na ponta da roda, abertas, e uma na ponta do fuso.
  L.push(P(pernaDe(0.36 * w, 0.4 * w), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.92, semente: 42 }))
  L.push(P(pernaDe(-0.39 * w, -0.46 * w), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.92, semente: 43 }))

  // O PEDAL no chão e a BIELA que sobe dele até a manivela.
  const pedal = poligono([[0.34 * w, yChao - 0.8], [-0.14 * w, yChao - 3.8], [-0.14 * w, yChao - 1.4], [0.34 * w, yChao + 0.6]])
  L.push(P(pedal, mad, { tabua: 0, bisel: 0.9, tom: 0.86, contorno: 0.28, semente: 44 }))
  const xManivela = xRoda - R * 0.12
  const yManivela = yRoda + R * 0.2
  L.push(P(capsula(0, yChao - 3, xManivela, yManivela, 0.75), mad, { tabua: 0, bisel: 0.4, tom: 1.06, contorno: 0.3, semente: 45 }))
  L.push(P(uniao(capsula(xRoda, yRoda, xManivela, yManivela, 0.9), elipse(xRoda, yRoda, 1.4, 1.4)), FERRO, { bisel: 0.5, contorno: 0.3, metal: 0.5, semente: 46 }))

  // A CAIXA DO FUSO: a travessa sobre a mesa, as duas colunas, o fuso em U, o carretel de fio e a roldana.
  const yFuso = yMesa0 - 0.21 * h
  const xFuso0 = -0.3 * w
  const xFuso1 = -0.08 * w
  const yTravessa = naMesa(-0.25 * w) - 0.06 * h
  L.push(P(caixa(xFuso0 - 0.03 * w, yTravessa - 0.035 * h, xFuso1 + 0.02 * w, yTravessa, 1), mad, { tabua: 0, bisel: 1, tom: 0.96, contorno: 0.26, semente: 50 }))
  for (const [i, x] of [xFuso0 - 0.005 * w, xFuso1 - 0.005 * w].entries()) {
    L.push(P(barra(x, naMesa(x), x, yTravessa - 0.035 * h, 1.6), mad, { eixo: QUARTO, tabua: 0, bisel: 0.6, tom: 0.86, semente: 51 + i }))
    L.push(P(caixa(x - 1.4, yFuso - 0.1 * h, x + 1.4, yTravessa - 0.03 * h, 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom: 1.04, contorno: 0.28, semente: 53 + i }))
  }
  const braco = 0.075 * h
  const fuso = uniao(uniao(capsula(xFuso0 + 0.03 * w, yFuso - braco, xFuso1 - 0.03 * w, yFuso - braco, 0.8), capsula(xFuso0 + 0.03 * w, yFuso + braco, xFuso1 - 0.03 * w, yFuso + braco, 0.8)), capsula(xFuso1 - 0.03 * w, yFuso - braco, xFuso1 - 0.03 * w, yFuso + braco, 0.8))
  L.push(P(capsula(xFuso0 - 0.06 * w, yFuso, xFuso1 + 0.01 * w, yFuso, 0.7), FERRO, { bisel: 0.3, contorno: 0.3, metal: 0.5, semente: 55 }))
  // O carretel: comprido e baixo, o fio enrolado de través entre as duas abas.
  const xCarretel0 = xFuso0 + 0.035 * w
  const xCarretel1 = xFuso1 - 0.045 * w
  const meioCarretel = braco * 0.48
  L.push(P(caixa(xCarretel0, yFuso - meioCarretel, xCarretel1, yFuso + meioCarretel, 1.4), fio, { eixo: QUARTO, tabua: 0, bisel: 1.2, tom: 0.96, contorno: 0.26, curvaY: { c: yFuso, r: meioCarretel, forca: 0.5 }, semente: 56 }))
  for (const [i, x] of [xCarretel0, xCarretel1].entries()) {
    L.push(P(caixa(x - 0.8, yFuso - braco * 0.74, x + 0.8, yFuso + braco * 0.74, 0.6), mad, { tabua: 0, bisel: 0.4, tom: 0.78, contorno: 0.3, semente: 57 + i }))
  }
  L.push(P(fuso, mad, { tabua: 0, bisel: 0.5, tom: 1.14, contorno: 0.3, semente: 59 }))
  // Os ganchos de ferro nos dois braços do fuso, por onde o fio passa para o carretel.
  for (let i = 0; i < GANCHOS; i += 1) {
    const x = xCarretel0 + ((i + 0.5) / GANCHOS) * (xCarretel1 - xCarretel0)
    for (const [j, s] of [-1, 1].entries()) {
      L.push(P(elipse(x, yFuso + s * braco, 0.55, 0.55), FERRO, { bisel: 0.3, contorno: 0.32, metal: 0.6, semente: 63 + i * 2 + j }))
    }
  }
  const xRoldana = xFuso1 + 0.005 * w
  const rRoldana = 0.045 * h
  L.push(P(caixa(xRoldana - 1.2, yFuso - rRoldana, xRoldana + 1.2, yFuso + rRoldana, 0.8), mad, { tabua: 0, bisel: 0.6, tom: 0.9, contorno: 0.3, semente: 60 }))

  // A CORREIA: do alto e do pé do aro até a roldana do fuso.
  L.push(P(capsula(xRoldana, yFuso - rRoldana, xRoda - R * 0.2, yRoda - R + aro * 0.5, 0.42), CORREIA, { bisel: 0, contorno: 0.32, semente: 61 }))
  L.push(P(capsula(xRoldana, yFuso + rRoldana, xRoda - R * 0.3, yRoda + R - aro * 0.5, 0.42), CORREIA, { bisel: 0, contorno: 0.32, semente: 62 }))

  // A VARA DA ROCA na ponta da mesa, com o rolo de lã, a fita e o fio que desce até a boca do fuso.
  const xVara = -0.42 * w
  const yTopoVara = -hh + 0.03 * h
  L.push(P(capsula(xVara + 0.01 * w, yMesa0 + grossa * 0.4, xVara, yTopoVara, 0.95), mad, { eixo: QUARTO, tabua: 0, bisel: 0.5, tom: 1.0, contorno: 0.28, semente: 70 }))
  const yLa = -hh + 0.2 * h
  const meiaLa = 0.065 * w
  const rolo = poligono([[xVara, yTopoVara + 0.02 * h], [xVara + meiaLa * 0.8, yLa - 0.11 * h], [xVara + meiaLa, yLa], [xVara + meiaLa * 0.7, yLa + 0.13 * h], [xVara, yLa + 0.17 * h], [xVara - meiaLa * 0.7, yLa + 0.13 * h], [xVara - meiaLa, yLa], [xVara - meiaLa * 0.8, yLa - 0.11 * h]])
  L.push(P(rolo, la, { tabua: 0, bisel: 2.2, contorno: 0.24, tom: 1.04, semente: 71 }))
  L.push(P(caixa(xVara - meiaLa * 0.95, yLa - 0.02 * h, xVara + meiaLa * 0.95, yLa + 0.01 * h, 0.5), FITA, { tabua: 0, bisel: 0.4, contorno: 0.28, semente: 72 }))
  L.push(P(capsula(xVara + meiaLa * 0.4, yLa + 0.12 * h, xFuso0 - 0.06 * w, yFuso, 0.3), fio, { tabua: 0, bisel: 0, contorno: 0.3, tom: 1.1, semente: 73 }))
}
