/**
 * PIRÂMIDE EM DEGRAUS (lote L08 de 24/11/2026, item 71: construção nova, a peça principal do templo na selva do
 * mapa 6; desenho próprio, só a ideia do objeto). QUATRO DEGRAUS concêntricos de pedra, cada um mais alto e mais
 * claro que o de baixo, com a face em TALUDE (inclinada: de cima se vê a faixa de cada face, clara do lado da luz e
 * escura do outro), a MURETA no alto de cada face e o terraço de lajes atrás dela. Na frente (o lado de baixo da
 * pegada) a ESCADARIA central sobe do chão ao patamar, entre duas alfardas de blocos com o marco entalhado no pé. No
 * patamar do alto, a moldura gravada e a PEDRA DO SOL no meio (some debaixo do Topo do templo, o item 72, que tem o
 * tamanho certo para ir em cima dele).
 *
 * Duas FORMAS (`lib/mobilia/piramideEmDegraus.ts`, a `variante`):
 * - SECA (a de partida): as lajes com o musgo nas juntas e no pé de cada face, umas folhas secas, trincas, uns
 *   blocos caídos, um cipó e poucas plantas;
 * - ALAGADA: cada terraço é um tanque raso de água parada, presa pela mureta, com a folhagem cobrindo a borda, os
 *   cipós descendo pelas faces, as plantas em roseta nos cantos e as folhas redondas boiando.
 *
 * Esticada, os degraus acompanham a pegada (frações dela) e o que é de través fica na régua da casa: o talude, a
 * mureta, a laje e a pisada da escada não engrossam, repetem.
 *
 * NA 3/4 (derivada, `tresQuartos.ts`): tudo é COLUNA do chão até a altura, sem pegada em cima de pegada, para a
 * ordem do norte para o sul valer com o objeto em qualquer giro. Cada degrau vai em três colunas: a faixa do NORTE
 * inteira e dois "L" (o flanco com a meia faixa do sul de cada lado da escada); o patamar é uma coluna; cada pisada
 * da escada e cada bloco das alfardas é a sua. Só o degrau de baixo faz sombra no chão (a dos de cima cai nele).
 * A sombra que cada degrau faz no terraço de baixo é PINTADA na laje e na água dele (na textura): sobe com o terraço
 * na 3/4 e continua no lugar. (Uma peça com `projeta` do tamanho do degrau subiria com uma coluna só e escureceria o
 * que não deve.)
 *
 * Lê `c.giro` para a luz das faces do talude e a sombra pintada ficarem do lado certo NA TELA. Material: `pedra`. Escreve
 * `cena.corDoPiso`. Barra a passagem, não tapa a visão.
 *
 * Este arquivo também guarda o que as peças de pedra do lote dividem (a pedra do templo com o musgo, a planta em
 * roseta, a moita, o cipó e a conta do giro): o topo do templo, a cabeça colossal, o ídolo, a cascata e a ponte
 * importam daqui.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { lerVarianteDaPiramideEmDegraus } from '../../../lib/mobilia/piramideEmDegraus'
import { comMeioEm, crescida } from './andaimeDaTresQuartos'
import { anel, cadeia, caixa, elipse, elipseGirada, menos, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, type CriarPeca, type MaterialDaPeca, type Peca, type Sombra, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

// ---------- o que as peças do lote dividem ----------

/** O escuro da pedra do templo (o piso de luz): com a nogueira, a beira cinza saía marrom. */
export const ESCURO_DA_PEDRA_DO_TEMPLO: Rgb = [0x45, 0x44, 0x3c]
/** O musgo: o verde-oliva do Meio-Termo, apagado. */
export const TOM_DO_MUSGO_DO_TEMPLO: Rgb = rgb(tomDoMeio('musgo', 0.84))
/** O tufo de musgo: a classe `folha` dá a luz manchada (chapado, o tufo grande lia como tinta). */
export const MUSGO_DO_TEMPLO: MaterialDaPeca = { classe: 'folha', rgb: TOM_DO_MUSGO_DO_TEMPLO }
/** A folhagem da selva em três tons contidos (a massa, a folha e o realce), o buxo e o alfeneiro da sebe puxados para o escuro. */
export const FOLHA_ESCURA_DA_SELVA: MaterialDaPeca = { classe: 'folha', rgb: [0x3c, 0x60, 0x45] }
export const FOLHA_DA_SELVA: MaterialDaPeca = { classe: 'folha', rgb: [0x54, 0x7c, 0x55] }
export const FOLHA_CLARA_DA_SELVA: MaterialDaPeca = { classe: 'folha', rgb: [0x6f, 0x92, 0x5c] }
/** A água parada do templo (verde de tanque velho, mais escura e menos azul que a do chafariz) e o claro do reflexo. */
export const AGUA_PARADA_DO_TEMPLO: MaterialDaPeca = { classe: 'liso', rgb: [0x47, 0x72, 0x69] }
export const REFLEXO_DA_AGUA_DO_TEMPLO: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0xcb, 0xbf] }

