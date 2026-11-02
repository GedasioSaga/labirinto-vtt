import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from './ruido'

/**
 * CHÃO DE METAL (pedido de 02/11/2026: o chão de um mapa em raios, salão
 * redondo e corredores largos, "tipo estação ou nave"). Um cartão só, quatro
 * formas, medidas em CASAS como os outros chãos de masmorra (Convés, Lajotas,
 * Calçamento):
 *
 * - PLACAS: placas quadradas de uma casa, rebite em cada canto, fresta fina
 *   entre elas (a forma padrão, cara de nave e de estação);
 * - CHAPA XADREZ: chapa antiderrapante, gomos em grão de arroz cruzados, em
 *   chapas de 2 × 1 casas assentadas em fiada (cara de fábrica e de porão);
 * - GRADE: grelha vazada de passarela, um painel por casa, as fendas de um
 *   painel deitadas e as do vizinho em pé, o escuro de baixo aparecendo;
 * - PAINÉIS DE NAVE: painéis grandes e lisos de cantos chanfrados, com linhas
 *   de encaixe e faixas (futurista limpo).
 *
 * O tom (decisão do usuário): aço cinza, frio e contido, com desgaste leve.
 * Nada de cromo nem de cor: o azul passa o vermelho por poucos níveis. O
 * desgaste (manchas suaves e arranhões finos) é todo MENOR que uma casa: de
 * perto ele se lê, de longe some na média e nada marca o período do ladrilho
 * (8 casas). Pelo mesmo motivo, cada peça varia de tom só uns poucos por cento.
 *
 * A junta de cada forma cai na linha da grade (a casa é a placa, o painel da
 * grelha), simétrica em volta dela: a emenda do ladrilho, que também cai lá,
 * fica no meio da fresta. A luz vem de cima à esquerda, como no resto.
 */

/** O ladrilho mede 8 casas de lado (128 px por casa no ladrilho de 1024). */
export const METAL_CASAS = 8

/** Uma volta sem emenda em [0, 1). */
function naVolta(t: number): number {
  return t - Math.floor(t)
}

function escolher(tons: readonly Rgb[], sorteio: number): Rgb {
  return tons[Math.floor(sorteio * tons.length) % tons.length]
}

/** A fresta entre duas peças, em casas a partir da linha: no `fio`, a cor dela; no `fim`, a peça inteira. */
const FRESTA = { fio: 0.009, fim: 0.02 } as const
/** O quanto a fresta cobre a peça no fio (o resto é a peça: os dois lados dela ficam quase iguais). */
const FRESTA_FORCA = 0.9
/** A beirada da peça, chanfrada: em casas, onde começa a pegar a luz e onde ela acaba (na fresta). */
const CHANFRO = { largura: 0.045, fio: 0.016 } as const

/**
 * Desgaste comum às quatro: manchas suaves em duas escalas, ambas menores que
 * uma casa (12 e 40 células no ladrilho de 8 casas), e o grão miúdo. Devolve
 * a variação da luz.
 */
function desgaste(u: number, v: number, semente: number, forca: number): number {
  const mancha = fbm(u, v, 12, 3, semente) * 0.04 + fbm(u, v, 40, 2, semente + 1) * 0.012
  const grao = (valor(u * 768, v * 768, 768, semente + 2) - 0.5) * 0.026
  return (mancha + grao) * forca
}

/**
 * Arranhões finos numa peça de `largura` × `altura` casas (ponto em casas
 * dentro dela): até `quantos` riscos retos de rumo sorteado, mais claros (o aço
 * nu), finos e de pontas que somem. Devolve a força do risco no ponto, de 0 a 1.
 * O rumo sai de um vetor sorteado e normalizado, sem seno: a mesma conta em
 * qualquer navegador.
 */
