/**
 * CARRINHO DE MINA (L04 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Cavernas e
 * mina): a vagoneta que corre no trilho da galeria, vista de cima. Uma CAIXA de tábuas em forma de tina (as paredes de
 * dentro descem em rampa até o fundo), com a BORDA de ferro rebitada em volta, as CANTONEIRAS nos quatro cantos e duas
 * CINTAS de cada lado comprido; por baixo, as quatro RODAS de ferro aparecem nos lados compridos, e nas pontas ficam o
 * ENGATE (a argola na frente, o gancho atrás).
 *
 * Dentro da tina a luz é a de sempre (de cima à esquerda): a parede de dentro do lado de baixo e da direita olha para
 * a luz e acende, a de cima e da esquerda fica na sombra, e o fundo, afundado, recebe a sombra da borda.
 *
 * Três versões no mesmo tipo (`versoes/carrinhoDeMinaVersoes.ts`):
 * - VAZIO (a 1ª, `montarCarrinhoDeMina`);
 * - COM MINÉRIO (`montarCarrinhoDeMinaComMinerio`): a tina cheia até a borda de pedras de ferro (o pedaço da Pilha de
 *   minério, `pilhaDeMinerio.ts`), mais alta no meio;
 * - COM OURO (`montarCarrinhoDeMinaComOuro`): a mesma carga com o veio de ouro, as pepitas e dois brilhos.
 *
 * Corre ao comprido (no x da pegada, 1 x 0,8 casa de partida): no trilho de mina a caixa cabe entre as beiras dos
 * dormentes. A caixa e as rodas saem de frações da pegada (esticado, o carrinho cresce junto); a borda, os rebites e
 * o engate, do menor lado. A sombra é a da caixa solta acima das rodas (como a da carroça) e o contato das rodas.
 * Na 3/4 (`tresQuartos.ts`, derivado) a caixa é um tampo solto com a beirada da altura da tina
 * (`ESPESSURA_DA_CAIXA_DO_CARRINHO`): a carga e o engate têm a caixa com o meio dentro dela, para subirem juntos.
 *
 * Materiais: `madeira` (as tábuas da tina) e `ferragens` (a borda, as cantoneiras, as cintas, as rodas e o engate).
 * A pedra da carga é fixa. Sem luz.
 */
import { hash } from '../../ruido'
import { anel, caixa, capsula, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, type Cena, type MaterialDaPeca } from './motor'
import { G, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { pintarPedacoDeMinerio, type Minerio } from './pilhaDeMinerio'
import { pintarBrilho, pintarPepita } from './tesouroDeOuro'

// ---------- as medidas ----------

/** A caixa por fora (fração da meia pegada): o resto, nas pontas, é do engate, e nos lados, das rodas. */
const CAIXA_X = 0.78
const CAIXA_Y = 0.78
/** A borda de ferro, a rampa das paredes de dentro até o fundo e o raio dos cantos (fração do menor lado). */
const BORDA = 0.095
const RAMPA = 0.12
const CANTO = 0.07
/** As tábuas: a largura nas paredes e no fundo (fração do menor lado). */
const TABUA_DA_PAREDE = 0.065
const TABUA_DO_FUNDO = 0.15
/** O tom de cada parede de dentro, pelo lado para onde olha: a de baixo e a da direita olham para a luz. */
const TOM_DA_PAREDE = { cima: 0.6, esquerda: 0.66, baixo: 0.94, direita: 0.98 } as const
const TOM_DO_FUNDO = 0.66
/** Os rebites da borda: o passo e o raio (fração do menor lado). */
const PASSO_DO_REBITE = 0.13
const RAIO_DO_REBITE = 0.017
/** As cantoneiras (o lado do quadrado) e as cintas (a largura e onde ficam, fração da meia caixa). */
const CANTONEIRA = 0.17
const CINTA = 0.075
const LUGAR_DAS_CINTAS = 0.46
/** As rodas: o meio (fração da meia caixa), o meio comprimento (fração do menor lado) e o quanto saem da caixa. */
const LUGAR_DAS_RODAS = 0.56
const MEIA_RODA = 0.14
const RODA_PARA_FORA = 0.085
/** O tom do ferro da roda: escuro, mas não preto (na primeira folha, a 0,74 com contorno forte, liam quatro pílulas). */
const TOM_DA_RODA = 0.64
/** O friso de ferro em cima da borda de madeira, do lado de dentro (a beira que a carga gasta). */
const FRISO_DA_BORDA = 0.03
/** O engate: o comprimento da haste, o raio da argola e a grossura do ferro (fração do menor lado). */
const HASTE = 0.07
const ARGOLA = 0.055
const FERRO_DO_ENGATE = 0.022
/** A altura da caixa acima do chão (casas): a sombra solta dela. */
const ALTURA_DA_CAIXA = 0.36
/** A beirada da caixa na 3/4 (px do protótipo): a altura da tina. */
export const ESPESSURA_DA_CAIXA_DO_CARRINHO = 0.34 * G

/** A pedra da carga, fixa: o cinza-pardo da rocha da mina (o carrinho não tem lugar de pedra no painel). */
const PEDRA_DA_CARGA: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0x72, 0x6a, 0x60] }

