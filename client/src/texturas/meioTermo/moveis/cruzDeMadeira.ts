/**
 * CRUZ DE MADEIRA (lote 8 dos objetos novos, 11/11/2026), EM PÉ, de frente
 * como a lápide e o espantalho: de cima ela seria um risco fino com um traço
 * atravessado, e ninguém diria o que é. É o marco de cova pobre do cemitério,
 * parente da lápide e da cova: duas TÁBUAS velhas e tortas, em T largo,
 * AMARRADAS com corda no cruzamento (a ponta do poste passa um pouco da
 * travessa, onde a amarra prende), o POSTE cravado num MONTINHO de terra com
 * PEDRAS no pé e dois tufos de capim seco. Pendurada no cruzamento por um
 * barbante curto, a COROA de flores secas cai na frente do poste (o aro de
 * ramos, as flores desbotadas, as folhas secas e um LAÇO de pano desbotado
 * embaixo, de pontas cortadas em V). Em T e sem símbolo de religião de verdade.
 *
 * O que a separa da lápide a 25% de zoom: a madeira no lugar da pedra, o T
 * de tábuas (a lápide é uma pedra cheia com a cruz gravada), a corda clara no
 * cruzamento, o aro da coroa em volta do poste e o monte de terra escura com
 * as pedras em volta do pé. A coroa fica no meio, e não na ponta de um braço:
 * pendurada na ponta, a cruz lia como forca.
 *
 * O desenho é feito na pegada de partida (0,6 casa) e escala com o menor lado
 * da pegada; como a lápide, ele passa da pegada para cima (o alto do poste,
 * 0,11 casa acima). A sombra no chão é a da cruz em pé: o poste arrastado do
 * pé ao alto e, soltas, a travessa e a coroa, cada uma na sua altura.
 * Material: `madeira` (as tábuas). A terra, as pedras, a corda, a coroa, o
 * laço e o capim são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { anel, caixa, capsula, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, TOM_DA_CORDA, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'

/** A pegada de partida, em que a cruz é desenhada (px do protótipo): 0,6 casa. */
const PEGADA = 0.6 * G

// As alturas do desenho, em y da pegada (0 no meio, para baixo cresce).
/** O chão na frente do monte, de onde as sombras saem. */
const CHAO = 14
/** O pé do poste (enterrado no monte) e o alto dele. */
const PE_DO_POSTE = 11
const ALTO_DO_POSTE = -23.2
/** O meio da travessa, um pouco abaixo do alto do poste (o T, com a ponta do poste presa na amarra). */
const MEIO_DA_TRAVESSA = -20
/** Meia largura do poste e meia altura da travessa. */
const MEIO_POSTE = 2.35
const MEIA_TRAVESSA = 2.05
/** As pontas da travessa, a partir do cruzamento, ao longo dela: o braço direito é um pouco mais comprido. */
const BRACO_ESQUERDO = 13
const BRACO_DIREITO = 13.6
/** As tábuas são tortas: o poste tomba para a esquerda e a travessa desce para a direita (radianos). */
const TOMBO_DO_POSTE = -0.075
const TOMBO_DA_TRAVESSA = 0.09

