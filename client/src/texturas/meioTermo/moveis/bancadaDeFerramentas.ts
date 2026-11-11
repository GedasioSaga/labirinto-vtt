/**
 * BANCADA DE FERRAMENTAS de cima com volume (lote 3 dos objetos novos,
 * 11/11/2026): a bancada do ferreiro, de madeira grossa. De cima aparece o
 * TAMPO de pranchas largas com as duas testeiras (a tábua de través em cada
 * ponta), a fileira de furos dos batentes na beira da frente e o uso: manchas,
 * riscos de ferramenta e o QUEIMADO de onde o ferro quente foi pousado. Largado
 * em cima dele, o serviço: o MARTELO, a peça de ferro pela metade (a lâmina de
 * uma espada, só com a espiga e a ponta ainda rombuda), a TENAZ de hastes
 * compridas, a LIMA de cabo redondo, um punção e uns pregos. Na beira da
 * frente, à esquerda, a MORSA de ferro: o mordente fixo em cima do tampo, o
 * solto para fora da beira, o fuso e a manivela em T.
 *
 * NA 3/4 a bancada é uma mesa pesada: o tampo grosso sobe com tudo o que está
 * em cima dele, as quatro pernas vão do chão até ele e, entre elas, aparece a
 * PRATELEIRA de baixo com umas barras de ferro guardadas. A tábua da
 * prateleira fica debaixo do tampo na vista de cima; na 3/4 ela sobe só a
 * altura dela porque está presa a um furo de um quarto de px na estrutura do
 * tampo (`tresQuartos.ts` sobe cada peça pela estrutura mais alta que contém
 * o meio da caixa dela). A morsa é uma estrutura à parte, mais alta que o
 * tampo: os mordentes ganham a face de frente e o fuso e a manivela, presos a
 * ela, ficam na frente dessa face.
 *
 * A 25% de zoom sobram a prancha clara com as duas testeiras, o bloco escuro
 * da morsa na beira e os riscos de ferro e de cabo espalhados: é o que diz
 * "bancada de oficina" e não "mesa". Material: `madeira`; o ferro e os cabos
 * são fixos. As ferramentas têm o tamanho do menor lado (2 x 1 casas de
 * partida) e os lugares são frações da pegada: a bancada esticada ganha
 * tampo, não ferramentas maiores.
 */
import { hash, rgb } from '../../ruido'
import { oklabDoRgb, tomDoMeio } from '../materiais'
import { cadeia, caixa, capsula, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { BURACO, G, PREGO, QUARTO, materialDaPeca, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Alturas em casas: o tampo, a tábua da prateleira de baixo e o quanto a morsa passa do tampo. */
const ALTURA_DO_TAMPO = 0.62
const ALTURA_DA_PRATELEIRA = 0.22
const ALTURA_DA_MORSA = 0.1
/**
 * A grossura do tampo na 3/4 (px do protótipo): a beirada que o perfil do tipo
 * tem de trazer (`{ modo: 'derivado', espessura: ESPESSURA_DO_TAMPO_DA_BANCADA }`).
 * Com a padrão (0,06 casa) o tampo sai fino como o de uma mesa de jantar.
 */
export const ESPESSURA_DO_TAMPO_DA_BANCADA = 0.11 * G

/** O tampo recua isto da pegada dos lados e atrás; na frente sobra o lugar do fuso e da manivela da morsa (px do protótipo, no menor lado). */
const FOLGA_DO_TAMPO = 0.8
const SOBRA_DA_FRENTE = 5.6
const QUINA_DO_TAMPO = 1.2
/** A testeira de cada ponta e as pranchas entre elas (quantas cabem no fundo do tampo). */
const TESTEIRA = 5.4
const PRANCHAS = 4
/** A perna (o lado dela) e o quanto fica para dentro da beira do tampo. */
const PERNA = 7
const RECUO_DA_PERNA = 2.4
/**
 * A quina da perna, em fração do lado: chanfrada o bastante para a 3/4 ler a perna como redonda e correr o veio
 * de pé (`ehRedonda` em `tresQuartos.ts`); com a quina viva o veio ia deitado e a perna saía em blocos empilhados.
 */
const QUINA_DA_PERNA = 0.32
/** A prateleira de baixo fica entre as pernas, a esta distância da beira do tampo. */
const RECUO_DA_PRATELEIRA = 6.5

/** O ferro das ferramentas (batido, mais escuro que o da tabela), o aço da lima e o ferro em brasa já frio da peça pela metade. */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.86)) }
const ACO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.28)) }
const CAREPA: MaterialDaPeca = { classe: 'metal', rgb: [0x5e, 0x5a, 0x5c] }
/** O queimado no tampo e o risco de ferramenta: escuros da própria madeira, meio transparentes. */
const QUEIMADO: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x22, 0x1b] }
const RISCO_CLARO: MaterialDaPeca = { classe: 'liso', rgb: [0xe0, 0xc8, 0x9c] }
/** A luz (OKLab L) a partir da qual a madeira do tampo é clara: os cabos das ferramentas ficam com a madeira do outro lado. */
const L_DA_MADEIRA_CLARA = 0.62

