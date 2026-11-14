/**
 * PALETES DE MADEIRA empilhados, de cima com volume (L06 dos objetos novos,
 * 14/11/2026, grupo Base militar). Três paletes um em cima do outro, cada um
 * um pouco torto em relação ao de baixo, como quem empilhou com pressa: as
 * beiradas dos de baixo aparecem em volta do de cima, com a sombra dele por
 * cima. Cada palete é o de carga de sempre: as cinco TÁBUAS do tampo ao
 * comprido (as duas das beiras mais largas), com as FRESTAS entre elas
 * deixando ver as três TRAVESSAS de baixo e o escuro do vão; os PREGOS onde a
 * tábua cruza a travessa. O de cima tem uma tábua QUEBRADA no meio, com as
 * pontas lascadas mostrando a madeira clara de dentro, e o carimbo apagado
 * na ponta de uma tábua.
 *
 * A 25% de zoom sobra o retângulo claro riscado de frestas escuras e
 * paralelas, com as travessas atravessadas no fundo: é o que diz "palete" e
 * não "caixa" (o X das ripas) nem "pilha de tábuas" (sem fresta nem travessa).
 *
 * NA 3/4 fica como de cima (perfil em pé com a sombra de baixo forte, como a
 * pilha de caixas): derivada, a pilha subia num bloco e a frente varrida, lisa,
 * apagava as frestas.
 *
 * Material: `madeira` (o pinho de partida, a madeira clara de palete). As
 * medidas saem do menor meio lado da pegada (1 x 1 casa de partida).
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type Cena, type MaterialDaPeca, type Peca } from './motor'
import { G, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Um palete da pilha: o meio e o giro (frações do menor meio lado; radianos). */
interface Palete {
  readonly x: number
  readonly y: number
  readonly ang: number
}

/** De baixo para cima: cada um um pouco torto em relação ao de baixo. */
const PILHA: readonly Palete[] = [
  { x: -0.05, y: 0.06, ang: -0.06 },
  { x: 0.05, y: -0.04, ang: 0.05 },
  { x: 0, y: 0.02, ang: -0.015 },
]
/** O meio comprimento (ao longo das tábuas) e a meia largura de um palete, em frações do menor meio lado. */
const MEIO_COMPRIMENTO = 0.86
const MEIA_LARGURA = 0.76
/** As tábuas do tampo, de uma beira à outra, em fração da largura; o que sobra vira as quatro frestas. */
const TABUAS: readonly number[] = [0.2, 0.135, 0.17, 0.135, 0.2]
/** As três travessas de baixo: o meio de cada uma (fração do meio comprimento) e a meia largura (fração do menor meio lado). */
const TRAVESSAS: readonly number[] = [-0.88, 0, 0.88]
const MEIA_TRAVESSA = 0.09
/** A grossura de um palete, em casas (a altura de cada andar da pilha). */
const GROSSURA_DO_PALETE = 0.1
/** O tom de cada tábua: a madeira de palete é de tábua de tudo que é tom (as beiras pegam mais tempo). */
const TONS_DAS_TABUAS: readonly number[] = [0.9, 1.04, 0.97, 1.08, 0.88]
/**
 * A tábua quebrada do palete de cima (o índice) e o vão que ficou, em frações do meio comprimento: a ponta
 * de dentro de cada pedaço é lascada.
 */
const TABUA_QUEBRADA = 3
const VAO_DA_QUEBRA: readonly [number, number] = [0.2, 0.5]
const DENTES_DA_LASCA = 4
/** A madeira de dentro, na quebra (o cerne claro dos destroços). */
const CERNE: Rgb = [0xcf, 0xae, 0x7c]
/** O carimbo apagado na ponta de uma tábua: tinta escura rala. */
const CARIMBO: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x3a, 0x2c] }
/** O vão de dentro do palete, entre as travessas: quase sem luz. */
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x2e, 0x24] }

/** Um retângulo (x0..x1, y0..y1 no referencial do palete) posto no mapa pelo meio (cx, cy) e o giro. */
function noPalete(cx: number, cy: number, ang: number, pontos: readonly Ponto[]): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return poligono(pontos.map(([x, y]): Ponto => [cx + x * co - y * si, cy + x * si + y * co]))
}

function retangulo(x0: number, y0: number, x1: number, y1: number): Ponto[] {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
}

/** A ponta lascada de uma tábua em x, de y0 a y1: os dentes entram para o lado de `para` (-1 ou 1). */
function lasca(x: number, y0: number, y1: number, para: -1 | 1, fundo: number, sem: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let k = 0; k <= DENTES_DA_LASCA * 2; k += 1) {
    const entra = k % 2 === 1 ? 0.35 + 0.65 * hash(k, sem, 31) : 0.1 * hash(k, sem, 32)
    pontos.push([x + para * fundo * entra, y0 + ((y1 - y0) * k) / (DENTES_DA_LASCA * 2)])
  }
  return pontos
}

