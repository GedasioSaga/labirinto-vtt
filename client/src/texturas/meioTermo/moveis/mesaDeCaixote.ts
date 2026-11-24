/**
 * MESA DE CAIXOTE de cima com volume (lote L09 dos objetos de 24/11/2026, "Cortiço"; a versão pobre da mesa). Um
 * CAIXOTE de feira virado de boca para baixo, um pouco torto, serve de mesa: vê-se o fundo dele, de tábuas com as frestas
 * escuras e os pregos, e as quatro quinas saindo por baixo do PANO. O pano é quadrado e foi jogado de través, em
 * losango, um nada puxado para a frente: em cima do caixote ele fica liso e claro, e as quatro pontas caem pelos lados,
 * opacas e bem mais escuras (na sombra), só com o vale das pregas e a bainha mole. Em cima, a CANECA de lata com o café no
 * fundo e a TIGELA de barro com a colher de pau atravessada.
 *
 * A 25% de zoom sobra o quadrado claro do pano em cima do caixote, as pontas escuras caindo e as tábuas do caixote
 * aparecendo nas quatro quinas: mesa improvisada (a mesa de verdade é a tábua comprida com as pernas nas pontas).
 *
 * Na 3/4 (DERIVADO) o caixote é a coluna de tábuas com os vãos escuros, e o pano é um tampo solto na altura dele: a ponta
 * da frente cai em V mole por cima da frente do caixote, com as tábuas aparecendo dos dois lados; a ponta de trás fica no
 * chão, escondida atrás do caixote. Materiais: `madeira` (o pinho de caixote, gasto para o pardo do cortiço) e `pano`
 * (um dos tecidos; o linho cru de partida). A lata, o barro e a colher são fixos. Medidas do menor meio lado (1 x 1 casa
 * de partida).
 */
import { hash } from '../../ruido'
import { anel, caixa, capsula, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { PREGO, type MontarMovel } from './contexto'
import { girar } from './grilhoesDeParede'
import { arco, ESCURO_DO_CORTICO, madeiraGasta, vale } from './catreDesarrumado'

/** A altura do caixote (casas): o tampo da mesa. */
const ALTURA_DO_CAIXOTE = 0.5
/** O meio lado do caixote e o meio da diagonal do pano, em frações do menor meio lado da pegada. */
const LADO_DO_CAIXOTE = 0.64
const DIAGONAL_DO_PANO = 0.85
/** O pano um nada para a esquerda e para a frente (fração do menor meio lado): a ponta da frente cai mais. */
const DESVIO_DO_PANO: Ponto = [-0.02, 0.05]
/** O caixote torto (radianos) e o pano, um nada mais torto que o losango exato. */
const GIRO_DO_CAIXOTE = 0.07
const GIRO_DO_PANO = Math.PI / 4 + 0.05
/** O caixote de feira velho: a madeira escolhida puxada para o pardo gasto do cortiço. */
const GASTO_DO_CAIXOTE = 0.35
/** As tábuas do fundo do caixote, de uma beira à outra (fração do lado); o que sobra são as três frestas. */
const TABUAS: readonly number[] = [0.24, 0.23, 0.23, 0.24]
/** As pontas que caem, mais escuras que o tampo (na sombra). */
const TOM_DAS_PONTAS = 0.65
/** A lata da caneca, o café, o barro da tigela, o caldo dela e a colher de pau. */
const LATA: MaterialDaPeca = { classe: 'metal', rgb: [0x8a, 0x8b, 0x86] }
const CAFE: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x2c, 0x22] }
const BARRO: MaterialDaPeca = { classe: 'liso', rgb: [0xa0, 0x66, 0x4a] }
const CALDO: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x84, 0x56] }
const COLHER: MaterialDaPeca = { classe: 'madeira', rgb: [0xb0, 0x8c, 0x5e] }

