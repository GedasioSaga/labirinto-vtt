/**
 * CAIXOTE DE PEIXE de cima com volume (lote 12 dos objetos novos, 11/11/2026;
 * a campanha é de piratas): o caixote raso de ripas do pescador, cheio da
 * pescaria da manhã. Duas FILEIRAS de cavalinhas arrumadas lado a lado, com a
 * cabeça na parede e o rabo para o meio, todas mostrando o mesmo flanco (o
 * lombo escuro listrado ao lado da barriga de prata faz o ritmo das fileiras),
 * deitadas em SAL GROSSO e ALGAS; ATRAVESSADO por cima delas, o PARGO grande,
 * vermelho-coral, com a crista de espinhos do lombo; no canto de cima, um
 * CARANGUEJO agarrado perto da cabeça do pargo; na borda de baixo, a FACA DE
 * ESCAMAR. As paredes são tábuas presas nos pilaretes dos cantos, e as das
 * pontas têm a pega cavada.
 *
 * Não se confunde com o barril de peixe: lá é a roda de sardinhas na boca
 * redonda; aqui é a caixa retangular e rasa, com os peixes em fileiras e o
 * pargo vermelho no meio, que é o que se lê a 25% de zoom.
 *
 * Na 3/4 (perfil derivado) só o caixote tem sombra com altura: ele vira a
 * coluna, e o que está dentro (peixes, sal, algas, caranguejo, faca) sobe com
 * ele, porque o meio da caixa de cada peça cai dentro dele. O FUNDO de madeira,
 * do tamanho do caixote, fica escondido debaixo de tudo: é a maior peça, então
 * a frente que a 3/4 varre sai de madeira.
 *
 * Material: `madeira` (o caixote). Os peixes, o caranguejo, o sal, as algas e
 * a faca são fixos. O caixote ocupa a pegada (1 x 0,7 casa de partida); o que
 * vai dentro tem o tamanho do lado que limita (`k`), e o número de peixes de
 * cada fileira sai da largura de dentro.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, elipse, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type CriarPeca, type MaterialDaPeca, type Peca, type Projecao, type Textura } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'

const VOLTA = Math.PI * 2
/** A pegada de partida (1 x 0,7 casa): `k` é a escala do que vai dentro. */
const ALTURA_DE_PARTIDA = 0.7
/** A altura do caixote (casas): raso, a borda bate no meio da canela. */
const ALTURA_DO_CAIXOTE = 0.2
/** Abaixo desta escala (pixels da imagem por px do protótipo) o detalhe miúdo cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_DETALHE = 1.5

function limitar01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

function misturarEm(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

// ---------- o peixe (o do barril de peixe, com a espécie) ----------

/** As cores e o passo das escamas de uma espécie (px do protótipo, na escala de partida). */
interface Especie {
  readonly flanco: Rgb
  readonly lombo: Rgb
  readonly barriga: Rgb
  readonly rabo: Rgb
  readonly iris: Rgb
  /** As barras tortas do lombo (a cavalinha); null = sem barras. */
  readonly listras: Rgb | null
  readonly escama: number
}

/** A cavalinha: o lombo verde-escuro de barras pretas e a barriga de prata. */
const CAVALINHA: Especie = {
  flanco: [0x9e, 0xae, 0xac],
  lombo: [0x3e, 0x58, 0x5c],
  barriga: [0xe2, 0xe4, 0xdc],
  rabo: [0x6a, 0x7a, 0x7c],
  iris: [0xd6, 0xd8, 0xcc],
  listras: [0x22, 0x2c, 0x2e],
  escama: 1.05,
}
/** O pargo: o coral contido, o lombo vinho, a barriga rosada e o olho dourado; escamas graúdas. */
const PARGO: Especie = {
  flanco: [0xc4, 0x7e, 0x6a],
  lombo: [0x9c, 0x4c, 0x46],
  barriga: [0xea, 0xcc, 0xbc],
  rabo: [0xa8, 0x62, 0x56],
  iris: [0xc8, 0xa0, 0x70],
  listras: null,
  escama: 1.9,
}
const PUPILA: MaterialDaPeca = { classe: 'liso', rgb: [0x2a, 0x28, 0x26] }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xee, 0xf2, 0xee] }
const GUELRA: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x46, 0x4a] }
/** A barbatana do pargo: o vinho do lombo, meio transparente. */
const BARBATANA: MaterialDaPeca = { classe: 'liso', rgb: [0xa0, 0x56, 0x4c] }