/** Os quartos de volta do giro que as duas vistas pintam (`girarCena`). */
export function quartosDoGiroDoTemplo(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** Para onde a direção (dx, dy) do objeto aponta NA TELA depois de `q` quartos de volta. */
export function naTelaDoTemplo(dx: number, dy: number, q: number): Ponto {
  return q === 1 ? [-dy, dx] : q === 2 ? [-dx, -dy] : q === 3 ? [dy, -dx] : [dx, dy]
}

/** A direção do objeto que cai em (dx, dy) NA TELA (a conta contrária). */
export function doObjetoDoTemplo(dx: number, dy: number, q: number): Ponto {
  return q === 1 ? [dy, -dx] : q === 2 ? [-dx, -dy] : q === 3 ? [-dy, dx] : [dx, dy]
}

/** A base da caixa NA TELA (o lado de baixo) com o objeto girado `q` quartos: o que põe as estruturas em ordem na 3/4. */
export function baseNaTelaDoTemplo(b: Caixa, q: number): number {
  return q === 1 ? b[2] : q === 2 ? -b[1] : q === 3 ? -b[0] : b[3]
}

/** O passo (px) entre as bases de duas estruturas seguidas na ordem de pintura da 3/4. */
const PASSO_DA_ORDEM = 0.05

/**
 * As formas na ORDEM DE PINTURA da 3/4 dada pela lista, com o objeto girado `q` quartos: a caixa de cada uma cresce
 * (para os quatro lados, sem mudar a forma) até a base dela NA TELA passar de `depoisDe` (px) e da anterior. É o
 * `emOrdem` do andaime com a base medida na tela: o que está EM CIMA de uma laje sai depois dela em qualquer giro.
 */
export function emOrdemNaTela(formas: readonly Forma[], q: number, depoisDe: number): Forma[] {
  return formas.map((f, i) => crescida(f, Math.max(0, depoisDe + PASSO_DA_ORDEM * (i + 1) - baseNaTelaDoTemplo(f.b, q))))
}

/** A luz do motor (de cima à esquerda) e a inclinação da face que as contas abaixo usam. */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
const INCLINACAO_DO_TALUDE = 0.6
const FORCA_DA_LUZ_DA_FACE = 0.68

/**
 * A luz (o `luz` da peça) de uma face inclinada cuja normal aponta para (nx, ny) no objeto, com o objeto girado `q`
 * quartos: a mesma conta do chanfro do motor, chapada na face inteira. A do oeste e a do norte clareiam, a do leste e
 * a do sul escurecem.
 */
export function luzDaFaceDoTemplo(nx: number, ny: number, q: number): number {
  const [sx, sy] = naTelaDoTemplo(nx, ny, q)
  const k = INCLINACAO_DO_TALUDE
  const nl = (sx * k * LUZ_X + sy * k * LUZ_Y + LUZ_Z) / Math.hypot(k, 1)
  return FORCA_DA_LUZ_DA_FACE * (nl - LUZ_Z)
}

function limitar01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/** A escala (pixels por px do protótipo) a partir da qual o grão miúdo e o líquen aparecem. */
const ESCALA_DO_GRAO = 1.2

/**
 * A base da pedra do templo vista de cima: manchas mansas em duas escalas e o grão miúdo de perto, mais as pintas do
 * granito. Não usa a textura da classe: as camadas do arenito, deitadas na tela, riscavam a laje como veio de madeira.
 */
export const DA_PEDRA: Textura = (_u, _v, x, y, p, s, escala) => {
  let luz = ruido(x * 0.085 + p.su, y * 0.085 + p.sv) * 0.15 + ruido(x * 0.33 + p.sv, y * 0.33 + 7) * 0.07
  if (escala >= ESCALA_DO_GRAO) luz += ruido(x * 1.3 + 5, y * 1.3 + p.su) * 0.04
  s[3] += luz
  if (p.mat.pedra !== 'granito') return
  const h = hash(Math.floor(x * 1.5), Math.floor(y * 1.5), p.semente)
  if (h > 0.95) s[6] = -0.16
  else if (h < 0.04) s[6] = 0.1
}

/** Mistura a cor do ponto com `cor` em `t` (0 a 1): o musgo, o limo e a mancha não são só menos luz. */
export function tingir(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

/** O tamanho das manchas de musgo (px por volta do ruído) e o quanto o grão miúdo as recorta. */
const MANCHA_DO_MUSGO = 8.5
const GRAO_DO_MUSGO = 2.6

/** O musgo no ponto (0 a 1): manchas grandes recortadas por um grão miúdo, a partir do `limiar` (menor = mais musgo). */
export function musgoNoPonto(x: number, y: number, limiar: number, semente: number): number {
  const n = ruido(x / MANCHA_DO_MUSGO + semente * 1.7, y / MANCHA_DO_MUSGO + semente * 0.9) + 0.45 * ruido(x / GRAO_DO_MUSGO + 31, y / GRAO_DO_MUSGO + semente)
  return limitar01((n - limiar) * 3.4)
}

/**
 * A PEDRA DO TEMPLO: a pedra do painel com o tempo por cima. `musgo` (0 a 1) é o quanto de musgo cresce nela em
 * manchas; o líquen (pintas claras) só aparece de perto.
 */
export function texDaPedraDoTemplo(musgo: number, semente = 0): Textura {
  return (u, v, x, y, p, s, escala) => {
    DA_PEDRA(u, v, x, y, p, s, escala)
    if (musgo > 0) {
      const t = musgoNoPonto(x, y, 0.3 - 0.34 * musgo, semente) * 0.78
      if (t > 0) {
        tingir(s, TOM_DO_MUSGO_DO_TEMPLO, t)
        s[3] -= 0.04 * t
      }
    }
    if (escala < ESCALA_DO_GRAO) return
    const l = ruido(x / 1.4 + 51 + semente, y / 1.4 + 3)
    if (l > 0.36) s[3] += (l - 0.36) * 0.7
  }
}

/** Sorteio fixo de 0 a 1 por índice e sal. */
export function acasoDoTemplo(i: number, sal: number): number {
  return hash(i, sal, 7127)
}

/** O quanto a direção do ângulo `a` olha para a luz do motor no chão (-1 de costas, 1 de frente). */
function paraALuz(a: number): number {
  return Math.cos(a) * -0.79 + Math.sin(a) * -0.61
}

/**
 * Uma planta em ROSETA vista de cima (a bromélia do templo): `folhas` folhas pontudas em volta do miolo escuro,
 * cada uma com a luz do chanfro. `r` = o comprimento da folha (px). Todas as peças têm o meio da caixa em (x, y): na
 * 3/4 a planta sobe inteira com a coluna em que está o pé dela.
 */
export function roseta(L: Peca[], P: CriarPeca, x: number, y: number, r: number, semente: number, folhas = 7): void {
  const torce = acasoDoTemplo(semente, 1) * Math.PI * 2
  L.push(P(comMeioEm(elipse(x + 0.5, y + 0.6, r * 0.62, r * 0.6), x, y), FOLHA_ESCURA_DA_SELVA, { bisel: r * 0.3, contorno: 0.2, alfa: 0.85, suave: 0.6, semente: 6400 + semente }))
  for (let i = 0; i < folhas; i += 1) {
    const a = torce + (i / folhas) * Math.PI * 2 + (acasoDoTemplo(semente, 10 + i) - 0.5) * 0.4
    const comprida = r * (0.82 + 0.3 * acasoDoTemplo(semente, 30 + i))
    const larga = r * (0.2 + 0.07 * acasoDoTemplo(semente, 50 + i))
    const [cx, cy] = [x + Math.cos(a) * comprida * 0.52, y + Math.sin(a) * comprida * 0.52]
    // A folha de cima à esquerda pega a luz, a de baixo à direita fica no tom do meio.
    const luz = paraALuz(a)
    const mat = luz > 0.25 ? FOLHA_CLARA_DA_SELVA : luz < -0.45 ? FOLHA_ESCURA_DA_SELVA : FOLHA_DA_SELVA
    L.push(P(comMeioEm(elipseGirada(cx, cy, comprida * 0.52, larga, a), x, y), mat, { bisel: larga * 0.7, contorno: 0.26, tom: 0.86 + 0.12 * acasoDoTemplo(semente, 70 + i), semente: 6410 + semente * 13 + i, projeta: { dist: 0.9, forca: 0.22 } }))
  }
  L.push(P(comMeioEm(elipse(x, y, r * 0.17, r * 0.17), x, y), FOLHA_ESCURA_DA_SELVA, { bisel: r * 0.1, contorno: 0.2, tom: 0.82, semente: 6490 + semente }))
}

/**
 * Uma MOITA baixa vista de cima (a folhagem que cobre a borda): a massa escura de beira recortada, os gomos do meio e
 * o realce do lado da luz. `r` = o raio (px); `gomos` = quantos lóbulos em volta. O meio da caixa de todas as peças
 * fica em (x, y), como na roseta.
 */
export function moita(L: Peca[], P: CriarPeca, x: number, y: number, r: number, semente: number, gomos = 5): void {
  const torce = acasoDoTemplo(semente, 2) * Math.PI * 2
  L.push(P(comMeioEm(elipse(x + r * 0.1, y + r * 0.12, r * 0.86, r * 0.8), x, y), FOLHA_ESCURA_DA_SELVA, { bisel: r * 0.45, contorno: 0.26, semente: 6500 + semente, projeta: { dist: 1.5, forca: 0.3 } }))
  for (let i = 0; i < gomos; i += 1) {
    const a = torce + (i / gomos) * Math.PI * 2 + (acasoDoTemplo(semente, 10 + i) - 0.5) * 0.5
    const d = r * (0.42 + 0.2 * acasoDoTemplo(semente, 20 + i))
    const rg = r * (0.42 + 0.16 * acasoDoTemplo(semente, 40 + i))
    const luz = paraALuz(a)
    const mat = luz > 0.3 ? FOLHA_CLARA_DA_SELVA : luz < -0.5 ? FOLHA_ESCURA_DA_SELVA : FOLHA_DA_SELVA
    L.push(P(comMeioEm(elipse(x + Math.cos(a) * d - r * 0.05, y + Math.sin(a) * d - r * 0.07, rg, rg * 0.9), x, y), mat, { bisel: rg * 0.7, contorno: 0.2, tom: 0.88 + 0.12 * acasoDoTemplo(semente, 60 + i), semente: 6510 + semente * 7 + i, projeta: { dist: 0.8, forca: 0.18 } }))
  }
  L.push(P(comMeioEm(elipse(x - r * 0.2, y - r * 0.24, r * 0.34, r * 0.3), x, y), FOLHA_CLARA_DA_SELVA, { bisel: r * 0.24, contorno: 0.1, tom: 0.98, alfa: 0.9, semente: 6560 + semente }))
}

/**
 * Um CIPÓ visto de cima: o ramo fino que sai de (x, y) no rumo (dx, dy), ondulando, com as folhinhas dos dois lados.
 * `comprimento` em px. O meio da caixa das peças fica em (x, y): na 3/4 ele sobe com a coluna de onde pende.
 */
export function cipo(L: Peca[], P: CriarPeca, x: number, y: number, dx: number, dy: number, comprimento: number, semente: number): void {
  const n = Math.hypot(dx, dy) || 1
  const [ux, uy] = [dx / n, dy / n]
  const nos = Math.max(3, Math.round(comprimento / 3.2))
  const pontos: Ponto[] = []
  for (let i = 0; i <= nos; i += 1) {
    const t = i / nos
    const onda = Math.sin(t * 5.2 + acasoDoTemplo(semente, 3) * 6) * 1.5 * t
    pontos.push([x + ux * comprimento * t - uy * onda, y + uy * comprimento * t + ux * onda])
  }
  L.push(P(comMeioEm(cadeia(pontos, 0.6), x, y), FOLHA_ESCURA_DA_SELVA, { bisel: 0.5, contorno: 0.2, tom: 0.9, semente: 6600 + semente, projeta: { dist: 0.8, forca: 0.2 } }))
  for (let i = 1; i <= nos; i += 1) {
    if (acasoDoTemplo(semente * 31 + i, 4) < 0.22) continue
    const [px, py] = pontos[i]
    const lado = i % 2 === 0 ? 1 : -1
    const a = Math.atan2(uy, ux) + lado * (0.9 + 0.5 * acasoDoTemplo(semente * 31 + i, 5))
    const rf = 1.5 + 0.9 * acasoDoTemplo(semente * 31 + i, 6)
    const mat = paraALuz(a) > 0 ? FOLHA_CLARA_DA_SELVA : FOLHA_DA_SELVA
    L.push(P(comMeioEm(elipseGirada(px + Math.cos(a) * rf * 0.8, py + Math.sin(a) * rf * 0.8, rf, rf * 0.56, a), x, y), mat, { bisel: rf * 0.4, contorno: 0.24, tom: 0.84 + 0.14 * acasoDoTemplo(semente * 31 + i, 7), semente: 6610 + semente * 17 + i }))
  }
}

// ---------- as medidas da pirâmide ----------

/** A meia medida de cada degrau, em fração da meia pegada (o de baixo é a pegada inteira; o último é o patamar). */
const DEGRAUS: readonly number[] = [1, 0.8, 0.6, 0.4]
/** A altura de cada degrau (casas): a da sombra no chão e a de cada coluna da 3/4. */
export const ALTURA_DO_DEGRAU_DA_PIRAMIDE = 0.3
/** A face em talude vista de cima e a mureta no alto dela (casas); nunca mais que estas frações do terraço. */
const TALUDE = 0.135
const MURETA = 0.08
const FRACAO_DO_TALUDE = 0.3
const FRACAO_DA_MURETA = 0.2
/** A escada: a meia largura das pisadas (fração da meia largura), a alfarda (casas) e a pisada (casas). */
const MEIA_ESCADA = 0.2
const ALFARDA = 0.15
const PISADA = 0.15
/** As alfardas vão em blocos, cada um da altura da pisada mais alta dele mais este tanto (casas). */
const BLOCOS_DA_ALFARDA = 4
const SOBRA_DA_ALFARDA = 0.16
/** A laje do terraço ao comprido (casas) e a do patamar (casas). */
const LAJE = 0.44
const LAJE_DO_PATAMAR = 0.6
/** O tom de cada degrau: o de cima, mais perto da luz, é o mais claro. */
const TOM_DO_DEGRAU: readonly number[] = [0.84, 0.92, 1, 1.08]
/** A sombra que cada degrau faz no terraço de baixo: o quanto anda (px, para baixo à direita NA TELA), a força e a borda. */
const SOMBRA_DO_DEGRAU = { dist: 8, forca: 0.36, suave: 2.2 } as const
/** A direção da sombra do motor no chão. */
const SOMBRA_NO_CHAO: Ponto = [0.79, 0.61]

interface Medidas {
  readonly hw: number
  readonly hh: number
  /** As meias medidas de cada degrau (px). */
  readonly AX: readonly number[]
  readonly AY: readonly number[]
  /** A altura do alto de cada degrau (px). */
  readonly Z: readonly number[]
  readonly talude: number
  readonly mureta: number
  /** A meia largura das pisadas e a da escada com as alfardas (px). */
  readonly s: number
  readonly sz: number
  readonly q: number
}

function medir(c: ContextoDoMovel): Medidas {
  const { hw, hh, g } = c
  const AX = DEGRAUS.map((f) => hw * f)
  const AY = DEGRAUS.map((f) => hh * f)
  const terraco = Math.min(AX[0] - AX[1], AY[0] - AY[1])
  const s = hw * MEIA_ESCADA
  return {
    hw,
    hh,
    AX,
    AY,
    Z: DEGRAUS.map((_, k) => g * ALTURA_DO_DEGRAU_DA_PIRAMIDE * (k + 1)),
    talude: Math.min(g * TALUDE, terraco * FRACAO_DO_TALUDE),
    mureta: Math.min(g * MURETA, terraco * FRACAO_DA_MURETA),
    s,
    sz: s + Math.min(g * ALFARDA, hw * 0.05),
    q: quartosDoGiroDoTemplo(c.giro),
  }
}

/** Um "L": a união de duas caixas (x0, y0, x1, y1 de cada uma) que se cobrem no canto. */
function emL(ax0: number, ay0: number, ax1: number, ay1: number, bx0: number, by0: number, bx1: number, by1: number): Forma {
  return uniao(caixa(ax0, ay0, ax1, ay1), caixa(bx0, by0, bx1, by1))
}

/** Coluna do chão até `z`; só a do degrau de baixo faz sombra no chão. */
function coluna(forma: Forma, z: number, comSombra: boolean): Sombra {
  return comSombra ? { forma, z } : { forma, z, forca: 0 }
}

// ---------- as texturas ----------

function suave01(t: number): number {
  const x = limitar01(t)
  return x * x * (3 - 2 * x)
}

/**
 * Quanto o ponto do terraço do degrau `k` está na sombra do degrau de cima (0 a 1): a planta dele deslocada para baixo
 * à direita NA TELA (a direção volta para o referencial do objeto, que é onde a textura lê o ponto).
 */
function sombraDoDegrauDeCima(m: Medidas, k: number): (x: number, y: number) => number {
  const [bx, by] = [m.AX[k + 1], m.AY[k + 1]]
  const [sx, sy] = doObjetoDoTemplo(SOMBRA_NO_CHAO[0] * SOMBRA_DO_DEGRAU.dist, SOMBRA_NO_CHAO[1] * SOMBRA_DO_DEGRAU.dist, m.q)
  return (x, y) => suave01(0.5 - Math.max(Math.abs(x - sx) - bx, Math.abs(y - sy) - by) / (2 * SOMBRA_DO_DEGRAU.suave))
}

/**
 * As LAJES do terraço do degrau `k`: uma fiada ao comprido de cada lado, emendada em meia-esquadria nos cantos, cada
 * laje no seu tom, a junta escura e o musgo que junta nela e no pé da face de cima.
 */
function texDoTerraco(m: Medidas, k: number, laje: number, musgo: number): Textura {
  const [bx, by] = [m.AX[k + 1], m.AY[k + 1]]
  const menor = Math.min(m.hw, m.hh)
  const naSombra = sombraDoDegrauDeCima(m, k)
  return (u, v, x, y, p, s, escala) => {
    DA_PEDRA(u, v, x, y, p, s, escala)
    s[3] -= SOMBRA_DO_DEGRAU.forca * naSombra(x, y)
    const [ax, ay] = [Math.abs(x), Math.abs(y)]
    const emX = ax / m.hw > ay / m.hh
    const lado = emX ? (x < 0 ? 3 : 1) : y < 0 ? 0 : 2
    const t = (emX ? y : x) / laje + 0.37 * lado + 0.21 * k
    const i = Math.floor(t)
    const f = (t - i) * laje
    const junta = Math.min(f, laje - f, Math.abs(ax / m.hw - ay / m.hh) * menor)
    s[3] += (hash(i, lado + 4 * k, 913) - 0.5) * 0.13
    if (junta < 1) s[3] -= 0.26 * (1 - junta)
    // O pé da face de cima: a distância até a planta do degrau seguinte.
    const pe = Math.max(ax - bx, ay - by)
    const peso = 0.3 * limitar01(1 - junta / 2.6) + 0.34 * limitar01(1 - pe / 6)
    const t2 = musgoNoPonto(x, y, 0.3 - 0.34 * musgo - peso, k * 5 + 2) * 0.8
    if (t2 > 0) {
      tingir(s, TOM_DO_MUSGO_DO_TEMPLO, t2)
      s[3] -= 0.05 * t2
    }
  }
}

/** As LAJES de um piso do templo (o patamar, a laje do topo): fiadas desencontradas de `laje` px, cada laje no seu tom, a junta escura e pouco musgo. */
export function texDasLajesDoTemplo(laje: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    DA_PEDRA(u, v, x, y, p, s, escala)
    const fileira = Math.floor(y / laje + 0.5)
    const xx = x / laje + (((fileira % 2) + 2) % 2) * 0.5
    const fila = Math.floor(xx)
    const [fx, fy] = [(xx - fila) * laje, (y / laje + 0.5 - fileira) * laje]
    const junta = Math.min(fx, laje - fx, fy, laje - fy)
    s[3] += (hash(fila, fileira, 917) - 0.5) * 0.12
    if (junta < 1) s[3] -= 0.24 * (1 - junta)
    const t = musgoNoPonto(x, y, 0.36 - 0.3 * limitar01(1 - junta / 2.4), 23) * 0.7
    if (t > 0) tingir(s, TOM_DO_MUSGO_DO_TEMPLO, t)
  }
}

/** O comprimento do bloco da face (px) e a escala a partir da qual as juntas de pé aparecem. */
const BLOCO_DO_TALUDE = 13
const ESCALA_DAS_JUNTAS = 1.2

/**
 * A face em TALUDE do degrau `k`: duas fiadas ao comprido, as juntas de pé desencontradas (só de perto), o pé mais
 * escuro (encosta no terraço de baixo) e o limo escorrido.
 */
function texDoTalude(m: Medidas, k: number): Textura {
  const [ax, ay, tl] = [m.AX[k], m.AY[k], m.talude]
  return (u, v, x, y, p, s, escala) => {
    DA_PEDRA(u, v, x, y, p, s, escala)
    const [dx, dy] = [ax - Math.abs(x), ay - Math.abs(y)]
    const fora = Math.min(dx, dy)
    const emX = dx < dy
    const fiada = fora < tl / 2 ? 0 : 1
    const naFiada = Math.abs(fora - tl / 2)
    if (naFiada < 0.55) s[3] -= 0.16 * (1 - naFiada / 0.55)
    if (escala >= ESCALA_DAS_JUNTAS) {
      const t = (emX ? y : x) / BLOCO_DO_TALUDE + fiada * 0.5 + k * 0.3
      const junta = Math.abs(t - Math.round(t)) * BLOCO_DO_TALUDE
      if (junta < 0.5) s[3] -= 0.14 * (1 - junta / 0.5)
      s[3] += (hash(Math.round(t), fiada + 2 * k + (emX ? 8 : 0), 921) - 0.5) * 0.08
    }
    s[3] -= 0.1 * limitar01(1 - fora / (tl * 0.55))
    const t2 = musgoNoPonto(x, y, 0.2 - 0.2 * limitar01(1 - fora / tl), k * 3 + 11) * 0.66
    if (t2 > 0) tingir(s, TOM_DO_MUSGO_DO_TEMPLO, t2)
  }
}

/** A MURETA: blocos curtos, a junta fina de través. */
function texDaMureta(k: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    DA_PEDRA(u, v, x, y, p, s, escala)
    const b = p.forma.b
    const deitada = b[2] - b[0] > b[3] - b[1]
    const t = (deitada ? x : y) / 11 + k * 0.4
    const junta = Math.abs(t - Math.round(t)) * 11
    if (junta < 0.5) s[3] -= 0.2 * (1 - junta / 0.5)
    s[3] += (hash(Math.round(t), k + (deitada ? 0 : 5), 923) - 0.5) * 0.07
    const t2 = musgoNoPonto(x, y, 0.24, k * 3 + 40) * 0.6
    if (t2 > 0) tingir(s, TOM_DO_MUSGO_DO_TEMPLO, t2)
  }
}

