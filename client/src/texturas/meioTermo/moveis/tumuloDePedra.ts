/**
 * TÚMULO DE PEDRA, o jazigo deitado (lote L2 das referências, 16/11/2026: versão original, só a ideia do objeto).
 * A arca de pedra sobre o BASAMENTO de lajes, com a TAMPA grossa que passa um pouco da arca: em cima da tampa, a
 * moldura chanfrada em volta do PAINEL alto, a GUIRLANDA esculpida na cabeceira (um anel de folhas, sem símbolo de
 * religião de verdade) e as três linhas gastas do epitáfio no meio; o musgo nos cantos, uma trinca e a quina partida
 * da tampa. A cabeceira é o lado de cima da pegada.
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura, pintada do norte para o sul; cada peça sobe com
 * a estrutura mais alta que contém o meio da caixa dela):
 * - o BASAMENTO vai em quatro estruturas baixas em volta da arca (a fileira de trás, os dois braços e a da frente),
 *   como o degrau do altar: inteiro, ele seria pintado depois da arca e cobriria a tampa;
 * - a ARCA é a coluna;
 * - a TAMPA é um tampo solto com a beirada da grossura dela (`ESPESSURA_DA_TAMPA_DO_TUMULO`, que o perfil da 3/4 usa).
 * Material: `pedra`; o musgo é fixo.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, cadeia, caixa, elipse, elipseGirada, poligono, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'

/** O basamento (casas de altura) e o que ele sobra em volta da arca, dos lados, atrás e na frente (px). */
const ALTURA_DO_BASAMENTO = 0.08
const SOBRA = { lados: 5, tras: 5, frente: 7 } as const
/** Altura do alto da tampa (casas) e a grossura dela (px do protótipo): a beirada na 3/4. */
const ALTURA = 0.7
export const ESPESSURA_DA_TAMPA_DO_TUMULO = 0.14 * G
/** Quanto a tampa passa da arca para os quatro lados e a largura da moldura chanfrada (px). */
const ABA = 1.7
const MOLDURA = 3.4
/** A quina partida da tampa (px) e o comprimento de uma laje do basamento (casas). */
const QUINA = 4.2
const LAJE = 0.5
const JUNTA = 0.8
/** O musgo: o verde-oliva da lápide, um pouco mais escuro, meio transparente. */
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/** O escuro da pedra (o do altar e do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

export const montarTumuloDePedra: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const zBase = g * ALTURA_DO_BASAMENTO
  const zTopo = g * ALTURA
  const zArca = zTopo - ESPESSURA_DA_TAMPA_DO_TUMULO

  // A arca e a tampa, de cima.
  const [ax0, ay0, ax1, ay1] = [-hw + SOBRA.lados, -hh + SOBRA.tras, hw - SOBRA.lados, hh - SOBRA.frente]
  const [tx0, ty0, tx1, ty1] = [ax0 - ABA, ay0 - ABA, ax1 + ABA, ay1 + ABA]

  // O BASAMENTO: a fileira de trás, os dois braços e a fileira da frente; cada trecho com as lajes dele.
  cena.sombras.push(contato(caixa(-hw, -hh, hw, hh, 1), 0.3))
  const trechos: readonly (readonly [number, number, number, number])[] = [
    [-hw + 0.5, -hh + 0.5, hw - 0.5, ty0],
    [-hw + 0.5, ty0, tx0, ty1],
    [tx1, ty0, hw - 0.5, ty1],
    [-hw + 0.5, ty1, hw - 0.5, hh - 0.5],
  ]
  trechos.forEach(([x0, y0, x1, y1], t) => {
    const trecho = caixa(x0, y0, x1, y1)
    cena.sombras.push({ forma: trecho, z: zBase })
    L.push(P(trecho, pedra, { tabua: 0, bisel: 0.6, tom: 0.56, contorno: 0.24, semente: 5300 + t }))
    const comprido = y1 - y0 > x1 - x0
    const lajes = Math.max(1, Math.round((comprido ? y1 - y0 : x1 - x0) / (LAJE * g)))
    for (let i = 0; i < lajes; i += 1) {
      const [a, b] = comprido ? [y0 + ((y1 - y0) * i) / lajes, y0 + ((y1 - y0) * (i + 1)) / lajes] : [x0 + ((x1 - x0) * i) / lajes, x0 + ((x1 - x0) * (i + 1)) / lajes]
      const laje = comprido ? caixa(x0 + JUNTA / 2, a + JUNTA / 2, x1 - JUNTA / 2, b - JUNTA / 2, 0.6) : caixa(a + JUNTA / 2, y0 + JUNTA / 2, b - JUNTA / 2, y1 - JUNTA / 2, 0.6)
      L.push(P(laje, pedra, { tabua: 0, bisel: 0.9, tom: 0.8 + 0.12 * hash(i, t, 5310), contorno: 0.22, semente: 5311 + t * 7 + i }))
    }
  })

  // A ARCA: a coluna (de cima a tampa a cobre).
  const arca = caixa(ax0, ay0, ax1, ay1, 0.8)
  cena.sombras.push({ forma: arca, z: zArca })
  L.push(P(arca, pedra, { tabua: 0, bisel: 1, tom: 0.86, contorno: 0.26, semente: 5330 }))

  // A TAMPA: a laje com a quina de trás à direita partida, a moldura chanfrada e o painel alto.
  const tampa = poligono([[tx0, ty0], [tx1 - QUINA, ty0], [tx1 - QUINA * 0.45, ty0 + QUINA * 0.3], [tx1, ty0 + QUINA], [tx1, ty1], [tx0, ty1]])
  cena.sombras.push({ forma: tampa, z: zTopo, solta: true, forca: 0.32 })
  L.push(P(tampa, pedra, { tabua: 0, bisel: 2.4, tom: 0.96, contorno: 0.3, semente: 5340 }))
  const [px0, py0, px1, py1] = [tx0 + MOLDURA, ty0 + MOLDURA + 0.6, tx1 - MOLDURA, ty1 - MOLDURA]
  L.push(P(caixa(px0, py0, px1, py1, 1), pedra, { tabua: 0, bisel: 1.6, tom: 1.06, contorno: 0.24, semente: 5341, projeta: { dist: 0.9, forca: 0.22 } }))

  // A GUIRLANDA na cabeceira: o anel de folhas (folhinhas deitadas em volta) e a fita embaixo.
  const gx = 0
  const gy = py0 + (px1 - px0) * 0.42
  const rG = (px1 - px0) * 0.3
  const esculpido = { tabua: 0, bisel: 0.5, contorno: 0.16, semente: 5350 }
  L.push(P(anel(gx, gy, rG, rG, rG * 0.62, rG * 0.62), pedra, { ...esculpido, tom: 0.9, recesso: { k: 0.8, forca: 0.22 } }))
  const folhas = 14
  for (let k = 0; k < folhas; k += 1) {
    const a = (k / folhas) * 2 * Math.PI
    const r = rG * 0.81
    L.push(P(elipseGirada(gx + Math.cos(a) * r, gy + Math.sin(a) * r, rG * 0.2, rG * 0.09, a + 0.7), pedra, { ...esculpido, tom: 1.1, semente: 5351 + k }))
  }
  L.push(P(poligono([[gx - 1.2, gy + rG * 0.9], [gx - rG * 0.55, gy + rG * 1.45], [gx - rG * 0.3, gy + rG * 1.5], [gx, gy + rG * 1.05], [gx + rG * 0.3, gy + rG * 1.5], [gx + rG * 0.55, gy + rG * 1.45], [gx + 1.2, gy + rG * 0.9]]), pedra, { ...esculpido, tom: 1.02 }))

  // O EPITÁFIO gasto: três linhas rebaixadas, de comprimentos diferentes, no meio do painel.
  const yTexto = (py0 + py1) / 2 + (py1 - py0) * 0.08
  const linhas = [0.62, 0.78, 0.46]
  linhas.forEach((f, k) => {
    const meia = ((px1 - px0) / 2) * f
    L.push(P(caixa(-meia, yTexto + k * 4.2 - 0.55, meia, yTexto + k * 4.2 + 0.55, 0.4), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.6, recesso: { k: 0.8, forca: 0.3 }, semente: 5370 + k }))
  })

  // A TRINCA do canto da frente e o MUSGO nas quinas da tampa e no pé do basamento.
  const trinca: Ponto[] = [[tx0 + 0.8, ty1 - 9], [tx0 + 4, ty1 - 7.4], [tx0 + 5.2, ty1 - 4.6], [tx0 + 8.6, ty1 - 3.2]]
  L.push(P(cadeia(trinca, 0.34), pedra, { tabua: 0, bisel: 0, tom: 0.45, contorno: 0, semente: 5380 }))
  const musgo = { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.55, suave: 0.9, semente: 5390 }
  L.push(P(elipseGirada(tx0 + 2.6, ty0 + 3.4, 3.6, 2.2, 0.6), MUSGO, musgo))
  L.push(P(elipseGirada(tx1 - 2.4, ty1 - 2.8, 4.2, 2, -0.4), MUSGO, { ...musgo, semente: 5391 }))
  L.push(P(elipse(-hw + 3, hh - 3.2, 2.6, 1.8), MUSGO, { ...musgo, alfa: 0.6, semente: 5392 }))
  L.push(P(elipse(hw - 2.2, -hh + 9, 1.6, 3), MUSGO, { ...musgo, alfa: 0.5, semente: 5393 }))
}