function arranhao(lx: number, ly: number, largura: number, altura: number, peca: number, semente: number, quantos: number, chance: number): number {
  let risco = 0
  for (let k = 0; k < quantos; k += 1) {
    const s = semente + k * 11
    if (hash(peca, k, s) > chance) continue
    const meio = 0.06 + 0.2 * hash(peca, k, s + 4)
    const cx = (0.1 + 0.8 * hash(peca, k, s + 1)) * largura
    const cy = (0.1 + 0.8 * hash(peca, k, s + 2)) * altura
    const px = lx - cx
    const py = ly - cy
    if (Math.abs(px) > meio + 0.01 || Math.abs(py) > meio + 0.01) continue
    let dx = hash(peca, k, s + 3) * 2 - 1
    let dy = hash(peca, k, s + 6) * 2 - 1
    const n = Math.sqrt(dx * dx + dy * dy) || 1
    dx /= n
    dy /= n
    const ao = px * dx + py * dy
    if (Math.abs(ao) >= meio) continue
    const fora = Math.abs(py * dx - px * dy)
    const traco = passoSuave(0.006, 0.0015, fora) * passoSuave(meio, meio * 0.45, Math.abs(ao))
    risco = Math.max(risco, traco * (0.55 + 0.45 * hash(peca, k, s + 5)))
  }
  return risco
}

/**
 * A beirada de uma peça retangular: a fresta escura na linha e o chanfro (o
 * lado de cima e o da esquerda pegam a luz, o de baixo e o da direita caem na
 * sombra). Distâncias em casas até cada lado.
 */
function comBeirada(c: Rgb, esquerda: number, direita: number, cima: number, baixo: number, corDaFresta: Rgb, chanfro: { luz: number; sombra: number }): Rgb {
  const claro = Math.min(esquerda, cima)
  const escuro = Math.min(direita, baixo)
  let r = luz(c, passoSuave(CHANFRO.largura, CHANFRO.fio, claro) * chanfro.luz - passoSuave(CHANFRO.largura, CHANFRO.fio, escuro) * chanfro.sombra)
  const borda = Math.min(claro, escuro)
  r = misturar(r, corDaFresta, passoSuave(FRESTA.fim, FRESTA.fio, borda) * FRESTA_FORCA)
  return r
}

/**
 * Um rebite (ou parafuso) de cabeça abaulada em (dx, dy) casas do centro:
 * a cabeça um pouco mais clara que a chapa, acesa em cima à esquerda, e a
 * sombra curta que ela joga para baixo à direita.
 */
function comRebite(c: Rgb, dx: number, dy: number, raio: number, abaulado: number): Rgb {
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d > raio * 1.6) return c
  // A sombra: o ponto embaixo à direita que, olhando para a luz, vê a cabeça.
  const sx = dx - raio * 0.4
  const sy = dy - raio * 0.4
  const cabeca = passoSuave(raio + 0.003, raio - 0.003, d)
  const sombra = passoSuave(raio + 0.006, raio - 0.004, Math.sqrt(sx * sx + sy * sy)) * (1 - cabeca)
  let r = luz(c, -0.25 * sombra)
  if (cabeca > 0) {
    const t = Math.min(1, d / raio)
    const inclinacao = abaulado * t
    const nx = d > 0 ? dx / d : 0
    const ny = d > 0 ? dy / d : 0
    // A cabeça desce para fora: a inclinação aponta para o centro.
    const brilho = luzNaInclinacao(-nx * inclinacao, -ny * inclinacao) - LUZ_NO_PLANO
    r = misturar(r, luz(c, 0.08 + brilho * 0.45), cabeca)
  }
  return r
}

// ---------------------------------------------------------------------------
// Placas: uma por casa, rebite nos quatro cantos.

const PLACAS_TONS: readonly Rgb[] = [rgb('#585d62'), rgb('#595e63'), rgb('#575c61'), rgb('#5a5f64'), rgb('#585d62'), rgb('#575c61')]
const PLACAS_FRESTA = rgb('#2c2f32')
const PLACAS_CHANFRO = { luz: 0.07, sombra: 0.085 } as const
/**
 * Rebite: o recuo do canto e o raio, em casas. Exagerado de propósito: no
 * Meio-Termo o chão é lido com uns 40-50 px por casa, e um rebite menor que
 * isso some no tom da chapa.
 */
const PLACAS_REBITE = { recuo: 0.1, raio: 0.05 } as const

