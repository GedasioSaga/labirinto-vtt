/**
 * VIGA CAÍDA de cima com volume (lote 11 dos objetos novos, 11/11/2026): o madeiramento de um telhado que
 * desabou. Uma VIGA grossa e velha, com as rachas de secagem ao comprido, caída em diagonal de um canto ao
 * outro e partida perto do meio: as duas metades desencontradas, cada ponta partida em poucas LASCAS
 * compridas (a fibra arrancada, com a madeira de dentro, clara), cruzadas umas nas outras. Nas pontas de fora, os ENTALHES de encaixe (o rebaixo
 * de meia madeira numa, a espiga na outra) com as CAVILHAS de ferro. Por cima, cruzada, uma TRAVE menor,
 * rebaixada numa ponta e partida na outra. Em volta, as TELHAS de barro quebradas, as lascas, os cravos e o PÓ.
 *
 * É o contrário dos destroços de madeira (`destrocos.ts`): lá são muitas tábuas finas e claras cruzadas; aqui
 * são poucas peças GROSSAS, escuras e compridas. O volume vem da face de lado à mostra (o truque dos escombros
 * de pedra, `escombrosDePedra.ts`), escura porque dá as costas para a luz, e da sombra comprida no chão.
 *
 * Material: `madeira` (a nogueira de partida: madeira de telhado, escurecida). As telhas, o pó e o ferro são
 * fixos. As posições saem de frações da pegada (2 x 1 casa de partida): esticada, a viga fica mais comprida
 * ou cai mais inclinada; a largura e a grossura das peças saem do menor lado, e não mudam.
 */
import { hash, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { barra, cadeia, capsula, dentroDe, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

// ---------- os materiais fixos ----------

/** A madeira de dentro, na quebra: o cerne claro dos destroços (`destrocos.ts`). */
const CERNE: Rgb = [0xcf, 0xae, 0x7c]
const QUANTO_DE_CERNE = 0.6
/** O ferro batido das cavilhas e dos cravos. */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.95)) }
/** O furo em volta da cavilha. */
const FURO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x2c, 0x22] }
/**
 * As telhas: barro cozido, alaranjado e queimado (saturação HSV ~0,53). O barro claro do vaso (#a8735a), no
 * chão de terra, saía rosado como papel.
 */
const TELHA: Rgb = [0x9e, 0x64, 0x46]
const TELHA_CLARA: Rgb = [0xac, 0x72, 0x52]
const TELHA_QUEIMADA: Rgb = [0x8c, 0x5a, 0x42]
/** O pó: a argamassa e o barro moídos, claro e quente, meio transparente (o chão aparece por baixo). */
const PO: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0xb3, 0x9b] }

// ---------- a luz ----------

/** De onde vem a luz no chão (cima à esquerda), para o tom da face de lado e a luz de través da telha. */
const LUZ_X = -0.79
const LUZ_Y = -0.61
/** O tom da face de lado: o do meio e quanto a luz o muda (os de `escombrosDePedra.ts`). */
const TOM_DA_FACE = 0.74
const LUZ_NA_FACE = 0.24
/** A luz de través da telha (meio cano): quanto o tom muda de uma beira à outra e quanto as beiras caem. */
const FORCA_DA_TELHA = 0.5
const BEIRA_DA_TELHA = 0.22

// ---------- as peças grossas ----------

/** Como a ponta de fora acaba: no rebaixo de meia madeira (o encaixe por cima) ou na espiga (o encaixe na ponta). */
type Encaixe = 'rebaixo' | 'espiga'

interface PecaGrossa {
  /** A ponta de fora (a do encaixe) e a ponta das lascas mais compridas, em frações da meia pegada. */
  readonly fora: Ponto
  readonly partida: Ponto
  /** A largura da face de cima e a grossura à mostra na face de lado, em frações do menor meio lado (R). */
  readonly larg: number
  readonly grossura: number
  readonly encaixe: Encaixe
  /** As lascas da ponta partida: quantas e até onde vai a mais comprida, em larguras da peça. */
  readonly lascas: number
  readonly fundo: number
  readonly tom: number
  /** A altura do topo, em casas: a trave, deitada por cima da viga, faz a sombra mais longa. */
  readonly z: number
  readonly sem: number
}

