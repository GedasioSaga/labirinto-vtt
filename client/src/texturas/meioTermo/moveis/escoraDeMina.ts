/**
 * ESCORA DE MINA (L04 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Cavernas e mina):
 * o quadro de madeira que segura o teto da galeria, atravessado no corredor, visto de cima. Os dois ESTEIOS roliços
 * encostados nas paredes, a TRAVE de madeira lavrada deitada em cima deles (passando um nada das pontas, com os
 * parafusos de ferro em cima de cada esteio) e, por cima da trave, as TÁBUAS do forro, atravessadas, que seguram a
 * rocha do teto. A sombra comprida da trave diz que ela está no alto: a ficha passa por baixo.
 *
 * Duas versões no mesmo tipo (`versoes/escoraDeMinaVersoes.ts`):
 * - INTEIRA (a 1ª, `montarEscoraDeMina`);
 * - QUEBRADA (`montarEscoraDeMinaQuebrada`): a trave partida perto do meio, a metade da esquerda ainda no esteio,
 *   com a ponta lascada, a da direita caída do esteio torto até o chão; as tábuas do forro espalhadas e o ENTULHO do
 *   teto que desceu (as pedras sem minério da Pilha de minério, `pilhaDeMinerio.ts`).
 *
 * É de parede a parede: corre ao comprido da pegada (2 x 0,6 casa de partida) e, esticada, a trave cresce e os
 * esteios ficam nas pontas; as tábuas do forro não esticam, se repetem (uma a cada `PASSO_DA_TABUA` casa). As grossuras
 * são em casas, até o que a pegada deixa. Na 3/4 (`tresQuartos.ts`, derivado) os esteios são colunas e a trave, um
 * tampo solto na altura deles, com a beirada da grossura dela (`ESPESSURA_DA_TRAVE_DA_ESCORA`); as tábuas têm a caixa
 * com o meio na trave, para subirem com ela. Material: `madeira`; o ferro e o entulho são fixos. Sem luz.
 */
import { hash, rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { barra, caixa, capsula, dentroDe, elipse, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { G, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { pintarPedacoDeMinerio } from './pilhaDeMinerio'
import { ondular } from './tesouroDeOuro'

// ---------- as medidas, em casas ----------

/** O raio do esteio, a meia grossura da trave e quanto ela passa do esteio. */
const RAIO_DO_ESTEIO = 0.17
const MEIA_TRAVE = 0.1
const SOBRA_DA_TRAVE = 0.07
/**
 * As tábuas do forro: a largura (e o quanto ela varia), o passo de uma à outra. Na primeira folha, todas iguais e no
 * mesmo passo, liam teclas de piano.
 */
const LARGURA_DA_TABUA = 0.1
const VARIA_A_LARGURA = 0.35
const PASSO_DA_TABUA = 0.34
/** A altura da trave (casas): o alto dos esteios, onde ela assenta, e a grossura dela na 3/4. */
const ALTURA_DA_TRAVE = 1.15
export const ESPESSURA_DA_TRAVE_DA_ESCORA = MEIA_TRAVE * 2 * G
/** Os parafusos em cima de cada esteio: o lado da cabeça e o afastamento de um ao outro. */
const PARAFUSO = 0.026
const ENTRE_PARAFUSOS = 0.1

// ---------- os materiais fixos ----------

const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.82)) }
/** A pedra que caiu do teto: o cinza-pardo da rocha da mina. */
const ENTULHO: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0x76, 0x70, 0x68] }
/** O pó de pedra em volta do entulho. */
const PO: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0x92, 0x86] }

/** O topo cortado do esteio: os anéis em volta do meio (a regra do mourão da cerca e do poste de amarrar). */
function texTopo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const raio = Math.hypot(x - cx, y - cy) + ruido(x * 0.2 + p.semente, y * 0.2) * 1.2
    s[3] += Math.sin(raio * 4.2) * 0.035 + ruido(x * 0.6, y * 0.6) * 0.05 + 0.07
  }
}

/** A mesma forma numa caixa com o meio em (mx, my): a 3/4 sobe a peça com a estrutura que contém esse ponto. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

interface Medidas {
  readonly rp: number
  readonly mt: number
  /** O meio de cada esteio (x) e as pontas da trave. */
  readonly xEsteio: number
  readonly xPonta: number
  readonly zTrave: number
}