/** As tábuas: o veio fino de pé no poste e deitado na travessa; o racho e os nós, mais escuros. */
const TOM_DO_RACHO = 0.48
/** A terra revolvida do monte (a terra fresca da cova, um pouco mais clara) e os torrões. */
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: [0x63, 0x5a, 0x50] }
const TORRAO: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x4d, 0x45] }
/** As pedras do pé: granito claro de beira de estrada. */
const PEDRA: MaterialDaPeca = { classe: 'pedra', rgb: [0x9e, 0x99, 0x90], pedra: 'granito' }
/** O capim seco do pé do monte. */
const CAPIM_SECO: MaterialDaPeca = { classe: 'liso', rgb: [0xa6, 0x93, 0x63] }
/** A corda da amarra e o barbante da coroa. */
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }
const BARBANTE: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0xa9, 0x83] }
/** A coroa: o ramo seco trançado, as folhas secas e as flores desbotadas (rosa velho, ocre, creme e lilás apagado). */
const RAMO: MaterialDaPeca = { classe: 'casca', rgb: [0x76, 0x60, 0x4a], casca: 'fendida' }
const FOLHA_SECA: MaterialDaPeca = { classe: 'liso', rgb: [0x80, 0x7a, 0x55] }
const MIOLO_DA_FLOR: MaterialDaPeca = { classe: 'liso', rgb: [0x7a, 0x62, 0x3e] }
const FLORES: readonly Rgb[] = [
  [0xb3, 0x80, 0x7a],
  [0xc2, 0x9e, 0x62],
  [0xd6, 0xcb, 0xb0],
  [0x95, 0x86, 0x98],
  [0xb8, 0x88, 0x84],
]
/** O laço da coroa: pano que foi vinho, desbotado pelo sol. */
const PANO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xa8, 0x86, 0x80] }
/**
 * O escuro em que o pixel escuro demais é levantado: um cinza-pardo, para a
 * beira da terra não sair laranja. Luminância linear 0,051, acima do piso de
 * luz (0,045); o de antes, 0x3d3935, ficava abaixo dele.
 */
const ESCURO_DA_TERRA: Rgb = [0x44, 0x3f, 0x3a]

/** Torrões miúdos da terra: o lado da célula (px) e quanto de luz cada uma ganha ou perde. */
const LADO_DO_TORRAO = 1.4
const LUZ_DO_TORRAO = 0.12

/** A terra solta do monte: torrões miúdos (cada célula com a sua luz) e manchas largas mais úmidas. */
const texDaTerra: Textura = (_u, _v, x, y, _p, s) => {
  const torrao = hash(Math.floor(x / LADO_DO_TORRAO), Math.floor(y / LADO_DO_TORRAO), 5113) - 0.5
  s[3] += torrao * LUZ_DO_TORRAO + ruido(x * 0.16 + 31, y * 0.16 + 7) * 0.14
}

/** Põe na cena uma peça desenhada na pegada de partida (quem chama a leva para o tamanho da pegada). */
type Por = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaPeca) => void

const SEM_BORDA: OpcoesDaPeca = { bisel: 0, contorno: 0 }

/** A forma girada `ang` radianos em volta de (cx, cy): as tábuas tortas. */
function girada(f: Forma, cx: number, cy: number, ang: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const [x0, y0, x1, y1] = f.b
  const cantos: readonly Ponto[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const xs = cantos.map(([x, y]) => cx + (x - cx) * co - (y - cy) * si)
  const ys = cantos.map(([x, y]) => cy + (x - cx) * si + (y - cy) * co)
  return {
    b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    d: (x, y) => f.d(cx + (x - cx) * co + (y - cy) * si, cy - (x - cx) * si + (y - cy) * co),
  }
}

/** O ponto (x, y) girado `ang` radianos em volta de (cx, cy). */
function girarPonto(x: number, y: number, cx: number, cy: number, ang: number): Ponto {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co]
}

/** Um tufo de capim de `largura` x `alto` com o pé em (x, y): folhas em zigue-zague, de alturas desiguais (o da lápide). */
function tufo(x: number, y: number, largura: number, alto: number, inclina: number): Forma {
  const m = largura / 2
  return poligono([
    [x - m, y + 0.6],
    [x - m * 0.85 + inclina, y - alto * 0.7],
    [x - m * 0.35, y - alto * 0.2],
    [x + inclina * 0.6, y - alto],
    [x + m * 0.3, y - alto * 0.25],
    [x + m * 0.9 + inclina, y - alto * 0.62],
    [x + m, y + 0.6],
  ])
}

// ---------- o monte e as pedras ----------