/** A PISADA: a pedra gasta no meio, por onde se sobe. */
function texDaPisada(s0: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    DA_PEDRA(u, v, x, y, p, s, escala)
    const q = x / (s0 * 0.6)
    s[3] += 0.05 * Math.exp(-q * q)
    const t = musgoNoPonto(x, y, 0.46 - 0.3 * limitar01((Math.abs(x) - s0 * 0.55) / (s0 * 0.45)), 61) * 0.6
    if (t > 0) tingir(s, TOM_DO_MUSGO_DO_TEMPLO, t)
  }
}

/** O verde do limo boiando na água parada. */
const LIMO_DA_AGUA: Rgb = [0x5f, 0x7f, 0x55]

/**
 * A ÁGUA parada do terraço: manchas mansas de fundo e de limo, uns riscos de reflexo deitados e a beira mais clara
 * (a água rasa em cima da laje) até `raso` px da mureta e do pé do degrau de cima.
 */
function texDaAguaParada(m: Medidas, k: number): Textura {
  const [bx, by] = [m.AX[k + 1], m.AY[k + 1]]
  const [ix, iy] = [m.AX[k] - m.talude - m.mureta, m.AY[k] - m.talude - m.mureta]
  const raso = 3.2
  const naSombra = sombraDoDegrauDeCima(m, k)
  return (_u, _v, x, y, _p, s) => {
    const semente = k * 9 + 1
    s[3] -= SOMBRA_DO_DEGRAU.forca * naSombra(x, y)
    s[3] += ruido(x * 0.06 + semente, y * 0.06 + 5) * 0.2 + ruido(x * 0.21 + 9, y * 0.21 + semente) * 0.07 - 0.05
    const [ax, ay] = [Math.abs(x), Math.abs(y)]
    const beira = Math.min(Math.max(ax - bx, ay - by), Math.min(ix - ax, iy - ay))
    if (beira < raso) s[3] += 0.14 * (1 - Math.max(0, beira) / raso)
    const limo = musgoNoPonto(x, y, 0.22, semente + 70) * 0.5
    if (limo > 0) tingir(s, LIMO_DA_AGUA, limo)
    const risco = ruido(x * 0.09 + 17 + semente, y * 0.6 + 3)
    if (risco > 0.3) s[3] += (risco - 0.3) * 0.55
  }
}

