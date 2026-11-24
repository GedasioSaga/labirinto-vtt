/**
 * MESA DE CAIXOTE de cima com volume (lote L09 dos objetos de 24/11/2026, "Cortiço"; a versão pobre da mesa). Um
 * CAIXOTE de feira virado de boca para baixo, um pouco torto, serve de mesa: vê-se o fundo dele, de tábuas com as frestas
 * escuras e os pregos, e as quatro quinas saindo por baixo do PANO. O pano é quadrado e foi jogado de través, em
 * losango: no meio ele fica liso em cima do caixote, e as quatro pontas caem pelos lados, mais escuras, com as pregas
 * da queda; a dobra da beira do caixote é a linha clara onde o pano vira. Perto da barra, a lista mais escura de toalha.
 * Em cima, a CANECA de lata com o café no fundo e a TIGELA de barro com a colher de pau atravessada.
 *
 * A 25% de zoom sobra o losango claro do pano sobre o quadrado escuro do caixote, com as quinas de madeira saindo nos
 * quatro cantos: mesa improvisada (a mesa de verdade é a tábua comprida com as pernas nas pontas).
 *
 * Na 3/4 (DERIVADO) o caixote e as pontas do pano sobem juntos (a coluna é o caixote com o losango), e a frente mostra a
 * ponta do pano caindo na frente do caixote. Materiais: `madeira` (o pinho de caixote) e `pano` (um dos tecidos; o linho
 * cru de partida). A lata, o barro e a colher são fixos. Medidas do menor meio lado (1 x 1 casa de partida).
 */
import { hash } from '../../ruido'
import { anel, caixa, capsula, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { PREGO, type MontarMovel } from './contexto'
import { girar } from './grilhoesDeParede'
import { arco, prega } from './catreDesarrumado'

/** A altura do caixote (casas): o tampo da mesa. */
const ALTURA_DO_CAIXOTE = 0.5
/** O meio lado do caixote e o meio da diagonal do pano, em frações do menor meio lado da pegada. */
const LADO_DO_CAIXOTE = 0.64
const DIAGONAL_DO_PANO = 0.97
/** O caixote torto (radianos) e o pano, um nada mais torto que o losango exato. */
const GIRO_DO_CAIXOTE = 0.07
const GIRO_DO_PANO = Math.PI / 4 + 0.05
/** As tábuas do fundo do caixote, de uma beira à outra (fração do lado); o que sobra são as três frestas. */
const TABUAS: readonly number[] = [0.24, 0.23, 0.23, 0.24]
/** A lata da caneca, o café, o barro da tigela, o caldo dela e a colher de pau. */
const LATA: MaterialDaPeca = { classe: 'metal', rgb: [0x8a, 0x8b, 0x86] }
const CAFE: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x2c, 0x22] }
const BARRO: MaterialDaPeca = { classe: 'liso', rgb: [0xa0, 0x66, 0x4a] }
const CALDO: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x84, 0x56] }
const COLHER: MaterialDaPeca = { classe: 'madeira', rgb: [0xb0, 0x8c, 0x5e] }
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x2e, 0x24] }

/** O pano é um quadrado de quinas moles (superelipse deste expoente) e a bainha que cai ondula este tanto (px). */
const EXPOENTE_DO_PANO = 9
const ONDA_DA_BAINHA = 0.9
const ONDAS_NA_VOLTA = 12
const PASSOS_DO_PANO = 96

/** O contorno do pano: as pontas a `d` do meio, girado de `giro`, com a bainha empurrada para fora por `onda`. */
function contornoDoPano(d: number, giro: number, onda: (x: number, y: number) => number): Ponto[] {
  const ex = 2 / EXPOENTE_DO_PANO
  const s = d / (Math.SQRT2 * 2 ** (-1 / EXPOENTE_DO_PANO))
  const [cg, sg] = [Math.cos(giro), Math.sin(giro)]
  return Array.from({ length: PASSOS_DO_PANO }, (_, i): Ponto => {
    const t = (i / PASSOS_DO_PANO) * Math.PI * 2
    const [ct, st] = [Math.cos(t), Math.sin(t)]
    const [lx, ly] = [s * Math.sign(ct) * Math.abs(ct) ** ex, s * Math.sign(st) * Math.abs(st) ** ex]
    const [x, y] = [lx * cg - ly * sg, lx * sg + ly * cg]
    const r = Math.hypot(x, y) || 1
    const o = onda(x, y) * Math.sin(t * ONDAS_NA_VOLTA)
    return [x + (x / r) * o, y + (y / r) * o]
  })
}

