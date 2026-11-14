/**
 * CAIXAS DE MUNIÇÃO de cima com volume (14/11/2026, a base militar): os
 * caixotes compridos de madeira pintada de verde-oliva, empilhados em dois
 * andares e um pouco tortos. No chão, cinco caixotes deitados em três filas;
 * em cima deles, dois de través, como se empilha para a pilha não correr. O
 * da direita está ABERTO, sem a tampa: dentro, os cartuchos em pé, de latão,
 * com a ponta de cobre. Na frente, duas latas de munição de ferro, com a alça
 * deitada na tampa.
 *
 * Cada caixote tem a tampa de três tábuas pintadas, com a tinta lascada na
 * beira (a madeira crua aparece), as travessas das pontas, os dois fechos de
 * ferro no lado da frente e a marca de estêncil: a faixa amarela de través e
 * as letras em duas linhas. O caixote de cima faz sombra nos de baixo.
 *
 * A 25% de zoom sobram os retângulos verdes cruzados com a faixa clara de
 * cada um e o miolo amarelado de latão do caixote aberto: é o que diz "caixas
 * de munição" e não "pilha de caixas" (a madeira crua do armazém, com lona).
 * As posições são frações da pegada (1,5 x 1 casa de partida) e os lados, em
 * casas: esticada, a pilha afasta os caixotes. A tinta, a madeira das lascas,
 * os cartuchos e as latas são fixos.
 */
import { tomDoMeio } from '../materiais'
import { rgb, type Rgb } from '../../ruido'
import { caixa, capsula, elipse, menos, type Forma } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** A tinta verde-oliva dos caixotes (saturação HSV ~0,32) e a madeira crua que aparece na lasca. */
const VERDE: MaterialDaPeca = { classe: 'liso', rgb: [0x6a, 0x73, 0x4e] }
const MADEIRA_DA_LASCA: Rgb = [0xae, 0x92, 0x68]
/** A tinta do estêncil: amarelo-palha, meio transparente (a tinta verde aparece por baixo). */
const ESTENCIL: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xc8, 0x86] }
const TINTA: OpcoesDaPeca = { tabua: 0, bisel: 0, contorno: 0, alfa: 0.82, suave: 0.25 }
/** As ferragens (fechos), o latão dos cartuchos e o cobre da ponta. */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.95)) }
const LATAO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('latao', 1)) }
const COBRE: MaterialDaPeca = { classe: 'metal', rgb: [0xa8, 0x74, 0x56] }
/** O fundo do caixote aberto, na sombra das paredes. */
const FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x3c, 0x2e] }
/** A lata de munição: chapa de ferro pintada de oliva mais cinza que o caixote. */
const LATA: MaterialDaPeca = { classe: 'metal', rgb: [0x63, 0x69, 0x51] }
/** O escuro em que o pixel escuro demais é levantado: o oliva na sombra (com a nogueira, a junta saía marrom). */
const ESCURO_DO_OLIVA: Rgb = [0x3e, 0x42, 0x30]

/** O caixote: comprimento e largura, em casas. A lata: idem. */
const COMPRIMENTO = 0.72
const LARGURA = 0.3
const COMPRIMENTO_DA_LATA = 0.32
const LARGURA_DA_LATA = 0.16
/** As alturas, em casas: um caixote deitado e a lata. */
const ALTURA_DO_CAIXOTE = 0.3
const ALTURA_DA_LATA = 0.17
/** A travessa da ponta, em fração do meio comprimento. O canto do caixote (px do protótipo). */
const TRAVESSA = 0.085
const CANTO = 0.6
/** Até onde chega a sombra do caixote de cima no de baixo, por casa de degrau, e a força dela. */
const ALCANCE_DA_SOMBRA = Math.hypot(SOMBRA_X, SOMBRA_Y) * 1.25
const FORCA_DA_SOMBRA_NO_DE_BAIXO = 0.46
/** Os cartuchos do caixote aberto: quantos ao comprido e de través. */
const CARTUCHOS_AO_COMPRIDO = 7
const CARTUCHOS_DE_TRAVES = 3

