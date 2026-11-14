/**
 * ALJAVAS E FEIXES DE FLECHAS de cima com volume (lote L02 de 14/11/2026, o
 * castelo): o canto do arsenal dos arqueiros. Em cima à esquerda, a ALJAVA EM
 * PÉ de couro escuro, com o aro de latão na boca e a cabeça das flechas lá
 * dentro (cada uma, as três penas abertas em estrela em volta da seteira); à
 * direita, o FEIXE de flechas deitado, amarrado com duas voltas de corda, as
 * penas para cima e as pontas de ferro para baixo; embaixo, a ALJAVA DEITADA
 * de couro claro, com as cintas escuras, de onde escorregam três flechas.
 *
 * O que lê a 25% de zoom são as listras claras das hastes (o feixe) ao lado do
 * círculo escuro com os pontos coloridos (a aljava em pé). Na 3/4 a aljava em
 * pé é uma coluna (a boca sobe e o couro aparece embaixo dela); o resto é
 * rente ao chão e fica como de cima, com a sombra pintada um pouco para o
 * lado (sem altura, para não virar coluna: a lição da carroça e do cano). O
 * desenho é feito na casa de 56 px e encolhe com a pegada. Sem material: o
 * couro, a madeira das hastes, as penas e o ferro são fixos.
 */
import { anel, capsula, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Peca, type CriarPeca } from './motor'
import { BURACO, materialDaPeca, type MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** O lado em que o desenho é feito (px do protótipo): uma casa. */
const CASA = 56
/** A altura da aljava em pé, em casas (a flecha passa um palmo da boca). */
const ALTURA_DA_ALJAVA = 0.6
/** A altura das coisas deitadas, só para a sombra pintada (px do protótipo): a aljava e o feixe. */
const ALTURA_DA_ALJAVA_DEITADA = 7
const ALTURA_DO_FEIXE = 2.4

/** A aljava em pé: o meio, o raio do couro e o do aro. */
const ALJAVA_EM_PE = { x: -11, y: -10.5, r: 9.6, aro: 8.1 } as const
/** As flechas encostadas na borda da aljava em pé: quantas e a que distância do meio. */
const FLECHAS_NA_RODA = 7
const RAIO_DA_RODA = 4.7
/** A aljava deitada: o fundo, a boca e o raio. */
const FUNDO_DA_DEITADA: Ponto = [-22, 19]
const BOCA_DA_DEITADA: Ponto = [-3.6, 10.6]
const RAIO_DA_DEITADA = 5.8
/** O fundo da aljava é mais fino que a boca. */
const FUNDO_MAIS_FINO = 0.78
/** O feixe: o meio das penas, o meio das pontas, quantas flechas e o passo entre elas. */
const PENAS_DO_FEIXE: Ponto = [15.4, -21]
const PONTAS_DO_FEIXE: Ponto = [19.6, 20]
const FLECHAS_DO_FEIXE = 9
const PASSO_NO_FEIXE = 1.32

/** As flechas: a haste de freixo, as quatro cores de pena, o ferro da ponta. */
const HASTE: MaterialDaPeca = { classe: 'liso', rgb: [0xcf, 0xb3, 0x86] }
const PENAS: readonly MaterialDaPeca[] = [
  { classe: 'liso', rgb: [0xe4, 0xdc, 0xca] },
  { classe: 'liso', rgb: [0x8e, 0x4a, 0x4a] },
  { classe: 'liso', rgb: [0x9a, 0x94, 0x88] },
  { classe: 'liso', rgb: [0x5e, 0x78, 0x92] },
]
const FERRO: MaterialDaPeca = materialDaPeca('ferro')
const LATAO: MaterialDaPeca = materialDaPeca('latao')
const CORDA: MaterialDaPeca = materialDaPeca('corda')
/** O couro: o escuro da aljava em pé e das cintas, o claro (curtido) da deitada. */
const COURO_ESCURO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('madeiraEscura', 0.86)) }
/** O claro é curtido e fosco: o tom da madeira do Meio-Termo deixava a aljava laranja, com cara de linguiça. */
const COURO_CLARO: MaterialDaPeca = { classe: 'liso', rgb: [0x8c, 0x6c, 0x4f] }

