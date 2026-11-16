/**
 * ALÇAPÃO (lote L2 das referências, 16/11/2026: versão original do que o mapa de referência pedia, só a ideia do
 * objeto). A tampa de tábuas RENTE AO CHÃO, num batente de quatro réguas mais escuras, com a fresta escura em volta
 * (o buraco que se adivinha por baixo); duas dobradiças de cinta de ferro com os pregos e a ponta de lança, presas
 * no batente de trás pelo nó; na frente, a argola de puxar deitada na chapa, ao lado da cava para os dedos.
 *
 * Objeto de chão, como o bueiro: o token anda em cima. Ele marca o pino de viagem de MÃO ÚNICA (`soChegada`,
 * `types/map.ts:945`): o desenho não sabe do pino, só fica em cima dele. Na 3/4 a tampa fica rente; só sobem um
 * nada os nós das dobradiças e a chapa da argola (o relevo que a vista inclinada mostra).
 *
 * A 25% de zoom sobram o quadrado escuro do batente, as tábuas claras e as duas cintas: "tampa no chão". Materiais:
 * `madeira` (tampa e batente) e `ferragens` (cintas, pregos, argola).
 */
import { hash } from '../../ruido'
import { anel, caixa, capsula, elipse, poligono, type Ponto } from './formas'
import { contato } from './motor'
import { BURACO, QUARTO, type MontarMovel } from './contexto'

/** O batente em volta da tampa, a fresta escura entre os dois e a folga da beira da pegada (px do protótipo). */
const BATENTE = 3.8
const FRESTA = 1.15
const FOLGA = 0.6
/** A largura de partida de uma tábua (px): a tampa esticada ganha tábuas, não tábua larga. */
const TABUA = 9.4
const JUNTA = 0.55
/** As cintas: o comprimento (fração da tampa), a largura e o lugar (fração da meia largura, a partir do meio). */
const CINTA = { comprimento: 0.6, largura: 3.6, lugar: 0.5 } as const
/** O nó da dobradiça, em cima do batente de trás: meia largura e meia altura (px). */
const NO = { meiaLargura: 2.6, meiaAltura: 1.5 } as const
/** A argola de puxar: o raio de fora e a grossura (px); a chapa e a cava dos dedos. */
const ARGOLA = { raio: 4.6, grossura: 1.15 } as const
/** O que sobe na 3/4 (px): o nó das dobradiças e a chapa da argola. */
const RELEVO = 1.3