function medidas(c: ContextoDoMovel): Medidas {
  const rp = Math.min(RAIO_DO_ESTEIO * c.g, c.hh * 0.92, c.hw * 0.2)
  const mt = Math.min(MEIA_TRAVE * c.g, rp * 0.8)
  const xPonta = c.hw - 0.4
  return { rp, mt, xEsteio: xPonta - SOBRA_DA_TRAVE * c.g - rp, xPonta, zTrave: ALTURA_DA_TRAVE * c.g }
}

/** Um esteio de pé em (x, 0): a casca roliça e o topo cortado; a sombra comprida e o contato. */
function pintarEsteio(c: ContextoDoMovel, cena: Cena, m: Medidas, x: number, semente: number): void {
  const P = c.peca
  const mad = c.m.madeira
  const esteio = elipse(x, 0, m.rp, m.rp)
  cena.sombras.push({ forma: esteio, z: m.zTrave, forca: 0.3 }, contato(esteio, 0.34))
  cena.partes.push(P(esteio, mad, { polar: { cx: x, cy: 0, r: m.rp }, tabua: 2.4, bisel: 1.2, tom: 0.7, contorno: 0.3, semente }))
  cena.partes.push(P(elipse(x, 0, m.rp * 0.8, m.rp * 0.8), mad, { textura: texTopo(x, 0), bisel: 0.9, tom: 1.02, semente: semente + 1 }))
}

/** Os dois parafusos de cabeça quadrada em cima da trave, sobre o esteio. */
function pintarParafusos(c: ContextoDoMovel, cena: Cena, x: number, semente: number): void {
  const P = c.peca
  const r = PARAFUSO * c.g
  for (const k of [-1, 1]) {
    const py = (k * ENTRE_PARAFUSOS * c.g) / 2
    cena.partes.push(P(comMeioEm(caixa(x - r, py - r, x + r, py + r, r * 0.3), x, 0), FERRO, { tabua: 0, bisel: r * 0.6, tom: 0.96, contorno: 0.3, metal: 0.4, semente: semente + k }))
  }
}

/** Uma tábua do forro em (x, 0), atravessada (ao longo de y), um nada torta; em cima da trave ou caída no chão. */
function tabuaDoForro(c: ContextoDoMovel, x: number, y: number, comprimento: number, giro: number, largura = 1): Forma {
  const meio = comprimento / 2
  const [dx, dy] = [Math.sin(giro) * meio, Math.cos(giro) * meio]
  return barra(x - dx, y - dy, x + dx, y + dy, LARGURA_DA_TABUA * c.g * largura)
}

/** As tábuas do forro por cima da trave, de `x0` a `x1`, no passo delas, cada uma com um tom e um nada torta. */
function pintarForro(c: ContextoDoMovel, cena: Cena, m: Medidas, x0: number, x1: number, semente: number): void {
  const P = c.peca
  const mad = c.m.madeira
  const n = Math.max(1, Math.round((x1 - x0) / (PASSO_DA_TABUA * c.g)))
  const passo = (x1 - x0) / n
  for (let i = 0; i < n; i += 1) {
    const x = x0 + (i + 0.5) * passo + (hash(i, 1, semente) - 0.5) * passo * 0.36
    const giro = (hash(i, 2, semente) - 0.5) * 0.1
    const comprimento = (c.h - 1.2) * (0.78 + 0.22 * hash(i, 3, semente))
    const y = (hash(i, 4, semente) - 0.5) * (c.h - 1.2 - comprimento)
    const largura = 1 + (hash(i, 6, semente) - 0.5) * 2 * VARIA_A_LARGURA
    const tabua = tabuaDoForro(c, x, y, comprimento, giro, largura)
    cena.sombras.push({ forma: tabua, z: m.zTrave + m.mt * 0.3, solta: true, forca: 0.24 })
    cena.partes.push(P(comMeioEm(tabua, x, 0), mad, { eixo: QUARTO - giro, tabua: 0, bisel: 0.8, tom: 0.84 + 0.18 * hash(i, 5, semente), contorno: 0.3, projeta: { dist: 1.7, forca: 0.42 }, semente: semente + 10 + i }))
  }
}