/** A quina do tampo, gasta de mão, pega luz: a largura da faixa (px do protótipo) e a luz somada. */
const LARGURA_DA_QUINA_GASTA = 2.6
const LUZ_DA_QUINA_GASTA = 0.16

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** A madeira dos cabos: escura no tampo claro, clara no tampo escuro, para o martelo não sumir na bancada. */
function madeiraDoCabo(tampo: MaterialDaPeca): MaterialDaPeca {
  const [L] = oklabDoRgb(tampo.rgb[0], tampo.rgb[1], tampo.rgb[2])
  return materialDaPeca(L >= L_DA_MADEIRA_CLARA ? 'nogueira' : 'pinho')
}

/** O veio das pranchas com a quina gasta e as manchas largas do uso (óleo, mão, fuligem), sem listra. */
function texDoTampo(forma: Forma): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const t = -forma.d(x, y)
    if (t < LARGURA_DA_QUINA_GASTA) s[3] += LUZ_DA_QUINA_GASTA * (1 - (t > 0 ? t : 0) / LARGURA_DA_QUINA_GASTA)
    s[3] += ruido(x * 0.07 + p.su, y * 0.1 + p.sv) * 0.12 - 0.02
  }
}

/** A mancha de queimado em volta de (cx, cy): preta no miolo, rala e rasgada na beira. */
function texDeQueimado(cx: number, cy: number, rx: number, ry: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry)
    s[5] = limitar((1 - d) * 1.8, 0, 1) * limitar(0.6 + ruido(x * 0.36 + p.su, y * 0.36 + p.sv) * 1.5, 0, 1)
  }
}

/** Os dentes da lima: riscos finos em diagonal, cruzados. */
const texDaLima: Textura = (u, v, _x, _y, _p, s) => {
  s[3] += Math.sin((u + v) * 4.2) * 0.07 + Math.sin((u - v) * 4.2) * 0.05
}

/** A peça pela metade: as marcas do martelo (manchas largas de luz) e a carepa da forja (grão escuro). */
const texDeForjado: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.55 + p.su, y * 0.55 + p.sv) * 0.3 + ruido(x * 1.6, y * 1.6 + p.su) * 0.08
}

/** A rosca do fuso da morsa: os filetes de través. */
const texDeRosca: Textura = (_u, _v, _x, y, _p, s) => {
  s[3] += Math.sin(y * 5.2) * 0.14
}

/** Leva os pontos de uma ferramenta desenhada deitada (x ao comprido, a partir da origem dela) para o lugar no tampo. */
function noLugar(origem: Ponto, angulo: number, escala: number): (p: Ponto) => Ponto {
  const co = Math.cos(angulo) * escala
  const si = Math.sin(angulo) * escala
  return ([x, y]) => [origem[0] + x * co - y * si, origem[1] + x * si + y * co]
}