function placas(u: number, v: number): number {
  const x = naVolta(u) * METAL_CASAS
  const y = naVolta(v) * METAL_CASAS
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const placa = iy * METAL_CASAS + ix
  let c = escolher(PLACAS_TONS, hash(ix, iy, 511))
  c = luz(c, (hash(ix, iy, 512) - 0.5) * 0.02 + desgaste(u, v, 513, 1))
  c = luz(c, arranhao(fx, fy, 1, 1, placa, 520, 3, 0.55) * 0.07)
  // A sujeira que junta na beira, perto da fresta.
  const borda = Math.min(fx, 1 - fx, fy, 1 - fy)
  c = luz(c, -0.035 * passoSuave(0.08, 0.015, borda))
  const { recuo, raio } = PLACAS_REBITE
  c = comRebite(c, fx - (fx < 0.5 ? recuo : 1 - recuo), fy - (fy < 0.5 ? recuo : 1 - recuo), raio, 1.1)
  return empacotar(comBeirada(c, fx, 1 - fx, fy, 1 - fy, PLACAS_FRESTA, PLACAS_CHANFRO))
}

// ---------------------------------------------------------------------------
// Chapa xadrez: chapas de 2 × 1 casas em fiada (a fila de baixo uma casa
// adiante), cada uma com 10 × 5 gomos em grão de arroz, cada gomo cruzado com
// os quatro vizinhos (deitado, em pé, em xadrez). Deitado e em pé, e não a
// 45°: a luz vem da diagonal, e o gomo a 45° alinhado com ela fazia sombra
// diferente do outro; de longe, a chapa virava hachura numa direção só. O
// gomo é abaulado e o topo dele é um nada mais claro: o pé gasta a ponta.

const XADREZ_TONS: readonly Rgb[] = [rgb('#5c6064'), rgb('#5d6165'), rgb('#5b5f63'), rgb('#5c6064'), rgb('#5e6266'), rgb('#5b5f63')]
const XADREZ_FRESTA = rgb('#2e3134')
const XADREZ_CHANFRO = { luz: 0.06, sombra: 0.075 } as const
const XADREZ_CHAPA = { largura: 2, altura: 1 } as const
const XADREZ_GOMOS_POR_CASA = 5
/**
 * O gomo, na célula de lado 1: metade do comprimento do eixo, raio no meio,
 * quanto ele afina nas pontas (o grão de arroz), quanto abaula, e o tamanho da sombra.
 */
const GOMO = { meio: 0.27, raio: 0.12, afina: 0.5, abaulado: 0.9, sombra: 0.055 } as const
const RAIZ_DE_MEIO = Math.SQRT1_2

/** O raio do gomo no ponto `ao` do eixo: cheio no meio, afinando para as pontas. */
function raioDoGomo(ao: number): number {
  const t = ao / GOMO.meio
  return GOMO.raio * (1 - GOMO.afina * t * t)
}