// ---------- as partes ----------

interface Trabalho {
  readonly c: ContextoDoMovel
  readonly m: Medidas
  readonly L: Peca[]
  readonly alagada: boolean
}

/** Os cantos da face em talude de cada lado do degrau `k` (a do sul em duas metades, em volta da escada). */
function facesDoDegrau(m: Medidas, k: number): readonly { readonly n: Ponto; readonly pontos: readonly Ponto[] }[] {
  const [ax, ay, tl, sz] = [m.AX[k], m.AY[k], m.talude, m.sz]
  return [
    { n: [0, -1], pontos: [[-ax, -ay], [ax, -ay], [ax - tl, -ay + tl], [-ax + tl, -ay + tl]] },
    { n: [1, 0], pontos: [[ax, -ay], [ax, ay], [ax - tl, ay - tl], [ax - tl, -ay + tl]] },
    { n: [-1, 0], pontos: [[-ax, -ay], [-ax + tl, -ay + tl], [-ax + tl, ay - tl], [-ax, ay]] },
    { n: [0, 1], pontos: [[-ax, ay], [-ax + tl, ay - tl], [-sz, ay - tl], [-sz, ay]] },
    { n: [0, 1], pontos: [[sz, ay], [sz, ay - tl], [ax - tl, ay - tl], [ax, ay]] },
  ]
}