/**
 * A mesma forma com a caixa de pintura centrada em (cx, cy): o desenho não
 * muda (fora da forma nada pinta), mas o meio da caixa, que é o que a 3/4 lê
 * para saber em que estrutura a peça está, cai onde a peça tem de se prender.
 */
function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => forma.d(x, y) }
}

/** O que cada parte da bancada precisa saber do móvel: a pegada, a escala das ferramentas e a fábrica de peças. */
interface Bancada {
  readonly c: ContextoDoMovel
  readonly L: Peca[]
  /** As ferramentas e a morsa têm o tamanho do menor lado: 1 na bancada de 2 x 1 casas. */
  readonly k: number
  /** A beira da frente do tampo. */
  readonly borda: number
}

// ---------- o tampo ----------

/** Os queimados: o meio (frações da meia pegada) e os dois raios (px do protótipo, no menor lado). */
const QUEIMADOS: readonly (readonly [number, number, number, number])[] = [
  [-0.03, -0.08, 18, 5.6],
  [-0.66, 0.2, 5.6, 4.4],
  [0.46, -0.06, 4.4, 3.4],
  [0.72, 0.44, 3, 2.4],
  [-0.3, -0.62, 6.5, 2.6],
]
/** Os riscos de ferramenta no miolo do tampo: quantos, e o comprimento do menor ao maior (px do protótipo). */
const RISCOS = 26
const RISCO_CURTO = 2.2
const RISCO_COMPRIDO = 7.5
/** Os furos dos batentes: de onde a onde vai a fileira (frações da meia largura), quantos, o meio lado e a distância da beira. */
const FUROS = { de: -0.1, ate: 0.84, quantos: 7, meioLado: 1.05, daBeira: 3.6 }

function montarTampo(b: Bancada, tampo: Forma): void {
  const { c, L, k, borda } = b
  const { hw, hh, peca: P } = c
  const mad = c.m.madeira
  const x0 = -hw + FOLGA_DO_TAMPO
  const x1 = hw - FOLGA_DO_TAMPO
  const y0 = -hh + FOLGA_DO_TAMPO
  const testeira = Math.min(TESTEIRA * k, c.w * 0.08)
  // A grossura da prancha, aparecendo embaixo e à direita, e o tampo: as pranchas ao comprido e as duas testeiras.
  L.push(P(tampo, mad, { dx: 0.5 * k, dy: 1.5 * k, tabua: 0, bisel: 0.7, contorno: 0.2, tom: 0.62, semente: 3301 }))
  L.push(P(tampo, mad, { tabua: (borda - y0) / PRANCHAS, bisel: 1.5, contorno: 0.1, tom: 0.98, textura: texDoTampo(tampo), semente: 3302 }))
  for (const [i, xa] of [x0, x1 - testeira].entries()) {
    const forma = caixa(xa, y0, xa + testeira, borda, QUINA_DO_TAMPO * k)
    L.push(P(forma, mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, contorno: 0.14, tom: 0.9, textura: texDoTampo(forma), semente: 3303 + i, projeta: { dist: 0.5, forca: 0.14 } }))
    // As duas cavilhas que prendem a testeira nas pranchas.
    for (const f of [0.22, 0.78]) L.push(P(elipse(xa + testeira / 2, y0 + (borda - y0) * f, 0.8 * k, 0.8 * k), mad, { tabua: 0, bisel: 0.5, tom: 0.66, contorno: 0.2 }))
  }
  // O uso, por baixo das ferramentas: o queimado, os riscos e os furos dos batentes.
  QUEIMADOS.forEach(([fx, fy, rx, ry], i) => {
    const cx = fx * hw
    const cy = fy * hh
    L.push(P(elipse(cx, cy, rx * k, ry * k), QUEIMADO, { bisel: 0, contorno: 0, alfa: 0.8, textura: texDeQueimado(cx, cy, rx * k, ry * k), semente: 3310 + i }))
  })
  for (let i = 0; i < RISCOS; i += 1) {
    const cx = (hash(i, 1, 3320) * 1.6 - 0.8) * hw
    const cy = y0 + (0.12 + hash(i, 2, 3320) * 0.76) * (borda - y0)
    const meio = ((RISCO_CURTO + (RISCO_COMPRIDO - RISCO_CURTO) * hash(i, 3, 3320)) * k) / 2
    const ang = (hash(i, 4, 3320) - 0.5) * 2.4
    const risco = capsula(cx - Math.cos(ang) * meio, cy - Math.sin(ang) * meio, cx + Math.cos(ang) * meio, cy + Math.sin(ang) * meio, 0.26 * k)
    // Um em cada quatro é corte novo, na madeira clara de dentro; os outros já escureceram.
    L.push(P(risco, i % 4 === 0 ? RISCO_CLARO : QUEIMADO, { bisel: 0, contorno: 0, alfa: i % 4 === 0 ? 0.3 : 0.4 }))
  }
  const lado = FUROS.meioLado * k
  for (let i = 0; i < FUROS.quantos; i += 1) {
    const cx = (FUROS.de + ((FUROS.ate - FUROS.de) * i) / (FUROS.quantos - 1)) * hw
    const cy = borda - FUROS.daBeira * k
    L.push(P(caixa(cx - lado, cy - lado, cx + lado, cy + lado, 0.3), BURACO, { bisel: 0.3, contorno: 0.1, recesso: { k: 0.8, forca: 0.3 }, semente: 3340 + i }))
  }
}