/**
 * As duas metades da viga, de um canto ao outro da pegada, e a trave cruzada por cima da de baixo. As pontas
 * das lascas das duas metades passam uma da outra: partida, a viga não deixa vão, as fibras se cruzam.
 */
const METADE_DA_ESQUERDA: PecaGrossa = { fora: [-0.95, -0.66], partida: [0.04, 0.04], larg: 0.38, grossura: 0.15, encaixe: 'rebaixo', lascas: 4, fundo: 1.5, tom: 1, z: 0.2, sem: 5100 }
const METADE_DA_DIREITA: PecaGrossa = { fora: [0.95, 0.3], partida: [-0.04, 0.06], larg: 0.38, grossura: 0.15, encaixe: 'espiga', lascas: 4, fundo: 1.3, tom: 0.93, z: 0.2, sem: 5120 }
const TRAVE: PecaGrossa = { fora: [0.2, -0.95], partida: [0.62, 0.84], larg: 0.27, grossura: 0.1, encaixe: 'rebaixo', lascas: 3, fundo: 1.2, tom: 1.06, z: 0.32, sem: 5140 }

/** O rebaixo: o comprimento dele (em larguras da peça) e o tom do fundo rebaixado. */
const COMPRIMENTO_DO_REBAIXO = 1.1
const TOM_DO_REBAIXO = 0.78
/** A espiga: o comprimento (em larguras) e a meia largura dela (fração da meia largura da peça). */
const COMPRIMENTO_DA_ESPIGA = 0.8
const MEIA_ESPIGA = 0.42
/** O raio da cabeça da cavilha (px do protótipo). */
const CAVILHA = 1.25
/** A fratura de onde as lascas saem fica a este tanto do fundo (fração) antes da ponta das lascas: o resto é lasca. */
const BASE_DAS_LASCAS = 1
/**
 * As RACHAS de secagem ao longo da face de cima (a viga velha racha com o tempo, ao comprido): o que diz "viga
 * de telhado" e não "tábua serrada" (as marcas de enxó de través, provadas na rodada 2, liam como juntas de
 * tábuas). Cada racha é um fio escuro e torto: de onde a onde vai (fração da parte inteira da peça) e onde
 * atravessa (fração da meia largura).
 */
const RACHAS: readonly (readonly [number, number, number])[] = [
  [0.16, 0.52, -0.36],
  [0.4, 0.74, 0.26],
]
const GROSSURA_DA_RACHA = 0.36
const RACHA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x22, 0x1a] }

// ---------- o que está em volta ----------

/** Um caco de telha: o meio (frações da meia pegada), o ângulo, o comprimento e a largura (frações de R), as pontas e a cor. */
interface Caco {
  readonly x: number
  readonly y: number
  readonly ang: number
  readonly comp: number
  readonly larg: number
  /** De costas (a capa, bojuda) ou de boca para cima (o canal, côncavo). */
  readonly canal: boolean
  /** Quebrada numa ponta só (a estreita é a beira inteira) ou nas duas. */
  readonly quebras: 1 | 2
  readonly cor: Rgb
}
/** Os cacos, nos dois lados da viga: embaixo à esquerda e em cima à direita, onde ela deixa chão livre. */
const CACOS: readonly Caco[] = [
  { x: -0.62, y: 0.52, ang: 0.3, comp: 0.66, larg: 0.3, canal: false, quebras: 1, cor: TELHA },
  { x: -0.28, y: 0.7, ang: -0.5, comp: 0.48, larg: 0.28, canal: true, quebras: 2, cor: TELHA_QUEIMADA },
  { x: -0.88, y: 0.3, ang: 1.7, comp: 0.44, larg: 0.27, canal: false, quebras: 2, cor: TELHA_CLARA },
  { x: 0.5, y: -0.58, ang: -0.25, comp: 0.6, larg: 0.3, canal: true, quebras: 1, cor: TELHA },
  { x: -0.12, y: -0.62, ang: 2.6, comp: 0.42, larg: 0.26, canal: false, quebras: 2, cor: TELHA_CLARA },
  { x: 0.84, y: -0.46, ang: 0.9, comp: 0.5, larg: 0.29, canal: false, quebras: 1, cor: TELHA_QUEIMADA },
  { x: 0.2, y: 0.74, ang: 0.2, comp: 0.4, larg: 0.27, canal: true, quebras: 2, cor: TELHA_CLARA },
]
/** As lascinhas de telha espalhadas. */
const MIUDOS_DE_TELHA = 14