/** A mesma forma numa caixa com o meio em (mx, my): a 3/4 sobe a peça com a estrutura que contém esse ponto. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

interface Medidas {
  /** A meia caixa por fora, a meia boca (a beira de dentro da borda) e o meio fundo. */
  readonly bx: number
  readonly by: number
  readonly ix: number
  readonly iy: number
  readonly fx: number
  readonly fy: number
  readonly s: number
}

function medidas(c: ContextoDoMovel): Medidas {
  const s = Math.min(c.w, c.h)
  const bx = c.hw * CAIXA_X
  const by = c.hh * CAIXA_Y
  const ix = bx - BORDA * s
  const iy = by - BORDA * s
  return { bx, by, ix, iy, fx: ix - RAMPA * s, fy: iy - RAMPA * s, s }
}

/** As rodas embaixo da caixa: de cima aparecem as pontas delas, para fora dos lados compridos. */
function pintarRodas(c: ContextoDoMovel, cena: Cena, m: Medidas): void {
  const P = c.peca
  const ferro = c.m.ferragens
  const r = MEIA_RODA * m.s
  ;[-1, 1].forEach((lx) => {
    ;[-1, 1].forEach((ly) => {
      const x = lx * m.bx * LUGAR_DAS_RODAS
      const dentro = ly * (m.by - 0.05 * m.s)
      const fora = ly * (m.by + RODA_PARA_FORA * m.s)
      const meiaGrossura = Math.abs(fora - dentro) / 2
      const y = (dentro + fora) / 2
      const roda = capsula(x - r + meiaGrossura, y, x + r - meiaGrossura, y, meiaGrossura)
      cena.sombras.push(contato(roda, 0.32))
      cena.partes.push(P(roda, ferro, { tabua: 0, eixo: 0, bisel: meiaGrossura * 0.7, tom: TOM_DA_RODA, contorno: 0.26, metal: 0.32, semente: 5100 + lx * 3 + ly }))
      // O friso da roda (a aba que segura no trilho), do lado de dentro.
      const friso = capsula(x - r * 0.86, dentro + ly * 0.6, x + r * 0.86, dentro + ly * 0.6, 0.55)
      cena.partes.push(P(friso, ferro, { tabua: 0, bisel: 0.3, tom: 0.56, contorno: 0, metal: 0.2, semente: 5110 + lx * 3 + ly }))
    })
  })
}