interface Caixote {
  /** O meio, em frações da meia pegada. */
  readonly x: number
  readonly y: number
  readonly ang: number
  /** O andar: 0 no chão, 1 em cima. */
  readonly andar: number
  readonly tom: number
  readonly aberto?: boolean
}

/** Os cinco do chão em três filas (os de trás mais escuros: os de cima tapam a luz) e os dois de través em cima. */
const CAIXOTES: readonly Caixote[] = [
  { x: -0.49, y: -0.665, ang: 0.01, andar: 0, tom: 0.84 },
  { x: 0.5, y: -0.66, ang: -0.015, andar: 0, tom: 0.88 },
  { x: -0.485, y: -0.02, ang: -0.02, andar: 0, tom: 0.9 },
  { x: 0.505, y: 0, ang: 0.025, andar: 0, tom: 0.86 },
  { x: -0.495, y: 0.655, ang: 0.03, andar: 0, tom: 0.94 },
  { x: -0.64, y: -0.07, ang: QUARTO + 0.04, andar: 1, tom: 1.06 },
  { x: 0.4, y: -0.25, ang: QUARTO - 0.05, andar: 1, tom: 1.02, aberto: true },
]
/** As duas latas, na frente à direita. */
const LATAS: readonly { readonly x: number; readonly y: number; readonly ang: number }[] = [
  { x: 0.24, y: 0.69, ang: 0.08 },
  { x: 0.71, y: 0.71, ang: -0.06 },
]

/** A forma `f`, desenhada em volta da origem, girada `ang` e levada para (cx, cy). */
function girada(f: Forma, cx: number, cy: number, ang: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const [x0, y0, x1, y1] = f.b
  const xs: number[] = []
  const ys: number[] = []
  for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
    xs.push(cx + x * co - y * si)
    ys.push(cy + x * si + y * co)
  }
  return {
    b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    d(x, y) {
      const dx = x - cx
      const dy = y - cy
      return f.d(dx * co + dy * si, -dx * si + dy * co)
    },
  }
}

/** Põe uma peça desenhada no referencial do caixote (em volta do meio dele, sem giro). */
type Por = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca) => void

function porNoLugar(c: ContextoDoMovel, cena: Cena, cx: number, cy: number, ang: number): Por {
  return (forma, mat, o) => {
    cena.partes.push(c.peca(girada(forma, cx, cy, ang), mat, { ...o, eixo: (o.eixo ?? 0) + ang }))
  }
}

/**
 * A tinta verde: as pinceladas ao comprido da tábua, a sujeira em manchas largas e as LASCAS, onde a tinta
 * saltou e a madeira crua aparece (mais na beira do caixote, onde ele bate).
 */
function texDaTinta(a: number, b: number, cx: number, cy: number, ang: number): Textura {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return (_u, v, x, y, p, s) => {
    const lx = (x - cx) * co + (y - cy) * si
    const ly = -(x - cx) * si + (y - cy) * co
    const naBeira = Math.max(Math.abs(lx) / a, Math.abs(ly) / b)
    s[3] += Math.sin(v * 2.6 + ruido(x * 0.2, y * 0.2 + p.su) * 2) * 0.025 + ruido(x * 0.09 + p.su, y * 0.09 + p.sv) * 0.12
    const lasca = ruido(x * 0.55 + p.sv, y * 0.55 + p.su) + (naBeira - 0.82) * 1.2
    if (lasca > 0.32) {
      const t = Math.min(1, (lasca - 0.32) * 6)
      s[0] += (MADEIRA_DA_LASCA[0] - s[0]) * t
      s[1] += (MADEIRA_DA_LASCA[1] - s[1]) * t
      s[2] += (MADEIRA_DA_LASCA[2] - s[2]) * t
      s[3] += 0.04 * t
    }
  }
}

/**
 * As letras do estêncil, duas linhas: cada letra é a haste e a perna dela, como a chapa vazada deixa (com
 * blocos cheios as letras viravam janelinhas de prédio). [haste em x, perna em cima (1), embaixo (-1) ou nenhuma (0)].
 */