/** As lascas compridas soltas junto da quebra e as curtas mais longe: o meio, o comprimento (fração de R) e o ângulo. */
const LASCAS: readonly (readonly [number, number, number, number])[] = [
  [0.04, 0.5, 0.36, 0.42],
  [-0.14, -0.34, 0.3, 0.18],
  [0.16, -0.34, 0.22, -0.4],
  [-0.5, 0.3, 0.14, 1.1],
  [0.56, 0.66, 0.12, -0.8],
  [0.7, -0.2, 0.12, 2.4],
]

/** Os cravos soltos: o meio (frações da meia pegada) e o ângulo. */
const CRAVOS: readonly (readonly [number, number, number])[] = [
  [-0.5, -0.24, 0.6],
  [0.42, 0.52, -1.2],
  [0.92, -0.06, 2.0],
]

// ---------- ajudantes ----------

/** Pontos locais (x ao longo, y através) girados `ang` e postos em (cx, cy). */
function girados(pontos: readonly Ponto[], cx: number, cy: number, ang: number): Ponto[] {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return pontos.map(([x, y]) => [cx + x * co - y * si, cy + x * si + y * co])
}

/** A forma deslocada de (dx, dy). */
function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/** A forma arrastada de (0, 0) até (dx, dy) em `passos` cópias: o corpo da peça com a face de lado, côncava nas lascas. */
function varrida(f: Forma, dx: number, dy: number, passos: number): Forma {
  let corpo = f
  for (let k = 1; k <= passos; k += 1) corpo = uniao(corpo, deslocada(f, (dx * k) / passos, (dy * k) / passos))
  return corpo
}

/** O tom da face de lado que olha para (dx, dy): mais clara virada para a luz, mais escura virada contra. */
function tomDaFace(dx: number, dy: number): number {
  const l = Math.hypot(dx, dy) || 1
  return TOM_DA_FACE + LUZ_NA_FACE * ((dx / l) * LUZ_X + (dy / l) * LUZ_Y)
}

/** A faixa atravessada na peça, de `de` a `ate` ao longo dela (px), girada com ela. */
function faixa(cx: number, cy: number, ang: number, de: number, ate: number, larg: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return barra(cx + de * co, cy + de * si, cx + ate * co, cy + ate * si, larg)
}

/**
 * O contorno da peça no referencial dela (x da ponta de fora até a ponta das lascas, y através): o encaixe numa
 * ponta e, na outra, a fratura com as lascas. Cada lasca é uma farpa fina e comprida que sai da fratura, de
 * largura e comprimento sorteados (a do meio, a mais comprida); entre elas o fundo é raso. De larguras iguais,
 * as farpas liam como um pente.
 */
function contornoDaPeca(p: PecaGrossa, comp: number, meia: number): Ponto[] {
  const pontos: Ponto[] = []
  if (p.encaixe === 'espiga') {
    const e = COMPRIMENTO_DA_ESPIGA * meia * 2
    pontos.push([e, -meia], [e, -meia * MEIA_ESPIGA], [0, -meia * MEIA_ESPIGA], [0, meia * MEIA_ESPIGA], [e, meia * MEIA_ESPIGA], [e, meia])
  } else {
    pontos.push([0, -meia], [0, meia])
  }
  const fundo = p.fundo * meia * 2
  const base = comp - fundo * BASE_DAS_LASCAS
  const maior = Math.floor(p.lascas / 2)
  // As divisas entre as lascas, de uma beira à outra, cada lasca de largura sorteada.
  const pesos = Array.from({ length: p.lascas }, (_, i) => 0.55 + hash(i, p.sem, 86))
  const total = pesos.reduce((a, b) => a + b, 0)
  let y0 = meia
  for (let i = 0; i < p.lascas; i += 1) {
    // A divisa (o fundo raso) e a ponta da lasca, um pouco fora do meio dela.
    const y1 = y0 - (2 * meia * pesos[i]) / total
    const alcance = i === maior ? 1 : 0.3 + 0.5 * hash(i, p.sem, 81)
    pontos.push([base + fundo * 0.12 * hash(i, p.sem, 82), y0])
    pontos.push([base + fundo * alcance, y0 + (y1 - y0) * (0.3 + 0.4 * hash(i, p.sem, 84))])
    y0 = y1
  }
  pontos.push([base + fundo * 0.12 * hash(p.lascas, p.sem, 82), -meia])
  return pontos
}