/** As faces em talude e a mureta do degrau `k` (o patamar não tem mureta). */
function bordaDoDegrau(t: Trabalho, k: number): void {
  const { c, m, L } = t
  const P = c.peca
  const pedra = c.m.pedra
  const [ax, ay, tl, mu, sz] = [m.AX[k], m.AY[k], m.talude, m.mureta, m.sz]
  const tom = TOM_DO_DEGRAU[k]
  const textura = texDoTalude(m, k)
  facesDoDegrau(m, k).forEach((face, i) => {
    L.push(P(poligono(face.pontos), pedra, { tabua: 0, bisel: 0, contorno: 0.14, tom, luz: luzDaFaceDoTemplo(face.n[0], face.n[1], m.q), textura, semente: 5100 + k * 10 + i }))
  })
  if (k === DEGRAUS.length - 1) return
  const mureta = { tabua: 0, bisel: Math.min(1.5, mu * 0.4), tom: tom + 0.14, contorno: 0.24, textura: texDaMureta(k), projeta: { dist: 2, forca: 0.32 } }
  const [ix, iy] = [ax - tl, ay - tl]
  L.push(P(caixa(-ix, -iy, ix, -iy + mu, 0.7), pedra, { ...mureta, semente: 5150 + k * 10 }))
  L.push(P(caixa(-ix, -iy, -ix + mu, iy, 0.7), pedra, { ...mureta, semente: 5151 + k * 10 }))
  L.push(P(caixa(ix - mu, -iy, ix, iy, 0.7), pedra, { ...mureta, semente: 5152 + k * 10 }))
  L.push(P(caixa(-ix, iy - mu, -sz, iy, 0.7), pedra, { ...mureta, semente: 5153 + k * 10 }))
  L.push(P(caixa(sz, iy - mu, ix, iy, 0.7), pedra, { ...mureta, semente: 5154 + k * 10 }))
}

/** A folga com que o piso de um degrau entra debaixo do vizinho (px): sem ela a emenda deixava um fio de chão. */
const FOLGA = 0.8

/** O degrau `k` (0 a 2): as três colunas, o piso de lajes de cada uma, a água (na alagada), as faces e a mureta. */
function degrau(t: Trabalho, cena: Parameters<MontarMovel>[1], k: number): void {
  const { c, m, L, alagada } = t
  const P = c.peca
  const pedra = c.m.pedra
  const [ax, ay, bx, by, sz] = [m.AX[k], m.AY[k], m.AX[k + 1], m.AY[k + 1], m.sz]
  const z = m.Z[k]
  const norte = caixa(-ax, -ay, ax, -by)
  // Cada "L" é a união de duas caixas que se cobrem no canto (o flanco e a meia faixa do sul): a conta da distância
  // de duas caixas custa uma fração da do polígono de seis lados, e a varredura da 3/4 a faz muitas vezes por ponto.
  const oeste = emL(-ax, -by, -bx, ay, -ax, by, -sz, ay)
  const leste = emL(bx, -by, ax, ay, sz, by, ax, ay)
  cena.sombras.push(coluna(norte, z, k === 0), coluna(oeste, z, k === 0), coluna(leste, z, k === 0))

  // O PISO de cada coluna: as lajes, sem beira (a face, a mureta e o degrau de cima tapam as bordas).
  const laje = c.g * LAJE
  const piso = { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_DEGRAU[k] * (alagada ? 0.78 : 0.94), textura: texDoTerraco(m, k, laje, alagada ? 0.5 : 0.34) }
  const f = FOLGA
  const meioDoFlanco = (ax + bx) / 2
  L.push(P(caixa(-ax, -ay, ax, -by + f), pedra, { ...piso, semente: 5010 + k * 10 }))
  L.push(P(comMeioEm(emL(-ax, -by, -bx + f, ay, -ax, by - f, -sz, ay), -meioDoFlanco, 0), pedra, { ...piso, semente: 5011 + k * 10 }))
  L.push(P(comMeioEm(emL(bx - f, -by, ax, ay, sz, by - f, ax, ay), meioDoFlanco, 0), pedra, { ...piso, semente: 5012 + k * 10 }))

  // A ÁGUA parada (só na alagada): da mureta até o pé do degrau de cima, em cada coluna.
  if (alagada) {
    const [ix, iy] = [ax - m.talude - m.mureta + 0.6, ay - m.talude - m.mureta + 0.6]
    const agua = { bisel: 0, contorno: 0, textura: texDaAguaParada(m, k) }
    L.push(P(caixa(-ix, -iy, ix, -by + f), AGUA_PARADA_DO_TEMPLO, { ...agua, semente: 5020 + k * 10 }))
    L.push(P(comMeioEm(emL(-ix, -by, -bx + f, iy, -ix, by - f, -sz, iy), -meioDoFlanco, 0), AGUA_PARADA_DO_TEMPLO, { ...agua, semente: 5021 + k * 10 }))
    L.push(P(comMeioEm(emL(bx - f, -by, ix, iy, sz, by - f, ix, iy), meioDoFlanco, 0), AGUA_PARADA_DO_TEMPLO, { ...agua, semente: 5022 + k * 10 }))
  }
  bordaDoDegrau(t, k)
  if (alagada) vidaDaAlagada(t, k)
  else tempoDaSeca(t, k)
}