/** O contorno do corpo, do pedúnculo do rabo à boca: [ao comprido, meia largura], em frações do comprimento e da largura. */
const CORPO_DO_PEIXE: readonly Ponto[] = [
  [-0.36, 0.12],
  [-0.2, 0.32],
  [0, 0.46],
  [0.15, 0.5],
  [0.32, 0.42],
  [0.44, 0.24],
  [0.5, 0.04],
]
/** O rabo em V, do pedúnculo para trás. */
const RABO_DO_PEIXE: readonly Ponto[] = [
  [-0.34, 0.08],
  [-0.52, 0.46],
  [-0.47, 0],
  [-0.52, -0.46],
  [-0.34, -0.08],
]
const LUGAR_DO_OLHO = 0.36
const LUGAR_DA_GUELRA = 0.27
/** O olho (fração da largura). O do barril (0,26), com as cabeças em fila na parede, virava uma fileira de olhos de boneco. */
const RAIO_DO_OLHO = 0.19
/** O pargo é mais largo para o tamanho: o olho dele é menor em proporção. */
const OLHO_DO_PARGO = 0.78
const FILEIRAS_DE_ESCAMAS = 3.2
/** O passo das barras da cavalinha ao comprido (px do protótipo). */
const PASSO_DA_LISTRA = 2.3
/** A 1x as barras viram chuvisco: o lombo só escurece este tanto para o lado delas. */
const LISTRA_MIUDA = 0.3

/** A meia largura do corpo (fração da largura) no ponto `ao` do comprido. */
function meiaDoCorpo(ao: number): number {
  if (ao <= CORPO_DO_PEIXE[0][0]) return CORPO_DO_PEIXE[0][1]
  for (let i = 1; i < CORPO_DO_PEIXE.length; i += 1) {
    const [a1, m1] = CORPO_DO_PEIXE[i]
    if (ao > a1) continue
    const [a0, m0] = CORPO_DO_PEIXE[i - 1]
    return m0 + ((m1 - m0) * (ao - a0)) / (a1 - a0)
  }
  return CORPO_DO_PEIXE[CORPO_DO_PEIXE.length - 1][1]
}

/** O flanco do peixe deitado: o lombo do lado `lado`, a barriga do outro, as barras (se houver), a linha do meio e as escamas. */
function texDoPeixe(cx: number, cy: number, ang: number, meia: number, lado: number, especie: Especie, k: number): Textura {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const passoDaEscama = especie.escama * k
  const passoDaListra = PASSO_DA_LISTRA * k
  return (_u, _v, x, y, _p, s, escala) => {
    const ao = (x - cx) * co + (y - cy) * si
    const atraves = ((-(x - cx) * si + (y - cy) * co) / meia) * lado
    misturarEm(s, especie.lombo, limitar01((atraves - 0.12) / 0.62) * 0.88)
    misturarEm(s, especie.barriga, limitar01((-atraves - 0.22) / 0.55) * 0.75)
    const miudo = escala < ESCALA_DO_DETALHE
    if (especie.listras !== null) {
      // As barras tortas da cavalinha, só no lombo; a 1x o lombo só escurece para o lado delas.
      const noLombo = limitar01((atraves - 0.08) / 0.3)
      const onda = Math.sin((ao / passoDaListra + Math.sin(atraves * 4.2) * 0.35) * VOLTA)
      misturarEm(s, especie.listras, (miudo ? LISTRA_MIUDA : limitar01((onda - 0.25) / 0.5) * 0.75) * noLombo)
    }
    if (miudo) return
    const linha = Math.abs(atraves - 0.06)
    if (linha < 0.07) s[3] -= 0.1 * (1 - linha / 0.07)
    const fileira = Math.floor((atraves + 1) * FILEIRAS_DE_ESCAMAS)
    const fase = ao / passoDaEscama + (fileira & 1) * 0.5
    const f = fase - Math.floor(fase)
    if (f < 0.24) s[3] -= 0.09 * (1 - f / 0.24)
  }
}

