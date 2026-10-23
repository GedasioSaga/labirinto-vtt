/**
 * LÁPIDE (peça nova da MT4), EM PÉ, de frente como o quadro de avisos: a
 * pedra vista de cima à frente mostra o topo (uma faixa fina e clara que segue
 * o contorno de cima, pegando a luz de cima à esquerda) e a face virada para
 * baixo da tela, mais escura, com a cruz gravada; a sombra da pedra alta cai
 * para baixo e para a direita, e três tufos de capim nascem no pé.
 * Material: `pedra`.
 *
 * Três desenhos, escolhidos pelo hash do id do objeto (`variante`, de
 * `varianteDaLapide`), que diferem no CONTORNO da face: 0 = arco (alta, topo em
 * semicírculo, meia pegada de largura), 1 = reta (0,65 da largura, com uma
 * quina partida) e 2 = cruz latina de pedra (sem a cruz gravada).
 *
 * Revisão da MT4: deitada (topo de 42% da altura) ela lia como sarcófago, a
 * cruz como bigorna e o arco e a reta eram iguais a 1x. Agora a pedra sobe até
 * 0,2 casa acima da pegada (o tamanho salvo e o clique não mudam: a imagem já
 * passa da pegada pela sombra), o topo é uma faixa de ~2 px a 1x e o capim são
 * tufos irregulares, não uma pílula lisa.
 */
import { caixa, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** Altura da pedra em casas (a sombra comprida). */
const ALTURA = 0.55
/** Quanto a pedra sobe acima da pegada, em casas (o teto do plano é 0,2). */
const SUBIDA = 0.19
/** O pé da pedra (onde ela entra no chão), em fração da altura da pegada a partir de baixo. */
const PE = 0.15
/** A faixa do topo, em fração da altura da pegada (~2 px a 1x). */
const TOPO = 0.15
/** A quina partida da reta, em px do protótipo (3 px a 1x). */
const QUINA = 3.4
/** O traço da cruz gravada, em px do protótipo (2 px ou mais a 1x). */
const TRACO = 2.5
/** O capim do pé: o verde-oliva das folhas do protótipo da vila. */
const CAPIM: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.95)) }

/** O contorno da face (de `y0`, o alto da face, até `y1`, o pé) de cada desenho. */
function contornoDaFace(variante: number, w: number, y0: number, y1: number): Forma {
  if (variante === 2) {
    const alto = y1 - y0
    const braco = y0 + 0.3 * alto
    const meioBraco = 0.1 * alto
    return uniao(caixa(-0.09 * w, y0, 0.09 * w, y1, 0.6), caixa(-0.4 * w, braco - meioBraco, 0.4 * w, braco + meioBraco, 0.6))
  }
  if (variante === 1) {
    const b = 0.325 * w
    const pontos: Ponto[] = [[-b, y0], [b - QUINA, y0], [b, y0 + QUINA], [b, y1], [-b, y1]]
    return poligono(pontos)
  }
  const a = 0.25 * w
  return uniao(caixa(-a, y0 + a, a, y1, 0.6), elipse(0, y0 + a, a, a))
}

/** Um tufo de capim de `largura` x `alto` px com o pé em (x, y): folhas em zigue-zague, de alturas desiguais. */
function tufo(x: number, y: number, largura: number, alto: number, inclina: number): Forma {
  const m = largura / 2
  const pontos: Ponto[] = [
    [x - m, y + 0.8],
    [x - m * 0.85 + inclina, y - alto * 0.7],
    [x - m * 0.35, y - alto * 0.2],
    [x + inclina * 0.6, y - alto],
    [x + m * 0.3, y - alto * 0.25],
    [x + m * 0.9 + inclina, y - alto * 0.62],
    [x + m, y + 0.8],
  ]
  return poligono(pontos)
}

export const montarLapide: MontarMovel = (c, cena) => {
  const { w, h, hh, peca: P } = c
  const pedra = c.m.pedra
  const variante = c.variante
  const yPe = hh - PE * h
  const yAlto = -hh - SUBIDA * c.g
  const topo = TOPO * h
  const face = contornoDaFace(variante, w, yAlto + topo, yPe)
  // O topo: o mesmo contorno, um pouco mais alto, atrás da face: aparece só a faixa de cima.
  const atras = contornoDaFace(variante, w, yAlto, yPe - topo)
  const meia = variante === 1 ? 0.325 * w : variante === 2 ? 0.09 * w : 0.25 * w
  cena.sombras.push({ forma: caixa(-meia, yPe - 1.5, meia, yPe, 0.6), z: c.g * ALTURA, forca: 0.3 }, contato(caixa(-meia - 0.5, yPe - 1.2, meia + 0.5, yPe + 1.2, 1), 0.3))
  const L = cena.partes
  L.push(P(atras, pedra, { tabua: 0, bisel: 1, tom: 1.08, semente: 87 }))
  L.push(P(face, pedra, { tabua: 0, bisel: 1.1, tom: 0.8, semente: 85 }))
  if (variante !== 2) {
    // A cruz gravada na face, rebaixada (a borda de cima faz sombra dentro): diz "lápide" de longe.
    const y0 = yAlto + topo + (variante === 0 ? 0.25 * w : 0) + 3
    const y1 = yPe - 3.5
    const cruzY = y0 + 0.3 * (y1 - y0)
    const gravada = { tabua: 0, bisel: 0, tom: 0.56, recesso: { k: 1, forca: 0.28 }, contorno: 0, semente: 86 }
    L.push(P(caixa(-TRACO / 2, y0, TRACO / 2, y1, 0.3), pedra, gravada))
    L.push(P(caixa(-0.13 * w, cruzY - TRACO / 2, 0.13 * w, cruzY + TRACO / 2, 0.3), pedra, gravada))
  }
  // Três tufos de capim no pé, de tamanhos e alturas diferentes: dois nas quinas da pedra e um na frente.
  // No pé estreito da cruz os tufos se afastam mais, para não virarem uma moita só.
  const capim = { bisel: 0.8, contorno: 0.2, semente: 88 }
  const fora = variante === 2 ? 2.6 : 0.3
  L.push(P(tufo(-meia - fora, yPe + 0.6, 4.2, 4.4, -0.5), CAPIM, { ...capim, tom: 0.9 }))
  L.push(P(tufo(meia + fora + 0.3, yPe + 0.9, 3.6, 3.6, 0.6), CAPIM, { ...capim, tom: 1.0, semente: 89 }))
  L.push(P(tufo(variante === 2 ? 0 : -0.06 * w, yPe + 1.6, 4, 3.4, 0.3), CAPIM, { ...capim, tom: 1.06, semente: 90 }))
}