/** O PATAMAR do alto: a coluna, as lajes, a moldura gravada e a pedra do sol no meio. */
function patamar(t: Trabalho, cena: Parameters<MontarMovel>[1]): void {
  const { c, m, L } = t
  const P = c.peca
  const pedra = c.m.pedra
  const k = DEGRAUS.length - 1
  const [ax, ay] = [m.AX[k], m.AY[k]]
  const planta = caixa(-ax, -ay, ax, ay)
  cena.sombras.push(coluna(planta, m.Z[k], false))
  L.push(P(planta, pedra, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_DEGRAU[k] * 0.96, textura: texDasLajesDoTemplo(c.g * LAJE_DO_PATAMAR), semente: 5200 }))
  bordaDoDegrau(t, k)
  // A moldura gravada: um sulco fino por dentro da beira.
  const [mx, my] = [ax - m.talude - 3.4, ay - m.talude - 3.4]
  if (mx > 8 && my > 8) L.push(P(menos(caixa(-mx, -my, mx, my, 1.2), caixa(-mx + 1.3, -my + 1.3, mx - 1.3, my - 1.3, 0.8)), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.66, alfa: 0.75, semente: 5210 }))

  // A PEDRA DO SOL: o disco em relevo baixo, o sulco em volta do miolo, os oito raios e o olho.
  const r = Math.min(ax, ay) * 0.36
  if (r < 6) return
  L.push(P(elipse(0, 0, r, r), pedra, { tabua: 0, bisel: 1.5, tom: 1.13, contorno: 0.26, textura: texDaPedraDoTemplo(0.22, 5), semente: 5220, projeta: { dist: 1.3, forca: 0.24 } }))
  L.push(P(anel(0, 0, r * 0.8, r * 0.8, r * 0.71, r * 0.71), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.7, alfa: 0.8, semente: 5221 }))
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    L.push(P(comMeioEm(elipseGirada(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58, r * 0.1, r * 0.045, a), 0, 0), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.68, alfa: 0.8, semente: 5230 + i }))
  }
  L.push(P(elipse(0, 0, r * 0.36, r * 0.36), pedra, { tabua: 0, bisel: r * 0.16, tom: 1.2, contorno: 0.26, semente: 5240, projeta: { dist: 0.9, forca: 0.22 } }))
  L.push(P(elipse(0, 0, r * 0.13, r * 0.13), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.62, alfa: 0.85, recesso: { k: 0.8, forca: 0.3 }, semente: 5241 }))
}

/** A ESCADARIA: cada pisada é uma coluna que sobe do chão; as alfardas vão em blocos, com o marco entalhado no pé. */
function escadaria(t: Trabalho, cena: Parameters<MontarMovel>[1]): void {
  const { c, m, L } = t
  const P = c.peca
  const pedra = c.m.pedra
  const alto = m.AY[DEGRAUS.length - 1]
  const topo = m.Z[DEGRAUS.length - 1]
  const n = Math.max(BLOCOS_DA_ALFARDA, Math.round((m.hh - alto) / (c.g * PISADA)))
  const passo = (m.hh - alto) / n
  const textura = texDaPisada(m.s)
  // As pisadas, de baixo para cima: a de cima faz sombra na de baixo.
  for (let j = 0; j < n; j += 1) {
    const y1 = m.hh - j * passo
    const y0 = y1 - passo
    const pisada = caixa(-m.s, y0, m.s, y1)
    cena.sombras.push(coluna(pisada, (topo * (j + 1)) / n, false))
    L.push(P(pisada, pedra, { tabua: 0, bisel: 0, contorno: 0.16, tom: 0.56, semente: 5300 + j }))
    L.push(P(caixa(-m.s + 0.4, y0 + 0.3, m.s - 0.4, y1 - 0.9, 0.7), pedra, { tabua: 0, bisel: 0.9, tom: 0.92 + (0.2 * j) / n + 0.05 * acasoDoTemplo(j, 3), contorno: 0.18, textura, semente: 5320 + j, projeta: { dist: 1.2, forca: 0.3 } }))
  }
  // As alfardas: blocos que sobem com a escada, cada um mais alto e mais claro.
  const porBloco = n / BLOCOS_DA_ALFARDA
  for (const lado of [-1, 1]) {
    const [x0, x1] = lado < 0 ? [-m.sz, -m.s] : [m.s, m.sz]
    for (let i = 0; i < BLOCOS_DA_ALFARDA; i += 1) {
      const y1 = m.hh - Math.round(i * porBloco) * passo
      const y0 = m.hh - Math.round((i + 1) * porBloco) * passo
      const bloco = caixa(x0, y0, x1, y1)
      const z = (topo * Math.round((i + 1) * porBloco)) / n + c.g * SOBRA_DA_ALFARDA
      cena.sombras.push(coluna(bloco, z, false))
      L.push(P(bloco, pedra, { tabua: 0, bisel: 0, contorno: 0.16, tom: 0.58, semente: 5350 + i * 2 + lado }))
      L.push(P(caixa(x0 + 0.4, y0 + 0.4, x1 - 0.4, y1 - 0.5, 1), pedra, { tabua: 0, bisel: 1.5, tom: 1 + 0.05 * i, contorno: 0.24, textura: texDaPedraDoTemplo(0.3, 80 + i), semente: 5360 + i * 2 + lado, projeta: { dist: 2.6, forca: 0.32 } }))
    }
    // O MARCO do pé: o bloco maior, com o quadrado entalhado.
    const lm = Math.min(c.g * 0.2, (m.sz - m.s) * 1.5)
    const meio = (x0 + x1) / 2
    const marco = caixa(meio - lm / 2, m.hh - lm - 0.4, meio + lm / 2, m.hh - 0.4, 1)
    cena.sombras.push(coluna(marco, c.g * 0.42, false))
    L.push(P(marco, pedra, { tabua: 0, bisel: 1.7, tom: 1.1, contorno: 0.28, semente: 5380 + lado, projeta: { dist: 2.8, forca: 0.32 } }))
    L.push(P(caixa(meio - lm * 0.24, m.hh - lm * 0.74 - 0.4, meio + lm * 0.24, m.hh - lm * 0.26 - 0.4, 0.6), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.66, alfa: 0.85, recesso: { k: 0.8, forca: 0.3 }, semente: 5390 + lado }))
  }
}

