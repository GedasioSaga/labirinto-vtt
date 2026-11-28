/**
 * TRILHO DE MINA (L04 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Cavernas e mina):
 * a linha estreita da galeria por onde corre o carrinho, vista de cima. Os DORMENTES de madeira atravessados, cada um
 * um nada torto e de um tom, os dois TRILHOS de ferro por cima (o pé escuro e o boleto gasto, que brilha), os
 * CRAVOS dos dois lados de cada trilho em cada dormente e, por baixo de tudo, o LEITO de cascalho escuro com as
 * pedrinhas entre os dormentes.
 *
 * Três versões no mesmo tipo (`versoes/trilhoDeMinaVersoes.ts`):
 * - RETO (a 1ª, `montarTrilhoDeMina`): corre ao comprido da pegada e ESTICA: os dormentes não esticam, se repetem
 *   (um a cada `PASSO_DO_DORMENTE` da largura da linha), e o primeiro e o último ficam a meio passo da ponta, para dois
 *   pedaços postos um depois do outro emendarem no mesmo ritmo;
 * - CURVA (`montarTrilhoDeMinaCurva`): um quarto de volta da beira da esquerda (na faixa de cima) à beira de baixo
 *   (na faixa da direita), com o meio no canto de baixo à esquerda: em 1 x 1 casa é a curva fechada de uma casa; em
 *   2 x 2, a de raio 1,5 casa, que emenda com retos de uma casa de largura. Os dormentes ficam de través na curva;
 * - BATENTE (`montarTrilhoDeMinaBatente`): o fim da linha. Os trilhos param na VIGA de madeira atravessada, com a chapa
 *   de ferro de frente para o carrinho, os dois ESCORAS para trás e o MONTE de terra e pedra que segura tudo.
 *
 * A largura da linha é a do menor lado da pegada, até uma casa (a bitola não engorda com o objeto esticado de lado,
 * para emendar com os outros pedaços). Objeto de chão (as fichas e o carrinho passam por cima): na 3/4 fica como de
 * cima. Materiais: `madeira` (os dormentes, a viga e as escoras do batente) e `trilhos` (os trilhos, os cravos e a
 * chapa). O cascalho, a terra e a pedra do batente são fixos. Sem luz.
 */
import { hash } from '../../ruido'
import { anel, barra, caixa, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type Cena, type MaterialDaPeca } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { pintarPedacoDeMinerio } from './pilhaDeMinerio'
import { ondular } from './tesouroDeOuro'

// ---------- as medidas, em frações da largura da linha (`b`) ----------

/** A bitola (de um trilho ao outro, no meio deles), o pé e o boleto do trilho. */
const BITOLA = 0.56
const PE_DO_TRILHO = 0.078
const BOLETO = 0.042
/** O dormente: o comprimento, a largura e o passo de um ao outro. */
const DORMENTE = { comprimento: 0.86, largura: 0.15 } as const
const PASSO_DO_DORMENTE = 0.33
/** Na curva, o quanto o dormente passa do trilho de dentro (menos que do lado de fora). */
const DENTRO_DA_CURVA = 0.09
/** O quanto cada dormente sai do lugar: de lado, no giro e no comprimento. */
const TORTO = { lado: 0.026, giro: 0.05, comprimento: 0.045 } as const
/** Os cravos: o quanto ficam do meio do trilho e o raio. */
const CRAVO = { fora: 0.066, raio: 0.02 } as const
/** O leito de cascalho: a largura, a força e as pedrinhas por casa de linha (e o raio delas). */
const LEITO = { largura: 0.98, alfa: 0.4 } as const
const PEDRINHAS_POR_CASA = 16
const RAIO_DA_PEDRINHA = 0.018
/** O batente: o espaço que ele toma no fim da linha, a viga (a grossura), as escoras e o monte de trás. */
const BATENTE = { fundo: 0.44, viga: 0.17, escora: 0.11, monte: 0.15 } as const
/** A altura da viga do batente (casas): a sombra curta dela no chão. */
const ALTURA_DA_VIGA = 0.3
/** As pedras do monte do batente: o lugar (ao comprido a partir do meio do monte, e de través) e o raio, em `b`. */
const PEDRAS_DO_MONTE: readonly (readonly [number, number, number])[] = [
  [-0.04, -0.26, 0.085],
  [0.02, 0.02, 0.1],
  [-0.06, 0.28, 0.08],
]

