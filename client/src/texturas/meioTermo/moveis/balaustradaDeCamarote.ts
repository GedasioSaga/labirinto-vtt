/**
 * BALAUSTRADA DE CAMAROTE de cima com volume (lote L11 dos objetos de 24/11/2026, "Arena e cortiço"; objeto novo).
 * O camarote de quem assiste à luta de cima: o PARAPEITO de madeira em arco, que abraça o fosso (o meio do arco fica
 * para trás e as pontas vêm para a frente, embaixo no giro 0), com o corrimão largo de veio corrido, as emendas, os
 * balaústres torneados por baixo e um PILARETE de pinha em cada ponta; no meio, o PANO do dono do camarote jogado por
 * cima do corrimão, com as duas barras claras e o losango. Atrás do parapeito, três CADEIRAS de braço viradas para o
 * fosso, de assento estofado, e entre duas delas a MESINHA com a jarra e as duas taças.
 *
 * Barra a passagem e não tapa a visão. A 25% de zoom sobram o arco escuro de madeira com o retângulo de pano no
 * meio e os três quadrados estofados atrás: gente importante assiste dali.
 *
 * Na 3/4 (`{ modo: 'derivado', espessura: 0,07 casa }`) o corrimão é um tampo no ar em cima dos balaústres (colunas
 * finas) e de uma travessa de pé; os pilaretes passam dele; o pano é uma coluna na frente (cai até o chão); cada
 * cadeira tem o assento, os braços e o encosto como tampos e as pernas como colunas. Materiais: `madeira` (sugestão:
 * nogueira) e `pano` (o pano do corrimão e os assentos; sugestão: lã vinho). O latão da jarra é fixo.
 * Medidas de 3 x 1,5 casas.
 */
import { caixa, cadeia, capsula, type Forma, type Ponto } from './formas'
import { contato, type Cena, type CriarPeca, type MaterialDaPeca } from './motor'
import { LENCOL, materialDaPeca, type MontarMovel } from './contexto'
import { disco } from './apoioDasReferencias'
import { comMeioEm, girada } from './fossoDeArena'

/** O arco do corrimão no tamanho de partida (px): a meia corda, a flecha, o y das pontas e o meio raio dele. */
const ARCO = { meiaCorda: 78, flecha: 17, yDasPontas: 35, meiaLargura: 3.6 } as const
/** As alturas (casas): o corrimão, a travessa de pé, o quanto o pilarete passa do corrimão, e as da cadeira e da mesinha. */
const Z = { corrimao: 0.52, travessa: 0.09, pilarete: 0.12, assento: 0.27, braco: 0.44, encosto: 0.68, mesinha: 0.42 } as const
/** Os balaústres entre os pilaretes e o raio de cada um (px). */
const BALAUSTRES = 13
const RAIO_DO_BALAUSTRE = 1.9
/** As cadeiras: onde ficam no arco (-1 a 1) e a distância atrás do corrimão (px). */
const CADEIRAS: readonly number[] = [-0.62, 0, 0.62]
const ATRAS = 31
/** A mesinha: onde fica no arco, a distância atrás do corrimão e o raio (px). */
const MESINHA = { onde: -0.31, atras: 27, raio: 6 } as const