/** O lado do terraço: 0 norte, 1 leste, 2 sul, 3 oeste. A direção para FORA da pirâmide em cada um. */
const PARA_FORA: readonly Ponto[] = [[0, -1], [1, 0], [0, 1], [-1, 0]]

/**
 * Um ponto no terraço do degrau `k`: o lado, ao comprido (-1 a 1) e de través (0 na mureta, 1 no pé do degrau de
 * cima; negativo sai para a face). `folga` = o quanto ele fica longe das pontas e da escada (px).
 */
function noTerraco(m: Medidas, k: number, lado: number, ao: number, traves: number, folga = 0): Ponto {
  const naVertical = lado % 2 === 1
  const fora = (naVertical ? m.AX[k] : m.AY[k]) - m.talude - m.mureta
  const dentro = naVertical ? m.AX[k + 1] : m.AY[k + 1]
  const d = fora + (dentro - fora) * traves
  const meio = Math.max(0, (naVertical ? m.AY[k] : m.AX[k]) - m.talude - folga)
  let a = Math.max(-meio, Math.min(meio, ao * meio))
  // No lado do sul a escada fica no meio: o ponto vai para fora dela.
  if (lado === 2 && Math.abs(a) < m.sz + folga + 2) a = (a < 0 ? -1 : 1) * (m.sz + folga + 2)
  return lado === 0 ? [a, -d] : lado === 2 ? [a, d] : lado === 1 ? [d, a] : [-d, a]
}

const FOLHA_SECA: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x80, 0x52] }
const TRINCA: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x47, 0x3e] }

type Posto = readonly [k: number, lado: number, ao: number, traves: number, tamanho: number]

/** As trincas, os tufos de musgo, os blocos caídos e as plantas da SECA: [degrau, lado, ao comprido, de través, tamanho]. */
const TRINCAS: readonly Posto[] = [[0, 0, -0.5, 0.25, 1], [0, 3, 0.3, 0.35, -1], [1, 1, -0.4, 0.5, 1], [1, 2, 0.62, 0.45, -1], [2, 0, 0.3, 0.5, 1], [0, 1, 0.1, 0.5, -1]]
const TUFOS: readonly Posto[] = [[0, 0, -0.9, 0.2, 5], [0, 0, 0.35, 0.9, 4], [0, 1, 0.8, 0.85, 4.4], [0, 3, -0.2, 0.9, 5.2], [0, 2, -0.7, 0.8, 4], [1, 0, 0.7, 0.9, 4.2], [1, 3, 0.6, 0.85, 3.6], [1, 1, -0.5, 0.2, 3.4], [2, 0, -0.5, 0.85, 3.8], [2, 2, 0.8, 0.8, 3.2]]
const BLOCOS_CAIDOS: readonly Posto[] = [[0, 1, 0.42, 0.45, 0.5], [0, 1, 0.52, 0.72, 1.9], [0, 2, 0.55, 0.5, 2.6], [1, 3, -0.6, 0.5, 1.1]]
const PLANTAS_DA_SECA: readonly Posto[] = [[0, 0, -0.78, 0.5, 7.4], [1, 1, 0.74, 0.5, 6.2], [0, 2, 0.74, 0.5, 6.8]]
const MOITAS_DA_SECA: readonly Posto[] = [[0, 3, 0.86, 0.45, 7], [0, 3, 0.76, 0.2, 5], [1, 0, -0.84, 0.4, 5.6]]
const CIPOS_DA_SECA: readonly Posto[] = [[1, 0, 0.3, 0, 13], [1, 3, -0.3, 0, 11], [2, 1, 0.2, 0, 10]]

/** O que o tempo deixou no degrau `k` da pirâmide SECA: as trincas, o musgo, os blocos caídos, as folhas secas e poucas plantas. */
function tempoDaSeca(t: Trabalho, k: number): void {
  const { c, m, L } = t
  const P = c.peca
  const pedra = c.m.pedra
  TRINCAS.forEach(([kk, lado, ao, tr, rumo], i) => {
    if (kk !== k) return
    const [x, y] = noTerraco(m, k, lado, ao, tr, 12)
    const pontos: Ponto[] = [0, 1, 2, 3, 4].map((j) => [x + (j - 2) * 3.4 + (acasoDoTemplo(i * 9 + j, 5) - 0.5) * 2.6, y + (j - 2) * 1.5 * rumo + (acasoDoTemplo(i * 9 + j, 6) - 0.5) * 3])
    L.push(P(comMeioEm(cadeia(pontos, 0.42), x, y), TRINCA, { bisel: 0, contorno: 0, alfa: 0.55, semente: 5400 + i }))
  })
  TUFOS.forEach(([kk, lado, ao, tr, r], i) => {
    if (kk !== k) return
    const [x, y] = noTerraco(m, k, lado, ao, tr, 8)
    L.push(P(comMeioEm(elipseGirada(x, y, r * 1.3, r * 0.8, acasoDoTemplo(i, 7) * Math.PI), x, y), MUSGO_DO_TEMPLO, { bisel: r * 0.4, contorno: 0.12, alfa: 0.62, suave: 0.9, tom: 0.92 + 0.16 * acasoDoTemplo(i, 8), semente: 5420 + i }))
  })
  BLOCOS_CAIDOS.forEach(([kk, lado, ao, tr, giro], i) => {
    if (kk !== k) return
    const [x, y] = noTerraco(m, k, lado, ao, tr, 8)
    const [cs, sn] = [Math.cos(giro), Math.sin(giro)]
    const canto = (px: number, py: number): Ponto => [x + px * cs - py * sn, y + px * sn + py * cs]
    const [bw, bh] = [3.6 + 1.4 * acasoDoTemplo(i, 9), 2.4 + acasoDoTemplo(i, 10)]
    L.push(P(comMeioEm(poligono([canto(-bw, -bh), canto(bw, -bh), canto(bw, bh), canto(-bw, bh)]), x, y), pedra, { tabua: 0, bisel: 1.3, tom: 1.04, contorno: 0.28, semente: 5440 + i, projeta: { dist: 1.6, forca: 0.32 } }))
  })
  // As folhas secas, sopradas contra o pé das faces.
  for (let i = k; i < 30; i += 3) {
    const [x, y] = noTerraco(m, k, Math.floor(acasoDoTemplo(i, 11) * 4), acasoDoTemplo(i, 12) * 1.8 - 0.9, 0.3 + 0.62 * acasoDoTemplo(i, 13), 5)
    L.push(P(comMeioEm(elipseGirada(x, y, 1.8, 0.9, acasoDoTemplo(i, 14) * Math.PI), x, y), FOLHA_SECA, { bisel: 0.5, contorno: 0.2, alfa: 0.82, tom: 0.86 + 0.3 * acasoDoTemplo(i, 15), semente: 5460 + i }))
  }
  PLANTAS_DA_SECA.forEach(([kk, lado, ao, tr, r], i) => {
    if (kk === k) roseta(L, P, ...noTerraco(m, k, lado, ao, tr, r), r, 100 + i)
  })
  MOITAS_DA_SECA.forEach(([kk, lado, ao, tr, r], i) => {
    if (kk === k) moita(L, P, ...noTerraco(m, k, lado, ao, tr, r), r, 110 + i)
  })
  CIPOS_DA_SECA.forEach(([kk, lado, ao, tr, comprido], i) => {
    if (kk !== k) return
    const [x, y] = noTerraco(m, k, lado, ao, tr, 10)
    cipo(L, P, x, y, PARA_FORA[lado][0], PARA_FORA[lado][1], comprido, 120 + i)
  })
}