// ---------- as ferramentas ----------

/** Onde cada ferramenta está largada: a origem (frações da meia pegada) e o giro. */
const MARTELO = { x: -0.82, y: -0.16, giro: -0.4 }
const PECA = { x: -0.36, y: -0.2, giro: 0.1 }
const TENAZ = { x: 0.25, y: -0.76, giro: 0.36 }
const LIMA = { x: 0.14, y: 0.22, giro: 0.13 }
/** A sombra que cada ferramenta faz no tampo. */
const SOMBRA_DA_FERRAMENTA = { dist: 1, forca: 0.34, suave: 0.8 }

/** O martelo, do pé do cabo (a origem) à cabeça: o cabo, a cabeça de través (a face de bater de um lado, a pena do outro) e a cunha no olho. */
function montarMartelo(b: Bancada, cabo: MaterialDaPeca): void {
  const { c, L, k } = b
  const P = c.peca
  const em = noLugar([MARTELO.x * c.hw, MARTELO.y * c.hh], MARTELO.giro, k)
  L.push(P(poligono(([[0, -1.5], [3, -1.25], [20, -1.05], [27, -1.05], [27, 1.05], [20, 1.05], [3, 1.25], [0, 1.5]] as Ponto[]).map(em)), cabo, { eixo: MARTELO.giro, tabua: 0, bisel: 1.1 * k, contorno: 0.26, semente: 3350, projeta: SOMBRA_DA_FERRAMENTA }))
  L.push(P(poligono(([[21.6, 5.4], [27.4, 5.4], [27.4, -1.4], [25.8, -6], [23.2, -6], [21.6, -1.4]] as Ponto[]).map(em)), FERRO, { tabua: 0, bisel: 1.3 * k, contorno: 0.28, metal: 0.4, semente: 3351, projeta: { dist: 1.6, forca: 0.36, suave: 0.9 } }))
  // A face de bater, polida de tanto uso, e a cunha de madeira no olho da cabeça.
  L.push(P(poligono(([[21.9, 5.4], [27.1, 5.4], [27.1, 4.1], [21.9, 4.1]] as Ponto[]).map(em)), ACO, { tabua: 0, bisel: 0.5, contorno: 0.12, metal: 0.5, semente: 3352 }))
  const [ox, oy] = em([24.5, 0])
  L.push(P(elipse(ox, oy, 1.25 * k, 1.25 * k), cabo, { tabua: 0, bisel: 0.5, tom: 1.16, contorno: 0.3, semente: 3353 }))
}

