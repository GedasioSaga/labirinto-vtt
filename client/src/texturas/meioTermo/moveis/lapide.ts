/**
 * LÁPIDE de cima com volume (peça nova da MT4). A pedra em pé vista do alto
 * é o topo dela (a faixa de trás, com chanfro forte, que pega a luz de cima à
 * esquerda) e a face virada para baixo da tela, mais escura, com a inscrição
 * rebaixada; a sombra comprida da pedra alta cai para baixo e para a direita,
 * e um tufo de capim nasce no pé. Material: `pedra`.
 *
 * Três desenhos, escolhidos pelo hash do id do objeto (`variante`, de
 * `varianteDaLapide`): 0 = topo em arco, 1 = reta com uma quina partida,
 * 2 = cruz (o braço deitado, a cabeça do poste e a face estreita).
 */
import { capsula, caixa, elipse, poligono } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** Altura da pedra em casas (a sombra comprida). */
const ALTURA = 0.55
/** Onde o topo acaba e começa a face, em fração da altura da pegada. */
const FIM_DO_TOPO = 0.42
/** O capim do pé: o verde-oliva das folhas do protótipo da vila. */
const CAPIM: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.95)) }

export const montarLapide: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, peca: P } = c
  const pedra = c.m.pedra
  const yTopo = -hh + FIM_DO_TOPO * h
  const yPe = hh - 0.16 * h
  const L = cena.partes
  if (c.variante === 2) {
    // CRUZ: o braço deitado no alto, a cabeça do poste no meio dele e a face estreita do poste.
    const braco = caixa(-hw + 0.5, -hh + 0.06 * h, hw - 0.5, yTopo - 0.04 * h, 1.2)
    const poste = caixa(-0.17 * w, -hh + 0.02 * h, 0.17 * w, yPe, 1)
    cena.sombras.push({ forma: braco, z: c.g * ALTURA * 0.8 }, { forma: poste, z: c.g * ALTURA }, contato(caixa(-0.2 * w, yPe - 2, 0.2 * w, yPe + 1.5, 1), 0.3))
    L.push(P(caixa(-0.17 * w, yTopo - 1, 0.17 * w, yPe, 1), pedra, { tabua: 0, bisel: 1, tom: 0.74, semente: 81 }))
    L.push(P(braco, pedra, { tabua: 0, bisel: 1.8, tom: 1.02, semente: 82 }))
    L.push(P(caixa(-hw + 1.2, yTopo - 0.04 * h, hw - 1.2, yTopo + 0.08 * h, 0.8), pedra, { tabua: 0, bisel: 0.6, tom: 0.72, semente: 83 }))
    L.push(P(elipse(0, (-hh + yTopo) / 2, 0.15 * w, 0.2 * h), pedra, { tabua: 0, bisel: 2.2, tom: 1.06, semente: 84 }))
  } else {
    const topo =
      c.variante === 1
        ? poligono([[-hw + 0.6, -hh + 0.5], [hw - 0.22 * w, -hh + 0.5], [hw - 0.6, -hh + 0.3 * h], [hw - 0.6, yTopo], [-hw + 0.6, yTopo]])
        : capsula(-hw + 0.5 + 0.2 * h, (-hh + yTopo) / 2, hw - 0.5 - 0.2 * h, (-hh + yTopo) / 2, (yTopo + hh) / 2 - 0.3)
    const face = caixa(-hw + 1, yTopo - 1.2, hw - 1, yPe, 1.2)
    cena.sombras.push({ forma: caixa(-hw + 0.5, -hh + 0.5, hw - 0.5, yTopo, 1.5), z: c.g * ALTURA }, contato(caixa(-hw + 1, yPe - 2, hw - 1, yPe + 1.5, 1), 0.3))
    L.push(P(face, pedra, { tabua: 0, bisel: 1, tom: 0.76, semente: 85 }))
    // A cruz gravada na face, rebaixada (a borda de cima faz sombra dentro): diz "lápide" de longe.
    const meioDaFace = (yTopo + yPe) / 2
    const gravada = { tabua: 0, bisel: 0, tom: 0.58, recesso: { k: 1, forca: 0.25 }, contorno: 0, semente: 86 }
    L.push(P(caixa(-0.035 * w, yTopo + 0.05 * h, 0.035 * w, yPe - 0.06 * h, 0.3), pedra, gravada))
    L.push(P(caixa(-0.14 * w, meioDaFace - 0.09 * h, 0.14 * w, meioDaFace - 0.03 * h, 0.3), pedra, gravada))
    L.push(P(topo, pedra, { tabua: 0, bisel: c.variante === 1 ? 1.6 : 2.6, tom: 1.04, semente: 87 }))
  }
  // O musgo no pé da pedra: uma faixa baixa e rasa, mais estreita que a face.
  L.push(P(capsula(-0.3 * w, yPe + 0.03 * h, 0.3 * w, yPe + 0.03 * h, 0.07 * h), CAPIM, { bisel: 1, contorno: 0.2, tom: 0.92, semente: 88 }))
}