export const montarEscoraDeMina: MontarMovel = (c, cena) => {
  const P = c.peca
  const mad = c.m.madeira
  const m = medidas(c)
  for (const lado of [-1, 1]) pintarEsteio(c, cena, m, lado * m.xEsteio, 8100 + lado * 2)
  const trave = caixa(-m.xPonta, -m.mt, m.xPonta, m.mt, m.mt * 0.3)
  cena.sombras.push({ forma: trave, z: m.zTrave, solta: true, forca: 0.3 })
  cena.partes.push(P(trave, mad, { eixo: 0, tabua: 0, bisel: m.mt * 0.4, tom: 0.98, contorno: 0.3, ruga: 0.6, semente: 8110 }))
  for (const lado of [-1, 1]) pintarParafusos(c, cena, lado * m.xEsteio, 8120 + lado * 3)
  pintarForro(c, cena, m, -m.xEsteio + m.rp * 1.6, m.xEsteio - m.rp * 1.6, 8130)
}

// ---------- a quebrada ----------

/**
 * A ponta lascada de uma metade de trave: o retângulo de `xa` a `xb` (a quebra em `xb`) com as farpas em zigue-zague
 * no lugar do corte reto. `sentido` = +1 quando a quebra fica à direita.
 */
function metadeLascada(xa: number, xb: number, mt: number, sentido: number, semente: number): Forma {
  const farpas = 5
  const pontos: Ponto[] = [[xa, -mt], [xb - sentido * mt * 0.6, -mt]]
  for (let i = 0; i <= farpas; i += 1) {
    const y = -mt + (2 * mt * i) / farpas
    const fundo = i % 2 === 0 ? 0.2 + 0.5 * hash(i, 1, semente) : 1 + 0.9 * hash(i, 2, semente)
    pontos.push([xb - sentido * mt * 0.6 + sentido * mt * fundo, y])
  }
  pontos.push([xb - sentido * mt * 0.6, mt], [xa, mt])
  return poligono(sentido > 0 ? pontos : [...pontos].reverse())
}

/** Girar (x, y) de `a` em volta de (cx, cy). */
function girar([x, y]: Ponto, cx: number, cy: number, a: number): Ponto {
  const [co, si] = [Math.cos(a), Math.sin(a)]
  return [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co]
}

/** O entulho do teto que desceu na quebra: o pó claro e as pedras, das grandes para as miúdas. */
const PEDRAS_DO_ENTULHO: readonly (readonly [number, number, number])[] = [
  [-0.02, 0.1, 0.13],
  [0.16, -0.12, 0.1],
  [-0.2, -0.18, 0.09],
  [0.26, 0.22, 0.085],
  [-0.24, 0.3, 0.07],
  [0.06, 0.38, 0.06],
  [0.36, -0.32, 0.055],
]