/** A folhagem na mureta da ALAGADA: [degrau, lado, ao comprido, quantas moitas na fileira]. */
const FOLHAGEM: readonly (readonly [number, number, number, number])[] = [
  [0, 0, -0.93, 4], [0, 0, 0.16, 5], [0, 0, 0.93, 2], [0, 3, -0.5, 4], [0, 3, 0.5, 3], [0, 1, 0.22, 3], [0, 1, 0.93, 2], [0, 2, -0.9, 3], [0, 2, 0.62, 3],
  [1, 0, -0.6, 4], [1, 0, 0.92, 2], [1, 3, 0.2, 3], [1, 1, -0.55, 3], [1, 2, -0.88, 2], [1, 2, 0.9, 2],
  [2, 0, 0.3, 3], [2, 3, -0.66, 2], [2, 1, 0.7, 2], [2, 2, -0.9, 1],
]
const ROSETAS_DA_ALAGADA: readonly Posto[] = [[0, 0, -0.62, 0.55, 8], [0, 1, -0.7, 0.5, 7.2], [0, 2, 0.8, 0.5, 7.4], [0, 3, 0.16, 0.7, 6], [1, 0, 0.66, 0.5, 6.8], [1, 3, -0.7, 0.5, 6.2], [1, 1, 0.5, 0.7, 5.6], [2, 0, -0.66, 0.5, 5.8], [2, 1, -0.2, 0.6, 5]]
const CIPOS_DA_ALAGADA: readonly Posto[] = [[0, 0, -0.3, 0, 12], [0, 3, -0.86, 0, 11], [0, 1, 0.6, 0, 12], [0, 2, -0.5, 0, 10], [1, 0, 0.2, 0, 13], [1, 0, -0.9, 0, 10], [1, 3, 0.62, 0, 12], [1, 1, 0.1, 0, 11], [1, 2, 0.6, 0, 11], [2, 0, -0.2, 0, 12], [2, 3, 0.3, 0, 11], [2, 1, 0.1, 0, 10], [2, 2, 0.84, 0, 10]]

/** A vida do degrau `k` da pirâmide ALAGADA: as folhas redondas na água, os cipós, a folhagem na mureta e as rosetas. */
function vidaDaAlagada(t: Trabalho, k: number): void {
  const { c, m, L } = t
  const P = c.peca
  // As folhas redondas boiando, com o corte em cunha e a sombra curta na água.
  for (let i = k; i < 27; i += 3) {
    const r = 2.8 + 1.8 * acasoDoTemplo(i, 24)
    const [x, y] = noTerraco(m, k, Math.floor(acasoDoTemplo(i, 21) * 4), acasoDoTemplo(i, 22) * 1.7 - 0.85, 0.3 + 0.45 * acasoDoTemplo(i, 23), r + 3)
    const a = acasoDoTemplo(i, 25) * Math.PI * 2
    const cunha = poligono([[x, y], [x + Math.cos(a - 0.3) * r * 1.4, y + Math.sin(a - 0.3) * r * 1.4], [x + Math.cos(a + 0.3) * r * 1.4, y + Math.sin(a + 0.3) * r * 1.4]])
    L.push(P(comMeioEm(menos(elipse(x, y, r, r), cunha), x, y), acasoDoTemplo(i, 26) < 0.5 ? FOLHA_DA_SELVA : FOLHA_CLARA_DA_SELVA, { bisel: 0.7, contorno: 0.24, tom: 0.94 + 0.14 * acasoDoTemplo(i, 27), semente: 5500 + i, projeta: { dist: 1.1, forca: 0.28 } }))
  }
  CIPOS_DA_ALAGADA.forEach(([kk, lado, ao, tr, comprido], i) => {
    if (kk !== k) return
    const [x, y] = noTerraco(m, k, lado, ao, tr, 10)
    cipo(L, P, x, y, PARA_FORA[lado][0], PARA_FORA[lado][1], comprido, 420 + i)
  })
  // A folhagem cobrindo a mureta: fileiras de moitas de tamanhos diferentes, encostadas, umas debruçadas na face.
  FOLHAGEM.forEach(([kk, lado, ao, quantas], i) => {
    if (kk !== k) return
    const comprido = (lado % 2 === 1 ? m.AY[k] : m.AX[k]) - m.talude
    let passo = 0
    for (let j = 0; j < quantas; j += 1) {
      const r = 3.8 + 3.4 * acasoDoTemplo(i * 7 + j, 32)
      passo += r * 0.95
      const [x, y] = noTerraco(m, k, lado, ao + ((passo - r * 0.95) / comprido) * (ao > 0.5 ? -1 : 1), -0.1 + 0.22 * acasoDoTemplo(i * 7 + j, 31), r)
      moita(L, P, x, y, r, 200 + i * 7 + j, r > 5.4 ? 6 : 4)
      passo += r * 0.95
    }
  })
  ROSETAS_DA_ALAGADA.forEach(([kk, lado, ao, tr, r], i) => {
    if (kk === k) roseta(L, P, ...noTerraco(m, k, lado, ao, tr, r), r, 300 + i)
  })
}

export const montarPiramideEmDegraus: MontarMovel = (c, cena) => {
  if (!(c.hw > 0) || !(c.hh > 0)) return
  const m = medir(c)
  const t: Trabalho = { c, m, L: cena.partes, alagada: lerVarianteDaPiramideEmDegraus(c.variante) === 'alagada' }
  cena.corDoPiso = ESCURO_DA_PEDRA_DO_TEMPLO
  cena.sombras.push(contato(caixa(-m.hw, -m.hh, m.hw, m.hh), 0.34))
  for (let k = 0; k < DEGRAUS.length - 1; k += 1) degrau(t, cena, k)
  patamar(t, cena)
  escadaria(t, cena)
}

/** As duas formas pelo nome, para a folha de prova (o catálogo registra só `montarPiramideEmDegraus`). */
export const montarPiramideEmDegrausSeca: MontarMovel = (c, cena) => montarPiramideEmDegraus({ ...c, variante: 0 }, cena)
export const montarPiramideEmDegrausAlagada: MontarMovel = (c, cena) => montarPiramideEmDegraus({ ...c, variante: 1 }, cena)