/** Uma flecha deitada, da seteira (`a`) à ponta (`b`), com as duas penas que se veem e a ponta de ferro em folha. */
function flechaDeitada(P: CriarPeca, L: Peca[], naPegada: (f: Forma) => Forma, a: Ponto, b: Ponto, pena: MaterialDaPeca, semente: number, comPonta = true): void {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const comp = Math.hypot(dx, dy) || 1
  const ux = dx / comp
  const uy = dy / comp
  /** O ponto a `t` px da seteira ao longo da haste e `n` px para o lado. */
  const em = (t: number, n: number): Ponto => [a[0] + ux * t - uy * n, a[1] + uy * t + ux * n]
  const eixo = Math.atan2(dy, dx)
  L.push(P(naPegada(capsula(...em(0.4, 0), ...em(comp - (comPonta ? 2.6 : 0), 0), 0.55)), HASTE, { eixo, bisel: 0.5, contorno: 0.26, semente, projeta: { dist: 0.5, forca: 0.26 } }))
  for (const lado of [-1, 1]) {
    L.push(P(naPegada(poligono([em(1, lado * 0.3), em(2.4, lado * 1.9), em(6.2, lado * 1.7), em(6.4, lado * 0.3)])), pena, { eixo, bisel: 0.4, contorno: 0.26, tom: lado < 0 ? 1.04 : 0.88, semente: semente + 1 }))
  }
  L.push(P(naPegada(elipse(...em(0.3, 0), 0.7, 0.7)), BURACO, { bisel: 0.4, contorno: 0, tom: 1.3, semente: semente + 2 }))
  if (comPonta) L.push(P(naPegada(poligono([em(comp - 3.8, 0), em(comp - 2.2, -1.2), em(comp, 0), em(comp - 2.2, 1.2)])), FERRO, { eixo, bisel: 0.6, metal: 0.6, contorno: 0.28, tom: 1.1, semente: semente + 3, projeta: { dist: 0.5, forca: 0.26 } }))
}

/** A cabeça de uma flecha em pé vista do alto: as três penas abertas em estrela e a seteira no meio. */
function flechaEmPe(P: CriarPeca, L: Peca[], naPegada: (f: Forma) => Forma, x: number, y: number, giro: number, pena: MaterialDaPeca, semente: number): void {
  for (let i = 0; i < 3; i += 1) {
    const a = giro + (i * 2 * Math.PI) / 3
    L.push(P(naPegada(elipseGirada(x + Math.cos(a) * 1.45, y + Math.sin(a) * 1.45, 1.6, 0.65, a)), pena, { bisel: 0.4, contorno: 0.24, tom: 0.9 + i * 0.08, semente: semente + i, projeta: { dist: 0.6, forca: 0.3 } }))
  }
  L.push(P(naPegada(elipse(x, y, 0.7, 0.7)), HASTE, { bisel: 0.5, contorno: 0.2, tom: 0.9, semente: semente + 3 }))
}

/** A sombra pintada de uma coisa deitada de `altura` px: a forma deslocada para baixo à direita, sem virar coluna. */
function sombraPintada(f: Forma, altura: number): Forma {
  const ox = SOMBRA_X * altura
  const oy = SOMBRA_Y * altura
  return { b: [f.b[0] + ox, f.b[1] + oy, f.b[2] + ox, f.b[3] + oy], d: (x, y) => f.d(x - ox, y - oy) }
}