/** O pano é um quadrado de quinas moles (superelipse deste expoente) e a bainha que cai ondula este tanto (px). */
const EXPOENTE_DO_PANO = 9
const ONDA_DA_BAINHA = 0.55
const ONDAS_NA_VOLTA = 8
/** Pontos do contorno do pano, calculado uma vez só: com 96, a mesa levava 1,4 s na 3/4. */
const PASSOS_DO_PANO = 40

/** O contorno do pano: as pontas a `d` do meio (cx, cy), girado de `giro`, com a bainha empurrada para fora por `onda`. */
function contornoDoPano(cx: number, cy: number, d: number, giro: number, onda: (x: number, y: number) => number): Ponto[] {
  const ex = 2 / EXPOENTE_DO_PANO
  const s = d / (Math.SQRT2 * 2 ** (-1 / EXPOENTE_DO_PANO))
  const [cg, sg] = [Math.cos(giro), Math.sin(giro)]
  return Array.from({ length: PASSOS_DO_PANO }, (_, i): Ponto => {
    const t = (i / PASSOS_DO_PANO) * Math.PI * 2
    const [ct, st] = [Math.cos(t), Math.sin(t)]
    const [lx, ly] = [s * Math.sign(ct) * Math.abs(ct) ** ex, s * Math.sign(st) * Math.abs(st) ** ex]
    const [x, y] = [cx + lx * cg - ly * sg, cy + lx * sg + ly * cg]
    const r = Math.hypot(lx, ly) || 1
    const o = onda(x, y) * Math.sin(t * ONDAS_NA_VOLTA)
    return [x + ((lx * cg - ly * sg) / r) * o, y + ((lx * sg + ly * cg) / r) * o]
  })
}

/** O losango liso do pano (sem onda nem quina mole), barato: a forma do tampo solto na 3/4. */
function losangoLiso(cx: number, cy: number, d: number, giro: number): (x: number, y: number) => number {
  const [c, s] = [Math.cos(giro - Math.PI / 4), Math.sin(giro - Math.PI / 4)]
  return (x, y) => {
    const [u, v] = [(x - cx) * c + (y - cy) * s, -(x - cx) * s + (y - cy) * c]
    return (Math.abs(u) + Math.abs(v) - d) / Math.SQRT2
  }
}