export const montarMesaDeCaixote: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const pano = c.m.pano
  const L = cena.partes
  const R = Math.min(hw, hh)
  const k = R / 28

  // O CAIXOTE torto e o PANO em losango por cima.
  const a = LADO_DO_CAIXOTE * R
  const caixote = girar(caixa(-a, -a, a, a, 1.2 * k), 0, 0, GIRO_DO_CAIXOTE)
  const d = DIAGONAL_DO_PANO * R
  // A bainha ondula só onde o pano cai para fora do caixote; em cima dele o pano fica liso e reto.
  const ondaDaBainha = (x: number, y: number): number => ONDA_DA_BAINHA * k * Math.max(0, Math.min(1, caixote.d(x, y) / (3 * k)))
  const losango = poligono(contornoDoPano(d, GIRO_DO_PANO, ondaDaBainha))
  const coluna: Forma = { b: [Math.min(caixote.b[0], losango.b[0]), Math.min(caixote.b[1], losango.b[1]), Math.max(caixote.b[2], losango.b[2]), Math.max(caixote.b[3], losango.b[3])], d: (x, y) => Math.min(caixote.d(x, y), losango.d(x, y)) }
  cena.sombras.push({ forma: coluna, z: g * ALTURA_DO_CAIXOTE, forca: 0.3 }, contato(caixote, 0.34))

  // O fundo do caixote: o vão escuro e as tábuas com as frestas e os pregos nas pontas.
  L.push(P(caixote, VAO, { tabua: 0, bisel: 0.6, contorno: 0.3, semente: 8401 }))
  const co = Math.cos(GIRO_DO_CAIXOTE)
  const si = Math.sin(GIRO_DO_CAIXOTE)
  const em = (u: number, v: number): Ponto => [u * co - v * si, u * si + v * co]
  const fresta = ((1 - TABUAS.reduce((s, t) => s + t, 0)) * 2 * a) / (TABUAS.length - 1)
  let v = -a
  TABUAS.forEach((t, i) => {
    const [v0, v1] = [v, v + t * 2 * a]
    v = v1 + fresta
    const tabua = poligono([em(-a, v0), em(a, v0), em(a, v1), em(-a, v1)])
    L.push(P(tabua, mad, { eixo: GIRO_DO_CAIXOTE, tabua: 0, bisel: 0.9, tom: 0.88 + 0.16 * hash(i, 3, 8402), contorno: 0.26, semente: 8403 + i, projeta: { dist: 0.8, forca: 0.3 } }))
    for (const u of [-a + 2.2 * k, a - 2.2 * k]) {
      const [px, py] = em(u, (v0 + v1) / 2)
      L.push(P(elipse(px, py, 0.6, 0.6), PREGO, { bisel: 0.5, contorno: 0, metal: 0.25, semente: 8410 + i }))
    }
  })

  // O PANO: a parte que cai (o losango inteiro, na sombra, com a bainha ondulada) e a parte de cima do caixote, lisa e
  // clara; a divisa das duas é a dobra na borda. Cada ponta que cai ganha duas pregas que se juntam na dobra. Sem
  // brilho largo na beira: com ele, o pano lia como placa de vidro.
  L.push(P(losango, pano, { tabua: 0, bisel: 0.5 * k, ruga: 1.4, tom: 0.62, contorno: 0.28, semente: 8420, projeta: { dist: 1 * k, forca: 0.3, suave: 0.9 * k } }))
  const emCima = dentroDe(losango, caixote)
  L.push(P(emCima, pano, { tabua: 0, bisel: 1.6 * k, ruga: 1, tom: 1, contorno: 0.14, semente: 8421 }))
  for (let q = 0; q < 4; q += 1) {
    const ang = GIRO_DO_PANO - Math.PI / 4 + (q * Math.PI) / 2
    const [ux, uy] = [Math.cos(ang), Math.sin(ang)]
    const [nx, ny] = [-uy, ux]
    // A ponta que cai e a borda do caixote naquele lado (onde o pano dobra).
    const ponta: Ponto = [ux * (d - 2.2 * k), uy * (d - 2.2 * k)]
    for (const lado of [-1, 1]) {
      const base: Ponto = [ux * a * 0.98 + nx * lado * a * 0.36, uy * a * 0.98 + ny * lado * a * 0.36]
      const meio: Ponto = [(base[0] + ponta[0]) / 2 + nx * lado * 1.4 * k, (base[1] + ponta[1]) / 2 + ny * lado * 1.4 * k]
      prega(P, L, pano, arco(base, meio, ponta), 1.45 * k, 1, 8430 + q * 4 + (lado + 1))
    }
  }

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