function chapaXadrez(u: number, v: number): number {
  const x = naVolta(u) * METAL_CASAS
  const y = naVolta(v) * METAL_CASAS
  const fila = Math.floor(y)
  // Em fiada: a fila ímpar anda uma casa (meia chapa).
  const xs = x + (fila % 2)
  const porFila = METAL_CASAS / XADREZ_CHAPA.largura
  const coluna = Math.floor(xs / XADREZ_CHAPA.largura)
  const lx = xs - coluna * XADREZ_CHAPA.largura
  const ly = y - fila
  const qual = coluna % porFila
  const chapa = fila * porFila + qual
  let c = escolher(XADREZ_TONS, hash(qual, fila, 611))
  c = luz(c, (hash(qual, fila, 612) - 0.5) * 0.015 + desgaste(u, v, 613, 1))
  c = luz(c, arranhao(lx, ly, XADREZ_CHAPA.largura, XADREZ_CHAPA.altura, chapa, 620, 3, 0.5) * 0.06)
  // O gomo da célula do ponto (nenhum passa da célula: a chapa termina inteira).
  const gx = lx * XADREZ_GOMOS_POR_CASA
  const gy = ly * XADREZ_GOMOS_POR_CASA
  const i = Math.floor(gx)
  const j = Math.floor(gy)
  const qx = gx - i - 0.5
  const qy = gy - j - 0.5
  const deitado = (i + j) % 2 === 0
  // Distância ao eixo do gomo (um segmento): no ponto e no ponto que olha para a luz (a sombra).
  const ao = deitado ? qx : qy
  const travado = Math.max(-GOMO.meio, Math.min(GOMO.meio, ao))
  const ox = deitado ? qx - travado : qx
  const oy = deitado ? qy : qy - travado
  const d = Math.sqrt(ox * ox + oy * oy)
  const sx = qx - GOMO.sombra
  const sy = qy - GOMO.sombra
  const aoS = Math.max(-GOMO.meio, Math.min(GOMO.meio, deitado ? sx : sy))
  const dS = deitado ? Math.sqrt((sx - aoS) ** 2 + sy * sy) : Math.sqrt(sx * sx + (sy - aoS) ** 2)
  const raio = raioDoGomo(travado)
  const raioS = raioDoGomo(aoS)
  const gomo = passoSuave(raio + 0.025, raio - 0.025, d)
  const sombra = passoSuave(raioS + 0.03, raioS - 0.02, dS) * (1 - gomo)
  c = luz(c, -0.18 * sombra)
  if (gomo > 0) {
    const t = Math.min(1, d / raio)
    const inclinacao = GOMO.abaulado * t
    const nx = d > 0 ? ox / d : 0
    const ny = d > 0 ? oy / d : 0
    const brilho = luzNaInclinacao(-nx * inclinacao, -ny * inclinacao) - LUZ_NO_PLANO
    c = misturar(c, luz(c, 0.06 + brilho * 0.42), gomo)
  }
  return empacotar(comBeirada(c, lx, XADREZ_CHAPA.largura - lx, ly, 1 - ly, XADREZ_FRESTA, XADREZ_CHANFRO))
}

// ---------------------------------------------------------------------------
// Grade: um painel de grelha por casa, com moldura cheia em volta; dentro,
// 4 × 2 fendas compridas entre barras. O painel vizinho gira 90° (xadrez), e
// assim nenhuma direção ganha: de longe a grelha não vira listra. Pelas
// fendas, o escuro de baixo, mais escuro ainda na sombra da barra (em cima à
// esquerda da fenda). A barra tem a beirada abaulada pela mesma luz.

const GRADE_BARRA = rgb('#575c61')
const GRADE_VAZIO = rgb('#353a40')
const GRADE_FUNDO = rgb('#282b2f')
/** A moldura do painel e a meia largura das barras, em casas. */
const GRADE_MOLDURA = 0.05
const GRADE_MEIA_BARRA = 0.03
/** Fendas por painel: atravessadas e ao comprido. */
const GRADE_FENDAS = { atravessadas: 4, comprido: 1 } as const
/** Meia largura da borda macia da fenda e da beirada abaulada da barra, em casas. */
const GRADE_MACIO = 0.004
const GRADE_BEIRADA = 0.014
/** Para onde a sombra da barra cai dentro da fenda, em casas (embaixo à direita). */
const GRADE_SOMBRA = 0.04

/** Distância assinada (positiva dentro) até a borda da fenda mais perto, num eixo do painel, em casas. */
function dentroDaFenda(t: number, quantas: number): number {
  const util = 1 - 2 * GRADE_MOLDURA
  const passo = util / quantas
  const local = (t - GRADE_MOLDURA) / passo
  const k = Math.min(quantas - 1, Math.max(0, Math.floor(local)))
  const centro = GRADE_MOLDURA + (k + 0.5) * passo
  return passo / 2 - GRADE_MEIA_BARRA - Math.abs(t - centro)
}

/** Dentro da fenda (positivo) ou na barra (negativo), em casas, no painel `girado` ou não. */
function fendaNoPainel(fx: number, fy: number, girado: boolean): number {
  const atravessado = girado ? fx : fy
  const comprido = girado ? fy : fx
  return Math.min(dentroDaFenda(atravessado, GRADE_FENDAS.atravessadas), dentroDaFenda(comprido, GRADE_FENDAS.comprido))
}