// ---------- os materiais fixos ----------

/** O cascalho do leito: cinza-pardo escuro, a rocha moída da mina. */
const CASCALHO: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0x5e, 0x57, 0x4e] }
/** A terra do monte do batente e a pedra dele. */
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: [0x6c, 0x5d, 0x4c] }
const PEDRA_DO_MONTE: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0x78, 0x72, 0x6a] }

/** A largura da linha (px): o menor lado da pegada, até uma casa. */
function larguraDaLinha(c: ContextoDoMovel): number {
  return Math.min(c.w, c.h, c.g)
}

/**
 * A linha reta, num referencial próprio: `u` ao comprido (de -comprimento/2 a +comprimento/2) e `v` de través. Os
 * pontos e as caixas passam para a pegada pelo `ponto` (deitada, u é o x; de pé, u é o y).
 */
interface Reta {
  readonly deitada: boolean
  readonly comprimento: number
  readonly b: number
  ponto(u: number, v: number): Ponto
  caixa(u0: number, v0: number, u1: number, v1: number, raio?: number): Forma
  /** O eixo do veio ao comprido (u) e de través (v), na pegada. */
  readonly eixoU: number
  readonly eixoV: number
}

function reta(c: ContextoDoMovel): Reta {
  const deitada = c.w >= c.h
  return {
    deitada,
    comprimento: deitada ? c.w : c.h,
    b: larguraDaLinha(c),
    ponto: (u, v) => (deitada ? [u, v] : [v, u]),
    caixa: (u0, v0, u1, v1, raio = 0) => (deitada ? caixa(u0, v0, u1, v1, raio) : caixa(v0, u0, v1, u1, raio)),
    eixoU: deitada ? 0 : QUARTO,
    eixoV: deitada ? QUARTO : 0,
  }
}

/** As pedrinhas do leito numa faixa: `quantas`, cada uma num ponto que `onde(sorteio1, sorteio2)` dá. */
function pintarPedrinhas(c: ContextoDoMovel, cena: Cena, quantas: number, onde: (a: number, b: number) => Ponto, semente: number): void {
  const P = c.peca
  const r = RAIO_DA_PEDRINHA * larguraDaLinha(c)
  for (let i = 0; i < quantas; i += 1) {
    const [x, y] = onde(hash(i, 1, semente), hash(i, 2, semente))
    const ri = r * (0.6 + 0.8 * hash(i, 3, semente))
    cena.partes.push(P(elipse(x, y, ri, ri * 0.82), CASCALHO, { bisel: ri * 0.5, contorno: 0.24, tom: 0.82 + 0.4 * hash(i, 4, semente), alfa: 0.9, semente: semente + i }))
  }
}

/** Os dormentes de `u0` a `u1`, no passo da linha (meio passo de folga em cada ponta). */
function pintarDormentesRetos(c: ContextoDoMovel, cena: Cena, r: Reta, u0: number, u1: number, semente: number): number[] {
  const P = c.peca
  const mad = c.m.madeira
  const { b } = r
  const n = Math.max(1, Math.round((u1 - u0) / (PASSO_DO_DORMENTE * b)))
  const passo = (u1 - u0) / n
  const lugares: number[] = []
  for (let i = 0; i < n; i += 1) {
    const u = u0 + (i + 0.5) * passo
    lugares.push(u)
    const lado = (hash(i, 1, semente) - 0.5) * 2 * TORTO.lado * b
    const giro = (hash(i, 2, semente) - 0.5) * 2 * TORTO.giro
    const meio = ((DORMENTE.comprimento + (hash(i, 3, semente) - 0.5) * 2 * TORTO.comprimento) * b) / 2
    const [ax, ay] = r.ponto(u + Math.sin(giro) * meio, lado - Math.cos(giro) * meio)
    const [bx, by] = r.ponto(u - Math.sin(giro) * meio, lado + Math.cos(giro) * meio)
    const dormente = barra(ax, ay, bx, by, DORMENTE.largura * b)
    cena.sombras.push(contato(dormente, 0.22))
    cena.partes.push(P(dormente, mad, { eixo: r.eixoV + giro * (r.deitada ? -1 : 1), tabua: 0, bisel: 1, tom: 0.84 + 0.2 * hash(i, 4, semente), contorno: 0.3, semente: semente + 10 + i }))
  }
  return lugares
}