/** O engate: a argola na frente (+x) e o gancho atrás (-x), presos na borda por uma haste curta. */
function pintarEngate(c: ContextoDoMovel, cena: Cena, m: Medidas): void {
  const P = c.peca
  const ferro = c.m.ferragens
  const e = FERRO_DO_ENGATE * m.s
  const haste = HASTE * m.s
  const ra = ARGOLA * m.s
  ;[-1, 1].forEach((lado) => {
    const x0 = lado * (m.bx - 0.4)
    const x1 = lado * (m.bx + haste)
    const ponta = capsula(x0, 0, x1, 0, e * 1.2)
    cena.partes.push(P(comMeioEm(ponta, lado * (m.bx - 2), 0), ferro, { tabua: 0, bisel: e, tom: 0.84, contorno: 0.34, metal: 0.4, semente: 5200 + lado, projeta: { dist: 1, forca: 0.36 } }))
    const cx = x1 + lado * ra * 0.8
    const forma: Forma = lado > 0 ? anel(cx, 0, ra, ra * 0.86, ra - e * 1.6, ra * 0.86 - e * 1.6) : menos(anel(cx, 0, ra, ra * 0.86, ra - e * 1.6, ra * 0.86 - e * 1.6), caixa(cx - ra * 1.2, -ra * 0.3, cx - ra * 0.2, ra * 0.3))
    cena.partes.push(P(comMeioEm(forma, lado * (m.bx - 2), 0), ferro, { tabua: 0, bisel: e * 0.8, tom: 0.92, contorno: 0.34, metal: 0.42, semente: 5210 + lado, projeta: { dist: 1, forca: 0.36 } }))
  })
}

/** A tina por dentro: as quatro paredes em rampa, cada uma no tom do lado para onde olha, e o fundo de tábuas. */
function pintarTina(c: ContextoDoMovel, cena: Cena, m: Medidas): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  const { ix, iy, fx, fy, s } = m
  // O corpo inteiro de madeira por baixo de tudo: é a maior peça da caixa, e a 3/4 tira dela a frente (com o friso de
  // ferro maior que as tábuas, a frente saía de ferro).
  L.push(P(caixa(-m.bx, -m.by, m.bx, m.by, CANTO * s), mad, { eixo: 0, tabua: 0, bisel: 0.6, tom: 0.9, contorno: 0.3, semente: 5299 }))
  const tabua = TABUA_DA_PAREDE * s
  const paredes: readonly (readonly [readonly Ponto[], number, number])[] = [
    [[[-ix, -iy], [ix, -iy], [fx, -fy], [-fx, -fy]], 0, TOM_DA_PAREDE.cima],
    [[[-ix, -iy], [-fx, -fy], [-fx, fy], [-ix, iy]], QUARTO, TOM_DA_PAREDE.esquerda],
    [[[-fx, fy], [fx, fy], [ix, iy], [-ix, iy]], 0, TOM_DA_PAREDE.baixo],
    [[[fx, -fy], [ix, -iy], [ix, iy], [fx, fy]], QUARTO, TOM_DA_PAREDE.direita],
  ]
  paredes.forEach(([pontos, eixo, tom], i) => {
    L.push(P(poligono(pontos), mad, { eixo, tabua, bisel: 0.4, tom, contorno: 0.16, semente: 5300 + i }))
  })
  L.push(P(caixa(-fx, -fy, fx, fy, 0.6), mad, { eixo: 0, tabua: TABUA_DO_FUNDO * s, bisel: 0.5, tom: TOM_DO_FUNDO, contorno: 0.2, recesso: { k: 3.4, forca: 0.32 }, semente: 5310 }))
}

/**
 * A borda por cima de tudo: as quatro tábuas de cima da tina (a madeira, com o veio ao comprido de cada lado), o friso
 * de ferro na beira de dentro, os rebites, as cintas dos lados compridos e as cantoneiras. Na primeira folha a borda
 * inteira era de ferro e a 3/4, que estica a beira de baixo para fazer a frente, saía uma chapa cinza lisa: com a
 * tábua por fora, a frente é de madeira com as cintas e as cantoneiras de ferro.
 */