/** A peça pela metade: a lâmina de uma espada, da espiga (a origem) à ponta ainda rombuda, com a beira torta do martelo. */
function montarPecaPelaMetade(b: Bancada): void {
  const { c, L, k } = b
  const P = c.peca
  const em = noLugar([PECA.x * c.hw, PECA.y * c.hh], PECA.giro, k)
  const contorno: Ponto[] = [[0, -0.9], [6.4, -1], [7.4, -2.9], [16, -3.1], [26, -2.7], [31.5, -2.2], [35.4, -1], [36.6, 0.2], [35, 1.3], [31, 2.3], [24, 2.9], [14, 2.7], [7.4, 3], [6.4, 1], [0, 0.9]]
  L.push(P(poligono(contorno.map(em)), CAREPA, { tabua: 0, bisel: 1.5 * k, contorno: 0.3, metal: 0.26, textura: texDeForjado, semente: 3360, projeta: SOMBRA_DA_FERRAMENTA }))
  // O miolo já batido e limpo, mais claro: é onde a lâmina vai ter o fio.
  L.push(P(poligono(([[9, -1.2], [24, -1.1], [31, -0.5], [31, 0.7], [24, 1.2], [9, 1.1]] as Ponto[]).map(em)), ACO, { tabua: 0, bisel: 1.1 * k, contorno: 0, alfa: 0.5, suave: 0.6 * k, textura: texDeForjado, semente: 3361 }))
}

/** A tenaz, da boca (a origem) às pontas das hastes: as duas hastes cruzadas no rebite. */
function montarTenaz(b: Bancada): void {
  const { c, L, k } = b
  const P = c.peca
  const em = noLugar([TENAZ.x * c.hw, TENAZ.y * c.hh], TENAZ.giro, k)
  const haste = (lado: number): Ponto[] => ([[32, 2.5 * lado], [20, 1.5 * lado], [8.5, 0], [3.4, -2 * lado], [0, -1.5 * lado]] as Ponto[]).map(em)
  L.push(P(cadeia(haste(1), 0.9 * k), FERRO, { bisel: 0.8 * k, contorno: 0.3, metal: 0.3, semente: 3370, projeta: SOMBRA_DA_FERRAMENTA }))
  L.push(P(cadeia(haste(-1), 0.9 * k), FERRO, { bisel: 0.8 * k, tom: 1.1, contorno: 0.3, metal: 0.3, semente: 3371, projeta: SOMBRA_DA_FERRAMENTA }))
  const [rx, ry] = em([8.5, 0])
  L.push(P(elipse(rx, ry, 1.5 * k, 1.5 * k), FERRO, { bisel: 1.2 * k, tom: 1.2, contorno: 0.3, metal: 0.5, semente: 3372 }))
}

/** A lima, da ponta (a origem) ao cabo: a folha de aço com os dentes, a virola e o cabo redondo. */
function montarLima(b: Bancada, cabo: MaterialDaPeca): void {
  const { c, L, k } = b
  const P = c.peca
  const em = noLugar([LIMA.x * c.hw, LIMA.y * c.hh], LIMA.giro, k)
  L.push(P(poligono(([[0, -0.8], [17.5, -1.5], [17.5, 1.5], [0, 0.8]] as Ponto[]).map(em)), FERRO, { eixo: LIMA.giro, tabua: 0, bisel: 0.8 * k, tom: 1.04, contorno: 0.3, metal: 0.3, textura: texDaLima, semente: 3380, projeta: SOMBRA_DA_FERRAMENTA }))
  const [ax, ay] = em([19.6, 0])
  const [bx, by] = em([25, 0])
  L.push(P(capsula(ax, ay, bx, by, 1.9 * k), cabo, { eixo: LIMA.giro, tabua: 0, bisel: 1.6 * k, contorno: 0.28, semente: 3381, projeta: SOMBRA_DA_FERRAMENTA }))
  L.push(P(poligono(([[17.3, -1.7], [19.2, -1.7], [19.2, 1.7], [17.3, 1.7]] as Ponto[]).map(em)), materialDaPeca('latao'), { tabua: 0, bisel: 0.6, contorno: 0.24, metal: 0.4, semente: 3382 }))
}