/** O monte de terra: o alto em domo e a beira de baixo, torta, onde ele encontra o chão. */
const MONTE: readonly Ponto[] = [
  [-13.9, 14.6],
  [-12.8, 12.3],
  [-9.7, 10.3],
  [-5.4, 9],
  [-0.7, 8.5],
  [4.3, 8.8],
  [9.1, 10],
  [12.7, 12],
  [14.2, 14.3],
  [11.6, 15.7],
  [6.2, 16.3],
  [-0.4, 16.5],
  [-6.8, 16.2],
  [-11.8, 15.7],
]
/** Os torrões em cima do monte: o meio, os dois raios e o ângulo. */
const TORROES: readonly (readonly [number, number, number, number, number])[] = [
  [-6.6, 12.2, 1.6, 1, 0.3],
  [5.8, 12.6, 1.4, 0.9, -0.25],
  [-2.6, 14.6, 1.2, 0.8, 0.1],
  [2.4, 10.6, 1.1, 0.7, -0.4],
]
/** As pedras em volta do pé do monte: o meio, os dois raios e o ângulo. */
const PEDRAS: readonly (readonly [number, number, number, number, number])[] = [
  [-12.5, 14, 2.5, 1.8, 0.25],
  [-7.3, 15.8, 1.9, 1.35, -0.2],
  [4.8, 16, 2.2, 1.45, 0.15],
  [11.1, 14.6, 2.5, 1.75, -0.35],
  [14.4, 12.6, 1.5, 1.15, 0.45],
]

function montarMonte(por: Por): void {
  por(poligono(MONTE), TERRA, { bisel: 2.6, contorno: 0.22, textura: texDaTerra, semente: 801 })
  TORROES.forEach(([x, y, rx, ry, ang], i) => {
    por(elipseGirada(x, y, rx, ry, ang), TORRAO, { bisel: 0.8, tom: 0.96 + 0.16 * hash(i, 3, 811), contorno: 0.24, semente: 802 + i })
  })
}

function montarPedras(por: Por): void {
  PEDRAS.forEach(([x, y, rx, ry, ang], i) => {
    por(elipseGirada(x, y, rx, ry, ang), PEDRA, { bisel: Math.min(rx, ry) * 0.75, tom: 0.9 + 0.16 * hash(i, 4, 812), contorno: 0.3, semente: 820 + i })
  })
  por(tufo(-14.8, 14.6, 3.6, 4.2, -0.6), CAPIM_SECO, { bisel: 0.7, contorno: 0.24, tom: 0.92, semente: 830 })
  por(tufo(8.3, 16.4, 3.2, 3.4, 0.5), CAPIM_SECO, { bisel: 0.7, contorno: 0.24, tom: 1.04, semente: 831 })
}

// ---------- as tábuas e a amarra ----------

/** O pé do poste, em volta de onde ele tomba. */
const PE: Ponto = [0.3, PE_DO_POSTE]
/** O cruzamento: o ponto do eixo do poste na altura da travessa, já tombado. */
const CRUZAMENTO = girarPonto(PE[0], MEIO_DA_TRAVESSA, PE[0], PE[1], TOMBO_DO_POSTE)

/** Um ponto da travessa: `u` ao longo dela a partir do cruzamento, `v` atravessado (para baixo cresce). */
function naTravessa(u: number, v: number): Ponto {
  return girarPonto(CRUZAMENTO[0] + u, CRUZAMENTO[1] + v, CRUZAMENTO[0], CRUZAMENTO[1], TOMBO_DA_TRAVESSA)
}

function montarPoste(por: Por, mad: MaterialDaPeca): void {
  const [px, py] = PE
  // A tábua de pé com a quina de cima à direita lascada; o racho ao comprido e um nó.
  const tabua = poligono([
    [px - MEIO_POSTE, ALTO_DO_POSTE + 0.4],
    [px + MEIO_POSTE - 1.2, ALTO_DO_POSTE],
    [px + MEIO_POSTE, ALTO_DO_POSTE + 1.3],
    [px + MEIO_POSTE, py],
    [px - MEIO_POSTE, py],
  ])
  const torto = (f: Forma): Forma => girada(f, px, py, TOMBO_DO_POSTE)
  por(torto(tabua), mad, { eixo: QUARTO + TOMBO_DO_POSTE, tabua: 0, bisel: 1.1, contorno: 0.28, semente: 840, projeta: { dist: 0.9, forca: 0.24 } })
  // O racho e o nó ficam abaixo da coroa, onde o poste aparece.
  por(torto(capsula(px + 0.8, -2.4, px + 1.05, 6.4, 0.26)), mad, { ...SEM_BORDA, tom: TOM_DO_RACHO, semente: 841 })
  por(torto(elipse(px - 0.8, 1.6, 0.85, 0.6)), mad, { bisel: 0.4, contorno: 0.2, tom: 0.62, semente: 842 })
}