const LETRAS: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 1], [1, -1], [2, 0], [3, 1], [4, 1], [5, -1]],
  [[0, -1], [1, 1], [2, 1], [4, 0]],
]

/** A marca de estêncil: a faixa de través perto de uma ponta e as duas linhas de letras. */
function marcar(por: Por, a: number, b: number): void {
  por(caixa(a * 0.5, -b * 0.82, a * 0.62, b * 0.82), ESTENCIL, TINTA)
  const passo = a * 0.13
  const traco = Math.max(0.55, a * 0.035)
  LETRAS.forEach((linha, l) => {
    const y = b * (l === 0 ? -0.3 : 0.3)
    const meia = b * 0.18
    for (const [i, perna] of linha) {
      const x = -a * 0.68 + i * passo
      por(caixa(x, y - meia, x + traco, y + meia), ESTENCIL, TINTA)
      if (perna !== 0) por(caixa(x, y - perna * meia - traco / 2, x + passo * 0.6, y - perna * meia + traco / 2), ESTENCIL, TINTA)
    }
  })
}

/** A tampa de três tábuas, as travessas das pontas com os pregos e os dois fechos de ferro da frente. */
function tampar(por: Por, a: number, b: number, c: Caixote, sem: number, textura: Textura): void {
  por(caixa(-a + 0.5, -b + 0.5, a - 0.5, b - 0.5, 0.5), VERDE, { tabua: (2 * b - 1) / 3, bisel: 0.8, tom: c.tom, textura, semente: sem + 1 })
  const t = a * TRAVESSA
  for (const lado of [-1, 1]) {
    const x0 = lado < 0 ? -a + 0.3 : a - 0.3 - 2 * t
    por(caixa(x0, -b + 0.3, x0 + 2 * t, b - 0.3, 0.4), VERDE, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom: c.tom * 1.08, textura, semente: sem + 2 + lado, projeta: { dist: 0.8, forca: 0.28, suave: 0.7 } })
    for (const fy of [-0.6, 0.6]) por(elipse(x0 + t, fy * b, 0.5, 0.5), PREGO, { bisel: 0.5, contorno: 0, metal: 0.2 })
  }
  for (const fx of [-0.42, 0.42]) {
    por(caixa(a * fx - 1.1, b - 2.2, a * fx + 1.1, b + 0.4, 0.4), FERRO, { tabua: 0, bisel: 0.5, tom: 1.04, contorno: 0.3, metal: 0.32, semente: sem + 5, projeta: { dist: 0.5, forca: 0.3 } })
  }
}

/** O caixote sem tampa: as paredes, o fundo escuro e os cartuchos em pé, de latão, com a ponta de cobre. */
function abrir(por: Por, a: number, b: number, c: Caixote, sem: number, textura: Textura): void {
  const parede = 1.3
  por(menos(caixa(-a, -b, a, b, CANTO), caixa(-a + parede, -b + parede, a - parede, b - parede)), VERDE, { tabua: 0, bisel: 0.6, tom: c.tom * 1.06, textura, semente: sem + 1 })
  const ax = a - parede
  const by = b - parede
  por(caixa(-ax, -by, ax, by), FUNDO, { tabua: 0, bisel: 0, contorno: 0, recesso: { k: 2.4, forca: 0.4 }, semente: sem + 2 })
  const passoX = (2 * ax) / CARTUCHOS_AO_COMPRIDO
  const passoY = (2 * by) / CARTUCHOS_DE_TRAVES
  const r = Math.min(passoX, passoY) * 0.42
  for (let i = 0; i < CARTUCHOS_AO_COMPRIDO; i += 1) {
    for (let j = 0; j < CARTUCHOS_DE_TRAVES; j += 1) {
      const x = -ax + (i + 0.5) * passoX
      const y = -by + (j + 0.5) * passoY
      por(elipse(x, y, r, r), LATAO, { tabua: 0, bisel: r * 0.7, tom: 1.02, contorno: 0.24, metal: 0.55, semente: sem + 10 + i * 3 + j, projeta: { dist: 0.6, forca: 0.34 } })
      por(elipse(x - r * 0.08, y - r * 0.08, r * 0.5, r * 0.5), COBRE, { tabua: 0, bisel: r * 0.5, tom: 1.06, contorno: 0.1, metal: 0.5, semente: sem + 40 + i * 3 + j })
    }
  }
}