function pintarBorda(c: ContextoDoMovel, cena: Cena, m: Medidas): void {
  const P = c.peca
  const ferro = c.m.ferragens
  const mad = c.m.madeira
  const L = cena.partes
  const { bx, by, ix, iy, s } = m
  const tabuas: readonly (readonly [Forma, number])[] = [
    [caixa(-bx, -by, bx, -iy, CANTO * s * 0.5), 0],
    [caixa(-bx, iy, bx, by, CANTO * s * 0.5), 0],
    [caixa(-bx, -iy, -ix, iy), QUARTO],
    [caixa(ix, -iy, bx, iy), QUARTO],
  ]
  tabuas.forEach(([forma, eixo], i) => {
    L.push(P(forma, mad, { eixo, tabua: 0, bisel: 0.8, tom: 1.02 + 0.05 * hash(i, 1, 5401), contorno: 0.3, semente: 5400 + i }))
  })
  const friso = FRISO_DA_BORDA * s
  L.push(P(menos(caixa(-ix - friso, -iy - friso, ix + friso, iy + friso, CANTO * s * 0.5), caixa(-ix, -iy, ix, iy, CANTO * s * 0.4)), ferro, { tabua: 0, bisel: 0.5, tom: 0.92, contorno: 0.26, metal: 0.42, semente: 5405 }))
  const meioDaBorda = ((BORDA - FRISO_DA_BORDA) * s) / 2
  const rebite = RAIO_DO_REBITE * s
  const pontos: Ponto[] = []
  const nx = Math.max(2, Math.round((2 * bx) / (PASSO_DO_REBITE * s)))
  for (let i = 1; i < nx; i += 1) {
    const x = -bx + (i * 2 * bx) / nx
    pontos.push([x, -by + meioDaBorda], [x, by - meioDaBorda])
  }
  const ny = Math.max(2, Math.round((2 * by) / (PASSO_DO_REBITE * s)))
  for (let j = 1; j < ny; j += 1) {
    const y = -by + (j * 2 * by) / ny
    pontos.push([-bx + meioDaBorda, y], [bx - meioDaBorda, y])
  }
  pontos.forEach(([x, y], i) => {
    L.push(P(elipse(x, y, rebite, rebite), ferro, { tabua: 0, bisel: rebite * 0.8, tom: 1.08, contorno: 0.2, metal: 0.5, semente: 5410 + i }))
  })
  // As cintas: a chapa que abraça a borda de fora para dentro, dos dois lados compridos.
  const cinta = CINTA * s
  ;[-1, 1].forEach((lx) => {
    ;[-1, 1].forEach((ly) => {
      const x = lx * bx * LUGAR_DAS_CINTAS
      const y0 = ly * (by + 0.4)
      const y1 = ly * (iy - 0.06 * s)
      L.push(P(caixa(x - cinta / 2, Math.min(y0, y1), x + cinta / 2, Math.max(y0, y1), 0.5), ferro, { tabua: 0, bisel: 0.6, tom: 0.84, contorno: 0.34, metal: 0.36, semente: 5500 + lx * 3 + ly, projeta: { dist: 0.7, forca: 0.3 } }))
      L.push(P(elipse(x, ly * (by - meioDaBorda), rebite * 1.1, rebite * 1.1), ferro, { tabua: 0, bisel: rebite, tom: 1.1, contorno: 0.2, metal: 0.5, semente: 5510 + lx * 3 + ly }))
    })
  })
  // As cantoneiras: a chapa quadrada dobrada em cada canto, com um rebite.
  const lado = CANTONEIRA * s
  ;[-1, 1].forEach((lx) => {
    ;[-1, 1].forEach((ly) => {
      const x = lx * bx
      const y = ly * by
      const chapa = caixa(Math.min(x, x - lx * lado), Math.min(y, y - ly * lado), Math.max(x, x - lx * lado), Math.max(y, y - ly * lado), CANTO * s)
      L.push(P(menos(chapa, caixa(-ix, -iy, ix, iy, CANTO * s * 0.5)), ferro, { tabua: 0, bisel: 0.8, tom: 0.86, contorno: 0.34, metal: 0.4, semente: 5600 + lx * 3 + ly, projeta: { dist: 0.6, forca: 0.3 } }))
      L.push(P(elipse(x - lx * lado * 0.5, y - ly * meioDaBorda, rebite * 1.15, rebite * 1.15), ferro, { tabua: 0, bisel: rebite, tom: 1.12, contorno: 0.2, metal: 0.5, semente: 5610 + lx * 3 + ly }))
    })
  })
}