/** A miudeza: o punção largado perto da morsa e os pregos (o meio em frações da meia pegada e o giro). */
const PUNCAO = { x: -0.2, y: 0.5, giro: 0.4, comprimento: 7.5 }
const PREGOS: readonly (readonly [number, number, number])[] = [
  [0.7, 0.06, 0.5],
  [0.77, 0.16, -0.9],
  [0.67, 0.2, 2.3],
]
const COMPRIMENTO_DO_PREGO = 3.6

function montarMiudeza(b: Bancada): void {
  const { c, L, k } = b
  const P = c.peca
  const noPuncao = noLugar([PUNCAO.x * c.hw, PUNCAO.y * c.hh], PUNCAO.giro, k)
  const [px, py] = noPuncao([0, 0])
  const [qx, qy] = noPuncao([PUNCAO.comprimento, 0])
  L.push(P(capsula(px, py, qx, qy, 0.95 * k), FERRO, { bisel: 0.9 * k, tom: 1.1, contorno: 0.3, metal: 0.4, semente: 3390, projeta: SOMBRA_DA_FERRAMENTA }))
  PREGOS.forEach(([fx, fy, giro], i) => {
    const em = noLugar([fx * c.hw, fy * c.hh], giro, k)
    const [ax, ay] = em([0, 0])
    const [bx, by] = em([COMPRIMENTO_DO_PREGO, 0])
    L.push(P(capsula(ax, ay, bx, by, 0.36 * k), PREGO, { bisel: 0.3, contorno: 0.2, metal: 0.3, semente: 3392 + i, projeta: { dist: 0.5, forca: 0.3, suave: 0.5 } }))
    L.push(P(elipse(ax, ay, 0.75 * k, 0.75 * k), PREGO, { bisel: 0.5, contorno: 0.2, metal: 0.4 }))
  })
}

// ---------- a morsa ----------

/** Onde a morsa fica na beira da frente (fração da meia largura) e as medidas dela (px do protótipo, no menor lado). */
const MORSA = {
  x: -0.5,
  meiaBoca: 8.4,
  /** O mordente fixo, em cima do tampo, e o solto, para fora da beira: de onde a onde vão, a partir da beira. */
  fixo: [-5, -0.7],
  solto: [0.5, 3.7],
  /** A mesa da morsa (a bigorninha atrás do mordente fixo): a meia largura e até onde vai. */
  meiaMesa: 4.6,
  mesaAte: -10.4,
  fusoAte: 5.2,
  meiaManivela: 6.4,
} as const