function montarCaixote(c: ContextoDoMovel, cena: Cena, cx: Caixote, sem: number): void {
  const a = (c.g * COMPRIMENTO) / 2
  const b = (c.g * LARGURA) / 2
  const x = cx.x * c.hw
  const y = cx.y * c.hh
  const contorno = girada(caixa(-a, -b, a, b, CANTO), x, y, cx.ang)
  const topo = c.g * ALTURA_DO_CAIXOTE * (cx.andar + 1)
  if (cx.andar > 0) cena.sombras.push({ forma: contorno, z: topo, forca: 0.3 })
  else cena.sombras.push({ forma: contorno, z: topo }, contato(contorno, 0.32))
  const por = porNoLugar(c, cena, x, y, cx.ang)
  const textura = texDaTinta(a, b, x, y, cx.ang)
  por(caixa(-a, -b, a, b, CANTO), VERDE, {
    tabua: 0,
    bisel: 0.8,
    tom: cx.tom * 0.7,
    contorno: 0.32,
    semente: sem,
    projeta: cx.andar > 0 ? { dist: c.g * ALTURA_DO_CAIXOTE * ALCANCE_DA_SOMBRA, forca: FORCA_DA_SOMBRA_NO_DE_BAIXO, suave: 1.3 } : undefined,
  })
  if (cx.aberto === true) {
    abrir(por, a, b, cx, sem, textura)
    return
  }
  tampar(por, a, b, cx, sem, textura)
  marcar(por, a, b)
}

/** A lata de munição: a caixa de chapa, a tampa com a beira dobrada, a alça deitada e o fecho na ponta. */
function montarLata(c: ContextoDoMovel, cena: Cena, x: number, y: number, ang: number, sem: number): void {
  const a = (c.g * COMPRIMENTO_DA_LATA) / 2
  const b = (c.g * LARGURA_DA_LATA) / 2
  const contorno = girada(caixa(-a, -b, a, b, 0.8), x, y, ang)
  cena.sombras.push({ forma: contorno, z: c.g * ALTURA_DA_LATA }, contato(contorno, 0.34))
  const por = porNoLugar(c, cena, x, y, ang)
  por(caixa(-a, -b, a, b, 0.8), LATA, { tabua: 0, bisel: 0.7, tom: 0.86, contorno: 0.32, metal: 0.18, semente: sem })
  por(caixa(-a + 0.9, -b + 0.9, a - 0.9, b - 0.9, 0.6), LATA, { tabua: 0, bisel: 0.9, tom: 1.04, contorno: 0.2, metal: 0.22, semente: sem + 1 })
  por(caixa(a * 0.3, -b + 0.9, a * 0.44, b - 0.9), ESTENCIL, TINTA)
  por(capsula(-a * 0.45, 0, a * 0.2, 0, 0.75), FERRO, { tabua: 0, bisel: 0.75, tom: 0.9, contorno: 0.3, metal: 0.36, semente: sem + 2, projeta: { dist: 0.7, forca: 0.32 } })
  por(caixa(-a - 0.3, -b * 0.4, -a + 1.6, b * 0.4, 0.4), FERRO, { tabua: 0, bisel: 0.5, tom: 1.08, contorno: 0.3, metal: 0.36, semente: sem + 3 })
}

export const montarCaixasDeMunicao: MontarMovel = (c, cena) => {
  cena.corDoPiso = ESCURO_DO_OLIVA
  LATAS.forEach((l, i) => montarLata(c, cena, l.x * c.hw, l.y * c.hh, l.ang, 9100 + i * 10))
  CAIXOTES.forEach((cx, i) => montarCaixote(c, cena, cx, 9000 + i * 12))
}