export const montarMesaDeCaixote: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = madeiraGasta(c.m.madeira, GASTO_DO_CAIXOTE)
  const pano = c.m.pano
  const L = cena.partes
  const R = Math.min(hw, hh)
  const k = R / 28
  const zC = g * ALTURA_DO_CAIXOTE
  cena.corDoPiso = ESCURO_DO_CORTICO

  // O CAIXOTE torto e o PANO em losango por cima. As coordenadas do caixote (u para a direita, v para a frente).
  const a = LADO_DO_CAIXOTE * R
  const caixote = girar(caixa(-a, -a, a, a, 1.2 * k), 0, 0, GIRO_DO_CAIXOTE)
  const co = Math.cos(GIRO_DO_CAIXOTE)
  const si = Math.sin(GIRO_DO_CAIXOTE)
  const em = (u: number, v: number): Ponto => [u * co - v * si, u * si + v * co]
  const noCaixote = (x: number, y: number): Ponto => [x * co + y * si, -x * si + y * co]
  const d = DIAGONAL_DO_PANO * R
  const [pcx, pcy] = [DESVIO_DO_PANO[0] * R, DESVIO_DO_PANO[1] * R]
  // A bainha ondula só onde o pano cai para fora do caixote; em cima dele o pano fica liso e reto.
  const ondaDaBainha = (x: number, y: number): number => ONDA_DA_BAINHA * k * Math.max(0, Math.min(1, caixote.d(x, y) / (3 * k)))
  const contorno = contornoDoPano(pcx, pcy, d, GIRO_DO_PANO, ondaDaBainha)
  const losango = poligono(contorno)
  const liso = losangoLiso(pcx, pcy, d, GIRO_DO_PANO)

  // As PONTAS que caem, uma por lado do caixote: o pano além daquela beira. A de trás (v < -a) fica de fora do tampo
  // solto: na 3/4 ela cai no chão, atrás do caixote, e some.
  const lados: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 0], [0, -1]]
  const pontas = lados.map(([lu, lv]) => {
    const alem = (x: number, y: number): number => {
      const [u, v] = noCaixote(x, y)
      return a - (u * lu + v * lv)
    }
    const fora = contorno.filter(([x, y]) => alem(x, y) < 1.5 * k)
    const b: Forma['b'] = [Math.min(...fora.map((p) => p[0])) - k, Math.min(...fora.map((p) => p[1])) - k, Math.max(...fora.map((p) => p[0])) + k, Math.max(...fora.map((p) => p[1])) + k]
    const forma: Forma = { b, d: (x, y) => Math.max(losango.d(x, y), alem(x, y)) }
    return { lu, lv, forma, atras: lv < 0 }
  })
  const caidas = pontas.filter((p) => !p.atras)
  const tampo: Forma = {
    b: [Math.min(...caidas.map((p) => p.forma.b[0])), Math.min(...caidas.map((p) => p.forma.b[1])), Math.max(...caidas.map((p) => p.forma.b[2])), Math.max(...caidas.map((p) => p.forma.b[3]))],
    d: (x, y) => Math.max(liso(x, y), -caixote.d(x, y), -a - noCaixote(x, y)[1]),
  }
  cena.sombras.push({ forma: caixote, z: zC, forca: 0.3 }, contato(caixote, 0.34), { forma: tampo, z: zC, solta: true, forca: 0.22 })

  // O fundo do caixote: o escuro de dentro (madeira na sombra: é a maior peça do caixote e dá a frente de tábuas na 3/4)
  // e as tábuas com as frestas e os pregos nas pontas.
  L.push(P(caixote, mad, { tabua: 0, bisel: 0.6, tom: 0.4, contorno: 0.3, semente: 8401 }))
  const fresta = ((1 - TABUAS.reduce((s, t) => s + t, 0)) * 2 * a) / (TABUAS.length - 1)
  let v = -a
  TABUAS.forEach((t, i) => {
    const [v0, v1] = [v, v + t * 2 * a]
    v = v1 + fresta
    const tabua = poligono([em(-a, v0), em(a, v0), em(a, v1), em(-a, v1)])
    L.push(P(tabua, mad, { eixo: GIRO_DO_CAIXOTE, tabua: 0, bisel: 0.9, tom: 0.9 + 0.16 * hash(i, 3, 8402), contorno: 0.26, semente: 8403 + i, projeta: { dist: 0.8, forca: 0.34 } }))
    for (const u of [-a + 2.2 * k, a - 2.2 * k]) {
      const [px, py] = em(u, (v0 + v1) / 2)
      L.push(P(elipse(px, py, 0.6, 0.6), PREGO, { bisel: 0.5, contorno: 0, metal: 0.2, alfa: 0.7, semente: 8410 + i }))
    }
  })

  // As PONTAS que caem: opacas, na sombra, cada uma com dois vales que descem da dobra e se juntam na ponta (sem fio
  // de luz: o pano que cai não pega a luz de cima).
  pontas.forEach((p, q) => {
    L.push(P(p.forma, pano, { tabua: 0, bisel: 0.6 * k, ruga: 1.2, tom: TOM_DAS_PONTAS, contorno: 0.26, semente: 8420 + q, projeta: { dist: 0.8 * k, forca: 0.3, suave: 0.8 * k } }))
    // A ponta: o ponto do contorno que vai mais longe para aquele lado.
    const longe = (ponto: Ponto): number => {
      const [u, w] = noCaixote(ponto[0], ponto[1])
      return u * p.lu + w * p.lv
    }
    const extremo = contorno.reduce((m, ponto) => (longe(ponto) > longe(m) ? ponto : m))
    const [pu, pv] = noCaixote(extremo[0], extremo[1])
    const ponta: Ponto = em(pu - p.lu * 1.6 * k, pv - p.lv * 1.6 * k)
    for (const lado of [-1, 1]) {
      const base = em(p.lu * a * 0.99 - p.lv * lado * a * 0.3, p.lv * a * 0.99 + p.lu * lado * a * 0.3)
      const meio: Ponto = [(base[0] + ponta[0]) / 2, (base[1] + ponta[1]) / 2]
      vale(P, L, pano, arco(base, meio, ponta), 1.2 * k, 0.9, 8430 + q * 4 + (lado + 1))
    }
  })

  // O PANO em cima do caixote: liso e claro, de beira mansa (a dobra na borda do caixote).
  L.push(P(dentroDe(losango, caixote), pano, { tabua: 0, bisel: 0.7 * k, ruga: 1, tom: 1, contorno: 0.12, semente: 8421 }))

  // A CANECA de lata: a boca clara, o café no fundo e a asa.
  const [qx, qy] = [-6.6 * k, -5.2 * k]
  const rq = 3.4 * k
  L.push(P(capsula(qx + rq * 0.7, qy + 0.4 * k, qx + rq * 1.45, qy + 0.6 * k, 0.75 * k), LATA, { tabua: 0, bisel: 0.5 * k, metal: 0.45, contorno: 0.26, semente: 8450 }))
  L.push(P(elipse(qx, qy, rq, rq), LATA, { tabua: 0, bisel: 0.9 * k, metal: 0.5, contorno: 0.28, semente: 8451, projeta: { dist: 1.4 * k, forca: 0.34, suave: 0.8 * k } }))
  L.push(P(elipse(qx + 0.2 * k, qy + 0.2 * k, rq - 0.8 * k, rq - 0.8 * k), CAFE, { tabua: 0, bisel: 0, contorno: 0.2, recesso: { k: 1, forca: 0.32 }, semente: 8452 }))
  L.push(P(anel(qx, qy, rq, rq, rq - 0.7 * k, rq - 0.7 * k), LATA, { tabua: 0, bisel: 0.3 * k, metal: 0.6, tom: 1.15, contorno: 0, semente: 8453 }))

  // A TIGELA de barro com o caldo e a colher de pau atravessada na boca.
  const [bx, by] = [5.6 * k, 5 * k]
  const rb = 5.2 * k
  L.push(P(elipse(bx, by, rb, rb), BARRO, { tabua: 0, bisel: 1.4 * k, contorno: 0.26, semente: 8460, projeta: { dist: 1.6 * k, forca: 0.34, suave: 0.9 * k } }))
  L.push(P(elipse(bx + 0.3 * k, by + 0.3 * k, rb - 1.3 * k, rb - 1.3 * k), CALDO, { tabua: 0, bisel: 0, contorno: 0.16, recesso: { k: 1.2, forca: 0.3 }, semente: 8461 }))
  // A concha da colher fica dentro, no caldo; o cabo sai pela boca para cima à direita e apoia na beira.
  const [cx, cy] = [bx - rb * 0.22, by + rb * 0.18]
  L.push(P(capsula(cx, cy, bx + rb * 1.3, by - rb * 1.02, 0.62 * k), COLHER, { tabua: 0, bisel: 0.5 * k, contorno: 0.26, semente: 8462, projeta: { dist: 0.9 * k, forca: 0.3 } }))
  L.push(P(girar(elipse(cx, cy, 1.9 * k, 1.3 * k), cx, cy, -0.68), COLHER, { tabua: 0, bisel: 0.8 * k, contorno: 0.26, tom: 0.94, recesso: { k: 0.6, forca: 0.24 }, semente: 8463 }))
}