function montarPalete(c: ContextoDoMovel, cena: Cena, L: Peca[], pal: Palete, andar: number, deCima: boolean): void {
  const P = c.peca
  const mad = c.m.madeira
  const R = Math.min(c.hw, c.hh)
  const cx = pal.x * R
  const cy = pal.y * R
  const a = MEIO_COMPRIMENTO * R
  const b = MEIA_LARGURA * R
  const corpo = noPalete(cx, cy, pal.ang, retangulo(-a, -b, a, b))
  const sem = 31000 + andar * 100
  cena.sombras.push({ forma: corpo, z: GROSSURA_DO_PALETE * G * (andar + 1), forca: 0.3 })

  // O vão escuro de dentro, que faz a sombra do palete nos de baixo.
  L.push(P(corpo, VAO, { tabua: 0, bisel: 0.6, contorno: 0.3, recesso: { k: 2, forca: 0.3 }, semente: sem, projeta: andar > 0 ? { dist: 2.6, forca: 0.42, suave: 1.3 } : undefined }))
  // As travessas de baixo, de través, vistas pelas frestas.
  TRAVESSAS.forEach((f, i) => {
    const x = f * a
    const m = MEIA_TRAVESSA * R
    const x0 = Math.max(-a, x - m)
    const x1 = Math.min(a, x + m)
    L.push(P(noPalete(cx, cy, pal.ang, retangulo(x0, -b + 0.3, x1, b - 0.3)), mad, { eixo: pal.ang + QUARTO, tabua: 0, bisel: 0.7, tom: 0.72, contorno: 0.2, semente: sem + 1 + i }))
  })

  // As tábuas do tampo ao comprido, com as frestas entre elas e os pregos sobre as travessas.
  const fresta = ((1 - TABUAS.reduce((s, t) => s + t, 0)) * 2 * b) / (TABUAS.length - 1)
  let y = -b
  TABUAS.forEach((t, i) => {
    const y0 = y
    const y1 = y + t * 2 * b
    y = y1 + fresta
    const tom = TONS_DAS_TABUAS[(i + andar * 2) % TONS_DAS_TABUAS.length] * (0.96 + 0.08 * hash(i, andar, 33))
    const opcoes = { eixo: pal.ang, tabua: 0, bisel: 0.9, tom, contorno: 0.26, semente: sem + 10 + i, projeta: { dist: 0.9, forca: 0.3 } }
    if (deCima && i === TABUA_QUEBRADA) {
      const [q0, q1] = [VAO_DA_QUEBRA[0] * a, VAO_DA_QUEBRA[1] * a]
      const fundo = (y1 - y0) * 0.9
      const quebra: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, CERNE, 0.6) }
      const pedacos: readonly Ponto[][] = [
        [[-a, y0], ...lasca(q0, y0, y1, -1, fundo, sem + 20), [-a, y1]],
        [...lasca(q1, y1, y0, 1, fundo, sem + 21), [a, y0], [a, y1]],
      ]
      pedacos.forEach((pontos, j) => {
        const forma = noPalete(cx, cy, pal.ang, pontos)
        L.push(P(forma, mad, { ...opcoes, semente: sem + 22 + j }))
        // A madeira clara de dentro, só na faixa da ponta lascada.
        const xq = j === 0 ? q0 : q1
        const faixa = noPalete(cx, cy, pal.ang, retangulo(xq - fundo * 1.1, y0, xq + fundo * 1.1, y1))
        L.push(P({ b: forma.b, d: (px, py) => Math.max(forma.d(px, py), faixa.d(px, py)) }, quebra, { eixo: pal.ang, tabua: 0, bisel: 0.5, contorno: 0.16, semente: sem + 24 + j }))
      })
    } else {
      L.push(P(noPalete(cx, cy, pal.ang, retangulo(-a, y0, a, y1)), mad, opcoes))
    }
    for (const f of TRAVESSAS) {
      const x = f * a * 0.97
      if (deCima && i === TABUA_QUEBRADA && x > VAO_DA_QUEBRA[0] * a - 2 && x < VAO_DA_QUEBRA[1] * a + 2) continue
      for (const v of [0.28, 0.72]) {
        const [px, py] = [x, y0 + (y1 - y0) * v]
        const co = Math.cos(pal.ang)
        const si = Math.sin(pal.ang)
        L.push(P(elipse(cx + px * co - py * si, cy + px * si + py * co, 0.6, 0.6), PREGO, { bisel: 0.5, contorno: 0, metal: 0.25, semente: sem + 40 + i }))
      }
    }
  })
  // O carimbo apagado na ponta da tábua do meio do palete de cima.
  if (deCima) {
    const yMeio = 0
    L.push(P(noPalete(cx, cy, pal.ang, retangulo(-a * 0.8, yMeio - b * 0.1, -a * 0.56, yMeio + b * 0.1)), CARIMBO, { bisel: 0, contorno: 0, alfa: 0.32, semente: sem + 60 }))
  }
}

export const montarPaletesDeMadeira: MontarMovel = (c, cena) => {
  const L = cena.partes
  PILHA.forEach((pal, i) => montarPalete(c, cena, L, pal, i, i === PILHA.length - 1))
  // A pilha inteira assenta no chão: o contato largo debaixo de todos.
  const R = Math.min(c.hw, c.hh)
  const pegada = PILHA.map((p) => noPalete(p.x * R, p.y * R, p.ang, retangulo(-MEIO_COMPRIMENTO * R, -MEIA_LARGURA * R, MEIO_COMPRIMENTO * R, MEIA_LARGURA * R))).reduce(uniao)
  cena.sombras.push(contato(pegada, 0.34))
}