/** A altura da barra: 1 no meio dela, descendo até 0 na boca da fenda (a beirada abaulada). */
function alturaDaBarra(fx: number, fy: number, girado: boolean): number {
  return passoSuave(0, -GRADE_BEIRADA, fendaNoPainel(fx, fy, girado))
}

const PASSO_DA_LUZ = 0.003

function grade(u: number, v: number): number {
  const x = naVolta(u) * METAL_CASAS
  const y = naVolta(v) * METAL_CASAS
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const girado = (ix + iy) % 2 === 1
  const painel = iy * METAL_CASAS + ix
  // A barra: o aço, o desgaste e a beirada pela inclinação da altura.
  let barra = luz(GRADE_BARRA, (hash(ix, iy, 711) - 0.5) * 0.03 + desgaste(u, v, 712, 1))
  barra = luz(barra, arranhao(fx, fy, 1, 1, painel, 720, 2, 0.35) * 0.06)
  const dhx = (alturaDaBarra(fx + PASSO_DA_LUZ, fy, girado) - alturaDaBarra(fx - PASSO_DA_LUZ, fy, girado)) / (2 * PASSO_DA_LUZ)
  const dhy = (alturaDaBarra(fx, fy + PASSO_DA_LUZ, girado) - alturaDaBarra(fx, fy - PASSO_DA_LUZ, girado)) / (2 * PASSO_DA_LUZ)
  const inclinacao = GRADE_BEIRADA * 0.9
  barra = luz(barra, (luzNaInclinacao(dhx * inclinacao, dhy * inclinacao) - LUZ_NO_PLANO) * 0.15)
  // O vazio: o fundo lá embaixo, manchado de leve, e a sombra da barra.
  const s = fendaNoPainel(fx, fy, girado)
  const fenda = passoSuave(-GRADE_MACIO, GRADE_MACIO, s)
  let c = barra
  if (fenda > 0) {
    const naSombra = 1 - passoSuave(-GRADE_MACIO, GRADE_MACIO * 3, fendaNoPainel(fx - GRADE_SOMBRA, fy - GRADE_SOMBRA, girado))
    let vazio = luz(GRADE_VAZIO, fbm(u, v, 16, 2, 713) * 0.1 + (valor(u * 384, v * 384, 384, 714) - 0.5) * 0.03)
    vazio = misturar(vazio, GRADE_FUNDO, naSombra * 0.75)
    c = misturar(barra, vazio, fenda)
  }
  // Entre dois painéis, a fresta fina.
  const borda = Math.min(fx, 1 - fx, fy, 1 - fy)
  c = misturar(c, GRADE_FUNDO, passoSuave(FRESTA.fim, FRESTA.fio, borda) * 0.7)
  return empacotar(c)
}

// ---------------------------------------------------------------------------
// Painéis de nave: painéis de 2 × 2 casas de cantos chanfrados; onde quatro
// cantos se encontram, sobra um losango mais escuro, a peça de encaixe. Em
// xadrez, um painel leva a linha de encaixe por dentro da borda e o vizinho,
// uma faixa rebaixada no meio, deitada ou em pé (alternando): nenhuma direção
// ganha, e nada fica em listra.
//
// O desenho é REGULAR de propósito (período de 4 casas): a primeira versão
// sorteava painéis inteiros e partidos, e de longe o sorteio do ladrilho de 8
// casas se repetia à vista. Num piso de nave a repetição é do projeto; o
// sorteio fica só no tom, nos arranhões e nas manchas.

const PAINEIS_TONS: readonly Rgb[] = [rgb('#5f6469'), rgb('#60656a'), rgb('#5e6368'), rgb('#61666b'), rgb('#5f6469'), rgb('#5e6368')]
const PAINEIS_FRESTA = rgb('#303337')
const PAINEIS_CHANFRO = { luz: 0.065, sombra: 0.08 } as const
const PAINEIS_ENCAIXE = rgb('#4f5358')
/** O lado do painel, o corte dos cantos (em casas, ao longo do lado), o recuo da linha de encaixe e a meia largura da faixa. */
const PAINEIS_LADO = 2
const PAINEIS_CANTO = 0.12
const PAINEIS_LINHA = 0.11
const PAINEIS_FAIXA = 0.17