/** Os dois trilhos de `u0` a `u1`: o pé escuro e, por cima, o boleto gasto que brilha. */
function pintarTrilhosRetos(c: ContextoDoMovel, cena: Cena, r: Reta, u0: number, u1: number): void {
  const P = c.peca
  const ferro = c.m.trilhos
  const { b } = r
  for (const lado of [-1, 1]) {
    const v = (lado * BITOLA * b) / 2
    cena.partes.push(P(r.caixa(u0, v - (PE_DO_TRILHO * b) / 2, u1, v + (PE_DO_TRILHO * b) / 2), ferro, { eixo: r.eixoU, tabua: 0, bisel: 0.5, tom: 0.62, contorno: 0.32, metal: 0.3, projeta: { dist: 0.8, forca: 0.36 }, semente: 6100 + lado }))
    cena.partes.push(P(r.caixa(u0, v - (BOLETO * b) / 2, u1, v + (BOLETO * b) / 2), ferro, { eixo: r.eixoU, tabua: 0, bisel: 0.3, tom: 1.14, contorno: 0, metal: 0.62, semente: 6110 + lado }))
  }
}

/** Os cravos dos dois lados de cada trilho, em cada dormente. */
function pintarCravosRetos(c: ContextoDoMovel, cena: Cena, r: Reta, lugares: readonly number[]): void {
  const P = c.peca
  const ferro = c.m.trilhos
  const { b } = r
  const raio = CRAVO.raio * b
  lugares.forEach((u, i) => {
    for (const lado of [-1, 1]) {
      for (const k of [-1, 1]) {
        const [x, y] = r.ponto(u, (lado * BITOLA * b) / 2 + k * CRAVO.fora * b)
        cena.partes.push(P(caixa(x - raio, y - raio, x + raio, y + raio, raio * 0.4), ferro, { tabua: 0, bisel: raio * 0.6, tom: 0.7, contorno: 0.26, metal: 0.3, semente: 6200 + i * 4 + (lado + 1) + (k + 1) / 2 }))
      }
    }
  })
}

/** O leito de cascalho reto, de `u0` a `u1`, e as pedrinhas dele. */
function pintarLeitoReto(c: ContextoDoMovel, cena: Cena, r: Reta, u0: number, u1: number): void {
  const P = c.peca
  const { b } = r
  const meia = (LEITO.largura * b) / 2
  cena.partes.push(P(r.caixa(u0, -meia, u1, meia, b * 0.06), CASCALHO, { bisel: 0, contorno: 0, alfa: LEITO.alfa, suave: b * 0.04, ruga: 1.6, tom: 0.9, semente: 6000 }))
  const quantas = Math.round((PEDRINHAS_POR_CASA * (u1 - u0)) / c.g)
  pintarPedrinhas(c, cena, quantas, (a, k) => r.ponto(u0 + a * (u1 - u0), (k - 0.5) * 2 * meia * 0.92), 6010)
}

export const montarTrilhoDeMina: MontarMovel = (c, cena) => {
  const r = reta(c)
  const meio = r.comprimento / 2
  pintarLeitoReto(c, cena, r, -meio, meio)
  const lugares = pintarDormentesRetos(c, cena, r, -meio, meio, 6300)
  pintarTrilhosRetos(c, cena, r, -meio, meio)
  pintarCravosRetos(c, cena, r, lugares)
}

// ---------- a curva ----------

/** Um quarto do perímetro da elipse (Ramanujan): o comprimento da curva no meio da linha. */
function quartoDaElipse(rx: number, ry: number): number {
  return (Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)))) / 4
}