/** A morsa na vista de cima; devolve a forma dos mordentes e da mesa (a estrutura que sobe na 3/4). */
function montarMorsa(b: Bancada): Forma {
  const { c, L, k, borda } = b
  const P = c.peca
  const x = MORSA.x * c.hw
  const Y = (d: number): number => borda + d * k
  const fixo = caixa(x - MORSA.meiaBoca * k, Y(MORSA.fixo[0]), x + MORSA.meiaBoca * k, Y(MORSA.fixo[1]), 0.9 * k)
  const solto = caixa(x - MORSA.meiaBoca * k, Y(MORSA.solto[0]), x + MORSA.meiaBoca * k, Y(MORSA.solto[1]), 0.9 * k)
  const mesa = caixa(x - MORSA.meiaMesa * k, Y(MORSA.mesaAte), x + MORSA.meiaMesa * k, Y(MORSA.fixo[0]) + k, 0.8 * k)
  const corpo = uniao(uniao(fixo, solto), mesa)
  // Tudo da morsa se prende ao meio do mordente fixo: o fuso e a manivela sobem com ele na 3/4.
  const cy = Y((MORSA.fixo[0] + MORSA.fixo[1]) / 2)
  const naMorsa = (forma: Forma): Forma => presa(forma, x, cy)
  const sombra = { dist: 1.8, forca: 0.38, suave: 1 }
  // A mesa com os dois parafusos, o vão escuro entre os mordentes e os dois mordentes, com a face de apertar polida.
  L.push(P(naMorsa(mesa), FERRO, { tabua: 0, bisel: 1 * k, tom: 0.94, contorno: 0.3, metal: 0.3, semente: 3400, projeta: sombra }))
  for (const lado of [-1, 1]) L.push(P(naMorsa(elipse(x + lado * MORSA.meiaMesa * 0.52 * k, Y(MORSA.mesaAte + 1.9), 0.85 * k, 0.85 * k)), FERRO, { bisel: 0.6, tom: 1.3, contorno: 0.24, metal: 0.5 }))
  L.push(P(naMorsa(caixa(x - MORSA.meiaBoca * k + 0.6, Y(MORSA.fixo[1]) - 0.4, x + MORSA.meiaBoca * k - 0.6, Y(MORSA.solto[0]) + 0.4)), BURACO, { bisel: 0, contorno: 0 }))
  L.push(P(naMorsa(fixo), FERRO, { tabua: 0, bisel: 1.2 * k, contorno: 0.3, metal: 0.36, semente: 3402, projeta: sombra }))
  L.push(P(naMorsa(solto), FERRO, { tabua: 0, bisel: 1.2 * k, tom: 1.06, contorno: 0.3, metal: 0.36, semente: 3403 }))
  for (const [de, ate] of [[MORSA.fixo[1] - 1.1, MORSA.fixo[1] - 0.2], [MORSA.solto[0] + 0.2, MORSA.solto[0] + 1.1]]) {
    L.push(P(naMorsa(caixa(x - MORSA.meiaBoca * k + 0.9, Y(de), x + MORSA.meiaBoca * k - 0.9, Y(ate))), ACO, { tabua: 0, bisel: 0.3, contorno: 0, metal: 0.5, semente: 3404 }))
  }
  // O fuso saindo do mordente solto e a manivela em T, com uma bola em cada ponta.
  L.push(P(naMorsa(capsula(x, Y(MORSA.solto[1]) - 0.5, x, Y(MORSA.fusoAte), 1.3 * k)), FERRO, { bisel: 1.1 * k, tom: 1.14, contorno: 0.26, metal: 0.4, textura: texDeRosca, semente: 3405 }))
  L.push(P(naMorsa(capsula(x - MORSA.meiaManivela * k, Y(MORSA.fusoAte), x + MORSA.meiaManivela * 0.8 * k, Y(MORSA.fusoAte), 0.75 * k)), FERRO, { bisel: 0.7 * k, tom: 1.2, contorno: 0.3, metal: 0.5, semente: 3406 }))
  for (const ponta of [-MORSA.meiaManivela, MORSA.meiaManivela * 0.8]) {
    L.push(P(naMorsa(elipse(x + ponta * k, Y(MORSA.fusoAte), 1.25 * k, 1.25 * k)), FERRO, { bisel: 1.2 * k, tom: 1.2, contorno: 0.3, metal: 0.5, semente: 3407 }))
  }
  return corpo
}

// ---------- a prateleira de baixo ----------

/** As barras de ferro guardadas na prateleira: de onde a onde vão (frações da meia largura), a distância da frente dela e a meia grossura. */
const BARRAS: readonly (readonly [number, number, number, number])[] = [
  [-0.62, 0.1, 3.2, 1],
  [-0.4, 0.52, 6.4, 0.8],
  [-0.7, -0.05, 9.4, 1.1],
]

/**
 * A tábua da prateleira e as barras em cima dela: escondidas debaixo do tampo
 * na vista de cima, presas ao furo da estrutura do tampo (`ancora`) para subir
 * só a altura da prateleira na 3/4.
 */
