/**
 * LÁPIDE TORTA (lote L2 das referências, 16/11/2026, das parciais: versão original, só a ideia). A irmã velha da
 * lápide (`lapide.ts`), EM PÉ e de frente como ela: a pedra de topo em arco, ADERNADA para um lado e meio afundada,
 * com o monte de terra levantado do lado para onde ela tombou, a trinca que atravessa a face, o musgo no alto, as
 * três linhas gastas do nome e o nicho em arco gravado em cima delas (sem cruz: a lápide de sempre já tem a dela).
 *
 * Desenho fixo: ela tomba sempre para a esquerda no desenho; o giro do objeto gira a imagem inteira, como a lápide
 * (perfil da 3/4 `em-pe`). A pedra sobe acima da pegada como a lápide (o clique e o tamanho salvo não mudam).
 * Material: `pedra`; a terra e o capim são fixos.
 */
import { rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

/** Altura da pedra em casas (a sombra comprida) e quanto ela sobe acima da pegada (casas). */
const ALTURA = 0.5
const SUBIDA = 0.16
/** O pé da pedra (onde ela entra na terra), em fração da altura da pegada a partir de baixo. */
const PE = 0.22
/** A faixa do topo (fração da altura da pegada), a meia largura da pedra (fração da largura) e o tombo (radianos). */
const TOPO = 0.13
const MEIA = 0.27
const TOMBO = -0.27
/** O capim e a terra revolvida do monte. */
const CAPIM: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.92)) }
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x55, 0x40] }
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.64)) }

/** O ponto (x, y) girado `a` radianos em volta de (ox, oy). */
function girado([x, y]: Ponto, ox: number, oy: number, a: number): Ponto {
  const [dx, dy] = [x - ox, y - oy]
  return [ox + dx * Math.cos(a) - dy * Math.sin(a), oy + dx * Math.sin(a) + dy * Math.cos(a)]
}

/** O contorno da pedra em arco, de `y0` (o alto) a `y1` (o pé), meia largura `m`, girado em volta do pé. */
function pedraEmArco(m: number, y0: number, y1: number, ox: number, oy: number, a: number): Forma {
  const pontos: Ponto[] = [[-m, y1]]
  const passos = 10
  for (let k = 0; k <= passos; k += 1) {
    const t = Math.PI - (k / passos) * Math.PI
    pontos.push([Math.cos(t) * m, y0 + m - Math.sin(t) * m])
  }
  pontos.push([m, y1])
  return poligono(pontos.map((p) => girado(p, ox, oy, a)))
}

/** Um tufo de capim de `largura` x `alto` px com o pé em (x, y), folhas em zigue-zague de alturas desiguais. */
function tufo(x: number, y: number, largura: number, alto: number, inclina: number): Forma {
  const m = largura / 2
  return poligono([
    [x - m, y + 0.8], [x - m * 0.8 + inclina, y - alto * 0.65], [x - m * 0.3, y - alto * 0.18], [x + inclina * 0.6, y - alto],
    [x + m * 0.35, y - alto * 0.22], [x + m * 0.9 + inclina, y - alto * 0.6], [x + m, y + 0.8],
  ])
}