/** Os lugares da carga: o meio (frações da meia boca) e o raio (fração do menor lado), da beira para o alto. */
const CARGA: readonly (readonly [number, number, number])[] = [
  [-0.74, -0.6, 0.12],
  [-0.24, -0.66, 0.13],
  [0.28, -0.64, 0.12],
  [0.76, -0.58, 0.12],
  [-0.78, 0.04, 0.12],
  [0.8, 0.06, 0.125],
  [-0.7, 0.66, 0.12],
  [-0.2, 0.7, 0.13],
  [0.3, 0.68, 0.12],
  [0.76, 0.62, 0.118],
  [-0.4, -0.18, 0.15],
  [0.4, -0.12, 0.15],
  [-0.36, 0.34, 0.14],
  [0.32, 0.36, 0.145],
  [-0.02, 0.06, 0.17],
]

/** A carga até a borda: o leito de pedra miúda e os pedaços por cima, os do meio mais altos (pintados por último). */
function pintarCarga(c: ContextoDoMovel, cena: Cena, m: Medidas, minerio: Minerio): void {
  const P = c.peca
  const { ix, iy, s } = m
  const leito = caixa(-ix + 0.4, -iy + 0.4, ix - 0.4, iy - 0.4, CANTO * s * 0.5)
  cena.partes.push(P(leito, PEDRA_DA_CARGA, { bisel: 0.8, contorno: 0.2, tom: 0.5, ruga: 1.8, semente: 5700 }))
  CARGA.forEach(([fx, fy, fr], i) => {
    const x = fx * (ix - fr * s * 0.55)
    const y = fy * (iy - fr * s * 0.55)
    const semente = 5710 + i * 13 + (minerio === 'ouro' ? 400 : 0)
    pintarPedacoDeMinerio(P, cena, x, y, fr * s, PEDRA_DA_CARGA, minerio, semente, Math.atan2(fy, fx))
  })
  if (minerio === 'ouro') {
    pintarPepita(P, cena, -0.5 * ix, 0.2 * iy, 0.045 * s, 1.04, 5900)
    pintarPepita(P, cena, 0.58 * ix, 0.46 * iy, 0.04 * s, 1, 5907)
    pintarPepita(P, cena, 0.12 * ix, -0.48 * iy, 0.038 * s, 1.02, 5914)
    pintarBrilho(P, cena, -0.16 * ix, -0.1 * iy, 0.085 * s, 5920)
    pintarBrilho(P, cena, 0.5 * ix, 0.3 * iy, 0.06 * s, 5921)
  }
}

function montarCarrinho(c: ContextoDoMovel, cena: Cena, carga: Minerio | null): void {
  const m = medidas(c)
  const corpo = caixa(-m.bx, -m.by, m.bx, m.by, CANTO * m.s)
  cena.sombras.push({ forma: corpo, z: ALTURA_DA_CAIXA * c.g, solta: true, forca: 0.3 })
  pintarRodas(c, cena, m)
  pintarEngate(c, cena, m)
  pintarTina(c, cena, m)
  if (carga !== null) pintarCarga(c, cena, m, carga)
  pintarBorda(c, cena, m)
  // No vazio, as pedrinhas que sobraram da última carga, no canto da sombra do fundo.
  if (carga === null) {
    const P = c.peca
    const p = 0.05 * m.s
    for (let i = 0; i < 5; i += 1) {
      const x = -m.fx + p * (1.2 + 2.2 * hash(i, 1, 5801))
      const y = -m.fy + p * (1 + 2.4 * hash(i, 2, 5801))
      const r = p * (0.35 + 0.3 * hash(i, 3, 5801))
      cena.partes.push(P(elipse(x, y, r, r * 0.85), PEDRA_DA_CARGA, { bisel: r * 0.5, contorno: 0.2, tom: 0.7 + 0.2 * hash(i, 4, 5801), semente: 5810 + i }))
    }
  }
}

export const montarCarrinhoDeMina: MontarMovel = (c, cena) => {
  montarCarrinho(c, cena, null)
}

export const montarCarrinhoDeMinaComMinerio: MontarMovel = (c, cena) => {
  montarCarrinho(c, cena, 'ferro')
}

export const montarCarrinhoDeMinaComOuro: MontarMovel = (c, cena) => {
  montarCarrinho(c, cena, 'ouro')
}