// ---------- as partes ----------

function montarPecaGrossa(c: ContextoDoMovel, cena: Cena, L: Peca[], p: PecaGrossa): void {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const mad = c.m.madeira
  const ax = p.fora[0] * c.hw
  const ay = p.fora[1] * c.hh
  const bx = p.partida[0] * c.hw
  const by = p.partida[1] * c.hh
  const ang = Math.atan2(by - ay, bx - ax)
  const comp = Math.hypot(bx - ax, by - ay)
  const meia = (p.larg * R) / 2
  const fundo = p.fundo * meia * 2
  const topo = poligono(girados(contornoDaPeca(p, comp, meia), ax, ay, ang))

  // A face de lado à mostra: a que dá as costas para a luz (escura), arrastada da face de cima.
  const sinal = -Math.sin(ang) * -LUZ_X + Math.cos(ang) * -LUZ_Y >= 0 ? 1 : -1
  const fx = -Math.sin(ang) * sinal * p.grossura * R
  const fy = Math.cos(ang) * sinal * p.grossura * R
  const corpo = varrida(topo, fx, fy, 3)
  // A sombra sai do corpo sem as lascas (uma barra só): arrastada, a forma com as farpas custava 7 vezes mais.
  const sombra = faixa(ax + fx / 2, ay + fy / 2, ang, 0, comp - fundo * BASE_DAS_LASCAS, meia * 2 + p.grossura * R)
  cena.sombras.push({ forma: sombra, z: c.g * p.z, forca: 0.3 }, contato(corpo, 0.3))
  const tomDeLado = p.tom * tomDaFace(fx, fy)
  L.push(P(corpo, mad, { eixo: ang, tabua: 0, bisel: 0.8, tom: tomDeLado, contorno: 0.32, semente: p.sem, projeta: { dist: 1.2, forca: 0.3 } }))
  L.push(P(topo, mad, { eixo: ang, tabua: 0, bisel: 1.3, tom: p.tom, contorno: 0.24, semente: p.sem + 1, projeta: { dist: 1 + c.g * p.z * 0.06, forca: 0.34 } }))

  // As rachas de secagem, ao comprido, na parte inteira da face de cima.
  const inteira = comp - fundo * BASE_DAS_LASCAS
  RACHAS.forEach(([de, ate, onde], k) => {
    const pontos: Ponto[] = []
    for (let i = 0; i <= 3; i += 1) {
      const t = de + ((ate - de) * i) / 3
      pontos.push([inteira * t, meia * (onde + (hash(i, p.sem + k, 87) - 0.5) * 0.12)])
    }
    L.push(P(cadeia(girados(pontos, ax, ay, ang), GROSSURA_DA_RACHA), RACHA, { bisel: 0, contorno: 0, alfa: 0.7, suave: 0.35, semente: p.sem + 6 + k }))
  })

  // As lascas: a madeira de dentro, clara em cima e mais escura na face de lado. Só as farpas clareiam: com a
  // fratura de trás junto, a ponta virava uma tampa clara.
  const naQuebra = faixa(ax, ay, ang, comp - fundo * (BASE_DAS_LASCAS - 0.06), comp + 2, (meia + p.grossura * R) * 2 + 2)
  const quebra: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, CERNE, QUANTO_DE_CERNE) }
  L.push(P(dentroDe(corpo, naQuebra), quebra, { eixo: ang, tabua: 0, bisel: 0.5, tom: tomDeLado, contorno: 0.22, semente: p.sem + 2 }))
  L.push(P(dentroDe(topo, naQuebra), quebra, { eixo: ang, tabua: 0, bisel: 0.6, contorno: 0.2, semente: p.sem + 3 }))

  // O encaixe da ponta de fora, com as cavilhas.
  const cavilha = (lx: number, ly: number, k: number): void => {
    const [cx, cy] = girados([[lx, ly]], ax, ay, ang)[0]
    L.push(P(elipse(cx, cy, CAVILHA + 0.6, CAVILHA + 0.6), FURO, { bisel: 0, contorno: 0, alfa: 0.6, suave: 0.5, semente: p.sem + 10 + k }))
    L.push(P(elipse(cx, cy, CAVILHA, CAVILHA), FERRO, { bisel: CAVILHA * 0.7, contorno: 0.3, metal: 0.36, semente: p.sem + 12 + k }))
  }
  if (p.encaixe === 'rebaixo') {
    // O rebaixo de meia madeira: a ponta tirada pela metade, mais funda; o degrau olha para a ponta e pega luz.
    const r = COMPRIMENTO_DO_REBAIXO * meia * 2
    L.push(P(dentroDe(topo, faixa(ax, ay, ang, -2, r, meia * 2 + 2)), mad, { eixo: ang, tabua: 0, bisel: 0.6, tom: p.tom * TOM_DO_REBAIXO, contorno: 0.2, semente: p.sem + 4 }))
    L.push(P(dentroDe(topo, faixa(ax, ay, ang, r - 0.7, r + 0.5, meia * 2 + 2)), mad, { eixo: ang + Math.PI / 2, tabua: 0, bisel: 0.3, tom: p.tom * 1.14, contorno: 0.1, semente: p.sem + 5 }))
    cavilha(r * 0.36, -meia * 0.42, 0)
    cavilha(r * 0.62, meia * 0.4, 1)
  } else {
    // A espiga: a cavilha atravessa no meio dela; um cravo em cada ombro.
    const e = COMPRIMENTO_DA_ESPIGA * meia * 2
    cavilha(e * 0.5, 0, 0)
    for (const [k, lado] of ([-1, 1] as const).entries()) {
      const [cx, cy] = girados([[e + meia * 0.5, lado * meia * 0.62]], ax, ay, ang)[0]
      L.push(P(elipse(cx, cy, 0.8, 0.8), FERRO, { bisel: 0.6, contorno: 0.24, metal: 0.3, semente: p.sem + 14 + k }))
    }
  }
}