export const montarTrilhoDeMinaCurva: MontarMovel = (c, cena) => {
  const P = c.peca
  const mad = c.m.madeira
  const ferro = c.m.trilhos
  const { hw, hh } = c
  const b = larguraDaLinha(c)
  // O meio da curva no canto de baixo à esquerda; a linha entra pela beira da esquerda e sai pela de baixo.
  const cx = -hw
  const cy = hh
  const rx = c.w - b / 2
  const ry = c.h - b / 2
  const pegada = caixa(-hw, -hh, hw, hh)
  const faixa = (de: number, ate: number): Forma => dentroDe(anel(cx, cy, rx + ate, ry + ate, Math.max(0.5, rx + de), Math.max(0.5, ry + de)), pegada)

  // O leito e as pedrinhas dele, ao longo da curva.
  const meiaLeito = (LEITO.largura * b) / 2
  cena.partes.push(P(faixa(-meiaLeito, meiaLeito), CASCALHO, { bisel: 0, contorno: 0, alfa: LEITO.alfa, suave: b * 0.04, ruga: 1.6, tom: 0.9, semente: 6000 }))
  const comprimento = quartoDaElipse(rx, ry)
  pintarPedrinhas(c, cena, Math.round((PEDRINHAS_POR_CASA * comprimento) / c.g), (a, k) => {
    const t = -Math.PI / 2 + a * (Math.PI / 2)
    const d = (k - 0.5) * 2 * meiaLeito * 0.9
    const nx = Math.cos(t) / rx
    const ny = Math.sin(t) / ry
    const n = Math.hypot(nx, ny) || 1
    return [cx + rx * Math.cos(t) + (nx / n) * d, cy + ry * Math.sin(t) + (ny / n) * d]
  }, 6010)

  // Os dormentes de través na curva, no passo dos retos medido no meio da linha (na curva de uma casa são dois).
  const n = Math.max(2, Math.round(comprimento / (PASSO_DO_DORMENTE * b)))
  const meioDormente = (DORMENTE.comprimento * b) / 2
  const lugares: { readonly p: Ponto; readonly n: Ponto }[] = []
  for (let i = 0; i < n; i += 1) {
    const t = -Math.PI / 2 + ((i + 0.5) / n) * (Math.PI / 2) + (hash(i, 2, 6300) - 0.5) * 0.04
    const px = cx + rx * Math.cos(t)
    const py = cy + ry * Math.sin(t)
    const nx0 = Math.cos(t) / rx
    const ny0 = Math.sin(t) / ry
    const nn = Math.hypot(nx0, ny0) || 1
    const nrm: Ponto = [nx0 / nn, ny0 / nn]
    const tan: Ponto = [-nrm[1], nrm[0]]
    lugares.push({ p: [px, py], n: nrm })
    // Do lado de dentro o dormente passa pouco do trilho: na curva fechada de uma casa, inteiro, ele chegava ao canto
    // e os dormentes liam raios de uma roda.
    const dentro = -Math.min((BITOLA / 2 + DENTRO_DA_CURVA) * b, Math.min(rx, ry) - b * 0.06)
    const fora = meioDormente + (hash(i, 3, 6300) - 0.5) * TORTO.comprimento * b
    // Retos e da mesma largura de ponta a ponta, como os dos retos: afinados para dentro eles abriam um leque.
    const largura = (DORMENTE.largura * b) / 2
    const canto = (d: number, k: number): Ponto => [px + nrm[0] * d + tan[0] * largura * k, py + nrm[1] * d + tan[1] * largura * k]
    const dormente = poligono([canto(dentro, -1), canto(fora, -1), canto(fora, 1), canto(dentro, 1)])
    cena.sombras.push(contato(dormente, 0.22))
    cena.partes.push(P(dormente, mad, { eixo: Math.atan2(nrm[1], nrm[0]), tabua: 0, bisel: 1, tom: 0.84 + 0.2 * hash(i, 4, 6300), contorno: 0.3, semente: 6310 + i }))
  }

  // Os trilhos: o pé e o boleto, cada um um anel de um quarto de volta.
  for (const lado of [-1, 1]) {
    const d = (lado * BITOLA * b) / 2
    cena.partes.push(P(faixa(d - (PE_DO_TRILHO * b) / 2, d + (PE_DO_TRILHO * b) / 2), ferro, { arco: { cx, cy, r: (rx + ry) / 2 + d, a0: -Math.PI / 2 }, tabua: 0, bisel: 0.5, tom: 0.62, contorno: 0.32, metal: 0.3, projeta: { dist: 0.8, forca: 0.36 }, semente: 6100 + lado }))
    cena.partes.push(P(faixa(d - (BOLETO * b) / 2, d + (BOLETO * b) / 2), ferro, { arco: { cx, cy, r: (rx + ry) / 2 + d, a0: -Math.PI / 2 }, tabua: 0, bisel: 0.3, tom: 1.14, contorno: 0, metal: 0.62, semente: 6110 + lado }))
  }

  // Os cravos, dos dois lados de cada trilho, em cada dormente.
  const raio = CRAVO.raio * b
  lugares.forEach(({ p, n: nrm }, i) => {
    for (const lado of [-1, 1]) {
      for (const k of [-1, 1]) {
        const d = (lado * BITOLA * b) / 2 + k * CRAVO.fora * b
        const x = p[0] + nrm[0] * d
        const y = p[1] + nrm[1] * d
        cena.partes.push(P(caixa(x - raio, y - raio, x + raio, y + raio, raio * 0.4), ferro, { tabua: 0, bisel: raio * 0.6, tom: 0.7, contorno: 0.26, metal: 0.3, semente: 6200 + i * 4 + (lado + 1) + (k + 1) / 2 }))
      }
    }
  })
}