interface Peixe {
  /** O meio do peixe, o giro (a cabeça para o lado do giro), o comprimento e a largura (px da cena). */
  readonly x: number
  readonly y: number
  readonly ang: number
  readonly comprimento: number
  readonly largura: number
  /** De que lado fica o lombo (1 ou -1). */
  readonly lado: number
}

/** O ponto [ao comprido, de través] do peixe (frações), na cena. */
function noPeixe(f: Peixe): (q: Ponto) => Ponto {
  const co = Math.cos(f.ang)
  const si = Math.sin(f.ang)
  return ([ao, atraves]) => {
    const a = ao * f.comprimento
    const t = atraves * f.largura * f.lado
    return [f.x + a * co - t * si, f.y + a * si + t * co]
  }
}

/** Um peixe inteiro: o rabo, o corpo de escamas, a guelra e o olho com o ponto de luz. */
function montarPeixe(P: CriarPeca, L: Peca[], f: Peixe, especie: Especie, k: number, sem: number): void {
  const em = noPeixe(f)
  const projeta: Projecao = { dist: 0.9 * k, forca: 0.32, suave: 0.7 }
  L.push(P(poligono(RABO_DO_PEIXE.map(em)), { classe: 'liso', rgb: especie.rabo }, { bisel: 0.4 * k, contorno: 0.28, semente: sem, projeta }))
  const contorno = [...CORPO_DO_PEIXE.map(em), ...[...CORPO_DO_PEIXE].reverse().map(([ao, t]) => em([ao, -t]))]
  L.push(P(poligono(contorno), { classe: 'liso', rgb: especie.flanco }, {
    bisel: f.largura * 0.42,
    contorno: 0.3,
    metal: 0.32,
    textura: texDoPeixe(f.x, f.y, f.ang, f.largura * 0.5, f.lado, especie, k),
    semente: sem + 1,
    projeta,
  }))
  const [gx, gy] = em([LUGAR_DA_GUELRA, 0])
  L.push(P(elipseGirada(gx, gy, f.largura * 0.08, f.largura * 0.4, f.ang), GUELRA, { bisel: 0, contorno: 0, alfa: 0.55, semente: sem + 2 }))
  const [ox, oy] = em([LUGAR_DO_OLHO, 0.1])
  const raio = f.largura * RAIO_DO_OLHO * (especie === PARGO ? OLHO_DO_PARGO : 1)
  L.push(P(elipse(ox, oy, raio, raio), { classe: 'liso', rgb: especie.iris }, { bisel: 0.2, contorno: 0.12, semente: sem + 3 }))
  L.push(P(elipse(ox, oy, raio * 0.6, raio * 0.6), PUPILA, { bisel: 0, contorno: 0 }))
  L.push(P(elipse(ox - raio * 0.25, oy - raio * 0.25, raio * 0.22, raio * 0.22), BRILHO, { bisel: 0, contorno: 0 }))
}

/** Os espinhos da crista do pargo: de onde a onde vão ao comprido, quantos, e o quanto passam do lombo (fração da largura). */
const CRISTA_DE = -0.22
const CRISTA_ATE = 0.3
const ESPINHOS = 8
const ALTURA_DO_ESPINHO = 0.17