/** Um caco de telha: o meio cano que se afina para uma ponta, com a luz de través e a(s) ponta(s) quebrada(s). */
function montarCaco(c: ContextoDoMovel, cena: Cena, L: Peca[], t: Caco, k: number): void {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const cx = t.x * c.hw
  const cy = t.y * c.hh
  const meio = (t.comp * R) / 2
  const larga = (t.larg * R) / 2
  const fina = larga * 0.8
  const quebrada = (x: number, de: number, ate: number, sem: number): Ponto[] => {
    const pontos: Ponto[] = []
    for (let i = 0; i <= 3; i += 1) pontos.push([x + (hash(i, sem, 85) - 0.5) * larga * 0.9, de + ((ate - de) * i) / 3])
    return pontos
  }
  // A ponta estreita (inteira ou quebrada) e, de volta, a larga, sempre quebrada.
  const frente: Ponto[] = t.quebras === 2 ? quebrada(meio, -fina, fina, k * 7 + 1) : [[meio, -fina], [meio, fina]]
  const forma = poligono(girados([...frente, ...quebrada(-meio, larga, -larga, k * 7 + 2)], cx, cy, t.ang))
  cena.sombras.push({ forma, z: 2.4, forca: 0.28 }, contato(forma, 0.28))
  const co = Math.cos(t.ang)
  const si = Math.sin(t.ang)
  const paraALuz = (t.canal ? -0.8 : 1) * FORCA_DA_TELHA * (-si * LUZ_X + co * LUZ_Y)
  const telha: Textura = (_u, _v, x, y, p, s) => {
    const lx = (x - cx) * co + (y - cy) * si
    const ly = -(x - cx) * si + (y - cy) * co
    const q = Math.max(-1, Math.min(1, ly / (larga - ((larga - fina) * (lx + meio)) / (2 * meio))))
    // De costas, o meio cano é bojudo: as beiras caem. De boca para cima, o fundo é escuro e as beiras, claras.
    s[3] += paraALuz * q + (t.canal ? BEIRA_DA_TELHA * q * q - 0.12 : -BEIRA_DA_TELHA * q * q * q * q)
    s[3] += ruido(x * 0.5 + p.su, y * 0.5) * 0.05 + ruido(x * 1.7, y * 1.7 + p.sv) * 0.03
  }
  L.push(P(forma, { classe: 'liso', rgb: t.cor }, { bisel: 0.7, contorno: 0.32, textura: telha, semente: 5200 + k, projeta: { dist: 0.9, forca: 0.28 } }))
}