function paineis(u: number, v: number): number {
  const x = naVolta(u) * METAL_CASAS
  const y = naVolta(v) * METAL_CASAS
  const bx = Math.floor(x / PAINEIS_LADO)
  const by = Math.floor(y / PAINEIS_LADO)
  const largura = PAINEIS_LADO
  const altura = PAINEIS_LADO
  const lx = x - bx * PAINEIS_LADO
  const ly = y - by * PAINEIS_LADO
  const esquerda = lx
  const direita = largura - lx
  const cima = ly
  const baixo = altura - ly
  // A linha a 45° que corta cada canto (distância assinada, positiva do lado do painel).
  const cantoTL = (esquerda + cima - PAINEIS_CANTO) * RAIZ_DE_MEIO
  const cantoTR = (direita + cima - PAINEIS_CANTO) * RAIZ_DE_MEIO
  const cantoBL = (esquerda + baixo - PAINEIS_CANTO) * RAIZ_DE_MEIO
  const cantoBR = (direita + baixo - PAINEIS_CANTO) * RAIZ_DE_MEIO
  const canto = Math.min(cantoTL, cantoTR, cantoBL, cantoBR)
  if (canto < 0) {
    // A peça de encaixe: uma só com as dos cantos vizinhos (a linha da grade não corta o losango).
    const encaixe = luz(PAINEIS_ENCAIXE, desgaste(u, v, 817, 0.5))
    return empacotar(misturar(encaixe, PAINEIS_FRESTA, passoSuave(FRESTA.fim, FRESTA.fio, -canto) * FRESTA_FORCA))
  }
  const painel = by * (METAL_CASAS / PAINEIS_LADO) + bx
  let c = escolher(PAINEIS_TONS, hash(painel, 0, 812))
  c = luz(c, (hash(painel, 1, 813) - 0.5) * 0.015 + desgaste(u, v, 814, 0.65))
  c = luz(c, arranhao(lx, ly, largura, altura, painel, 820, 2, 0.4) * 0.05)
  if ((bx + by) % 2 === 0) {
    // A linha de encaixe por dentro da borda, seguindo o chanfro.
    const corpo = Math.min(esquerda, direita, cima, baixo, canto)
    // Fio de uns 1,5 px na casa de 50 px: mais fino que isso, o Meio-Termo apaga.
    c = luz(c, -0.18 * passoSuave(0.014, 0.004, Math.abs(corpo - PAINEIS_LINHA)))
  } else {
    // A faixa rebaixada no meio: deitada numa coluna de painéis, em pé na outra.
    const meio = bx % 2 === 0 ? Math.abs(ly - altura / 2) : Math.abs(lx - largura / 2)
    c = luz(c, -0.08 * passoSuave(PAINEIS_FAIXA + 0.004, PAINEIS_FAIXA - 0.004, meio))
    c = luz(c, -0.15 * passoSuave(0.012, 0.003, Math.abs(meio - PAINEIS_FAIXA)))
  }
  // A beirada: chanfro claro em cima, à esquerda e no canto de cima à esquerda; escuro do lado oposto.
  const claro = Math.min(esquerda, cima, cantoTL)
  const escuro = Math.min(direita, baixo, cantoBR)
  c = luz(c, passoSuave(CHANFRO.largura, CHANFRO.fio, claro) * PAINEIS_CHANFRO.luz - passoSuave(CHANFRO.largura, CHANFRO.fio, escuro) * PAINEIS_CHANFRO.sombra)
  const borda = Math.min(esquerda, direita, cima, baixo, canto)
  return empacotar(misturar(c, PAINEIS_FRESTA, passoSuave(FRESTA.fim, FRESTA.fio, borda) * FRESTA_FORCA))
}

export { chapaXadrez as metalEmChapaXadrez, grade as metalEmGrade, paineis as metalEmPaineis, placas as metalEmPlacas }