export const montarLapideTorta: MontarMovel = (c, cena) => {
  const { w, h, hh, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  const m = MEIA * w
  const yPe = hh - PE * h
  const yAlto = -hh - SUBIDA * c.g
  const topo = TOPO * h
  // O pé da pedra fica um pouco à direita: ela tomba para a esquerda e o alto volta para o meio da pegada.
  const ox = 0.1 * w
  const face = pedraEmArco(m, yAlto + topo, yPe + 2, ox, yPe, TOMBO)
  const atras = pedraEmArco(m, yAlto, yPe + 2 - topo, ox, yPe - topo * 0.3, TOMBO)

  // A sombra da pedra alta e torta (cai para baixo à direita) e o contato do monte.
  cena.sombras.push({ forma: caixa(ox - m, yPe - 1.5, ox + m, yPe, 0.6), z: c.g * ALTURA, forca: 0.28 }, contato(elipse(ox - 1, yPe + 1, m * 1.5, 3.4), 0.3))

  // O MONTE de terra revolvida, do lado para onde ela tombou, e o pé enterrado.
  L.push(P(elipse(ox - m * 0.55, yPe + 1.6, m * 1.25, 3.6), TERRA, { tabua: 0, bisel: 1.6, tom: 0.92, contorno: 0.22, semente: 5401 }))
  L.push(P(elipse(ox - m * 1.15, yPe + 2.2, m * 0.5, 2.2), TERRA, { tabua: 0, bisel: 1.1, tom: 1.06, contorno: 0.18, semente: 5402 }))

  // A PEDRA: o topo claro atrás e a face, mais escura, por cima.
  L.push(P(atras, pedra, { tabua: 0, bisel: 1, tom: 1.06, semente: 5410 }))
  L.push(P(face, pedra, { tabua: 0, bisel: 1.1, tom: 0.78, semente: 5411 }))

  // O nicho em arco e as três linhas gastas do nome, gravados (giram com a pedra).
  const gravado = { tabua: 0, bisel: 0, contorno: 0, tom: 0.56, recesso: { k: 1, forca: 0.28 }, semente: 5420 }
  const yNicho = yAlto + topo + m + 1.4
  const nicho: Ponto[] = []
  for (let k = 0; k <= 8; k += 1) {
    const t = Math.PI - (k / 8) * Math.PI
    nicho.push(girado([Math.cos(t) * m * 0.55, yNicho - Math.sin(t) * m * 0.55], ox, yPe, TOMBO))
  }
  L.push(P(cadeia(nicho, 0.5), pedra, gravado))
  ;[0.62, 0.8, 0.5].forEach((f, k) => {
    const y = yNicho + 3.4 + k * 2.6
    L.push(P(cadeia([girado([-m * f, y], ox, yPe, TOMBO), girado([m * f, y], ox, yPe, TOMBO)], 0.45), pedra, { ...gravado, semente: 5421 + k }))
  })

  // A TRINCA que atravessa a face, do ombro direito até perto do pé.
  const trinca: Ponto[] = [[m * 0.95, yAlto + topo + m * 0.9], [m * 0.5, yAlto + topo + m * 1.4], [m * 0.6, yNicho + 6], [m * 0.1, yPe - 2.5]]
  L.push(P(cadeia(trinca.map((p) => girado(p, ox, yPe, TOMBO)), 0.36), pedra, { tabua: 0, bisel: 0, tom: 0.42, contorno: 0, semente: 5430 }))

  // O MUSGO no alto do arco e no pé.
  const musgo = { tabua: 0, bisel: 0.3, contorno: 0.06, alfa: 0.5, suave: 1, semente: 5440 }
  L.push(P(elipse(...girado([-m * 0.42, yAlto + topo * 0.9], ox, yPe, TOMBO), m * 0.3, 1.2), MUSGO, musgo))
  L.push(P(elipse(...girado([-m * 0.1, yAlto + topo * 0.4], ox, yPe, TOMBO), m * 0.16, 0.9), MUSGO, { ...musgo, alfa: 0.4, semente: 5442 }))
  L.push(P(elipse(...girado([m * 0.6, yPe - 1], ox, yPe, TOMBO), m * 0.3, 1.1), MUSGO, { ...musgo, semente: 5441 }))

  // O CAPIM em volta: tufos dos dois lados e um na frente do monte.
  const capim = { bisel: 0.8, contorno: 0.2, semente: 5450 }
  L.push(P(tufo(ox - m * 1.55, yPe + 1.4, 4.2, 4.2, -0.6), CAPIM, { ...capim, tom: 0.92 }))
  L.push(P(tufo(ox + m * 1.05, yPe + 0.8, 3.8, 3.8, 0.5), CAPIM, { ...capim, tom: 1.02, semente: 5451 }))
  L.push(P(tufo(ox - m * 0.2, yPe + 3.6, 3.6, 3, 0.3), CAPIM, { ...capim, tom: 1.08, semente: 5452 }))
}
