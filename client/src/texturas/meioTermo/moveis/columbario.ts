/**
 * COLUMBÁRIO (lote L05 de 24/11/2026, item 49: construção, das alas da cripta do mapa 8; desenho próprio, só a ideia
 * do objeto). Um trecho de PAREDE de pedra com oito LÓCULOS selados, quatro em cima e quatro embaixo, quase
 * quadrados, em dois pares de cada lado da PILASTRA do meio, com o FRONTÃO reto em dois degraus no alto. Barra a
 * passagem e tapa a visão (regra de fábrica da construção).
 *
 * DESENHADO DE FRENTE nas duas vistas (perfil `EM_PE`), como o nicho funerário: de cima, a parede de lóculos é só o
 * alto de um muro. O alto do muro (e dos degraus do frontão) pega a luz numa faixa; embaixo dele a CORNIJA larga faz
 * sombra na face; no pé, o RODAPÉ; as juntas das pedras aparecem no frontão, na cornija, no rodapé e nas pontas. Cada
 * lóculo é a junta escura e a LAJE afundada (a sombra da beira de cima e da esquerda cai nela), presa por dois PINOS de
 * ferro fosco, com a plaquinha do nome gasto; dois têm a PRATELEIRA de pedra embaixo da placa, com o VASINHO de bronze
 * e as flores secas. Uma laje é trincada, uma tem a quina partida, uma tem musgo e uma perdeu o nome.
 *
 * Revisão do diretor de arte (24/11): os quatro lóculos largos com rosetas de bronze e o frontão em arco com a
 * rosácea repetiam o nicho funerário; agora a grade é de lóculos quase quadrados, sem bronze nas lajes, e o frontão é
 * reto, em degraus.
 *
 * Material: `pedra`; o ferro dos pinos, o bronze, a pátina, as flores secas e o musgo são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, dentroDe, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

/** A altura do muro em casas (a sombra comprida) e quanto ele sobe acima da pegada (o teto do plano é 0,2). */
const ALTURA = 1.2
const SUBIDA = 0.18
/** A faixa do alto que pega a luz, os degraus do frontão (meia largura e altura de cada um), a cornija, o rodapé e o
 * pé (px). */
const TOPO = 3.6
const DEGRAUS: readonly { readonly meio: number; readonly alto: number }[] = [
  { meio: 27, alto: 2.6 },
  { meio: 14.5, alto: 2.6 },
]
const CORNIJA = 4.7
const RODAPE = 5
const PE = 2
/** Os lóculos: a sobra dos lados, a meia pilastra do meio, a pedra entre os dois de um par, o vão até a pilastra, o
 * vão entre as fileiras, a folga até a cornija e o rodapé e a junta em volta da laje (px). */
const LADO = 6.5
const MEIA_PILASTRA = 3
const ENTRE_O_PAR = 2.4
const ATE_A_PILASTRA = 2.2
const ENTRE_FILEIRAS = 6
const FOLGA = 3.4
const JUNTA = 1
/** A sombra da beira de cima e da esquerda do lóculo, dentro da laje afundada. */
const RECESSO = { k: 2, forca: 0.46 } as const
/** O ferro fosco dos pinos, o bronze dos vasinhos (o do sarcófago de bronze), a pátina e as flores secas. */
const FERRO: MaterialDaPeca = { classe: 'liso', rgb: [0x6a, 0x6b, 0x6d] }
const BRONZE: MaterialDaPeca = { classe: 'metal', rgb: rgb('#8d6e47') }
const PATINA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#6b8a77') }
const FLOR_SECA: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x7b, 0x60] }
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/** O escuro da pedra (o do túmulo e do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]
/** As marcas: os lóculos (0 a 3 em cima, 4 a 7 embaixo, da esquerda para a direita) com cada uma. */
const COM_VASO: readonly number[] = [1, 6]
const TRINCADO = 0
const QUINA_PARTIDA = 3
const COM_MUSGO = 4
const SEM_NOME = 7