/** O pargo: a crista de espinhos do lombo e a barbatana de baixo (por baixo do corpo), o peixe e a barbatana do peito. */
function montarPargo(P: CriarPeca, L: Peca[], f: Peixe, k: number): void {
  const em = noPeixe(f)
  // A pele da crista, meio transparente, e os espinhos por cima dela; o corpo cobre o pé dos dois.
  const pele: Ponto[] = []
  const PASSOS = 10
  for (let i = 0; i <= PASSOS; i += 1) pele.push(em([CRISTA_DE + ((CRISTA_ATE - CRISTA_DE) * i) / PASSOS, meiaDoCorpo(CRISTA_DE + ((CRISTA_ATE - CRISTA_DE) * i) / PASSOS) + 0.1]))
  for (let i = PASSOS; i >= 0; i -= 1) pele.push(em([CRISTA_DE + ((CRISTA_ATE - CRISTA_DE) * i) / PASSOS, meiaDoCorpo(CRISTA_DE + ((CRISTA_ATE - CRISTA_DE) * i) / PASSOS) * 0.8]))
  L.push(P(poligono(pele), BARBATANA, { bisel: 0, contorno: 0.16, alfa: 0.55, semente: 7790 }))
  for (let i = 0; i < ESPINHOS; i += 1) {
    const ao = CRISTA_DE + ((CRISTA_ATE - CRISTA_DE) * (i + 0.5)) / ESPINHOS
    const m = meiaDoCorpo(ao)
    L.push(P(poligono([em([ao - 0.022, m * 0.8]), em([ao + 0.022, m * 0.8]), em([ao - 0.012, m + ALTURA_DO_ESPINHO])]), BARBATANA, { bisel: 0.2, tom: 0.92, contorno: 0.24, semente: 7791 + i }))
  }
  // A barbatana de baixo, perto do rabo, do lado da barriga.
  L.push(P(poligono([em([-0.3, -0.16]), em([-0.27, -0.38]), em([-0.2, -0.47]), em([-0.12, -0.4]), em([-0.1, -0.3])]), BARBATANA, { bisel: 0, contorno: 0.16, alfa: 0.6, semente: 7800 }))
  montarPeixe(P, L, f, PARGO, k, 7801)
  // A barbatana do peito, logo atrás da guelra, deitada para o rabo e para a barriga: estreita e mais escura que
  // o flanco (clara e larga, lia mancha no meio do peixe).
  const [bx, by] = em([0.22, -0.06])
  const [px, py] = em([0.03, -0.27])
  L.push(P(elipseGirada((bx + px) / 2, (by + py) / 2, Math.hypot(px - bx, py - by) / 2, 0.024 * f.comprimento, Math.atan2(py - by, px - bx)), BARBATANA, { bisel: 0.3, tom: 0.86, contorno: 0.18, alfa: 0.55, semente: 7806 }))
}

// ---------- o leito: o sal grosso e as algas ----------

/** O sal grosso do leito (cinza-claro de pedra) e os cristais soltos por cima dos peixes. */
const SAL_DO_LEITO: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0xc6, 0xbe] }
const CRISTAL: MaterialDaPeca = { classe: 'liso', rgb: [0xf2, 0xf0, 0xe8] }
const CRISTAIS = 30
const texDoSal: Textura = (_u, _v, x, y, p, s, escala) => {
  const grao = ruido(x * 1.4 + p.su, y * 1.4 + p.sv) + ruido(x * 0.5 + p.sv, y * 0.5) * 0.5
  s[3] += grao * (escala < ESCALA_DO_DETALHE ? 0.08 : 0.2)
}
/** As algas: a do fundo, a do meio e a clara, que fica por cima dos peixes, na luz (oliva, puxando para o pardo da bodelha). */
const ALGA: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x66, 0x3e] }
const ALGA_ESCURA: MaterialDaPeca = { classe: 'liso', rgb: [0x48, 0x52, 0x34] }
const ALGA_CLARA: MaterialDaPeca = { classe: 'liso', rgb: [0x7a, 0x78, 0x48] }
/** Pedaços de cada lâmina de alga e o quanto a beira franze (fração da meia largura). */
const PASSOS_DA_ALGA = 16
const FRANZIDO = 0.22

/**
 * A lâmina de alga de `a` a `b`: larga no meio, em ponta nas duas pontas, com a beira franzida em `frisos`
 * ondas e um arco de `curva` px para o lado. Lâmina e não fita: a fita de largura igual e ponta redonda lia
 * minhoca em cima dos peixes.
 */
function laminaDeAlga(a: Ponto, b: Ponto, curva: number, largura: number, frisos: number): Forma {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  const nx = -dy / l
  const ny = dx / l
  const ida: Ponto[] = []
  const volta: Ponto[] = []
  for (let i = 0; i <= PASSOS_DA_ALGA; i += 1) {
    const t = i / PASSOS_DA_ALGA
    const arco = Math.sin(t * Math.PI) * curva
    const meia = largura * Math.pow(Math.sin(t * Math.PI), 0.7) * (1 + FRANZIDO * Math.sin(t * frisos * VOLTA))
    const x = a[0] + dx * t + nx * arco
    const y = a[1] + dy * t + ny * arco
    ida.push([x + nx * meia, y + ny * meia])
    // As duas pontas entram uma vez só (meia largura zero nelas).
    if (i > 0 && i < PASSOS_DA_ALGA) volta.push([x - nx * meia, y - ny * meia])
  }
  return poligono([...ida, ...volta.reverse()])
}