export const montarEscoraDeMinaQuebrada: MontarMovel = (c, cena) => {
  const P = c.peca
  const mad = c.m.madeira
  const m = medidas(c)
  const { g } = c
  const xQuebra = -0.06 * c.w

  // O entulho no chão, debaixo da quebra (primeiro: tudo cai por cima dele).
  const po = ondular(elipse(xQuebra + 0.1 * g, 0.04 * g, 0.5 * g, Math.min(0.34 * g, c.hh * 1.1)), 0.04 * g, 0.4, 3.7)
  cena.partes.push(P(po, PO, { bisel: 0, contorno: 0, alfa: 0.4, suave: 2.4, ruga: 1.4, semente: 8300 }))
  PEDRAS_DO_ENTULHO.forEach(([fx, fy, fr], i) => {
    const x = xQuebra + 0.1 * g + fx * g
    const y = fy * Math.min(g, c.h)
    cena.sombras.push(contato(elipse(x, y, fr * g, fr * g * 0.88), 0.3))
    pintarPedacoDeMinerio(P, cena, x, y, fr * g, ENTULHO, 'entulho', 8310 + i * 17)
  })

  // As tábuas do forro que caíram, deitadas no chão em volta do entulho.
  const caidas: readonly (readonly [number, number, number, number])[] = [
    [xQuebra - 0.42 * g, 0.06 * g, 0.62, 0.9],
    [xQuebra + 0.5 * g, -0.08 * g, 0.55, -0.5],
    [xQuebra + 0.18 * g, 0.22 * g, 0.5, 1.45],
  ]
  caidas.forEach(([x, y, comprimento, giro], i) => {
    const tabua = tabuaDoForro(c, x, y, comprimento * g, giro)
    cena.sombras.push(contato(tabua, 0.3))
    cena.partes.push(P(tabua, mad, { eixo: QUARTO - giro, tabua: 0, bisel: 0.8, tom: 0.8 + 0.14 * hash(i, 1, 8350), contorno: 0.3, semente: 8350 + i }))
  })

  // O esteio da esquerda, de pé, e a metade da trave que ficou nele, com a ponta lascada e duas tábuas.
  pintarEsteio(c, cena, m, -m.xEsteio, 8098)
  const esquerda = metadeLascada(-m.xPonta, xQuebra, m.mt, 1, 8400)
  cena.sombras.push({ forma: esquerda, z: m.zTrave, solta: true, forca: 0.3 })
  cena.partes.push(P(esquerda, mad, { eixo: 0, tabua: 0, bisel: m.mt * 0.4, tom: 0.98, contorno: 0.3, ruga: 0.6, semente: 8401 }))
  // A madeira crua da quebra: as farpas claras na ponta.
  const crua = dentroDe(esquerda, caixa(xQuebra - m.mt * 0.9, -m.mt, xQuebra + m.mt * 2, m.mt))
  cena.partes.push(P(crua, mad, { eixo: 0, tabua: 0, bisel: 0.4, tom: 1.32, contorno: 0, alfa: 0.85, semente: 8402 }))
  pintarParafusos(c, cena, -m.xEsteio, 8117)
  pintarForro(c, cena, m, -m.xEsteio + m.rp * 1.6, xQuebra - m.mt * 1.6, 8130)

  // O esteio da direita, torto (o topo saiu para fora e para trás), e a metade da trave caída dele até o chão.
  const base: Ponto = [m.xEsteio, 0]
  const topo: Ponto = [m.xEsteio + 0.1 * g, -0.08 * Math.min(g, c.h)]
  const torto = capsula(base[0], base[1], topo[0], topo[1], m.rp)
  cena.sombras.push({ forma: torto, z: m.zTrave * 0.9, forca: 0.3 }, contato(elipse(base[0], base[1], m.rp, m.rp), 0.34))
  cena.partes.push(P(torto, mad, { eixo: Math.atan2(topo[1] - base[1], topo[0] - base[0]), tabua: 2.4, bisel: 1.2, tom: 0.7, contorno: 0.3, semente: 8500 }))
  cena.partes.push(P(elipseGirada(topo[0], topo[1], m.rp * 0.8, m.rp * 0.68, 0.6), mad, { textura: texTopo(topo[0], topo[1]), bisel: 0.9, tom: 1.02, semente: 8501 }))
  const giro = 0.22
  const desce = 0.12 * g
  const caida = metadeLascada(xQuebra + 0.12 * g, m.xPonta - 0.1 * g, m.mt, -1, 8510)
  // A caixa da metade caída: os quatro cantos da caixa dela, girados e descidos como ela.
  const cantos = [
    [caida.b[0], caida.b[1]],
    [caida.b[2], caida.b[1]],
    [caida.b[2], caida.b[3]],
    [caida.b[0], caida.b[3]],
  ].map(([x, y]) => girar([x, y], m.xPonta, 0, giro))
  const pontosGirados: Forma = {
    b: [Math.min(...cantos.map((p) => p[0])), Math.min(...cantos.map((p) => p[1])) + desce, Math.max(...cantos.map((p) => p[0])), Math.max(...cantos.map((p) => p[1])) + desce],
    d: (x, y) => {
      const [px, py] = girar([x, y - desce], m.xPonta, 0, -giro)
      return caida.d(px, py)
    },
  }
  // Deitada no chão (do esteio torto até o entulho): só o contato. Com sombra de altura ela virava, na 3/4, uma
  // coluna, um bloco de madeira em pé.
  cena.sombras.push(contato(pontosGirados, 0.32))
  cena.partes.push(P(pontosGirados, mad, { eixo: giro, tabua: 0, bisel: m.mt * 0.4, tom: 0.9, contorno: 0.3, ruga: 0.6, projeta: { dist: 1.4, forca: 0.36 }, semente: 8511 }))
  const cruaCaida: Forma = {
    b: pontosGirados.b,
    d: (x, y) => {
      const [px, py] = girar([x, y - desce], m.xPonta, 0, -giro)
      return Math.max(caida.d(px, py), caixa(xQuebra - m.mt * 2, -m.mt, xQuebra + 0.12 * g + m.mt * 0.9, m.mt).d(px, py))
    },
  }
  cena.partes.push(P(cruaCaida, mad, { eixo: giro, tabua: 0, bisel: 0.4, tom: 1.28, contorno: 0, alfa: 0.85, semente: 8512 }))
}