export const montarAljavasEFlechas: MontarMovel = (c, cena) => {
  const { peca: P } = c
  const e = Math.min(c.w, c.h) / CASA
  /** A forma desenhada na casa de 56 px, no tamanho da pegada. */
  const naPegada = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const L = cena.partes

  // O feixe deitado, amarrado: as flechas um pouco abertas nas duas pontas, como num molho de verdade.
  const [px, py] = PENAS_DO_FEIXE
  const [qx, qy] = PONTAS_DO_FEIXE
  const comp = Math.hypot(qx - px, qy - py)
  const nx = -(qy - py) / comp
  const ny = (qx - px) / comp
  const meioDoFeixe = (FLECHAS_DO_FEIXE - 1) / 2
  const largura = FLECHAS_DO_FEIXE * PASSO_NO_FEIXE
  const contornoDoFeixe = capsula(px, py, qx, qy, largura / 2 + 0.6)
  cena.sombras.push({ forma: naPegada(sombraPintada(contornoDoFeixe, ALTURA_DO_FEIXE)), z: 0, suave: 1.2, forca: 0.26 }, contato(naPegada(contornoDoFeixe), 0.24))
  for (let i = 0; i < FLECHAS_DO_FEIXE; i += 1) {
    const d = i - meioDoFeixe
    const n0 = d * (PASSO_NO_FEIXE + 0.42)
    const n1 = d * (PASSO_NO_FEIXE + 0.12)
    flechaDeitada(P, L, naPegada, [px + nx * n0, py + ny * n0], [qx + nx * n1, qy + ny * n1], PENAS[i % PENAS.length], 8000 + i * 5)
  }
  // As duas voltas de corda, um pouco além da largura do feixe.
  for (const t of [0.36, 0.66]) {
    const mx = px + (qx - px) * t
    const my = py + (qy - py) * t
    const meia = largura / 2 + 0.8
    L.push(P(naPegada(capsula(mx - nx * meia, my - ny * meia, mx + nx * meia, my + ny * meia, 1.05)), CORDA, { eixo: Math.atan2(ny, nx), bisel: 0.9, contorno: 0.24, semente: 8100 + t * 10, projeta: { dist: 0.6, forca: 0.3 } }))
  }

  // A aljava deitada: o couro claro com as cintas, a boca escura e as flechas escorregando dela.
  const [fx, fy] = FUNDO_DA_DEITADA
  const [bx, by] = BOCA_DA_DEITADA
  const ux = (bx - fx) / Math.hypot(bx - fx, by - fy)
  const uy = (by - fy) / Math.hypot(bx - fx, by - fy)
  // O tubo abre do fundo (mais fino, com o tampo de couro redondo) para a boca.
  const rFundo = RAIO_DA_DEITADA * FUNDO_MAIS_FINO
  const tubo = uniao(poligono([[fx - uy * rFundo, fy + ux * rFundo], [bx - uy * RAIO_DA_DEITADA, by + ux * RAIO_DA_DEITADA], [bx + uy * RAIO_DA_DEITADA, by - ux * RAIO_DA_DEITADA], [fx + uy * rFundo, fy - ux * rFundo]]), elipseGirada(fx, fy, 1.6, rFundo, Math.atan2(uy, ux)))
  const eixoDaDeitada = Math.atan2(by - fy, bx - fx)
  cena.sombras.push({ forma: naPegada(sombraPintada(tubo, ALTURA_DA_ALJAVA_DEITADA)), z: 0, suave: 1.6, forca: 0.3 }, contato(naPegada(tubo), 0.3))
  const caidas: readonly (readonly [Ponto, Ponto, number])[] = [
    [[8.6, 2.6], [-5.2, 12.6], 1],
    [[5.4, -3.2], [-4.6, 9.2], 2],
    [[6.4, 14.6], [-4.4, 11.6], 0],
  ]
  caidas.forEach(([a, b, cor], i) => flechaDeitada(P, L, naPegada, a, b, PENAS[cor], 8200 + i * 5, false))
  L.push(P(naPegada(tubo), COURO_CLARO, { eixo: eixoDaDeitada, bisel: RAIO_DA_DEITADA * 0.6, contorno: 0.28, ruga: 0.3, semente: 8300, projeta: { dist: 0.6, forca: 0.24 } }))
  // O tampo do fundo, um pouco mais escuro, e a costura ao comprido, do lado que pega luz.
  L.push(P(naPegada(elipseGirada(fx, fy, 1.4, rFundo * 0.92, eixoDaDeitada)), COURO_ESCURO, { bisel: 0.9, contorno: 0.24, tom: 1.16, semente: 8301 }))
  const costura = -RAIO_DA_DEITADA * 0.42
  L.push(P(naPegada(capsula(fx + ux * 2.4 - uy * costura * FUNDO_MAIS_FINO, fy + uy * 2.4 + ux * costura * FUNDO_MAIS_FINO, bx - ux * 2.6 - uy * costura, by - uy * 2.6 + ux * costura, 0.32)), COURO_CLARO, { bisel: 0.2, contorno: 0, tom: 1.3, alfa: 0.8, semente: 8302 }))
  for (const t of [0.26, 0.62]) {
    const cx = fx + (bx - fx) * t
    const cy = fy + (by - fy) * t
    const meia = rFundo + (RAIO_DA_DEITADA - rFundo) * t + 0.3
    L.push(P(naPegada(capsula(cx - uy * meia, cy + ux * meia, cx + uy * meia, cy - ux * meia, 1.1)), COURO_ESCURO, { eixo: eixoDaDeitada + Math.PI / 2, bisel: 0.8, contorno: 0.24, semente: 8310 + t * 10 }))
  }
  // O fecho de latão na cinta de cima.
  L.push(P(naPegada(elipse(fx + (bx - fx) * 0.62 + uy * 2.2, fy + (by - fy) * 0.62 - ux * 2.2, 1.2, 1.2)), LATAO, { bisel: 0.9, metal: 0.6, contorno: 0.24, semente: 8315 }))
  L.push(P(naPegada(elipseGirada(bx, by, 1.9, RAIO_DA_DEITADA * 0.98, eixoDaDeitada)), COURO_ESCURO, { bisel: 0.7, contorno: 0.26, tom: 1.1, semente: 8320 }))
  L.push(P(naPegada(elipseGirada(bx + ux * 0.4, by + uy * 0.4, 1.2, RAIO_DA_DEITADA * 0.72, eixoDaDeitada)), BURACO, { bisel: 0.3, contorno: 0, recesso: { k: 0.8, forca: 0.3 }, semente: 8321 }))
  // As cabeças de duas flechas ainda dentro, aparecendo na boca.
  for (const [n, cor] of [[-1.8, 3], [1.6, 0]] as const) flechaEmPe(P, L, naPegada, bx + ux * 1.2 - uy * n, by + uy * 1.2 + ux * n, 0.4 + n, PENAS[cor], 8330 + n * 4)

  // A aljava em pé: a coluna de couro escuro, a boca escura, o aro de latão e as flechas lá dentro.
  const { x: ax, y: ay, r: ra, aro } = ALJAVA_EM_PE
  const corpo = elipse(ax, ay, ra, ra)
  cena.sombras.push({ forma: naPegada(corpo), z: c.g * ALTURA_DA_ALJAVA }, contato(naPegada(corpo), 0.34))
  L.push(P(naPegada(corpo), COURO_ESCURO, { bisel: ra * 0.5, contorno: 0.28, ruga: 0.3, semente: 8400 }))
  L.push(P(naPegada(anel(ax, ay, ra * 0.97, ra * 0.97, aro, aro)), LATAO, { bisel: 0.9, metal: 0.55, contorno: 0.22, semente: 8401 }))
  L.push(P(naPegada(elipse(ax, ay, aro, aro)), BURACO, { bisel: 0.4, contorno: 0.1, recesso: { k: 1.6, forca: 0.4 }, semente: 8402 }))
  // A alça: a cinta de couro que sai da boca e o fecho de latão.
  L.push(P(naPegada(capsula(ax + ra * 0.62, ay + ra * 0.62, ax + ra * 1.05, ay + ra * 1.12, 1.1)), COURO_ESCURO, { bisel: 0.8, contorno: 0.26, tom: 1.08, semente: 8403, projeta: { dist: 0.6, forca: 0.26 } }))
  L.push(P(naPegada(elipse(ax + ra * 0.72, ay + ra * 0.72, 1.3, 1.3)), LATAO, { bisel: 0.9, metal: 0.6, contorno: 0.24, semente: 8404 }))
  // As flechas encostadas na borda, em roda, cada uma com uma pena apontando para fora; duas no meio.
  for (let i = 0; i < FLECHAS_NA_RODA; i += 1) {
    const a = 0.3 + (i * 2 * Math.PI) / FLECHAS_NA_RODA
    flechaEmPe(P, L, naPegada, ax + Math.cos(a) * RAIO_DA_RODA, ay + Math.sin(a) * RAIO_DA_RODA, a, PENAS[i % PENAS.length], 8410 + i * 4)
  }
  flechaEmPe(P, L, naPegada, ax - 1.1, ay + 0.6, 1.2, PENAS[1], 8450)
  flechaEmPe(P, L, naPegada, ax + 1.4, ay - 1, 2.6, PENAS[0], 8455)
}
