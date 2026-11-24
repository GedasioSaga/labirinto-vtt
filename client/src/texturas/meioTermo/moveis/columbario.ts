/**
 * COLUMBÁRIO (lote L05 de 24/11/2026, item 49: construção, das alas da cripta do mapa 8; desenho próprio, só a ideia
 * do objeto). Um trecho de PAREDE de pedra com quatro LÓCULOS selados numa peça só, dois em cima e dois embaixo,
 * separados pela pilastra do meio, com o FRONTÃO em arco abatido no alto. Barra a passagem e tapa a visão (regra de
 * fábrica da construção).
 *
 * DESENHADO DE FRENTE nas duas vistas (perfil `EM_PE`), como o nicho funerário: de cima, a parede de lóculos é só o
 * alto de um muro. O alto do muro (e do frontão) pega a luz numa faixa; embaixo dele a CORNIJA faz sombra na face; no
 * pé, o RODAPÉ; as juntas das pedras aparecem no frontão, na cornija, no rodapé e nas pontas. Cada lóculo é a junta
 * fina e escura, a LAJE com as quatro ROSETAS de bronze dos cantos e a plaquinha do nome gasto; dois têm o VASINHO de
 * bronze com as flores secas. Uma laje é trincada, uma tem a quina partida, uma tem musgo e uma perdeu o nome.
 *
 * Material: `pedra`; o bronze, a pátina, as flores secas e o musgo são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, dentroDe, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

/** A altura do muro em casas (a sombra comprida) e quanto ele sobe acima da pegada (o teto do plano é 0,2). */
const ALTURA = 1.2
const SUBIDA = 0.18
/** A faixa do alto que pega a luz, o frontão (meia largura e flecha), a cornija, o rodapé e o pé (px). */
const TOPO = 3.6
const MEIO_FRONTAO = 22
const FLECHA_DO_FRONTAO = 5.4
const CORNIJA = 3.2
const RODAPE = 5
const PE = 2
/** Os lóculos: a sobra dos lados, a pilastra do meio, o vão entre as fileiras, a folga até a cornija e o rodapé e a
 * junta em volta da laje (px). */