function montarTravessa(por: Por, mad: MaterialDaPeca): void {
  const [cx, cy] = CRUZAMENTO
  // A tábua deitada, de pontas desiguais: a esquerda cortada em viés, a direita com um lasco embaixo.
  const tabua = poligono([
    [cx - BRACO_ESQUERDO + 0.9, cy - MEIA_TRAVESSA],
    [cx + BRACO_DIREITO, cy - MEIA_TRAVESSA],
    [cx + BRACO_DIREITO, cy + MEIA_TRAVESSA - 1],
    [cx + BRACO_DIREITO - 1.3, cy + MEIA_TRAVESSA],
    [cx - BRACO_ESQUERDO, cy + MEIA_TRAVESSA],
  ])
  por(girada(tabua, cx, cy, TOMBO_DA_TRAVESSA), mad, { eixo: TOMBO_DA_TRAVESSA, tabua: 0, bisel: 1, contorno: 0.28, tom: 1.06, semente: 845, projeta: { dist: 1, forca: 0.26 } })
  // Um prego enferrujado em cada braço, perto da ponta.
  for (const u of [-BRACO_ESQUERDO + 2.2, BRACO_DIREITO - 2.4]) {
    const [x, y] = naTravessa(u, -0.2)
    por(elipse(x, y, 0.55, 0.55), { classe: 'metal', rgb: [0x6e, 0x58, 0x4a] }, { bisel: 0.4, contorno: 0.3, metal: 0.18, semente: 846 })
  }
}

/** A amarra no cruzamento: as voltas em X por cima das duas tábuas e a ponta da corda caída. */
function montarAmarra(por: Por): void {
  const meia = MEIO_POSTE + 0.9
  for (const lado of [-1, 1]) {
    const [ax, ay] = naTravessa(-lado * meia, -MEIA_TRAVESSA - 0.7)
    const [bx, by] = naTravessa(lado * meia, MEIA_TRAVESSA + 0.7)
    por(capsula(ax, ay, bx, by, 0.62), CORDA, { bisel: 0.6, contorno: 0.26, semente: 850 + lado })
  }
  // As duas voltas retas, de cada lado do X.
  for (const u of [-meia - 0.2, meia + 0.2]) {
    const [ax, ay] = naTravessa(u, -MEIA_TRAVESSA - 0.5)
    const [bx, by] = naTravessa(u, MEIA_TRAVESSA + 0.5)
    por(capsula(ax, ay, bx, by, 0.55), CORDA, { bisel: 0.5, tom: 0.94, contorno: 0.26, semente: 853 })
  }
  // A ponta que sobrou, caída do nó.
  const [nx, ny] = naTravessa(meia - 0.4, MEIA_TRAVESSA + 0.6)
  por(poligono([[nx - 0.5, ny], [nx + 0.6, ny], [nx + 1.5, ny + 3.4], [nx + 0.5, ny + 3.6]]), CORDA, { bisel: 0.4, tom: 0.9, contorno: 0.26, semente: 854 })
}

// ---------- a coroa e o laço ----------