function montarPrateleira(b: Bancada, prateleira: Forma, ancora: Ponto): void {
  const { c, L, k } = b
  const P = c.peca
  const guardar = (forma: Forma): Forma => presa(forma, ancora[0], ancora[1])
  const [x0, , , y1] = prateleira.b
  // A tábua fica na sombra do tampo: escura no fundo, com a frente pegando um resto de luz.
  L.push(P(guardar(prateleira), c.m.madeira, { tabua: 9 * k, bisel: 0.6, contorno: 0.1, tom: 0.56, semente: 3420 }))
  BARRAS.forEach(([de, ate, daFrente, meia], i) => {
    const y = y1 - daFrente * k
    L.push(P(guardar(caixa(Math.max(x0 + 1, de * c.hw), y - meia * k, ate * c.hw, y + meia * k, 0.4)), FERRO, { tabua: 0, bisel: 0.7 * k, tom: 0.9 + 0.12 * i, contorno: 0.26, metal: 0.3, semente: 3421 + i }))
  })
}

export const montarBancadaDeFerramentas: MontarMovel = (c, cena) => {
  const { hw, hh, g } = c
  const k = Math.min(c.h, c.w / 2) / G
  const borda = hh - SOBRA_DA_FRENTE * k
  const b: Bancada = { c, L: cena.partes, k, borda }
  const zTampo = g * ALTURA_DO_TAMPO
  const tampo = caixa(-hw + FOLGA_DO_TAMPO, -hh + FOLGA_DO_TAMPO, hw - FOLGA_DO_TAMPO, borda, QUINA_DO_TAMPO * k)
  // As quatro pernas, debaixo do tampo, e a prateleira entre elas.
  const lado = PERNA * k
  const pernas = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sy) => {
      const x = sx < 0 ? -hw + FOLGA_DO_TAMPO + RECUO_DA_PERNA * k : hw - FOLGA_DO_TAMPO - RECUO_DA_PERNA * k - lado
      const y = sy < 0 ? -hh + FOLGA_DO_TAMPO + RECUO_DA_PERNA * k : borda - RECUO_DA_PERNA * k - lado
      return caixa(x, y, x + lado, y + lado, QUINA_DA_PERNA * lado)
    }),
  )
  const prateleira = caixa(-hw + RECUO_DA_PRATELEIRA * k, -hh + RECUO_DA_PRATELEIRA * k, hw - RECUO_DA_PRATELEIRA * k, borda - RECUO_DA_PRATELEIRA * k, 0.6)
  // O furo na estrutura do tampo por onde a prateleira se prende: um quarto de px, debaixo da sombra de baixo.
  const ancora: Ponto = [hw * 0.3, (prateleira.b[1] + prateleira.b[3]) / 2 + 3 * k]
  const furo = caixa(ancora[0] - 0.15, ancora[1] - 0.15, ancora[0] + 0.15, ancora[1] + 0.15)

  // A sombra de baixo (pesada, em volta do tampo), a do tampo (solta, mais clara) e a de cada perna.
  const alem = 1.4 * k
  cena.sombras.push(
    { forma: caixa(tampo.b[0] - alem, tampo.b[1] - alem, tampo.b[2] + alem, tampo.b[3] + alem, QUINA_DO_TAMPO * k + alem), z: 0, suave: alem, forca: 0.4 },
    { forma: menos(tampo, furo), z: zTampo, solta: true, suave: 1.8, forca: 0.24 },
    { forma: prateleira, z: g * ALTURA_DA_PRATELEIRA, solta: true, forca: 0.2 },
  )
  for (const perna of pernas) cena.sombras.push({ forma: perna, z: zTampo - ESPESSURA_DO_TAMPO_DA_BANCADA, suave: 0.9, forca: 0.3 }, contato(perna, 0.34))

  montarPrateleira(b, prateleira, ancora)
  montarTampo(b, tampo)
  const cabo = madeiraDoCabo(c.m.madeira)
  montarPecaPelaMetade(b)
  montarMartelo(b, cabo)
  montarTenaz(b)
  montarLima(b, cabo)
  montarMiudeza(b)
  // A morsa por último. A estrutura dela só diz à 3/4 a altura: a sombra solta caía longe da bancada, numa mancha sozinha.
  const morsa = montarMorsa(b)
  cena.sombras.push({ forma: morsa, z: zTampo + g * ALTURA_DA_MORSA, solta: true, forca: 0 })
}