export const montarAlcapao: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const madeira = c.m.madeira
  const ferro = c.m.ferragens
  const L = cena.partes

  const [x0, y0, x1, y1] = [-hw + FOLGA, -hh + FOLGA, hw - FOLGA, hh - FOLGA]
  const [bx0, by0, bx1, by1] = [x0 + BATENTE, y0 + BATENTE, x1 - BATENTE, y1 - BATENTE]
  cena.sombras.push(contato(caixa(x0, y0, x1, y1, 1), 0.2))

  // O BATENTE: quatro réguas em meia-esquadria, cada uma com o veio ao comprido, mais escuras que a tampa.
  const reguas: readonly (readonly [readonly Ponto[], number])[] = [
    [[[x0, y0], [x1, y0], [bx1, by0], [bx0, by0]], 0],
    [[[x0, y1], [bx0, by1], [bx1, by1], [x1, y1]], 0],
    [[[x0, y0], [bx0, by0], [bx0, by1], [x0, y1]], QUARTO],
    [[[x1, y0], [x1, y1], [bx1, by1], [bx1, by0]], QUARTO],
  ]
  reguas.forEach(([pontos, eixo], i) => L.push(P(poligono(pontos), madeira, { eixo, tabua: 0, bisel: 0.9, tom: 0.62, contorno: 0.28, semente: 4010 + i })))

  // A FRESTA: o escuro de baixo, entre o batente e a tampa.
  L.push(P(caixa(bx0, by0, bx1, by1, 0.5), BURACO, { tabua: 0, bisel: 0, contorno: 0.12, tom: 0.62, semente: 4015 }))

  // A TAMPA: tábuas de pé, cada uma com o tom dela (uma mais clara, de reparo), e o gasto do meio.
  const [tx0, ty0, tx1, ty1] = [bx0 + FRESTA, by0 + FRESTA, bx1 - FRESTA, by1 - FRESTA]
  const largura = tx1 - tx0
  const n = Math.max(3, Math.round(largura / TABUA))
  const passo = largura / n
  for (let i = 0; i < n; i += 1) {
    const a = tx0 + i * passo + (i === 0 ? 0 : JUNTA / 2)
    const b = tx0 + (i + 1) * passo - (i === n - 1 ? 0 : JUNTA / 2)
    const tom = 0.84 + 0.14 * hash(i, 7, 4020) + (i === n - 2 ? 0.1 : 0)
    // A ponta de cada tábua um nada desigual: tábua velha de alçapão não fecha certinha.
    const da = (hash(i, 1, 4021) - 0.5) * 0.7
    L.push(P(poligono([[a, ty0 + Math.max(0, da)], [b, ty0 + Math.max(0, -da)], [b, ty1 - Math.max(0, -da)], [a, ty1 - Math.max(0, da)]]), madeira, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom, contorno: 0.26, semente: 4022 + i }))
  }
  // Um nó escuro numa tábua.
  L.push(P(elipse(tx0 + passo * 0.55, ty0 + (ty1 - ty0) * 0.7, 1.1, 1.6), madeira, { tabua: 0, bisel: 0.3, tom: 0.55, contorno: 0.1, semente: 4030 }))

  // As DOBRADIÇAS de cinta: o nó em cima do batente de trás (sobe um nada na 3/4), a cinta com a ponta de lança e
  // três pregos de cabeça redonda.
  const comprimento = (ty1 - ty0) * CINTA.comprimento
  const meia = CINTA.largura / 2
  for (const lado of [-1, 1]) {
    const x = lado * (largura / 2) * CINTA.lugar
    const no = caixa(x - NO.meiaLargura, by0 - NO.meiaAltura - 0.6, x + NO.meiaLargura, by0 + NO.meiaAltura - 0.6, 0.8)
    cena.sombras.push({ forma: no, z: RELEVO, forca: 0.2 })
    L.push(P(no, ferro, { eixo: 0, tabua: 0, bisel: NO.meiaAltura * 0.9, tom: 0.95, contorno: 0.28, semente: 4040 + lado }))
    const yPonta = ty0 + comprimento
    const cinta = poligono([[x - meia, ty0 - 0.4], [x + meia, ty0 - 0.4], [x + meia, yPonta - 3], [x + meia * 1.5, yPonta - 2.4], [x, yPonta + 1.4], [x - meia * 1.5, yPonta - 2.4], [x - meia, yPonta - 3]])
    L.push(P(cinta, ferro, { eixo: QUARTO, tabua: 0, bisel: 0.7, tom: 0.88, contorno: 0.3, semente: 4045 + lado, projeta: { dist: 0.8, forca: 0.3 } }))
    for (let k = 0; k < 3; k += 1) {
      const y = ty0 + 3 + k * ((comprimento - 6) / 2)
      L.push(P(elipse(x, y, 0.8, 0.8), ferro, { tabua: 0, bisel: 0.7, tom: 1.18, contorno: 0.2, semente: 4050 + k }))
    }
  }

  // A ARGOLA na frente: a cava dos dedos (meia-lua funda na beira da tampa), a chapa pregada e a argola deitada.
  const xa = 0
  const yChapa = ty1 - ARGOLA.raio * 2 - 2.2
  L.push(P(elipse(xa, ty1 - 0.4, 4.4, 2.6), BURACO, { tabua: 0, bisel: 0, contorno: 0.12, tom: 0.75, recesso: { k: 1, forca: 0.3 }, semente: 4060 }))
  const chapa = caixa(xa - 2.6, yChapa - 1.8, xa + 2.6, yChapa + 1.8, 0.8)
  cena.sombras.push({ forma: chapa, z: RELEVO * 0.8, forca: 0.18 })
  L.push(P(chapa, ferro, { tabua: 0, bisel: 0.8, tom: 0.82, contorno: 0.28, semente: 4061 }))
  const yArgola = yChapa + ARGOLA.raio + 0.3
  L.push(P(anel(xa, yArgola, ARGOLA.raio, ARGOLA.raio, ARGOLA.raio - ARGOLA.grossura * 2, ARGOLA.raio - ARGOLA.grossura * 2), ferro, { tabua: 0, bisel: ARGOLA.grossura, tom: 1.02, contorno: 0.3, semente: 4062, projeta: { dist: 1, forca: 0.32 } }))
  L.push(P(capsula(xa, yChapa - 0.6, xa, yArgola - ARGOLA.raio + 0.8, 0.9), ferro, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom: 1.08, contorno: 0.24, semente: 4063 }))
}