const LADO = 6.5
const PILASTRA = 3.2
const ENTRE_FILEIRAS = 4
const FOLGA = 3.4
const JUNTA = 1
/** O bronze das rosetas e dos vasinhos (o do sarcófago de bronze), a pátina verde contida e as flores secas. */
const BRONZE: MaterialDaPeca = { classe: 'metal', rgb: rgb('#8d6e47') }
const PATINA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#6b8a77') }
const FLOR_SECA: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x7b, 0x60] }
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/** O escuro da pedra (o do túmulo e do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

export const montarColumbario: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const x = hw - 2
  const yPe = hh - PE
  const yAlto = -hh - SUBIDA * g
  const yLados = yAlto + TOPO + FLECHA_DO_FRONTAO
  /** O contorno do muro com o frontão, descido `dy` px e com o pé em `pe`. */
  const contorno = (dy: number, pe: number): Forma => uniao(caixa(-x, yLados + dy, x, pe, 0.6), elipse(0, yLados + dy, MEIO_FRONTAO, FLECHA_DO_FRONTAO))
  const juntaDaPedra = { tabua: 0, bisel: 0, contorno: 0, tom: 0.6, alfa: 0.7 }
  const deFiada = (x0: number, y0: number, x1: number, y1: number, semente: number): void => {
    L.push(P(caixa(x0, y0, x1, y1, 0.2), pedra, { ...juntaDaPedra, semente }))
  }

  // A sombra do muro e o contato no pé.
  cena.sombras.push({ forma: caixa(-x, yPe - 1.6, x, yPe, 0.6), z: g * ALTURA, forca: 0.3 }, contato(caixa(-x - 1.5, yPe - 1.2, x + 1.5, yPe + 1.2, 1), 0.34))

  // O MURO: o alto que pega a luz (atrás) e a face, os dois com o frontão; as juntas do frontão e a rosácea dele.
  L.push(P(contorno(-TOPO, yPe - TOPO), pedra, { tabua: 0, bisel: 1, tom: 1.1, semente: 4900 }))
  L.push(P(contorno(0, yPe), pedra, { tabua: 0, bisel: 1.1, tom: 0.8, contorno: 0.3, semente: 4901 }))
  for (const lado of [-1, 1]) deFiada(lado * 9 - 0.3, yLados - 3.4, lado * 9 + 0.3, yLados, 4902)
  const yRosa = yLados - 2.4
  L.push(P(elipse(0, yRosa, 1.5, 1.5), pedra, { tabua: 0, bisel: 0.5, tom: 1.08, contorno: 0.2, semente: 4903 }))
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * 2 * Math.PI
    L.push(P(elipseGirada(Math.cos(a) * 2.3, yRosa + Math.sin(a) * 1.9, 1.1, 0.55, a), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.66, recesso: { k: 0.3, forca: 0.24 }, semente: 4904 + k }))
  }

  // A CORNIJA com a sombra dela e as juntas; o RODAPÉ com o alto claro e as juntas.
  L.push(P(caixa(-x - 1.4, yLados, x + 1.4, yLados + CORNIJA, 0.4), pedra, { tabua: 0, bisel: 0.8, tom: 0.96, contorno: 0.28, projeta: { dist: 1.1, forca: 0.3 }, semente: 4910 }))
  const yRodape = yPe - RODAPE
  L.push(P(caixa(-x - 1.4, yRodape - 0.9, x + 1.4, yRodape + 0.3, 0.3), pedra, { tabua: 0, bisel: 0.3, tom: 1.06, contorno: 0.22, semente: 4911 }))
  L.push(P(caixa(-x - 1.4, yRodape + 0.3, x + 1.4, yPe, 0.5), pedra, { tabua: 0, bisel: 0.8, tom: 0.72, contorno: 0.3, semente: 4912 }))
  for (const xj of [-31, 3, 29]) deFiada(xj - 0.3, yLados + 0.5, xj + 0.3, yLados + CORNIJA - 0.5, 4913)
  for (const xj of [-38, -12, 15, 41]) deFiada(xj - 0.3, yRodape + 0.8, xj + 0.3, yPe - 0.5, 4914)

  // Os LÓCULOS: duas colunas (com a pilastra no meio) e duas fileiras.
  const y0 = yLados + CORNIJA + FOLGA
  const y1 = yRodape - 0.9 - FOLGA
  const alta = (y1 - y0 - ENTRE_FILEIRAS) / 2
  const xg = x - LADO
  L.push(P(caixa(-PILASTRA, y0 - 1.4, PILASTRA, y1 + 1.4, 0.4), pedra, { tabua: 0, bisel: 0.9, tom: 0.9, contorno: 0.24, semente: 4915 }))
  const loculos: readonly (readonly [number, number, number, number])[] = [
    [-xg, y0, -PILASTRA - 2.2, y0 + alta],
    [PILASTRA + 2.2, y0, xg, y0 + alta],
    [-xg, y1 - alta, -PILASTRA - 2.2, y1],
    [PILASTRA + 2.2, y1 - alta, xg, y1],
  ]
  const gravada = { tabua: 0, bisel: 0, contorno: 0, tom: 0.62, recesso: { k: 0.5, forca: 0.3 } }
  loculos.forEach(([gx0, gy0, gx1, gy1], i) => {
    // A junta fina e escura e a laje, de tom um pouco diferente em cada lóculo; a do 1 tem a quina partida.
    L.push(P(caixa(gx0, gy0, gx1, gy1, 0.5), pedra, { tabua: 0, bisel: 0, tom: 0.48, contorno: 0.2, recesso: { k: 1, forca: 0.36 }, semente: 4920 + i }))
    const [lx0, ly0, lx1, ly1] = [gx0 + JUNTA, gy0 + JUNTA, gx1 - JUNTA, gy1 - JUNTA]
    const laje = i === 1
      ? poligono([[lx0, ly0], [lx1 - 4.6, ly0], [lx1 - 3, ly0 + 1.8], [lx1, ly0 + 3.8], [lx1, ly1], [lx0, ly1]])
      : caixa(lx0, ly0, lx1, ly1, 0.5)
    L.push(P(laje, pedra, { tabua: 0, bisel: 1.1, tom: 0.98 + 0.07 * hash(i, 3, 4924), contorno: 0.26, semente: 4925 + i }))

    // As quatro ROSETAS de bronze dos cantos, com a pátina escorrida embaixo de cada uma.
    const cantos: readonly Ponto[] = [[lx0 + 2.8, ly0 + 2.6], [lx1 - 2.8, ly0 + 2.6], [lx0 + 2.8, ly1 - 2.6], [lx1 - 2.8, ly1 - 2.6]]
    cantos.forEach(([rx, ry], k) => {
      if (i === 1 && k === 1) return
      L.push(P(elipse(rx + 0.3, ry + 1.1, 1.3, 1.8), PATINA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 0.9, semente: 4930 + k }))
      L.push(P(elipse(rx, ry, 1.2, 1.2), BRONZE, { tabua: 0, bisel: 0.7, tom: 1.08, contorno: 0.26, projeta: { dist: 0.5, forca: 0.24 }, semente: 4934 + k }))
    })

    // A PLAQUINHA do nome (a do 3 sem nome), um pouco à esquerda, e o VASINHO à direita no 0 e no 2.
    const gyc = (ly0 + ly1) / 2
    const gx = (lx0 + lx1) / 2 - 4
    L.push(P(caixa(gx - 9.6, gyc - 3.4, gx + 9.6, gyc + 3.4, 0.5), pedra, { tabua: 0, bisel: 0.7, tom: 1.1, contorno: 0.22, projeta: { dist: 0.6, forca: 0.22 }, semente: 4940 + i }))
    if (i !== 3) {
      const nome = 8 + 6 * hash(i, 4, 4944)
      L.push(P(caixa(gx - nome / 2, gyc - 1.7, gx + nome / 2, gyc - 0.6, 0.3), pedra, { ...gravada, semente: 4945 + i }))
      L.push(P(caixa(gx - 5.4, gyc + 0.8, gx + 1.4 + 3 * hash(i, 5, 4949), gyc + 1.6, 0.3), pedra, { ...gravada, alfa: 0.55, semente: 4950 + i }))
    }
    if (i === 0 || i === 2) {
      const vx = lx1 - 8.6
      L.push(P(elipse(vx + 0.6, gyc + 3.6, 3, 2.4), PATINA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 1.2, semente: 4954 + i }))
      L.push(P(caixa(vx - 2.6, gyc + 2.8, vx + 2.6, gyc + 3.8, 0.4), BRONZE, { tabua: 0, bisel: 0.4, tom: 0.9, contorno: 0.26, semente: 4958 }))
      // As flores secas: os talos e as cabecinhas, saindo da boca do vasinho (por trás dele).
      const talos: readonly Ponto[] = i === 0 ? [[-2.6, -8.6], [0.4, -9.6], [2.6, -7.8]] : [[-1.8, -9], [1.6, -8.4]]
      talos.forEach(([tx, ty], k) => {
        L.push(P(cadeia([[vx, gyc - 2], [vx + tx * 0.5, gyc + ty * 0.6], [vx + tx, gyc + ty]], 0.28), FLOR_SECA, { tabua: 0, bisel: 0, tom: 0.9, contorno: 0.2, semente: 4959 + k }))
        L.push(P(elipse(vx + tx, gyc + ty - 0.4, 0.9, 1.1), FLOR_SECA, { tabua: 0, bisel: 0.4, tom: 0.8 + 0.1 * k, contorno: 0.26, semente: 4962 + k }))
      })
      L.push(P(poligono([[vx - 2.2, gyc - 2.2], [vx + 2.2, gyc - 2.2], [vx + 1.4, gyc + 2.9], [vx - 1.4, gyc + 2.9]]), BRONZE, { tabua: 0, bisel: 0.8, tom: 1.04, contorno: 0.28, projeta: { dist: 0.6, forca: 0.26 }, semente: 4965 }))
      L.push(P(elipse(vx, gyc - 2.2, 2.5, 0.8), BRONZE, { tabua: 0, bisel: 0.3, tom: 1.14, contorno: 0.24, semente: 4966 }))
      L.push(P(elipse(vx, gyc - 2.2, 1.7, 0.42), BRONZE, { tabua: 0, bisel: 0, contorno: 0, tom: 0.42, semente: 4967 }))
    }

    // As marcas: a trinca (0) e o musgo (2).
    if (i === 0) {
      const trinca: Ponto[] = [[lx0 + 1, ly1 - 2.2], [lx0 + 5.6, ly1 - 5], [lx0 + 7.4, ly1 - 3.8], [lx0 + 11.4, ly1 - 7.6]]
      L.push(P(dentroDe(cadeia(trinca, 0.3), laje), pedra, { tabua: 0, bisel: 0, tom: 0.44, contorno: 0, semente: 4970 }))
    }
    if (i === 2) L.push(P(dentroDe(elipse(lx0 + 2.4, ly1 - 1.6, 5.4, 3), laje), MUSGO, { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.55, suave: 0.9, semente: 4971 }))
  })

  // As juntas das pedras das pontas do muro e o MUSGO no pé do rodapé.
  for (const lado of [-1, 1]) {
    for (const y of [y0 + alta * 0.45, y1 - alta * 0.35]) {
      const [a, b] = lado < 0 ? [-x + 0.6, -xg - 0.6] : [xg + 0.6, x - 0.6]
      deFiada(a, y - 0.3, b, y + 0.3, 4972)
    }
  }
  L.push(P(elipse(-x + 7, yPe - 0.8, 7.4, 1.6), MUSGO, { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.5, suave: 0.9, semente: 4973 }))
}
