/**
 * MACA COM LENÇOL de cima com volume (lote L1 de 16/11/2026, necrotério e laboratório; versão ORIGINAL, só a ideia
 * do objeto das referências): a maca de hospital antigo, de tubo de ferro pintado de cinza-esverdeado, com as alças
 * de empurrar em U nas duas pontas e as rodinhas de borracha nos cantos. Em cima, o LENÇOL branco cobre um corpo
 * deitado, num volume só: a cabeça à esquerda, os ombros largos, a cintura, as mãos no quadril, as pernas afinando
 * com o vão raso no meio e as pontas dos pés levantando o pano no fim; as dobras descem do peito para as beiras. Do pé direito pende, por fora do lençol, a ETIQUETA de
 * papel presa num barbante. Nada de sangue nem de corpo à mostra: o volume debaixo do pano é que conta.
 *
 * A 25% de zoom sobram o retângulo claro do lençol com o calombo da cabeça numa ponta e os dois tubos escuros das
 * alças: é o que diz "maca com alguém debaixo do lençol".
 *
 * NA 3/4 é derivada (`tresQuartos.ts`): o lençol é um tampo solto na altura da maca, e a beirada dele
 * (`ESPESSURA_DA_MACA`) é o pano que cai pelos lados; debaixo, as quatro PERNAS de tubo (colunas nos cantos, fora da
 * quina redonda do lençol para não subirem com ele) e as RODINHAS (colunas baixas, um nada para fora). Nada lê o
 * giro.
 *
 * Sem material escolhido: o lençol, a tinta, a borracha e o papel são fixos.
 */
import { cadeia, capsula, caixa, elipse, elipseGirada, poligono, uniao, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm } from './varalDeBandeirinhas'
import { BORRACHA, ESCURO, PAPEL, PISO_DO_NECROTERIO, TINTA_VERDE, BRILHO_DA_TINTA, texTinta } from './apoioDoNecroterio'

/** O lençol de hospital: branco frio de algodão, com a trama do linho. */
const LENCOL: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xdd, 0xdb, 0xd2] }
/** A sombra das dobras e do vão entre as pernas: o escuro do aço, bem transparente. */
const SOMBRA_DO_PANO: MaterialDaPeca = ESCURO

/** A altura da maca em casas e a beirada do lençol que cai pelos lados na 3/4 (px do protótipo). */
const ALTURA = 0.5
export const ESPESSURA_DA_MACA = 0.08 * G
/** O lençol: o recuo das pontas (onde ficam as alças) e dos lados, e a quina redonda (px). */
const PONTA_DO_LENCOL = 7
const LADO_DO_LENCOL = 1.2
const QUINA_DO_LENCOL = 4.2
/** O tubo: o raio, o recuo dos trilhos a partir da beira e o quanto a alça em U sai da ponta do lençol (px). */
const RAIO_DO_TUBO = 0.95
const RECUO_DO_TRILHO = 3.4
/** As pernas (o lado, colado no canto) e as rodinhas (o raio, para fora da perna), em px. */
const LADO_DA_PERNA = 2.2
const RAIO_DA_RODA = 1.5
const ALTURA_DA_RODA = 0.07

/**
 * O corpo debaixo do pano, em frações do comprimento do lençol a partir da cabeceira e da meia largura dele: a
 * cabeça, e o contorno do resto em pares [ao longo, meia largura], do pescoço às pontas dos pés (os ombros largos, a
 * cintura, as mãos no quadril, os joelhos e os tornozelos afinando). Um contorno só, sem peças de boneco.
 */
const CABECA = { x: 0.08, rx: 0.055, ry: 0.27 } as const
const CONTORNO_DO_CORPO: readonly (readonly [number, number])[] = [
  [0.12, 0.16], [0.16, 0.2], [0.19, 0.46], [0.23, 0.53], [0.31, 0.5], [0.4, 0.43], [0.47, 0.47], [0.53, 0.45],
  [0.7, 0.36], [0.84, 0.28], [0.9, 0.27], [0.925, 0.16], [0.93, 0],
]
/** O vão raso entre as pernas e as pontas dos pés. */
const PERNAS = { de: 0.56, ate: 0.88 } as const
const PES = { x: 0.9, rx: 0.035, ry: 0.13, y: 0.2 } as const
/** O chanfro do volume do corpo (px). */
const BISEL_DO_CORPO = 5