// ---------- o batente ----------

export const montarTrilhoDeMinaBatente: MontarMovel = (c, cena) => {
  const P = c.peca
  const mad = c.m.madeira
  const ferro = c.m.trilhos
  const r = reta(c)
  const { b } = r
  const meio = r.comprimento / 2
  const fim = meio - BATENTE.fundo * b
  pintarLeitoReto(c, cena, r, -meio, fim)
  const lugares = pintarDormentesRetos(c, cena, r, -meio, fim, 6300)
  pintarTrilhosRetos(c, cena, r, -meio, fim + 0.08 * b)
  pintarCravosRetos(c, cena, r, lugares)

  // O monte de terra e pedra lá atrás, que segura as escoras.
  const [mx, my] = r.ponto(meio - BATENTE.monte * b, 0)
  const monte = ondular(r.deitada ? elipse(mx, my, BATENTE.monte * b, 0.46 * b) : elipse(mx, my, 0.46 * b, BATENTE.monte * b), b * 0.03, 0.6, 7.1)
  cena.sombras.push(contato(monte, 0.24))
  cena.partes.push(P(monte, TERRA, { bisel: b * 0.08, contorno: 0.26, ruga: 1.6, tom: 0.92, semente: 6400 }))
  PEDRAS_DO_MONTE.forEach(([du, dv, rr], i) => {
    const [x, y] = r.ponto(meio - BATENTE.monte * b + du * b, dv * b)
    pintarPedacoDeMinerio(P, cena, x, y, rr * b, PEDRA_DO_MONTE, 'entulho', 6410 + i * 17)
  })

  // As duas escoras: da viga para trás, no alinhamento dos trilhos, deitadas até o monte.
  const u0 = fim + BATENTE.viga * b
  const u1 = meio - BATENTE.monte * b * 0.9
  for (const lado of [-1, 1]) {
    const v = (lado * BITOLA * b) / 2
    const escora = r.caixa(u0 - 0.02 * b, v - (BATENTE.escora * b) / 2, u1, v + (BATENTE.escora * b) / 2, 0.6)
    cena.sombras.push({ forma: escora, z: ALTURA_DA_VIGA * c.g * 0.5, forca: 0.24 })
    cena.partes.push(P(escora, mad, { eixo: r.eixoU, tabua: 0, bisel: 1, tom: 0.9, contorno: 0.3, projeta: { dist: 1, forca: 0.32 }, semente: 6420 + lado }))
  }

  // A viga atravessada, com a chapa de ferro de frente para o carrinho e os dois parafusos em cima.
  const viga = r.caixa(fim, -0.47 * b, fim + BATENTE.viga * b, 0.47 * b, b * 0.02)
  cena.sombras.push({ forma: viga, z: ALTURA_DA_VIGA * c.g, forca: 0.3 }, contato(viga, 0.3))
  cena.partes.push(P(viga, mad, { eixo: r.eixoV, tabua: 0, bisel: 1.4, tom: 1, contorno: 0.32, projeta: { dist: 1.6, forca: 0.4 }, semente: 6430 }))
  cena.partes.push(P(r.caixa(fim - 0.012 * b, -0.3 * b, fim + 0.028 * b, 0.3 * b, 0.4), ferro, { eixo: r.eixoV, tabua: 0, bisel: 0.5, tom: 0.8, contorno: 0.3, metal: 0.4, semente: 6431 }))
  for (const lado of [-1, 1]) {
    const [x, y] = r.ponto(fim + BATENTE.viga * b * 0.55, (lado * BITOLA * b) / 2)
    const rp = 0.028 * b
    cena.partes.push(P(elipse(x, y, rp, rp), ferro, { tabua: 0, bisel: rp * 0.7, tom: 1.04, contorno: 0.26, metal: 0.45, semente: 6435 + lado }))
  }
}