// ---------- o caranguejo ----------

const CASCO: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x5e, 0x48] }
const PERNA: MaterialDaPeca = { classe: 'liso', rgb: [0x88, 0x50, 0x3e] }
const PONTA_DA_PINCA: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x2e, 0x2a] }
const texDoCasco: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.9 + p.su, y * 0.9 + p.sv) * 0.12
}

/** O caranguejo de meio (cx, cy), virado para `ang`: as quatro pernas de cada lado, as pinças e o casco por cima. */
function montarCaranguejo(P: CriarPeca, L: Peca[], cx: number, cy: number, ang: number, k: number): void {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  /** [para a frente, para o lado], em px do protótipo da escala de partida. */
  const em = ([f, l]: Ponto): Ponto => [cx + (f * co - l * si) * k, cy + (f * si + l * co) * k]
  const fina = 0.55 * k
  const projeta: Projecao = { dist: 0.6 * k, forca: 0.3 }
  for (const lado of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) {
      const f0 = 0.9 - i * 1.15
      const joelho: Ponto = [f0 - 0.4 - i * 0.35, lado * 5.6]
      const pe: Ponto = [f0 - 1.6 - i * 0.6, lado * (6.6 + i * 0.25)]
      L.push(P(cadeia([em([f0, lado * 2.6]), em(joelho), em(pe)], fina), PERNA, { bisel: fina, contorno: 0.28, semente: 7820 + i + (lado > 0 ? 4 : 0), projeta }))
    }
    // O braço da pinça sai da frente do casco; a pinça vira para dentro, com as pontas escuras.
    L.push(P(cadeia([em([2.4, lado * 2.6]), em([4.6, lado * 4])], 0.75 * k), PERNA, { bisel: 0.7 * k, contorno: 0.28, semente: 7830 + lado, projeta }))
    const [px, py] = em([6.4, lado * 3])
    const angDaPinca = ang - lado * 0.45
    L.push(P(elipseGirada(px, py, 2.3 * k, 1.35 * k, angDaPinca), CASCO, { bisel: 1.1 * k, tom: 1.06, contorno: 0.3, semente: 7832 + lado, projeta }))
    const [tx, ty] = em([8.3, lado * 2.2])
    L.push(P(elipseGirada(tx, ty, 0.9 * k, 0.55 * k, angDaPinca), PONTA_DA_PINCA, { bisel: 0.4 * k, contorno: 0.24 }))
  }
  const [mx, my] = em([0, 0])
  L.push(P(elipseGirada(mx, my, 3.6 * k, 4.8 * k, ang), CASCO, { bisel: 2.2 * k, contorno: 0.32, textura: texDoCasco, semente: 7836, projeta: { dist: 0.9 * k, forca: 0.34 } }))
  for (const lado of [-1, 1]) {
    const [ox, oy] = em([3.5, lado * 1.1])
    L.push(P(elipse(ox, oy, 0.45 * k, 0.45 * k), PUPILA, { bisel: 0.2, contorno: 0.1 }))
  }
}

// ---------- a faca de escamar ----------

/** A lâmina (aço claro), o cabo de madeira escura e a virola e os rebites de latão. */
const LAMINA: MaterialDaPeca = { classe: 'metal', rgb: [0xb4, 0xba, 0xbe] }
const CABO_DA_FACA: MaterialDaPeca = { classe: 'madeira', rgb: rgb(tomDoMeio('nogueira', 0.78)) }
const LATAO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('latao', 1)) }
const DENTE: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x5e, 0x60] }
/** A faca ao comprido (u, do pé do cabo à ponta) e de través (v), em px da faca; a faca inteira tem 27 px. */
const FORMA_DA_LAMINA: readonly Ponto[] = [[10.4, -1.7], [22, -1.7], [27, 1], [10.4, 1.5]]
const FORMA_DO_CABO: readonly Ponto[] = [[0, -1.5], [1, -1.8], [9.6, -1.6], [9.6, 1.6], [1, 1.8], [0, 1.5]]
const VIROLA: readonly Ponto[] = [[9.4, -2], [10.6, -2], [10.6, 1.9], [9.4, 1.9]]
const REBITES: readonly number[] = [3, 6.6]
/** Os dentes do lombo da lâmina, que raspam a escama. */
const DENTES: readonly number[] = [13, 15, 17, 19]
/** A faca no caixote: 27 px da faca viram este tanto de px da casa. */
const TAMANHO_DA_FACA = 0.72