export const montarColumbario: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const x = hw - 2
  const yPe = hh - PE
  const yAlto = -hh - SUBIDA * g
  const yLados = yAlto + TOPO + DEGRAUS.reduce((s, d) => s + d.alto, 0)
  /** O contorno do muro com os degraus do frontão, descido `dy` px e com o pé em `pe`. */
  const contorno = (dy: number, pe: number): Forma => {
    let f = caixa(-x, yLados + dy, x, pe, 0.6)
    let y = yLados
    for (const { meio, alto } of DEGRAUS) {
      f = uniao(f, caixa(-meio, y - alto + dy, meio, y + 1 + dy, 0.4))
      y -= alto
    }
    return f
  }
  const juntaDaPedra = { tabua: 0, bisel: 0, contorno: 0, tom: 0.6, alfa: 0.7 }
  const deFiada = (x0: number, y0: number, x1: number, y1: number, semente: number): void => {
    L.push(P(caixa(x0, y0, x1, y1, 0.2), pedra, { ...juntaDaPedra, semente }))
  }

  // A sombra do muro e o contato no pé.
  cena.sombras.push({ forma: caixa(-x, yPe - 1.6, x, yPe, 0.6), z: g * ALTURA, forca: 0.3 }, contato(caixa(-x - 1.5, yPe - 1.2, x + 1.5, yPe + 1.2, 1), 0.34))

  // O MURO: o alto que pega a luz (atrás) e a face, os dois com os degraus do frontão; as juntas dos degraus.
  L.push(P(contorno(-TOPO, yPe - TOPO), pedra, { tabua: 0, bisel: 1, tom: 1.1, semente: 4900 }))
  L.push(P(contorno(0, yPe), pedra, { tabua: 0, bisel: 1.1, tom: 0.8, contorno: 0.3, semente: 4901 }))
  const [d1, d2] = DEGRAUS
  for (const lado of [-1, 1]) deFiada(lado * 20.5 - 0.3, yLados - d1.alto + 0.4, lado * 20.5 + 0.3, yLados - 0.2, 4902)
  deFiada(-4.8, yLados - d1.alto - d2.alto + 0.4, -4.2, yLados - d1.alto - 0.2, 4903)

  // A CORNIJA larga, com a sombra dela na face e as juntas; o RODAPÉ com o alto claro e as juntas.
  L.push(P(caixa(-x - 1.4, yLados, x + 1.4, yLados + CORNIJA, 0.4), pedra, { tabua: 0, bisel: 0.9, tom: 0.96, contorno: 0.28, projeta: { dist: 1.6, forca: 0.36 }, semente: 4910 }))
  L.push(P(caixa(-x - 1.4, yLados, x + 1.4, yLados + 1.1, 0.3), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 1.12, alfa: 0.8, semente: 4909 }))
  const yRodape = yPe - RODAPE
  L.push(P(caixa(-x - 1.4, yRodape - 0.9, x + 1.4, yRodape + 0.3, 0.3), pedra, { tabua: 0, bisel: 0.3, tom: 1.06, contorno: 0.22, semente: 4911 }))
  L.push(P(caixa(-x - 1.4, yRodape + 0.3, x + 1.4, yPe, 0.5), pedra, { tabua: 0, bisel: 0.8, tom: 0.72, contorno: 0.3, semente: 4912 }))
  for (const xj of [-31, 3, 29]) deFiada(xj - 0.3, yLados + 1.4, xj + 0.3, yLados + CORNIJA - 0.5, 4913)
  for (const xj of [-38, -12, 15, 41]) deFiada(xj - 0.3, yRodape + 0.8, xj + 0.3, yPe - 0.5, 4914)

  // Os LÓCULOS: dois pares de cada lado da pilastra do meio, em duas fileiras.
  const y0 = yLados + CORNIJA + FOLGA
  const y1 = yRodape - 0.9 - FOLGA
  const alta = (y1 - y0 - ENTRE_FILEIRAS) / 2
  const xg = x - LADO
  const largo = (xg - MEIA_PILASTRA - ATE_A_PILASTRA - ENTRE_O_PAR) / 2
  L.push(P(caixa(-MEIA_PILASTRA, y0 - 1.4, MEIA_PILASTRA, y1 + 1.4, 0.4), pedra, { tabua: 0, bisel: 1, tom: 0.92, contorno: 0.26, projeta: { dist: 0.8, forca: 0.26 }, semente: 4915 }))
  const colunas = [-xg, -xg + largo + ENTRE_O_PAR, MEIA_PILASTRA + ATE_A_PILASTRA, MEIA_PILASTRA + ATE_A_PILASTRA + largo + ENTRE_O_PAR]
  const loculos = [y0, y1 - alta].flatMap((gy0) => colunas.map((gx0): readonly [number, number, number, number] => [gx0, gy0, gx0 + largo, gy0 + alta]))
  const gravada = { tabua: 0, bisel: 0, contorno: 0, tom: 0.62, recesso: { k: 0.5, forca: 0.3 } }
  loculos.forEach(([gx0, gy0, gx1, gy1], i) => {
    // A junta escura e a laje afundada, de tom um pouco diferente em cada lóculo; uma tem a quina partida.
    L.push(P(caixa(gx0, gy0, gx1, gy1, 0.4), pedra, { tabua: 0, bisel: 0, tom: 0.5, contorno: 0.2, recesso: { k: 1, forca: 0.36 }, semente: 4920 + i }))
    const [lx0, ly0, lx1, ly1] = [gx0 + JUNTA, gy0 + JUNTA, gx1 - JUNTA, gy1 - JUNTA]
    const laje = i === QUINA_PARTIDA
      ? poligono([[lx0, ly0], [lx1 - 4.2, ly0], [lx1 - 2.8, ly0 + 1.6], [lx1, ly0 + 3.4], [lx1, ly1], [lx0, ly1]])
      : caixa(lx0, ly0, lx1, ly1, 0.4)
    L.push(P(laje, pedra, { tabua: 0, bisel: 0.5, tom: 0.9 + 0.08 * hash(i, 3, 4924), contorno: 0.24, recesso: RECESSO, semente: 4925 + i }))

    // Os dois PINOS de ferro fosco, no meio da altura, perto das beiras.
    const cy = (ly0 + ly1) / 2 + 0.6
    for (const px of [lx0 + 2, lx1 - 2]) L.push(P(elipse(px, cy, 0.85, 0.85), FERRO, { tabua: 0, bisel: 0.4, tom: 0.6, contorno: 0.3, projeta: { dist: 0.4, forca: 0.2 }, semente: 4930 }))

    // A PLAQUINHA do nome, no alto da laje (a de um sem nome).
    const cx = (lx0 + lx1) / 2
    const meiaPlaca = Math.min(5.8, (lx1 - lx0) / 2 - 3.6)
    L.push(P(caixa(cx - meiaPlaca, ly0 + 1.8, cx + meiaPlaca, ly0 + 5.2, 0.4), pedra, { tabua: 0, bisel: 0.6, tom: 1.08, contorno: 0.22, projeta: { dist: 0.6, forca: 0.22 }, semente: 4940 + i }))
    if (i !== SEM_NOME) {
      const nome = meiaPlaca * (0.9 + 0.6 * hash(i, 4, 4944))
      L.push(P(caixa(cx - nome / 2, ly0 + 2.9, cx + nome / 2, ly0 + 3.6, 0.2), pedra, { ...gravada, semente: 4945 + i }))
      L.push(P(caixa(cx - meiaPlaca + 1.4, ly0 + 4.1, cx + meiaPlaca * (0.1 + 0.4 * hash(i, 5, 4949)), ly0 + 4.6, 0.2), pedra, { ...gravada, alfa: 0.5, semente: 4950 + i }))
    }

    // A PRATELEIRA de pedra embaixo da placa, com a sombra dela, o VASINHO de bronze em cima e as flores secas.
    if (COM_VASO.includes(i)) {
      const ys = ly1 - 2.4
      L.push(P(caixa(cx - 4.6, ys, cx + 4.6, ys + 1.5, 0.3), pedra, { tabua: 0, bisel: 0.4, tom: 0.84, contorno: 0.28, projeta: { dist: 1.1, forca: 0.34 }, semente: 4955 }))
      L.push(P(caixa(cx - 4.6, ys - 0.9, cx + 4.6, ys, 0.3), pedra, { tabua: 0, bisel: 0.2, tom: 1.14, contorno: 0.24, semente: 4956 }))
      const vx = cx + (i === COM_VASO[0] ? 1.6 : -1.4)
      const vt = ys - 3.4
      L.push(P(elipse(vx + 1.2, ys - 1.2, 1.6, 1), PATINA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 0.8, semente: 4957 }))
      const talos: readonly Ponto[] = i === COM_VASO[0] ? [[-1.6, -2], [0.3, -2.3], [1.7, -1.9]] : [[-1.3, -2.2], [1.2, -2]]
      talos.forEach(([tx, ty], k) => {
        L.push(P(cadeia([[vx, vt + 0.6], [vx + tx * 0.5, vt + ty * 0.6], [vx + tx, vt + ty]], 0.22), FLOR_SECA, { tabua: 0, bisel: 0, tom: 0.9, contorno: 0.2, semente: 4959 + k }))
        L.push(P(elipse(vx + tx, vt + ty - 0.3, 0.7, 0.8), FLOR_SECA, { tabua: 0, bisel: 0.3, tom: 0.8 + 0.1 * k, contorno: 0.26, semente: 4962 + k }))
      })
      L.push(P(poligono([[vx - 1.6, vt], [vx + 1.6, vt], [vx + 1.1, ys - 0.5], [vx - 1.1, ys - 0.5]]), BRONZE, { tabua: 0, bisel: 0.6, tom: 1, contorno: 0.28, projeta: { dist: 0.5, forca: 0.26 }, semente: 4965 }))
      L.push(P(elipse(vx, vt, 1.9, 0.6), BRONZE, { tabua: 0, bisel: 0.3, tom: 1.1, contorno: 0.24, semente: 4966 }))
      L.push(P(elipse(vx, vt, 1.25, 0.32), BRONZE, { tabua: 0, bisel: 0, contorno: 0, tom: 0.42, semente: 4967 }))
    }

    // As marcas: a trinca (uma reta quebrada, no tom das trincas do lote) e o musgo.
    if (i === TRINCADO) {
      const trinca: Ponto[] = [[lx0 + 0.8, ly1 - 2], [lx0 + 4.6, ly1 - 4.4], [lx0 + 5.8, ly1 - 4], [lx0 + 9, ly1 - 6.6]]
      L.push(P(dentroDe(cadeia(trinca, 0.28), laje), pedra, { tabua: 0, bisel: 0, tom: 0.6, alfa: 0.7, contorno: 0, semente: 4970 }))
    }
    if (i === COM_MUSGO) L.push(P(dentroDe(elipse(lx0 + 2, ly1 - 1.4, 4.6, 2.6), laje), MUSGO, { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.55, suave: 0.9, semente: 4971 }))
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
