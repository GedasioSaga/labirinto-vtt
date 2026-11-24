/**
 * PILASTRA QUADRADA (lote L05 de 24/11/2026, item 47: a versão do pilar das paredes do grande salão da cripta do mapa
 * 8; desenho próprio, só a ideia do objeto). O BLOCO quadrado de pedra ENCOSTADO NA PAREDE: o lado de cima da pegada
 * é o da parede, liso e rente a ela. Em volta dos outros três lados, o PLINTO baixo em blocos; no alto, o CAPITEL de
 * laje simples, um pouco mais largo que o fuste, com o filete gravado em volta, a quina da frente à direita partida,
 * uma trinca e o musgo no canto úmido junto da parede. De cima, quem diz "pilastra" é o quadrado colado na parede,
 * o plinto em U e a sombra comprida.
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura, pintada do norte para o sul; cada peça sobe com a
 * estrutura mais alta que contém o meio da caixa dela):
 * - o FUSTE é a coluna (de cima o capitel o cobre; na 3/4 é a face lisa da frente);
 * - o CAPITEL é um tampo solto com a beirada `ESPESSURA_DO_CAPITEL_DA_PILASTRA` (o perfil da 3/4 usa);
 * - o PLINTO vai em três estruturas baixas (os dois braços e a fileira da frente), como o basamento do túmulo:
 *   inteiro, ele seria pintado depois do fuste e cobriria a pilastra. Cada bloco tem o meio fora do capitel.
 * Material: `pedra`; o musgo é fixo.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, elipse, menos, poligono, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'

/** Altura do alto do capitel e a do plinto, em casas, e a grossura do capitel (px do protótipo). */
const ALTURA = 1.85
const ALTURA_DO_PLINTO = 0.1
export const ESPESSURA_DO_CAPITEL_DA_PILASTRA = 0.13 * G
/** O que o plinto sobra do fuste (px) e quanto o capitel passa dele (px). */
const SOBRA_DO_PLINTO = 6.5
const ABA_DO_CAPITEL = 1.8
/** O filete gravado do capitel (px a partir da beira) e a quina partida (px). */
const FILETE = 3.4
const QUINA = 4.6
/** O musgo: o verde-oliva da lápide, um pouco mais escuro (o do túmulo de pedra). */
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/** O escuro da pedra (o do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

export const montarPilastraQuadrada: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const alto = g * ALTURA
  const zPlinto = g * ALTURA_DO_PLINTO
  const zFuste = alto - ESPESSURA_DO_CAPITEL_DA_PILASTRA

  // A parede é o lado de cima: o fuste e o capitel encostam nela; o fuste é quadrado pelo menor lado.
  const yParede = -hh + 0.5
  const lado = Math.min(2 * (hw - 0.5 - SOBRA_DO_PLINTO), 2 * hh - 1 - SOBRA_DO_PLINTO)
  const [fx0, fx1] = [-lado / 2, lado / 2]
  const fy1 = yParede + lado
  const [px0, px1, py1] = [fx0 - SOBRA_DO_PLINTO, fx1 + SOBRA_DO_PLINTO, fy1 + SOBRA_DO_PLINTO]
  const [cx0, cx1, cy1] = [fx0 - ABA_DO_CAPITEL, fx1 + ABA_DO_CAPITEL, fy1 + ABA_DO_CAPITEL]

  // As sombras: o contato do plinto, o plinto em três trechos, o fuste e o capitel solto no alto.
  cena.sombras.push(contato(caixa(px0, yParede, px1, py1, 0.8), 0.32))
  const trechos: readonly (readonly [number, number, number, number])[] = [
    [px0, yParede, fx0, fy1],
    [fx1, yParede, px1, fy1],
    [px0, fy1, px1, py1],
  ]
  for (const [x0, y0, x1, y1] of trechos) cena.sombras.push({ forma: caixa(x0, y0, x1, y1), z: zPlinto })
  const fuste = caixa(fx0, yParede, fx1, fy1, 0.6)
  cena.sombras.push({ forma: fuste, z: zFuste })
  const capitel = poligono([[cx0, yParede], [cx1, yParede], [cx1, cy1 - QUINA], [cx1 - QUINA * 0.36, cy1 - QUINA * 0.58], [cx1 - QUINA * 0.7, cy1 - QUINA * 0.44], [cx1 - QUINA, cy1], [cx0, cy1]])
  cena.sombras.push({ forma: capitel, z: alto, solta: true, forca: 0.26 })

  // O MUSGO no chão, no pé do plinto (fica embaixo de tudo).
  const musgo = { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.55, suave: 0.9 }
  L.push(P(elipse(px0 + 1.4, py1 + 1, 3.2, 1.8), MUSGO, { ...musgo, semente: 4790 }))

  // O PLINTO em blocos: dois em cada braço e três na frente, de tons um pouco diferentes; o meio de cada um fica
  // fora do capitel (sobe com o plinto na 3/4).
  const blocos: readonly (readonly [number, number, number, number])[] = [
    [px0, yParede, fx0, yParede + lado * 0.45],
    [px0, yParede + lado * 0.45, fx0, fy1],
    [fx1, yParede, px1, yParede + lado * 0.58],
    [fx1, yParede + lado * 0.58, px1, fy1],
    [px0, fy1, px0 + (px1 - px0) * 0.3, py1],
    [px0 + (px1 - px0) * 0.3, fy1, px0 + (px1 - px0) * 0.68, py1],
    [px0 + (px1 - px0) * 0.68, fy1, px1, py1],
  ]
  blocos.forEach(([x0, y0, x1, y1], k) => {
    L.push(P(caixa(x0 + 0.35, y0 + 0.35, x1 - 0.35, y1 - 0.35, 0.7), pedra, { tabua: 0, bisel: 1.3, tom: 0.8 + 0.1 * hash(k, 1, 4700), contorno: 0.26, semente: 4701 + k }))
  })

  // O FUSTE (de cima, coberto pelo capitel) e o CAPITEL: a laje, o filete gravado, a trinca e o musgo da parede.
  L.push(P(fuste, pedra, { tabua: 0, bisel: 1, tom: 0.9, contorno: 0.26, semente: 4710 }))
  L.push(P(capitel, pedra, { tabua: 0, bisel: 2.2, tom: 1.02, contorno: 0.3, semente: 4711 }))
  const fora = caixa(cx0 + FILETE, yParede + FILETE * 0.6, cx1 - FILETE, cy1 - FILETE, 0.5)
  const dentro = caixa(cx0 + FILETE + 1.2, yParede + FILETE * 0.6 + 1.2, cx1 - FILETE - 1.2, cy1 - FILETE - 1.2, 0.3)
  L.push(P(menos(fora, dentro), pedra, { tabua: 0, bisel: 0, tom: 0.66, contorno: 0, recesso: { k: 0.6, forca: 0.3 }, semente: 4712 }))
  const trinca: Ponto[] = [[cx0 + 0.6, cy1 - 12], [cx0 + 5, cy1 - 10.2], [cx0 + 8.4, cy1 - 11.6], [cx0 + 13.6, cy1 - 7.8]]
  L.push(P(cadeia(trinca, 0.32), pedra, { tabua: 0, bisel: 0, tom: 0.46, contorno: 0, semente: 4713 }))
  L.push(P(elipse(cx1 - 3.4, yParede + 3, 4.2, 2.6), MUSGO, { ...musgo, alfa: 0.5, semente: 4714 }))
  L.push(P(elipse(cx0 + 2.4, yParede + 1.8, 2.4, 1.5), MUSGO, { ...musgo, alfa: 0.4, semente: 4715 }))
}