/** Uma cadeira de braço com o meio em (px, py), virada `volta` radianos (0 = de frente para baixo). */
function cadeira(cena: Cena, P: CriarPeca, madeira: MaterialDaPeca, pano: MaterialDaPeca, px: number, py: number, volta: number, k: number, g: number, sem: number): void {
  const L = cena.partes
  const em = (x0: number, y0: number, x1: number, y1: number, raio: number): Forma => girada(caixa(px + x0 * k, py + y0 * k, px + x1 * k, py + y1 * k, raio * k), px, py, volta)
  const [zA, zB, zE] = [g * Z.assento, g * Z.braco, g * Z.encosto]
  const assento = em(-12, -8, 12, 13, 1.6)
  const encosto = em(-12.6, -13, 12.6, -8.6, 1.4)
  cena.sombras.push({ forma: assento, z: zA, solta: true }, { forma: encosto, z: zE, solta: true })
  // As pernas: as de trás sobem até o encosto, as da frente até o assento.
  for (const [x, y, z] of [[-11, -10.8, zE], [11, -10.8, zE], [-10.4, 11.2, zA], [10.4, 11.2, zA]] as const) {
    const perna = em(x - 1.5, y - 1.5, x + 1.5, y + 1.5, 0.5)
    cena.sombras.push(contato(perna, 0.28), { forma: perna, z, forca: 0.22 })
  }
  L.push(P(assento, madeira, { tabua: 0, eixo: volta, bisel: 1 * k, semente: sem }))
  L.push(P(em(-10, -6.2, 10, 11, 2.6), pano, { tabua: 0, bisel: 2.6 * k, ruga: 0.5, contorno: 0.14, semente: sem + 1, projeta: { dist: 0.8 * k, forca: 0.22, suave: 1 } }))
  // Os braços, com o poste da frente de cada um.
  for (const lado of [-1, 1]) {
    const braco = em(lado * 12.9 - 1.6, -9, lado * 12.9 + 1.6, 8.4, 1.2)
    const poste = em(lado * 12.9 - 1.3, 5.6, lado * 12.9 + 1.3, 8.2, 0.5)
    cena.sombras.push({ forma: braco, z: zB, solta: true, forca: 0.2 }, { forma: poste, z: zB, forca: 0.2 })
    L.push(P(braco, madeira, { tabua: 0, eixo: volta + Math.PI / 2, bisel: 1.2 * k, tom: 1.06, semente: sem + 2 + lado, projeta: { dist: (zB - zA) * 0.28, forca: 0.3, suave: 1.2 } }))
  }
  L.push(P(encosto, madeira, { tabua: 0, eixo: volta, bisel: 1.4 * k, tom: 1.04, semente: sem + 5, projeta: { dist: (zE - zA) * 0.26, forca: 0.32, suave: 1.5 } }))
  // Os dois pomos do alto do encosto.
  for (const lado of [-1, 1]) L.push(P(em(lado * 11 - 1.9, -12.7, lado * 11 + 1.9, -8.9, 1.9), madeira, { tabua: 0, bisel: 1.7 * k, tom: 1.12, contorno: 0.26, semente: sem + 6 + lado }))
}