/** Onde o barbante da coroa sai da travessa (ao longo dela: no cruzamento), o comprimento dele e os raios do aro. */
const PONTO_DA_COROA = 0
const BARBANTE_DA_COROA = 1.4
const RAIO_DA_COROA = 5
const FURO_DA_COROA = 3
/** As flores na volta do aro (radianos; embaixo fica o laço) e as folhas secas entre elas. */
const ANGULOS_DAS_FLORES: readonly number[] = [-2.35, -0.8, 0.42, 2.72]
const ANGULOS_DAS_FOLHAS: readonly number[] = [-1.55, -0.1, 1.05, 2.1, 3.1]
/** O laço embaixo do aro: o comprimento das pontas e para onde cada uma cai (radianos). */
const PONTA_DO_LACO = 3.4
const QUEDAS_DO_LACO: readonly number[] = [2.02, 1.12]
/** Uma flor: cinco pétalas em volta do miolo. */
const PETALAS = 5

function flor(cx: number, cy: number, r: number, giro: number): Forma {
  let f: Forma = elipse(cx, cy, r * 0.55, r * 0.55)
  for (let k = 0; k < PETALAS; k += 1) {
    const a = giro + (k * 2 * Math.PI) / PETALAS
    f = uniao(f, elipse(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.48, r * 0.48))
  }
  return f
}

/** O meio do aro da coroa: a prumo do barbante, por mais torta que esteja a travessa. */
function meioDaCoroa(): Ponto {
  const [ox, oy] = naTravessa(PONTO_DA_COROA, MEIA_TRAVESSA - 0.3)
  return [ox + 0.2, oy + BARBANTE_DA_COROA + RAIO_DA_COROA]
}

function montarCoroa(por: Por): void {
  const [ox, oy] = naTravessa(PONTO_DA_COROA, MEIA_TRAVESSA - 0.3)
  const [cx, cy] = meioDaCoroa()
  por(capsula(ox, oy - 0.4, cx, cy - RAIO_DA_COROA + 0.6, 0.34), BARBANTE, { bisel: 0.2, contorno: 0.24, semente: 860 })
  const raioDoMeio = (RAIO_DA_COROA + FURO_DA_COROA) / 2
  por(anel(cx, cy, RAIO_DA_COROA, RAIO_DA_COROA, FURO_DA_COROA, FURO_DA_COROA), RAMO, {
    arco: { cx, cy, r: raioDoMeio, a0: 0 },
    bisel: 1,
    contorno: 0.28,
    semente: 861,
    projeta: { dist: 0.7, forca: 0.22 },
  })
  // Dois gravetos escapando do trançado.
  for (const [a, comp] of [[-0.55, 2.4], [2.2, 2]] as const) {
    const x = cx + Math.cos(a) * RAIO_DA_COROA * 0.9
    const y = cy + Math.sin(a) * RAIO_DA_COROA * 0.9
    por(capsula(x, y, x - Math.sin(a) * comp, y + Math.cos(a) * comp, 0.3), RAMO, { bisel: 0.2, tom: 0.9, contorno: 0.24, semente: 862 })
  }
  ANGULOS_DAS_FOLHAS.forEach((a, i) => {
    const x = cx + Math.cos(a) * raioDoMeio
    const y = cy + Math.sin(a) * raioDoMeio
    por(elipseGirada(x, y, 1.4, 0.62, a + QUARTO + 0.3), FOLHA_SECA, { bisel: 0.4, tom: 0.9 + 0.2 * hash(i, 6, 813), contorno: 0.26, semente: 870 + i })
  })
  ANGULOS_DAS_FLORES.forEach((a, i) => {
    const x = cx + Math.cos(a) * raioDoMeio
    const y = cy + Math.sin(a) * raioDoMeio
    const r = 1.3 + 0.32 * hash(i, 7, 814)
    por(flor(x, y, r, a), { classe: 'liso', rgb: FLORES[i % FLORES.length] }, { bisel: 0.6, contorno: 0.26, semente: 880 + i, projeta: { dist: 0.5, forca: 0.2 } })
    por(elipse(x, y, r * 0.3, r * 0.3), MIOLO_DA_FLOR, { bisel: 0.2, contorno: 0.1, semente: 890 + i })
  })
}