/** O contorno irregular de uma mancha de pó: `n` pontos em volta de (cx, cy). */
function mancha(cx: number, cy: number, rx: number, ry: number, n: number, sem: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * 2 * Math.PI
    const k = 0.8 + 0.24 * hash(i, sem, 94)
    pontos.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k])
  }
  return pontos
}

export const montarVigaCaida: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const L = cena.partes

  // O pó primeiro, no chão: a mancha larga e fraca ao longo da viga e a do meio, mais cheia, em volta da quebra.
  L.push(P(poligono(mancha(0, 0, hw * 0.98, hh * 0.96, 18, 1)), PO, { bisel: 0, contorno: 0, alfa: 0.26, suave: R * 0.14, semente: 5000 }))
  L.push(P(poligono(mancha(0, 0.04 * hh, hw * 0.4, hh * 0.62, 14, 2)), PO, { bisel: 0, contorno: 0, alfa: 0.32, suave: R * 0.1, semente: 5001 }))

  // As lascinhas de telha e os cravos, no pó.
  for (let k = 0; k < MIUDOS_DE_TELHA; k += 1) {
    const t = ((k + hash(k, 1, 96) * 0.7) / MIUDOS_DE_TELHA) * 2 * Math.PI
    const longe = 0.5 + 0.46 * hash(k, 2, 96)
    const r = R * (0.03 + 0.03 * hash(k, 3, 96))
    const miudo = elipseGirada(Math.cos(t) * longe * hw, Math.sin(t) * longe * hh, r, r * 0.66, hash(k, 4, 96) * Math.PI)
    cena.sombras.push(contato(miudo, 0.22))
    L.push(P(miudo, { classe: 'liso', rgb: k % 2 === 0 ? TELHA : TELHA_QUEIMADA }, { bisel: r * 0.6, contorno: 0.3, tom: 0.9 + 0.2 * hash(k, 5, 96), semente: 5300 + k }))
  }
  CRAVOS.forEach(([fx, fy, ang], k) => {
    const meio = R * 0.13
    const [x, y] = [fx * hw, fy * hh]
    const haste = capsula(x - Math.cos(ang) * meio, y - Math.sin(ang) * meio, x + Math.cos(ang) * meio, y + Math.sin(ang) * meio, 0.55)
    cena.sombras.push(contato(haste, 0.24))
    L.push(P(haste, FERRO, { bisel: 0.5, contorno: 0.3, metal: 0.3, semente: 5320 + k }))
    L.push(P(elipse(x - Math.cos(ang) * meio, y - Math.sin(ang) * meio, 1.1, 1.1), FERRO, { bisel: 0.8, contorno: 0.3, metal: 0.36, semente: 5325 + k }))
  })

  // Os cacos de telha e as lascas soltas, em volta e por baixo da viga.
  CACOS.forEach((caco, k) => montarCaco(c, cena, L, caco, k))
  const lasca: MaterialDaPeca = { classe: 'madeira', rgb: misturar(c.m.madeira.rgb, CERNE, QUANTO_DE_CERNE) }
  LASCAS.forEach(([fx, fy, comp, ang], k) => {
    const meio = (comp * R) / 2
    const forma = capsula(fx * hw - Math.cos(ang) * meio, fy * hh - Math.sin(ang) * meio, fx * hw + Math.cos(ang) * meio, fy * hh + Math.sin(ang) * meio, 0.8)
    cena.sombras.push({ forma, z: 1.2, forca: 0.24 }, contato(forma, 0.22))
    L.push(P(forma, lasca, { eixo: ang, tabua: 0, bisel: 0.6, tom: 0.92 + 0.12 * hash(k, 6, 96), contorno: 0.26, semente: 5340 + k }))
  })

  // A viga partida (as lascas da metade da direita por cima das da esquerda) e, por cima, a trave.
  montarPecaGrossa(c, cena, L, METADE_DA_ESQUERDA)
  montarPecaGrossa(c, cena, L, METADE_DA_DIREITA)
  montarPecaGrossa(c, cena, L, TRAVE)
}