export const montarBalaustradaDeCamarote: MontarMovel = (c, cena) => {
  const { w, h, g, peca: P } = c
  const madeira = c.m.madeira
  const pano = c.m.pano
  const L = cena.partes
  const k = Math.min(w / (3 * g), h / (1.5 * g))
  const latao = materialDaPeca('latao')

  // O ARCO: o círculo que passa pelas duas pontas e pelo meio do corrimão; o meio dele fica abaixo da pegada.
  const [corda, flecha] = [ARCO.meiaCorda * k, ARCO.flecha * k]
  const raio = (corda * corda + flecha * flecha) / (2 * flecha)
  const cy = ARCO.yDasPontas * k - flecha + raio
  const meioAngulo = Math.asin(corda / raio)
  /** O ponto do arco em `t` (-1 a 1), `atras` px para trás do corrimão. */
  const noArco = (t: number, atras = 0): Ponto => {
    const a = -Math.PI / 2 + t * meioAngulo
    return [Math.cos(a) * (raio + atras), cy + Math.sin(a) * (raio + atras)]
  }
  const pontosDoArco = (de: number, ate: number, n: number): Ponto[] => Array.from({ length: n + 1 }, (_, i) => noArco(de + ((ate - de) * i) / n))
  const [zCorrimao, zTravessa] = [g * Z.corrimao, g * Z.travessa]
  const meia = ARCO.meiaLargura * k
  const topo = noArco(0)
  // O meio da caixa das peças do corrimão: um ponto do arco fora do pano (a 3/4 as sobe com o corrimão, não com o pano).
  const noCorrimao = noArco(0.35)

  // ---------- atrás: as três cadeiras e a mesinha ----------
  CADEIRAS.forEach((t, i) => {
    const [px, py] = noArco(t, ATRAS * k)
    cadeira(cena, P, madeira, pano, px, py, t * meioAngulo, k, g, 7600 + i * 10)
  })
  const [mx, my] = noArco(MESINHA.onde, MESINHA.atras * k)
  const tampo = disco(mx, my, MESINHA.raio * k)
  const peDaMesa = disco(mx, my, 1.7 * k)
  cena.sombras.push({ forma: tampo, z: g * Z.mesinha, solta: true, forca: 0.24 }, { forma: peDaMesa, z: g * Z.mesinha - 0.5, forca: 0.2 }, contato(disco(mx, my, 3.4 * k), 0.26))
  L.push(P(tampo, madeira, { tabua: 0, bisel: 1.1 * k, polar: { cx: mx, cy: my, r: MESINHA.raio * k }, tom: 1.08, semente: 7640 }))
  // A jarra de latão (o bojo, a boca e a asa) e as duas taças.
  const [jx, jy] = [mx - 1.2 * k, my - 0.8 * k]
  L.push(P(comMeioEm(capsula(jx + 1.6 * k, jy + 0.4 * k, jx + 3.6 * k, jy + 1 * k, 0.55 * k), jx, jy), latao, { tabua: 0, bisel: 0.5 * k, contorno: 0.26, semente: 7641 }))
  L.push(P(disco(jx, jy, 2.4 * k), latao, { tabua: 0, bisel: 1.5 * k, contorno: 0.28, semente: 7642, projeta: { dist: 1.2 * k, forca: 0.3 } }))
  L.push(P(disco(jx, jy, 1.2 * k), latao, { tabua: 0, bisel: 0, tom: 0.56, contorno: 0, recesso: { k: 0.5, forca: 0.3 }, metal: 0.1, semente: 7643 }))
  for (const [i, [dx, dy]] of ([[3.2, -2.6], [2.2, 3]] as const).entries()) {
    L.push(P(disco(mx + dx * k, my + dy * k, 1.25 * k), latao, { tabua: 0, bisel: 0.7 * k, tom: 1.1, contorno: 0.28, semente: 7644 + i, projeta: { dist: 0.8 * k, forca: 0.26 } }))
    L.push(P(disco(mx + dx * k, my + dy * k, 0.62 * k), pano, { tabua: 0, bisel: 0, tom: 0.7, contorno: 0, semente: 7646 + i }))
  }

  // ---------- o parapeito: a travessa de pé, os balaústres, o corrimão e os pilaretes ----------
  const arco = cadeia(pontosDoArco(-1, 1, 28), meia)
  const travessa = cadeia(pontosDoArco(-1, 1, 28), meia * 0.62)
  cena.sombras.push({ forma: travessa, z: zTravessa, solta: true, forca: 0.2 }, contato(arco, 0.22))
  for (let i = 0; i < BALAUSTRES; i += 1) {
    const [bx, by] = noArco(-0.86 + (1.72 * i) / (BALAUSTRES - 1))
    const balaustre = disco(bx, by, RAIO_DO_BALAUSTRE * k)
    cena.sombras.push({ forma: balaustre, z: zCorrimao - 0.6, forca: 0.2 })
    L.push(P(balaustre, madeira, { tabua: 0, bisel: 1 * k, tom: 1.1, contorno: 0.2, semente: 7650 + i }))
  }
  cena.sombras.push({ forma: arco, z: zCorrimao, solta: true, forca: 0.26 })
  const veio = { cx: 0, cy, r: raio, a0: -Math.PI / 2 }
  L.push(P(comMeioEm(arco, noCorrimao[0], noCorrimao[1]), madeira, { tabua: 0, arco: veio, bisel: 1.5 * k, contorno: 0.26, semente: 7670, projeta: { dist: 2.2 * k, forca: 0.3, suave: 1.6 } }))
  // O friso do meio do corrimão e as duas emendas.
  L.push(P(comMeioEm(cadeia(pontosDoArco(-0.97, 0.97, 28), 0.45 * k), noCorrimao[0], noCorrimao[1]), madeira, { tabua: 0, bisel: 0, contorno: 0, tom: 0.7, alfa: 0.5, semente: 7671 }))
  for (const [i, t] of [-0.46, 0.5].entries()) {
    const [a, b] = [noArco(t, meia * 0.9), noArco(t + 0.012, -meia * 0.9)]
    L.push(P(comMeioEm(capsula(a[0], a[1], b[0], b[1], 0.35 * k), noCorrimao[0], noCorrimao[1]), madeira, { tabua: 0, bisel: 0, contorno: 0, tom: 0.5, alfa: 0.6, semente: 7672 + i }))
  }
  for (const [i, t] of [-1, 1].entries()) {
    const [px, py] = noArco(t)
    const pilarete = caixa(px - 4.3 * k, py - 4.3 * k, px + 4.3 * k, py + 4.3 * k, 1.2 * k)
    cena.sombras.push({ forma: pilarete, z: zCorrimao + g * Z.pilarete }, contato(pilarete, 0.3))
    L.push(P(pilarete, madeira, { tabua: 0, bisel: 1.4 * k, tom: 1.06, contorno: 0.28, semente: 7680 + i }))
    L.push(P(disco(px, py, 2.9 * k), madeira, { tabua: 0, bisel: 2.6 * k, tom: 1.16, contorno: 0.28, polar: { cx: px, cy: py, r: 2.9 * k }, semente: 7682 + i, projeta: { dist: 1 * k, forca: 0.28 } }))
  }

  // ---------- o PANO jogado por cima do corrimão, no meio: na 3/4 ele cai pela frente até o chão ----------
  const [pw, atrasDoPano, naFrente] = [15 * k, 5.6 * k, 2.4 * k]
  const estendido = caixa(-pw, topo[1] - meia - atrasDoPano, pw, topo[1] + meia + naFrente, 1 * k)
  // A caixa da sombra desce até depois dos pilaretes: na 3/4 o pano é pintado por último, na frente dos balaústres.
  cena.sombras.push({ forma: { b: [estendido.b[0], estendido.b[1], estendido.b[2], ARCO.yDasPontas * k + 6 * k], d: estendido.d }, z: zCorrimao + 0.7, forca: 0.22 })
  L.push(P(estendido, pano, { tabua: 0, bisel: 1.3 * k, ruga: 1, contorno: 0.26, semente: 7690, projeta: { dist: 1 * k, forca: 0.28, suave: 1 } }))
  const meioDoPano: readonly [number, number] = [0, (estendido.b[1] + estendido.b[3]) / 2]
  for (const lado of [-1, 1]) {
    L.push(P(comMeioEm(caixa(lado * (pw - 3.4 * k) - 0.7 * k, estendido.b[1] + 0.8 * k, lado * (pw - 3.4 * k) + 0.7 * k, estendido.b[3] - 0.8 * k), meioDoPano[0], meioDoPano[1]), LENCOL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.82, semente: 7691 }))
  }
  const [lx, ly, lr] = [0, meioDoPano[1], 3.4 * k]
  L.push(P(girada(caixa(lx - lr, ly - lr, lx + lr, ly + lr, 0.3 * k), lx, ly, Math.PI / 4), LENCOL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.82, semente: 7692 }))
  L.push(P(girada(caixa(lx - lr * 0.5, ly - lr * 0.5, lx + lr * 0.5, ly + lr * 0.5, 0.2 * k), lx, ly, Math.PI / 4), pano, { tabua: 0, bisel: 0, contorno: 0, tom: 0.9, semente: 7693 }))
}