/** Uma ponta do laço saindo de (x, y) para `ang`: a fita afinando um pouco, cortada em V na ponta. */
function pontaDoLaco(x: number, y: number, ang: number): Forma {
  const fx = Math.cos(ang)
  const fy = Math.sin(ang)
  const em = (frente: number, lado: number): Ponto => [x + fx * frente - fy * lado, y + fy * frente + fx * lado]
  return poligono([em(0, -0.5), em(PONTA_DO_LACO, -0.62), em(PONTA_DO_LACO - 0.75, 0), em(PONTA_DO_LACO, 0.62), em(0, 0.5)])
}

/** O laço de pano embaixo do aro: as duas pontas caídas, as duas alças e o nó. */
function montarLaco(por: Por): void {
  const [cx, cy] = meioDaCoroa()
  const bx = cx
  const by = cy + (RAIO_DA_COROA + FURO_DA_COROA) / 2 + 0.3
  QUEDAS_DO_LACO.forEach((ang, i) => {
    por(pontaDoLaco(bx, by, ang), PANO, { bisel: 0.5, ruga: 0.5, tom: 0.92 + 0.08 * i, contorno: 0.26, semente: 900 + i })
  })
  for (const lado of [-1, 1]) {
    por(elipseGirada(bx + lado * 1.45, by - 0.25, 1.55, 0.85, lado * 0.38), PANO, { bisel: 0.7, ruga: 0.5, tom: lado < 0 ? 1.04 : 0.96, contorno: 0.28, semente: 903 + lado, projeta: { dist: 0.5, forca: 0.18 } })
  }
  por(elipse(bx, by, 0.75, 0.65), PANO, { bisel: 0.5, tom: 0.88, contorno: 0.28, semente: 906 })
}

export const montarCruzDeMadeira: MontarMovel = (c, cena) => {
  const e = Math.min(c.w, c.h) / PEGADA
  /** A forma desenhada na pegada de partida, no tamanho da pegada. */
  const naPegada = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const por: Por = (forma, mat, o) => {
    cena.partes.push(c.peca(naPegada(forma), mat, o))
  }
  cena.corDoPiso = ESCURO_DA_TERRA

  // A sombra da cruz em pé: o monte rente, o poste arrastado do chão ao alto e, soltas, a travessa e a coroa.
  const [cx, cy] = CRUZAMENTO
  const alturaDaTravessa = (CHAO - cy) * e
  cena.sombras.push(contato(naPegada(poligono(MONTE)), 0.3))
  cena.sombras.push({ forma: naPegada(caixa(-13.2, CHAO + 0.6, 13.9, CHAO + 2.2, 1)), z: 4.4 * e, forca: 0.22 })
  cena.sombras.push({ forma: naPegada(caixa(PE[0] - MEIO_POSTE, CHAO - 1, PE[0] + MEIO_POSTE, CHAO + 0.8, 0.6)), z: (CHAO - ALTO_DO_POSTE) * e, forca: 0.3 })
  cena.sombras.push({ forma: naPegada(caixa(cx - BRACO_ESQUERDO, CHAO - 0.8, cx + BRACO_DIREITO, CHAO + 0.8, 0.8)), z: alturaDaTravessa, solta: true, forca: 0.27 })
  const [ax, ay] = meioDaCoroa()
  cena.sombras.push({ forma: naPegada(elipse(ax, CHAO, RAIO_DA_COROA, 1.4)), z: (CHAO - ay) * e, solta: true, forca: 0.2 })

  const mad = c.m.madeira
  montarMonte(por)
  montarPoste(por, mad)
  // Os torrões que sobem na frente do pé do poste, por cima dele.
  por(elipseGirada(PE[0] - 1.6, PE_DO_POSTE + 0.4, 1.7, 0.95, 0.15), TORRAO, { bisel: 0.8, tom: 1.08, contorno: 0.24, semente: 806 })
  por(elipseGirada(PE[0] + 1.8, PE_DO_POSTE + 0.7, 1.5, 0.85, -0.2), TERRA, { bisel: 0.8, tom: 1.12, contorno: 0.24, semente: 807 })
  montarPedras(por)
  montarTravessa(por, mad)
  montarAmarra(por)
  montarCoroa(por)
  montarLaco(por)
}