function montarFaca(P: CriarPeca, L: Peca[], x0: number, y0: number, ang: number, k: number): void {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const e = TAMANHO_DA_FACA * k
  const em = ([u, v]: Ponto): Ponto => [x0 + (u * co - v * si) * e, y0 + (u * si + v * co) * e]
  const projeta: Projecao = { dist: 1 * k, forca: 0.34, suave: 0.8 }
  L.push(P(poligono(FORMA_DO_CABO.map(em)), CABO_DA_FACA, { eixo: ang, tabua: 0, bisel: 0.9 * e, contorno: 0.3, semente: 7840, projeta }))
  L.push(P(poligono(FORMA_DA_LAMINA.map(em)), LAMINA, { eixo: ang, tabua: 0, bisel: 0.7 * e, contorno: 0.3, metal: 0.5, semente: 7841, projeta }))
  for (const u of DENTES) L.push(P(poligono([em([u - 0.5, -1.7]), em([u + 0.5, -1.7]), em([u, -1.05])]), DENTE, { bisel: 0, contorno: 0, alfa: 0.7 }))
  L.push(P(poligono(VIROLA.map(em)), LATAO, { tabua: 0, bisel: 0.5 * e, contorno: 0.26, metal: 0.45, semente: 7842 }))
  for (const u of REBITES) {
    const [rx, ry] = em([u, 0])
    L.push(P(elipse(rx, ry, 0.55 * e, 0.55 * e), LATAO, { bisel: 0.5 * e, tom: 1.1, contorno: 0.2, metal: 0.45 }))
  }
}

// ---------- o caixote ----------

/** A folga da pegada, a grossura das paredes, o pilarete dos cantos e a meia largura da pega cavada (px da escala de partida). */
const FOLGA = 0.8
const PAREDE = 2.6
const PILARETE = 3.4
const MEIA_PEGA = 4.6
/** A sombra que a borda de cima e a da esquerda fazem dentro do caixote. */
const SOMBRA_DA_BORDA = 2.6
const FORCA_DA_SOMBRA_DA_BORDA = 0.4
/** As cavalinhas: o comprido, a largura e o passo de lado a lado (px da escala de partida), e a folga da cabeça até a parede. */
const COMPRIMENTO_DA_CAVALINHA = 13.6
const LARGURA_DA_CAVALINHA = 4.6
const PASSO_DAS_CAVALINHAS = 4.8
const FOLGA_DA_CABECA = 1.6
/** O pargo: o comprido (até a largura de dentro menos uma folga) e a largura (fração do comprido; o pargo é alto, mais fino lia salmão). */
const COMPRIMENTO_DO_PARGO = 40
const LARGURA_DO_PARGO = 0.36