export const montarMacaComLencol: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  cena.corDoPiso = PISO_DO_NECROTERIO
  const z = g * ALTURA
  const [lx0, lx1] = [-hw + PONTA_DO_LENCOL, hw - PONTA_DO_LENCOL]
  const [ly0, ly1] = [-hh + LADO_DO_LENCOL, hh - LADO_DO_LENCOL]
  const lencol = caixa(lx0, ly0, lx1, ly1, QUINA_DO_LENCOL)

  // As sombras: a de baixo, o lençol solto na altura da maca, as quatro pernas e as rodinhas.
  cena.sombras.push(
    { forma: caixa(-hw + 1, -hh + 1, hw - 1, hh - 1, 3), z: 0, suave: 1.6, forca: 0.3 },
    { forma: lencol, z, solta: true, suave: 1.8, forca: 0.24 },
  )
  const L = cena.partes
  const tinta = { tabua: 0, metal: BRILHO_DA_TINTA, textura: texTinta }
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      // A perna fica no canto, fora da quina redonda do lençol (senão a 3/4 a subiria com ele).
      const px = sx * (lx1 + 0.4)
      const py = sy * (hh - RECUO_DO_TRILHO)
      const perna = caixa(px - LADO_DA_PERNA / 2, py - LADO_DA_PERNA / 2, px + LADO_DA_PERNA / 2, py + LADO_DA_PERNA / 2, 0.8)
      cena.sombras.push({ forma: perna, z: z - ESPESSURA_DA_MACA, suave: 0.8, forca: 0.26 }, contato(perna, 0.3))
      const roda = elipse(px + sx * 1.6, py + sy * 0.6, RAIO_DA_RODA, RAIO_DA_RODA * 0.8)
      cena.sombras.push({ forma: roda, z: g * ALTURA_DA_RODA, forca: 0.2 }, contato(roda, 0.34))
      L.push(P(roda, BORRACHA, { tabua: 0, bisel: 0.8, contorno: 0.28, semente: 7101 }))
      L.push(P(perna, TINTA_VERDE, { ...tinta, bisel: 0.7, tom: 0.9, contorno: 0.28, semente: 7102 }))
    }
  }

  // O tubo: os dois trilhos dos lados e as alças em U das pontas (ficam por fora do lençol).
  for (const sy of [-1, 1]) {
    const y = sy * (hh - RECUO_DO_TRILHO)
    L.push(P(capsula(lx0 - 1, y, lx1 + 1, y, RAIO_DO_TUBO), TINTA_VERDE, { ...tinta, bisel: RAIO_DO_TUBO * 0.9, contorno: 0.26, semente: 7103 }))
  }
  for (const sx of [-1, 1]) {
    const xp = sx * (lx1 + 0.4)
    const xa = sx * (hw - 1.4)
    const yb = hh - RECUO_DO_TRILHO
    const alca: Ponto[] = [[xp, -yb], [xa, -yb + 2.6], [xa, yb - 2.6], [xp, yb]]
    // A alça fica fora do lençol: o meio da caixa dela vai para dentro dele, para subir com a maca na 3/4.
    const naMaca = sx * (lx1 - 1)
    L.push(P(comMeioEm(cadeia(alca, RAIO_DO_TUBO * 1.1), naMaca, 0), TINTA_VERDE, { ...tinta, bisel: RAIO_DO_TUBO, tom: 1.05, contorno: 0.28, semente: 7104, projeta: { dist: 0.7, forca: 0.24 } }))
    // A empunhadura de borracha no meio da alça.
    L.push(P(comMeioEm(capsula(xa, -yb * 0.45, xa, yb * 0.45, RAIO_DO_TUBO * 1.25), naMaca, 0), BORRACHA, { tabua: 0, bisel: 0.8, tom: 1.2, contorno: 0.28, semente: 7105 }))
  }
  // O estrado: a lona escura entre os trilhos, que aparece nas pontas do lençol.
  L.push(P(caixa(lx0 - 1.6, -hh + RECUO_DO_TRILHO, lx1 + 1.6, hh - RECUO_DO_TRILHO, 1), BORRACHA, { tabua: 0, bisel: 0.6, tom: 1.3, contorno: 0.2, semente: 7106 }))

  // O lençol liso e, debaixo dele, o corpo: UM volume só (a cabeça, o pescoço, o peito e as pernas unidos), de
  // chanfro largo e beira macia, para o pano parecer cair do corpo até o estrado. Volumes separados, cada um com o
  // seu contorno, liam como um boneco de neve.
  const pano = { tabua: 0, ruga: 0.3, contorno: 0 }
  L.push(P(lencol, LENCOL, { ...pano, bisel: 1.6, contorno: 0.22, semente: 7110, projeta: { dist: 0.8, forca: 0.22 } }))
  const comprimento = lx1 - lx0
  const meia = (ly1 - ly0) / 2
  const xDe = (f: number): number => lx0 + comprimento * f
  const cabeca = elipse(xDe(CABECA.x), 0, comprimento * CABECA.rx, meia * CABECA.ry)
  const deUmLado: Ponto[] = CONTORNO_DO_CORPO.map(([t, l]) => [xDe(t), -meia * l])
  const doOutro: Ponto[] = CONTORNO_DO_CORPO.map(([t, l]): Ponto => [xDe(t), meia * l]).reverse()
  const corpo = uniao(cabeca, poligono([...deUmLado, ...doOutro]))
  // A sombra macia que o volume deixa no pano, para baixo à direita, e o volume.
  L.push(P(corpo, SOMBRA_DO_PANO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.13, suave: 2.6, dx: 1.3, dy: 1.5, semente: 7111 }))
  L.push(P(corpo, LENCOL, { ...pano, bisel: BISEL_DO_CORPO, tom: 1.03, suave: 1.5, semente: 7112 }))
  // A cabeça um nada mais redonda que o resto, o vão raso entre as pernas e as duas pontas dos pés.
  L.push(P(cabeca, LENCOL, { ...pano, bisel: comprimento * CABECA.rx * 0.8, tom: 1.04, suave: 1.2, semente: 7113 }))
  L.push(P(capsula(xDe(PERNAS.de + 0.08), 0, xDe(PERNAS.ate), 0, 0.8), SOMBRA_DO_PANO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.08, suave: 1.4, semente: 7114 }))
  for (const sy of [-1, 1]) {
    L.push(P(elipse(xDe(PES.x), sy * meia * PES.y, comprimento * PES.rx, meia * PES.ry), LENCOL, { ...pano, bisel: 2.2, tom: 1.05, suave: 1, semente: 7115 + sy, projeta: { dist: 0.9, forca: 0.14, suave: 1.4 } }))
  }

  // As dobras: largas e macias, do ombro e do quadril até a beira do lençol, cada uma com a sombra de um lado.
  const dobras: readonly [number, number, number, number][] = [
    [0.22, -0.52, 0.14, -0.95], [0.32, 0.5, 0.4, 0.95], [0.55, -0.36, 0.62, -0.95], [0.74, 0.34, 0.8, 0.95],
  ]
  dobras.forEach(([fa, ya, fb, yb], i) => {
    const [ax, ay, bx, by] = [xDe(fa), meia * ya, xDe(fb), meia * yb]
    L.push(P(capsula(ax + 1, ay + 0.8, bx + 1, by + 0.8, 1.2), SOMBRA_DO_PANO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.07, suave: 1.4, semente: 7120 + i }))
    L.push(P(capsula(ax, ay, bx, by, 1), LENCOL, { ...pano, bisel: 0.9, tom: 1.05, alfa: 0.45, suave: 1.2, semente: 7130 + i }))
  })

  // A etiqueta do pé: o barbante do pé direito até a ponta do lençol e o cartão de papel caído por cima do tubo.
  const [ex, ey] = [xDe(PES.x), meia * PES.y]
  const fimDoBarbante: Ponto = [lx1 + 2.2, ey + 3]
  // Tudo isto passa da ponta do lençol: o meio da caixa fica dentro dele, para subir com a maca na 3/4.
  const [mx, my] = [lx1 - 1, ey]
  L.push(P(comMeioEm(cadeia([[ex + 1, ey + 0.6], [lx1 - 0.6, ey + 1.6], fimDoBarbante], 0.28), mx, my), PAPEL, { tabua: 0, bisel: 0, tom: 0.82, contorno: 0.2, semente: 7140 }))
  const etiqueta = elipseGirada(fimDoBarbante[0] + 1.6, fimDoBarbante[1] + 1.1, 2.3, 1.5, 0.5)
  L.push(P(comMeioEm(etiqueta, mx, my), PAPEL, { tabua: 0, bisel: 0.5, contorno: 0.3, semente: 7141, projeta: { dist: 0.6, forca: 0.26 } }))
  L.push(P(comMeioEm(elipse(fimDoBarbante[0] + 0.5, fimDoBarbante[1] + 0.4, 0.4, 0.4), mx, my), ESCURO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.6, semente: 7142 }))
}