export const montarCaixoteDePeixe: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const mad = c.m.madeira
  const k = Math.min(c.w / G, c.h / (G * ALTURA_DE_PARTIDA))
  const ox = c.hw - FOLGA * k
  const oy = c.hh - FOLGA * k
  const ix = ox - PAREDE * k
  const iy = oy - PAREDE * k

  // O caixote é a coluna da 3/4; o fundo de madeira, escondido debaixo de tudo, é a maior peça (a frente sai de madeira).
  const fora = caixa(-ox, -oy, ox, oy, 0.8 * k)
  cena.sombras.push({ forma: fora, z: c.g * ALTURA_DO_CAIXOTE }, contato(fora, 0.32))
  L.push(P(fora, mad, { tabua: 0, bisel: 0.8 * k, tom: 0.8, contorno: 0.28, semente: 7700 }))
  L.push(P(caixa(-ix, -iy, ix, iy), SAL_DO_LEITO, { bisel: 0, contorno: 0, textura: texDoSal, semente: 7701 }))

  // As algas do fundo: lâminas deitadas ao longo das paredes compridas e nas pontas do meio, que aparecem entre
  // as cabeças, entre os rabos e em volta da cabeça e do rabo do pargo: [de, até] (px da cena), o arco, a meia
  // largura (px da escala de partida) e os frisos.
  const algasDoFundo: readonly (readonly [Ponto, Ponto, number, number, number, MaterialDaPeca])[] = [
    [[-ix + k, -iy + 1.1 * k], [-ix + 13 * k, -iy + 0.9 * k], 0.8, 1.5, 3, ALGA],
    [[-ix + 11 * k, -iy + k], [-k, -iy + 1.2 * k], -0.7, 1.4, 3, ALGA_ESCURA],
    [[-2 * k, -iy + 1.1 * k], [10 * k, -iy + 0.9 * k], 0.8, 1.5, 3, ALGA],
    [[8 * k, -iy + k], [ix - k, -iy + 1.1 * k], -0.7, 1.4, 3, ALGA_ESCURA],
    [[-ix + k, iy - k], [-ix + 12 * k, iy - 1.2 * k], -0.8, 1.4, 3, ALGA_ESCURA],
    [[-ix + 10 * k, iy - 1.1 * k], [2 * k, iy - 0.9 * k], 0.7, 1.5, 3, ALGA],
    [[0, iy - k], [12 * k, iy - 1.2 * k], -0.8, 1.4, 3, ALGA_ESCURA],
    [[10 * k, iy - 1.1 * k], [ix - k, iy - 0.9 * k], 0.7, 1.5, 3, ALGA],
    [[-ix + 0.8 * k, 1.2 * k], [-ix + 9 * k, -1.4 * k], 1.2, 2, 2.5, ALGA],
    [[ix - 9 * k, 1.6 * k], [ix - 0.8 * k, -k], -1.2, 2, 2.5, ALGA_ESCURA],
  ]
  algasDoFundo.forEach(([a, b, curva, meia, frisos, mat], i) => {
    L.push(P(laminaDeAlga(a, b, curva * k, meia * k, frisos), mat, { bisel: 0.35 * k, contorno: 0.2, alfa: 0.95, semente: 7710 + i }))
  })

  // As duas fileiras de cavalinhas: a de cima com a cabeça para cima, a de baixo para baixo; o rabo vai para o meio.
  const comprimento = Math.min(COMPRIMENTO_DA_CAVALINHA * k, iy - FOLGA_DA_CABECA * k)
  const largura = LARGURA_DA_CAVALINHA * k
  const passo = PASSO_DAS_CAVALINHAS * k
  const porFileira = Math.max(3, Math.floor((2 * ix - largura) / passo) + 1)
  const inicio = (-(porFileira - 1) * passo) / 2
  for (const fileira of [-1, 1]) {
    const yDoMeio = fileira * (iy - FOLGA_DA_CABECA * k - comprimento * 0.5)
    for (let i = 0; i < porFileira; i += 1) {
      const sem = 7720 + i * 8 + (fileira > 0 ? 200 : 0)
      montarPeixe(P, L, {
        x: inicio + i * passo + (hash(sem, 1, 7721) - 0.5) * 0.7 * k,
        y: yDoMeio + (hash(sem, 2, 7721) - 0.5) * 1.2 * k,
        ang: fileira * QUARTO + (hash(sem, 3, 7721) - 0.5) * 0.14,
        comprimento: comprimento * (0.96 + 0.08 * hash(sem, 4, 7721)),
        largura,
        lado: 1,
      }, CAVALINHA, k, sem)
    }
  }

  // Três lâminas jogadas por cima das cavalinhas, nos cantos que o pargo e o caranguejo deixam livres.
  const algasDeCima: readonly (readonly [Ponto, Ponto, number, number, MaterialDaPeca])[] = [
    [[ix - 14 * k, -iy + 3 * k], [ix - 3 * k, -4 * k], 2.5, 1.8, ALGA_CLARA],
    [[-ix + 3 * k, 4 * k], [-ix + 15 * k, iy - 3 * k], -2.2, 1.7, ALGA_CLARA],
    [[-6 * k, -iy + 2.2 * k], [4 * k, -iy + 6 * k], 1.5, 1.5, ALGA],
  ]
  algasDeCima.forEach(([a, b, curva, meia, mat], i) => {
    L.push(P(laminaDeAlga(a, b, curva * k, meia * k, 2.5), mat, { bisel: 0.4 * k, contorno: 0.22, alfa: 0.95, semente: 7716 + i, projeta: { dist: 0.6 * k, forca: 0.26 } }))
  })

  // O pargo atravessado por cima, com a cabeça para a esquerda.
  const comprimentoDoPargo = Math.min(COMPRIMENTO_DO_PARGO * k, 2 * ix - 6 * k)
  montarPargo(P, L, { x: 0.8 * k, y: 0.4 * k, ang: Math.PI + 0.05, comprimento: comprimentoDoPargo, largura: comprimentoDoPargo * LARGURA_DO_PARGO, lado: 1 }, k)

  // O sal grosso jogado por cima: cristais quadrados, cada um num giro.
  for (let i = 0; i < CRISTAIS; i += 1) {
    const x = (hash(i, 1, 7750) - 0.5) * 2 * (ix - 1.2 * k)
    const y = (hash(i, 2, 7750) - 0.5) * 2 * (iy - 1.2 * k)
    const lado = (0.45 + 0.4 * hash(i, 3, 7750)) * k
    const giro = hash(i, 4, 7750) * QUARTO
    const cantos = [0, 1, 2, 3].map((q): Ponto => [x + Math.cos(giro + q * QUARTO) * lado, y + Math.sin(giro + q * QUARTO) * lado])
    L.push(P(poligono(cantos), CRISTAL, { bisel: 0.3 * k, tom: 0.92 + 0.12 * hash(i, 5, 7750), contorno: 0.24, semente: 7751 + i }))
  }

  // O caranguejo no canto de cima à esquerda, virado para a cabeça do pargo; as pontas das pernas de trás entram
  // debaixo das paredes (mais para o canto, a última passava da borda de fora e virava um cisco fora do caixote).
  montarCaranguejo(P, L, -ix + 7.6 * k, -iy + 7.4 * k, 0.75, k)

  // As paredes por cima de tudo: a de cima e a da esquerda fazem a sombra dentro do caixote.
  const borda: Projecao = { dist: SOMBRA_DA_BORDA * k, forca: FORCA_DA_SOMBRA_DA_BORDA, suave: 1 }
  L.push(P(caixa(-ox, -oy, ox, -iy, 0.6 * k), mad, { eixo: 0, tabua: 0, bisel: 0.8 * k, tom: 1.06, contorno: 0.28, semente: 7760, projeta: borda }))
  L.push(P(caixa(-ox, iy, ox, oy, 0.6 * k), mad, { eixo: 0, tabua: 0, bisel: 0.8 * k, tom: 0.98, contorno: 0.28, semente: 7761, projeta: borda }))
  for (const lado of [-1, 1]) {
    const x0 = lado < 0 ? -ox : ix
    L.push(P(caixa(x0, -iy, x0 + PAREDE * k, iy, 0.4 * k), mad, { eixo: QUARTO, tabua: 0, bisel: 0.8 * k, tom: lado < 0 ? 1.04 : 0.96, contorno: 0.28, semente: 7762 + lado, projeta: borda }))
    // A pega cavada no meio da tábua da ponta: o fundo dela, mais baixo, fica na sombra.
    L.push(P(caixa(x0 + 0.55 * k, -MEIA_PEGA * k, x0 + (PAREDE - 0.55) * k, MEIA_PEGA * k, 0.8 * k), mad, { eixo: QUARTO, tabua: 0, bisel: 0.5 * k, tom: 0.6, contorno: 0.22, semente: 7764 + lado }))
  }
  // Os pilaretes dos cantos, de topo: os anéis do veio aparecem.
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const x = sx < 0 ? -ix : ix - PILARETE * k
      const y = sy < 0 ? -iy : iy - PILARETE * k
      L.push(P(caixa(x, y, x + PILARETE * k, y + PILARETE * k, 0.5 * k), mad, {
        tabua: 0,
        bisel: 0.6 * k,
        tom: 0.9,
        contorno: 0.26,
        polar: { cx: x + (sx < 0 ? 0 : PILARETE * k), cy: y + (sy < 0 ? 0 : PILARETE * k), r: PILARETE * k },
        semente: 7770 + sx + sy * 2,
        projeta: { dist: 1 * k, forca: 0.3 },
      }))
    }
  }

  // A faca de escamar deitada na borda de baixo, o cabo na ponta da direita e a lâmina para dentro.
  montarFaca(P, L, ix - 0.6 * k, (iy + oy) / 2 + 0.2 * k, Math.PI + 0.14, k)
}
