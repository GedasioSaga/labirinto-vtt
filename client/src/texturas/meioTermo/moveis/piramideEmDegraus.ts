/**
 * PIRÂMIDE EM DEGRAUS (lote L08 de 24/11/2026, item 71: construção nova, a peça principal do templo na selva do
 * mapa 6; desenho próprio, só a ideia do objeto). QUATRO DEGRAUS concêntricos de pedra, cada um mais alto e mais
 * claro que o de baixo, com a face em TALUDE pintada POR FACE (a do norte e a do oeste na luz, a do sul e a do leste
 * na sombra), a capa fina no alto de cada face e o terraço de lajes atrás dela. Cada degrau deita no de baixo uma
 * faixa de sombra do lado do sul e do leste, escura colada à parede e sumindo em degradê. Na frente (o lado de baixo
 * da pegada) a ESCADARIA sobe do chão ao patamar TALHADA NA MASSA: os pisantes da mesma pedra, cada um com a borda da
 * frente clara e o espelho escuro, as juntas desencontradas, entre duas ALFARDAS de pedra mais escura que sobem em
 * três blocos, sempre mais altas que a escada. No patamar do alto, a moldura gravada e a PEDRA DO SOL no meio (some
 * debaixo do Topo do templo, o item 72, que tem o tamanho certo para ir em cima dele e repete o mesmo medalhão).
 *
 * Duas FORMAS (`lib/mobilia/piramideEmDegraus.ts`, a `variante`):
 * - SECA (a de partida): o musgo só onde a água para (nas juntas, nos cantos de dentro e no pé das faces do norte),
 *   uns tufos de dois tons, umas folhas secas, trincas, uns blocos caídos, cipós e poucas plantas;
 * - ALAGADA: cada terraço é um tanque raso de água parada com FUNDURA (escura junto da parede de dentro, clara para
 *   fora, o fio claro onde toca a pedra e o reflexo curto da borda), com moitas, samambaias, capim e cipós caindo
 *   pela face, em trechos, e as folhas redondas boiando em grupos.
 *
 * Esticada, os degraus acompanham a pegada (frações dela) e o que é de través fica na régua da casa: o talude, a
 * capa, a laje e a pisada da escada não engrossam, repetem.
 *
 * AS DUAS VISTAS SAEM DO MESMO DESENHO (perfil `{ modo: 'derivado', propria: true }` em `tresQuartos.ts`): cada
 * face é um polígono com os cantos em 3D, posto NA TELA por `pontoNaTela` (o quarto de volta do giro e, na 3/4, a
 * altura subindo). De cima a altura não sobe e sobra o talude; na 3/4 a face do sul cresce com o espelho de cada
 * degrau, a do norte some atrás do degrau e as do leste e do oeste inclinam. Não usa a frente varrida do motor (que
 * saía com as camadas do arenito deitadas, lendo como tábua). A escada de lado é a mesma vala: os pisantes paralelos
 * à face, cada um com o seu espelho, cortando os mesmos degraus; na 3/4 só encurtam no eixo da vista, com a parede
 * do fundo da vala aparecendo em cima, e o contorno fica reto.
 *
 * Lê `c.giro` e `c.vista`. Material: `pedra`. Escreve `cena.corDoPiso`. Barra a passagem, não tapa a visão.
 *
 * Este arquivo também guarda o que as peças de pedra do lote dividem (a vista em 3D, a pedra do templo, o musgo em
 * tufos, a pedra do sol e as plantas): o topo do templo, a cabeça colossal, o ídolo, a cascata e a ponte importam daqui.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { lerVarianteDaPiramideEmDegraus } from '../../../lib/mobilia/piramideEmDegraus'
import { anel, cadeia, caixa, elipse, elipseGirada, menos, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { ruido, type Cena, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { desgirarCena } from './pipaDeitada'
import type { ContextoDoMovel, MontarMovel } from './contexto'

// ---------- o que as peças do lote dividem: as cores ----------

/** O escuro da pedra do templo (o piso de luz): com a nogueira, a beira cinza saía marrom. */
export const ESCURO_DA_PEDRA_DO_TEMPLO: Rgb = [0x45, 0x44, 0x3c]
/** O musgo: o verde-oliva do Meio-Termo, apagado. O tufo tem dois tons: o escuro embaixo e o claro em cima. */
export const TOM_DO_MUSGO_DO_TEMPLO: Rgb = rgb(tomDoMeio('musgo', 0.84))
export const MUSGO_ESCURO_DO_TEMPLO: MaterialDaPeca = { classe: 'folha', rgb: rgb(tomDoMeio('musgo', 0.66)) }
export const MUSGO_CLARO_DO_TEMPLO: MaterialDaPeca = { classe: 'folha', rgb: rgb(tomDoMeio('musgo', 1)) }
/** A folhagem da selva em três tons contidos (a massa, a folha e o realce), o buxo e o alfeneiro da sebe puxados para o escuro. */
export const FOLHA_ESCURA_DA_SELVA: MaterialDaPeca = { classe: 'folha', rgb: [0x3c, 0x60, 0x45] }
export const FOLHA_DA_SELVA: MaterialDaPeca = { classe: 'folha', rgb: [0x54, 0x7c, 0x55] }
export const FOLHA_CLARA_DA_SELVA: MaterialDaPeca = { classe: 'folha', rgb: [0x6f, 0x92, 0x5c] }
/** O capim: mais amarelo que a folha. */
const CAPIM_ESCURO: MaterialDaPeca = { classe: 'folha', rgb: [0x55, 0x74, 0x48] }
const CAPIM_CLARO: MaterialDaPeca = { classe: 'folha', rgb: [0x86, 0x9c, 0x5c] }

/**
 * A pedra do painel como o templo a usa: a ardósia e o granito um nada mais quentes (o cinza frio azulava ao lado do
 * verde da mata); o arenito fica como está.
 */
export function pedraDoTemplo(pedra: MaterialDaPeca): MaterialDaPeca {
  const [r, g, b] = pedra.rgb
  if (pedra.pedra === 'ardosia') return { ...pedra, rgb: [r * 1.1, g * 1.01, b * 0.93] }
  if (pedra.pedra === 'granito') return { ...pedra, rgb: [r * 1.02, g, b * 0.96] }
  return pedra
}

/** A pedra é escura (a ardósia)? O alto e o pisante ganham mais luz para o olho achar o centro e a escada. */
export function ehPedraEscura(pedra: MaterialDaPeca): boolean {
  return 0.3 * pedra.rgb[0] + 0.59 * pedra.rgb[1] + 0.11 * pedra.rgb[2] < 118
}

// ---------- a vista: o giro e a altura, do objeto para a tela ----------

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

/**
 * A VISTA de quem desenha as duas vistas do mesmo jeito: os quartos do giro e o quanto a altura sobe na tela (0 de
 * cima, 1 na 3/4). Tudo é montado NA TELA e devolvido ao objeto por `entregarNaTela` (o motor gira de volta).
 */
export interface VistaDoTemplo {
  readonly q: number
  readonly sobe: number
}

export function vistaDoTemplo(c: Pick<ContextoDoMovel, 'giro' | 'vista'>): VistaDoTemplo {
  return { q: quartosDoGiroDoTemplo(c.giro), sobe: c.vista === 'tres-quartos' ? 1 : 0 }
}

/** O ponto (x, y) do objeto, à altura `z`, NA TELA. */
export function pontoNaTela(v: VistaDoTemplo, x: number, y: number, z = 0): Ponto {
  const [sx, sy] = naTelaDoTemplo(x, y, v.q)
  return [sx, sy - v.sobe * z]
}

/** A caixa (x0, y0)-(x1, y1) do objeto, à altura `z`, NA TELA. */
export function caixaNaTela(v: VistaDoTemplo, x0: number, y0: number, x1: number, y1: number, z = 0): Caixa {
  const [ax, ay] = pontoNaTela(v, x0, y0, z)
  const [bx, by] = pontoNaTela(v, x1, y1, z)
  return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]
}

/** O retângulo deitado (x0, y0)-(x1, y1) do objeto, à altura `z`, NA TELA. */
export function retNaTela(v: VistaDoTemplo, x0: number, y0: number, x1: number, y1: number, z = 0, raio = 0): Forma {
  const b = caixaNaTela(v, x0, y0, x1, y1, z)
  return caixa(b[0], b[1], b[2], b[3], raio)
}

export type Ponto3 = readonly [number, number, number]

/** O polígono de cantos (x, y, z) do objeto NA TELA. */
export function polNaTela(v: VistaDoTemplo, pontos: readonly Ponto3[]): Forma {
  return poligono(pontos.map(([x, y, z]) => pontoNaTela(v, x, y, z)))
}

/**
 * A FACE DE PÉ virada para quem olha (a do sul NA TELA) do bloco (x0, y0)-(x1, y1) do objeto, de `z0` a `z1`. De
 * cima ela não tem altura: `null`.
 */
export function frenteNaTela(v: VistaDoTemplo, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number): Forma | null {
  if (!(v.sobe > 0) || !(z1 > z0)) return null
  const b = caixaNaTela(v, x0, y0, x1, y1, 0)
  return caixa(b[0], b[3] - v.sobe * z1, b[2], b[3] - v.sobe * z0)
}

/** Entrega a cena montada NA TELA: sem giro vai como está; girada, volta ao referencial do objeto (`desgirarCena`). */
export function entregarNaTela(v: VistaDoTemplo, tela: Cena, cena: Cena): void {
  if (v.q === 0) {
    cena.partes.push(...tela.partes)
    cena.sombras.push(...tela.sombras)
    if (tela.corDoPiso !== undefined) cena.corDoPiso = tela.corDoPiso
    return
  }
  desgirarCena(tela, v.q, cena)
}

/** O ponto do objeto que uma textura achou (escrito por `paraOObjeto`): sem criar lista a cada pixel. */
const NO_OBJETO = new Float64Array(2)

/** O ponto (x, y) da tela, de um plano deitado à altura `z`, de volta no referencial do objeto (em `NO_OBJETO`). */
function paraOObjeto(v: VistaDoTemplo, z: number, x: number, y: number): void {
  const yy = y + v.sobe * z
  if (v.q === 1) {
    NO_OBJETO[0] = yy
    NO_OBJETO[1] = -x
  } else if (v.q === 2) {
    NO_OBJETO[0] = -x
    NO_OBJETO[1] = -yy
  } else if (v.q === 3) {
    NO_OBJETO[0] = -yy
    NO_OBJETO[1] = x
  } else {
    NO_OBJETO[0] = x
    NO_OBJETO[1] = yy
  }
}

/**
 * Uma textura escrita no referencial do OBJETO, para um plano deitado à altura `z` (a água da cascata, o tabuleiro da
 * ponte): recebe o ponto do objeto (x, y) e, depois, o da tela. O desenho gira com o objeto; a luz fica na tela.
 */
export function texNoObjeto(v: VistaDoTemplo, z: number, tex: (x: number, y: number, p: Peca, s: Float32Array, escala: number, sx: number, sy: number) => void): Textura {
  return (_u, _v, sx, sy, p, s, escala) => {
    paraOObjeto(v, z, sx, sy)
    tex(NO_OBJETO[0], NO_OBJETO[1], p, s, escala, sx, sy)
  }
}

/**
 * A luz (o `luz` da peça) de uma face pela normal dela NA TELA, com a luz do app (LUZ_NO_PLANO -0,6, -0,8): a do
 * norte e a do oeste clareiam 12%, a do sul e a do leste escurecem 22%, as de quina ficam no meio.
 */
export function luzDaFaceNaTela(nx: number, ny: number): number {
  const d = -(nx * 0.6 + ny * 0.8) / (Math.hypot(nx, ny) || 1)
  const f = Math.min(1, Math.abs(d) / 0.6)
  return d >= 0 ? 0.12 * f : -0.22 * f
}

/** A direção da sombra do motor no chão, NA TELA. */
const SOMBRA_NA_TELA: Ponto = [0.79, 0.61]
/** A luz da face de pé virada para quem olha na 3/4 (o espelho de um degrau, a frente de um muro): o `TOM_DA_FRENTE` do motor. */
export const LUZ_DA_FRENTE_DO_TEMPLO = -0.27

function limitar01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

// ---------- o que as peças do lote dividem: a pedra e o musgo ----------

/** A escala (pixels por px do protótipo) a partir da qual o grão miúdo e o líquen aparecem. */
const ESCALA_DO_GRAO = 1.2

/**
 * A base da pedra do templo vista de cima: manchas mansas em duas escalas e o grão miúdo de perto, mais as pintas do
 * granito. Não usa a textura da classe: as camadas do arenito, deitadas na tela, riscavam a laje como veio de madeira.
 */
export const DA_PEDRA: Textura = (_u, _v, x, y, p, s, escala) => {
  let luz = ruido(x * 0.085 + p.su, y * 0.085 + p.sv) * 0.13 + ruido(x * 0.33 + p.sv, y * 0.33 + 7) * 0.06
  if (escala >= ESCALA_DO_GRAO) luz += ruido(x * 1.3 + 5, y * 1.3 + p.su) * 0.035
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

/** O musgo cresce em TRECHOS (px por volta do ruído que escolhe o trecho) e tem a beira roída por um grão miúdo. */
const TRECHO_DO_MUSGO = 17
const GRAO_DO_MUSGO = 1.5

/**
 * O musgo de uma JUNTA no ponto (0 a 1): só até `largura` px da junta, só nos trechos sorteados (perto de um terço
 * deles) e com a beira roída. É o musgo "onde a água para": não mancha o miolo da pedra.
 */
export function musgoDaJunta(x: number, y: number, junta: number, largura: number, semente: number): number {
  if (junta >= largura) return 0
  const trecho = ruido(x / TRECHO_DO_MUSGO + semente * 1.7, y / TRECHO_DO_MUSGO + semente * 0.9)
  if (trecho < -0.03) return 0
  const roido = 0.7 + 0.6 * ruido(x / GRAO_DO_MUSGO + 31, y / GRAO_DO_MUSGO + semente)
  return limitar01((trecho + 0.03) * 6) * (1 - (junta / largura) * (junta / largura)) * roido
}

/** Pinta o musgo `t` (0 a 1) no ponto: a cor do musgo e um nada menos de luz. */
export function pintarMusgo(s: Float32Array, t: number): void {
  if (t <= 0.04) return
  const k = t > 0.86 ? 0.86 : t
  tingir(s, TOM_DO_MUSGO_DO_TEMPLO, k)
  s[3] -= 0.04 * k
}

/**
 * A PEDRA DO TEMPLO de uma peça solta (o bloco, o pedestal, o muro): a pedra do painel com o líquen de perto e, com
 * `musgo` (0 a 1), o musgo roído só no PÉ da peça (o lado de baixo da caixa dela, onde a água para), em trechos.
 */
export function texDaPedraDoTemplo(musgo: number, semente = 0): Textura {
  return (u, v, x, y, p, s, escala) => {
    DA_PEDRA(u, v, x, y, p, s, escala)
    if (musgo > 0) {
      const b = p.forma.b
      pintarMusgo(s, musgoDaJunta(x, y, b[3] - y, 2 + 5 * musgo, semente) * (0.5 + 0.5 * musgo))
    }
    if (escala < ESCALA_DO_GRAO) return
    const l = ruido(x / 1.4 + 51 + semente, y / 1.4 + 3)
    if (l > 0.36) s[3] += (l - 0.36) * 0.6
  }
}

/**
 * As LAJES de um piso do templo (o patamar, a laje do topo): fiadas desencontradas de `laje` px, cada laje no seu tom,
 * a junta escura e o musgo só nas juntas, em trechos. Com `v` e `z`, o piso está à altura `z` do objeto e gira com ele.
 */
export function texDasLajesDoTemplo(laje: number, v?: VistaDoTemplo, z = 0): Textura {
  return (_u, _v, sx, sy, p, s, escala) => {
    let [x, y] = [sx, sy]
    if (v !== undefined) {
      paraOObjeto(v, z, sx, sy)
      x = NO_OBJETO[0]
      y = NO_OBJETO[1]
    }
    DA_PEDRA(0, 0, x, y, p, s, escala)
    const fileira = Math.floor(y / laje + 0.5)
    const xx = x / laje + (((fileira % 2) + 2) % 2) * 0.5
    const fila = Math.floor(xx)
    const [fx, fy] = [(xx - fila) * laje, (y / laje + 0.5 - fileira) * laje]
    const junta = Math.min(fx, laje - fx, fy, laje - fy)
    s[3] += (hash(fila, fileira, 917) - 0.5) * 0.1
    if (junta < 0.9) s[3] -= 0.24 * (1 - junta / 0.9)
    pintarMusgo(s, musgoDaJunta(x, y, junta, 1.9, 23) * 0.72)
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
 * Uma MANCHA de beira irregular: a elipse girada com a beira empurrada por um ruído (o tufo de musgo, a massa de
 * folhagem). Não é oval: cada semente dá um contorno.
 */
export function manchaIrregular(x: number, y: number, rx: number, ry: number, giro: number, semente: number, aspereza = 0.5): Forma {
  const e = elipseGirada(x, y, rx, ry, giro)
  const m = Math.min(rx, ry)
  const folga = m * aspereza * 0.8
  const f = 1.25 / Math.max(1.6, m)
  return {
    b: [e.b[0] - folga, e.b[1] - folga, e.b[2] + folga, e.b[3] + folga],
    d: (px, py) => e.d(px, py) + (ruido(px * f + semente * 3.1, py * f + semente * 1.3) * 1.4 + ruido(px * f * 2.7 + 9, py * f * 2.7 + semente) * 0.5) * m * aspereza,
  }
}

/**
 * Um TUFO DE MUSGO: a mancha escura de beira roída e, por cima dela, deslocada para o lado da luz, a mancha clara
 * menor (os dois tons: escuro embaixo, claro em cima). `r` = o raio maior (px); nunca um oval chapado.
 */
export function tufoDeMusgo(L: Peca[], P: CriarPeca, x: number, y: number, r: number, semente: number, achata = 0.62): void {
  const giro = acasoDoTemplo(semente, 7) * Math.PI
  L.push(P(manchaIrregular(x, y, r, r * achata, giro, semente + 3, 0.62), MUSGO_ESCURO_DO_TEMPLO, { bisel: 0, contorno: 0.16, alfa: 0.94, suave: 0.5, tom: 0.94 + 0.12 * acasoDoTemplo(semente, 8), semente: 6300 + semente, projeta: { dist: 0.7, forca: 0.14 } }))
  L.push(P(manchaIrregular(x - r * 0.2, y - r * 0.24, r * 0.6, r * achata * 0.56, giro, semente + 17, 0.7), MUSGO_CLARO_DO_TEMPLO, { bisel: 0, contorno: 0, alfa: 0.9, suave: 0.6, tom: 0.92 + 0.14 * acasoDoTemplo(semente, 9), semente: 6340 + semente }))
}

/**
 * A PEDRA DO SOL: o medalhão do templo (o disco em relevo baixo, o sulco em volta do miolo, os oito raios e o olho).
 * Está no patamar da pirâmide e na crista do topo do templo: o motivo que amarra as duas peças. `r` = o raio (px).
 */
export function pedraDoSol(L: Peca[], P: CriarPeca, pedra: MaterialDaPeca, x: number, y: number, r: number, tom: number, semente: number): void {
  L.push(P(elipse(x, y, r, r), pedra, { bisel: Math.min(1.5, r * 0.2), tom: tom * 1.04, contorno: 0.26, textura: texDaPedraDoTemplo(0, 5), semente, projeta: { dist: Math.min(1.5, r * 0.16), forca: 0.3 } }))
  L.push(P(anel(x, y, r * 0.8, r * 0.8, r * 0.7, r * 0.7), pedra, { bisel: 0, contorno: 0, tom: tom * 0.62, alfa: 0.8, semente: semente + 1 }))
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    L.push(P(elipseGirada(x + Math.cos(a) * r * 0.57, y + Math.sin(a) * r * 0.57, r * 0.105, r * 0.05, a), pedra, { bisel: 0, contorno: 0, tom: tom * 0.6, alfa: 0.8, semente: semente + 2 + i }))
  }
  L.push(P(elipse(x, y, r * 0.36, r * 0.36), pedra, { bisel: r * 0.16, tom: tom * 1.1, contorno: 0.26, semente: semente + 10, projeta: { dist: Math.min(1, r * 0.1), forca: 0.26 } }))
  L.push(P(elipse(x, y, r * 0.13, r * 0.13), pedra, { bisel: 0, contorno: 0, tom: tom * 0.56, alfa: 0.85, recesso: { k: 0.8, forca: 0.3 }, semente: semente + 11 }))
}

// ---------- o que as peças do lote dividem: as plantas (todas montadas NA TELA) ----------

/** A folha de um tom pelo lado da luz: a de cima à esquerda clara, a de baixo à direita escura. */
function folhaPelaLuz(a: number): MaterialDaPeca {
  const luz = paraALuz(a)
  return luz > 0.28 ? FOLHA_CLARA_DA_SELVA : luz < -0.45 ? FOLHA_ESCURA_DA_SELVA : FOLHA_DA_SELVA
}

/**
 * Uma planta em ROSETA vista de cima (a bromélia do templo): `folhas` folhas pontudas em volta do miolo escuro,
 * cada uma com a luz do chanfro. `r` = o comprimento da folha (px).
 */
export function roseta(L: Peca[], P: CriarPeca, x: number, y: number, r: number, semente: number, folhas = 7): void {
  const torce = acasoDoTemplo(semente, 1) * Math.PI * 2
  L.push(P(elipse(x + 0.5, y + 0.6, r * 0.62, r * 0.6), FOLHA_ESCURA_DA_SELVA, { bisel: r * 0.3, contorno: 0.2, alfa: 0.85, suave: 0.6, semente: 6400 + semente }))
  for (let i = 0; i < folhas; i += 1) {
    const a = torce + (i / folhas) * Math.PI * 2 + (acasoDoTemplo(semente, 10 + i) - 0.5) * 0.4
    const comprida = r * (0.82 + 0.3 * acasoDoTemplo(semente, 30 + i))
    const larga = r * (0.2 + 0.07 * acasoDoTemplo(semente, 50 + i))
    const [cx, cy] = [x + Math.cos(a) * comprida * 0.52, y + Math.sin(a) * comprida * 0.52]
    L.push(P(elipseGirada(cx, cy, comprida * 0.52, larga, a), folhaPelaLuz(a), { bisel: larga * 0.7, contorno: 0.26, tom: 0.86 + 0.12 * acasoDoTemplo(semente, 70 + i), semente: 6410 + semente * 13 + i, projeta: { dist: 0.9, forca: 0.22 } }))
  }
  L.push(P(elipse(x, y, r * 0.17, r * 0.17), FOLHA_ESCURA_DA_SELVA, { bisel: r * 0.1, contorno: 0.2, tom: 0.82, semente: 6490 + semente }))
}

/**
 * Uma MOITA baixa vista de cima: a massa escura de beira irregular e, por cima, as folhas ovais apontando para fora
 * (as de cima à esquerda claras), em vez de gomos redondos. `r` = o raio (px); `gomos` = quantas folhas em volta.
 */
export function moita(L: Peca[], P: CriarPeca, x: number, y: number, r: number, semente: number, gomos = 5): void {
  const torce = acasoDoTemplo(semente, 2) * Math.PI * 2
  L.push(P(manchaIrregular(x + r * 0.08, y + r * 0.1, r * 0.84, r * 0.76, torce, semente, 0.42), FOLHA_ESCURA_DA_SELVA, { bisel: r * 0.3, contorno: 0.26, semente: 6500 + semente, projeta: { dist: 1.4, forca: 0.3 } }))
  const n = gomos + 2
  for (let i = 0; i < n; i += 1) {
    const a = torce + (i / n) * Math.PI * 2 + (acasoDoTemplo(semente, 10 + i) - 0.5) * 0.7
    const d = r * (0.3 + 0.3 * acasoDoTemplo(semente, 20 + i))
    const comprida = r * (0.4 + 0.2 * acasoDoTemplo(semente, 40 + i))
    L.push(P(elipseGirada(x + Math.cos(a) * d - r * 0.04, y + Math.sin(a) * d - r * 0.06, comprida, comprida * 0.5, a), folhaPelaLuz(a), { bisel: comprida * 0.3, contorno: 0.22, tom: 0.88 + 0.12 * acasoDoTemplo(semente, 60 + i), semente: 6510 + semente * 7 + i, projeta: { dist: 0.8, forca: 0.2 } }))
  }
  // Duas folhas novas no alto, do lado da luz.
  for (let i = 0; i < 2; i += 1) {
    const a = -2.3 + i * 1.2 + (acasoDoTemplo(semente, 80 + i) - 0.5) * 0.5
    L.push(P(elipseGirada(x - r * 0.14 + Math.cos(a) * r * 0.16, y - r * 0.18 + Math.sin(a) * r * 0.16, r * 0.3, r * 0.15, a), FOLHA_CLARA_DA_SELVA, { bisel: r * 0.1, contorno: 0.14, tom: 1 + 0.06 * i, semente: 6560 + semente + i }))
  }
}

/**
 * Um CIPÓ visto de cima: o ramo fino que sai de (x, y) no rumo (dx, dy), ondulando, com as folhinhas alternadas dos
 * dois lados, menores para a ponta. `comprimento` em px.
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
  L.push(P(cadeia(pontos, 0.55), FOLHA_ESCURA_DA_SELVA, { bisel: 0.5, contorno: 0.2, tom: 0.9, semente: 6600 + semente, projeta: { dist: 0.8, forca: 0.2 } }))
  for (let i = 1; i <= nos; i += 1) {
    if (acasoDoTemplo(semente * 31 + i, 4) < 0.2) continue
    const [px, py] = pontos[i]
    const lado = i % 2 === 0 ? 1 : -1
    const a = Math.atan2(uy, ux) + lado * (0.9 + 0.5 * acasoDoTemplo(semente * 31 + i, 5))
    const rf = (1.9 + 0.8 * acasoDoTemplo(semente * 31 + i, 6)) * (1 - (0.45 * i) / nos)
    const mat = paraALuz(a) > 0 ? FOLHA_CLARA_DA_SELVA : FOLHA_DA_SELVA
    L.push(P(elipseGirada(px + Math.cos(a) * rf * 0.8, py + Math.sin(a) * rf * 0.8, rf, rf * 0.56, a), mat, { bisel: rf * 0.4, contorno: 0.24, tom: 0.84 + 0.14 * acasoDoTemplo(semente * 31 + i, 7), semente: 6610 + semente * 17 + i }))
  }
}

/** O espaço entre dois folíolos da fronde (px). */
const PASSO_DO_FOLIOLO = 1.9

/** Uma FRONDE de samambaia de (ax, ay) a (bx, by): afina para as duas pontas e tem a beira em pente (os folíolos). */
function fronde(ax: number, ay: number, bx: number, by: number, largura: number): Forma {
  const [dx, dy] = [bx - ax, by - ay]
  const l = Math.hypot(dx, dy) || 1
  const [ux, uy] = [dx / l, dy / l]
  return {
    b: [Math.min(ax, bx) - largura, Math.min(ay, by) - largura, Math.max(ax, bx) + largura, Math.max(ay, by) + largura],
    d(x, y) {
      const [px, py] = [x - ax, y - ay]
      const u = px * ux + py * uy
      const w = Math.abs(-px * uy + py * ux)
      if (u < 0) return Math.hypot(px, py)
      if (u > l) return Math.hypot(x - bx, y - by)
      const t = u / l
      const dente = Math.abs(u / PASSO_DO_FOLIOLO - Math.round(u / PASSO_DO_FOLIOLO)) * 2
      return w - largura * Math.sin(Math.PI * Math.pow(t, 0.7)) * (1 - 0.5 * dente) - 0.25
    },
  }
}

/**
 * Uma SAMAMBAIA vista de cima: as frondes em pente saindo do pé. Sem `rumo`, em roda; com `rumo` (radianos), em leque
 * de `abre` radianos para esse lado (a que se debruça na borda e cai pelo espelho do degrau). `r` = a fronde (px).
 */
export function samambaia(L: Peca[], P: CriarPeca, x: number, y: number, r: number, semente: number, frondes = 6, rumo?: number, abre = 2.2): void {
  L.push(P(elipse(x, y, r * 0.3, r * 0.26), FOLHA_ESCURA_DA_SELVA, { bisel: r * 0.12, contorno: 0.2, alfa: 0.9, suave: 0.5, semente: 6700 + semente }))
  const torce = acasoDoTemplo(semente, 1) * Math.PI * 2
  for (let i = 0; i < frondes; i += 1) {
    const sorte = (acasoDoTemplo(semente, 10 + i) - 0.5) * 0.4
    const a = rumo === undefined ? torce + (i / frondes) * Math.PI * 2 + sorte : rumo + ((i + 0.5) / frondes - 0.5) * abre + sorte
    const comprida = r * (0.74 + 0.36 * acasoDoTemplo(semente, 30 + i))
    const [bx, by] = [x + Math.cos(a) * comprida, y + Math.sin(a) * comprida]
    L.push(P(fronde(x, y, bx, by, r * 0.19), folhaPelaLuz(a), { bisel: 0.6, contorno: 0.24, tom: 0.9 + 0.14 * acasoDoTemplo(semente, 50 + i), semente: 6710 + semente * 11 + i, projeta: { dist: 0.9, forca: 0.22 } }))
  }
}

/** Um tufo de CAPIM visto de cima: as lâminas finas, curvas, abrindo do pé, em dois tons. `r` = a lâmina (px). */
export function capim(L: Peca[], P: CriarPeca, x: number, y: number, r: number, semente: number, laminas = 7): void {
  const torce = acasoDoTemplo(semente, 1) * Math.PI * 2
  for (let i = 0; i < laminas; i += 1) {
    const a = torce + (i / laminas) * Math.PI * 2 + (acasoDoTemplo(semente, 10 + i) - 0.5) * 0.7
    const comprida = r * (0.6 + 0.5 * acasoDoTemplo(semente, 20 + i))
    const dobra = (acasoDoTemplo(semente, 30 + i) - 0.5) * 0.9
    const meio: Ponto = [x + Math.cos(a) * comprida * 0.55, y + Math.sin(a) * comprida * 0.55]
    const ponta: Ponto = [x + Math.cos(a + dobra) * comprida, y + Math.sin(a + dobra) * comprida]
    L.push(P(cadeia([[x, y], meio, ponta], 0.52), paraALuz(a) > -0.1 ? CAPIM_CLARO : CAPIM_ESCURO, { bisel: 0.4, contorno: 0.22, tom: 0.9 + 0.16 * acasoDoTemplo(semente, 40 + i), semente: 6800 + semente * 9 + i, projeta: { dist: 0.7, forca: 0.18 } }))
  }
}

/** O que a rocha facetada precisa: a vista, a fábrica, a pedra e onde entram as peças. */
export interface ParaARocha {
  readonly v: VistaDoTemplo
  readonly P: CriarPeca
  readonly L: Peca[]
  readonly pedra: MaterialDaPeca
}

/**
 * Uma ROCHA FACETADA (a família das rochas de `carimbos/novos/_rochaFacetada.ts`, feita com as peças do motor): o pé
 * de cantos vivos, as faces de lado (cada uma com a luz do lado para onde olha NA TELA: a do norte e a do oeste
 * claras, a do sul e a do leste escuras) e o topo menor, recuado para o lado da luz. Na 3/4 o topo sobe `alto` px e as
 * faces da frente crescem. (cx, cy) e os raios são do objeto; devolve o pé NA TELA (a sombra no chão sai dele).
 */
export function rochaFacetada(r: ParaARocha, cx: number, cy: number, rx: number, ry: number, alto: number, semente: number, tom = 1): Forma {
  const { v, P, L, pedra } = r
  const n = 5 + Math.floor(acasoDoTemplo(semente, 1) * 3)
  const torce = acasoDoTemplo(semente, 2) * Math.PI * 2
  const [mx, my] = pontoNaTela(v, cx, cy)
  const menor = Math.min(rx, ry)
  const base: Ponto[] = []
  const topo: Ponto[] = []
  const encolhe = 0.5 + 0.14 * acasoDoTemplo(semente, 3)
  for (let i = 0; i < n; i += 1) {
    const a = torce + ((i + (acasoDoTemplo(semente, 10 + i) - 0.5) * 0.6) / n) * Math.PI * 2
    const raio = 0.8 + 0.3 * acasoDoTemplo(semente, 20 + i)
    const [bx, by] = pontoNaTela(v, cx + Math.cos(a) * rx * raio, cy + Math.sin(a) * ry * raio)
    base.push([bx, by])
    const irregular = encolhe * (0.86 + 0.28 * acasoDoTemplo(semente, 30 + i))
    topo.push([mx + (bx - mx) * irregular - menor * 0.1, my + (by - my) * irregular - menor * 0.14 - v.sobe * alto])
  }
  const pe = poligono(base)
  L.push(P(pe, pedra, { bisel: 0, contorno: 0.3, tom: tom * 0.6, textura: DA_PEDRA, semente: 7500 + semente, projeta: { dist: 1.4 + alto * 0.22, forca: 0.34, suave: 1.2 } }))
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    const [nx, ny] = [(base[i][0] + base[j][0]) / 2 - mx, (base[i][1] + base[j][1]) / 2 - my]
    L.push(P(poligono([base[i], base[j], topo[j], topo[i]]), pedra, { bisel: 0, contorno: 0.14, tom: tom * (0.9 + 0.08 * acasoDoTemplo(semente, 40 + i)), luz: luzDaFaceNaTela(nx, ny) * 1.3 - 0.04, textura: DA_PEDRA, semente: 7510 + semente * 8 + i }))
  }
  L.push(P(poligono(topo), pedra, { bisel: 0.7, contorno: 0.18, tom: tom * (1.04 + 0.1 * acasoDoTemplo(semente, 4)), luz: 0.05, textura: texDaPedraDoTemplo(0, semente), semente: 7590 + semente }))
  return pe
}

// ---------- as medidas da pirâmide ----------

/** A meia medida de cada degrau, em fração da meia pegada (o de baixo é a pegada inteira; o último é o patamar). */
const DEGRAUS: readonly number[] = [1, 0.8, 0.6, 0.4]
/** A altura de cada degrau (casas). */
export const ALTURA_DO_DEGRAU_DA_PIRAMIDE = 0.3
/** A face em talude vista de cima e a capa no alto dela (casas); nunca mais que estas frações do terraço. */
const TALUDE = 0.135
const CAPA = 0.07
const FRACAO_DO_TALUDE = 0.3
const FRACAO_DA_CAPA = 0.2
/** A escada: a meia largura dos pisantes (fração da meia largura), a alfarda (casas) e o pisante (casas). */
const MEIA_ESCADA = 0.2
const ALFARDA = 0.15
const PISADA = 0.15
/** A laje do terraço ao comprido (casas), a do patamar (casas) e o bloco da face ao comprido (px). */
const LAJE = 0.44
const LAJE_DO_PATAMAR = 0.6
const BLOCO_DA_FACE = 15
/** O tom de cada degrau: o de cima, mais perto da luz, é o mais claro (na pedra escura o alto clareia mais). */
const TOM_DO_DEGRAU: readonly number[] = [0.86, 0.93, 1, 1.1]
const TOM_A_MAIS_NO_ALTO_ESCURO = 0.1
/** A alfarda é um ou dois tons mais escura que o degrau, para a escada ler como talhada na massa. */
const TOM_DA_ALFARDA = 0.82
/** A sombra que cada degrau deita no terraço de baixo: o comprimento no rumo da sombra (px) e a força junto da parede. */
const SOMBRA_DO_DEGRAU = { comprimento: 8.2, forca: 0.5 } as const
/** A sombra no chão: a faixa de contato do sul e do leste (px para fora da base, a borda e a força na base). */
const SOMBRA_NO_CHAO = { leste: 5.6, sul: 5, borda: 5, forca: 0.45 } as const
/** O espelho de imitação (px): de cima e de lado o espelho do pisante não tem largura, então ganha esta. */
const ESPELHO_DE_CIMA = 1.7

interface Medidas {
  readonly hw: number
  readonly hh: number
  /** As meias medidas de cada degrau (px). */
  readonly AX: readonly number[]
  readonly AY: readonly number[]
  /** A altura do alto de cada degrau e a do alto de cada bloco da alfarda (px). */
  readonly Z: readonly number[]
  readonly ZA: readonly number[]
  readonly talude: number
  readonly capa: number
  /** A meia largura dos pisantes e a da escada com as alfardas (px). */
  readonly s: number
  readonly sz: number
}

function medir(c: ContextoDoMovel): Medidas {
  const { hw, hh, g } = c
  const AX = DEGRAUS.map((f) => hw * f)
  const AY = DEGRAUS.map((f) => hh * f)
  const terraco = Math.min(AX[0] - AX[1], AY[0] - AY[1])
  const s = hw * MEIA_ESCADA
  const Z = DEGRAUS.map((_, k) => g * ALTURA_DO_DEGRAU_DA_PIRAMIDE * (k + 1))
  const lances = DEGRAUS.length - 1
  return {
    hw,
    hh,
    AX,
    AY,
    Z,
    ZA: Array.from({ length: lances }, (_, k) => (Z[lances] * (k + 1)) / lances),
    talude: Math.min(g * TALUDE, terraco * FRACAO_DO_TALUDE),
    capa: Math.min(g * CAPA, terraco * FRACAO_DA_CAPA),
    s,
    sz: s + Math.min(g * ALFARDA, hw * 0.05),
  }
}

interface Trabalho {
  readonly c: ContextoDoMovel
  readonly m: Medidas
  readonly v: VistaDoTemplo
  readonly L: Peca[]
  readonly pedra: MaterialDaPeca
  readonly escura: boolean
  readonly alagada: boolean
}

/** Os quatro lados do objeto: 0 norte, 1 leste, 2 sul (o da escada), 3 oeste. A direção para FORA em cada um. */
const PARA_FORA: readonly Ponto[] = [[0, -1], [1, 0], [0, 1], [-1, 0]]

/** O tom do degrau `k` nesta pedra. */
function tomDo(t: Trabalho, k: number): number {
  return TOM_DO_DEGRAU[k] + (t.escura && k === DEGRAUS.length - 1 ? TOM_A_MAIS_NO_ALTO_ESCURO : 0)
}

// ---------- as texturas ----------

/**
 * Quanto o ponto (do objeto) do terraço do degrau `k` está na sombra do degrau de cima (0 à força inteira): escura
 * colada à parede do sul e do leste NA TELA, sumindo em degradê no rumo da sombra.
 */
function sombraDoDegrauDeCima(t: Trabalho, k: number): (x: number, y: number) => number {
  const { m, v } = t
  const [bx, by] = [m.AX[k + 1], m.AY[k + 1]]
  const [ux, uy] = doObjetoDoTemplo(SOMBRA_NA_TELA[0], SOMBRA_NA_TELA[1], v.q)
  const { comprimento, forca } = SOMBRA_DO_DEGRAU
  return (x, y) => {
    const ex = (ux > 0 ? x - bx : -x - bx) / Math.abs(ux)
    const ey = (uy > 0 ? y - by : -y - by) / Math.abs(uy)
    const anda = ex > ey ? ex : ey
    if (anda <= 0 || anda >= comprimento) return 0
    // De onde a sombra vem tem de ser a planta do degrau de cima.
    if (Math.abs(x - ux * anda) > bx + 0.6 || Math.abs(y - uy * anda) > by + 0.6) return 0
    const f = 1 - anda / comprimento
    return forca * f * (0.45 + 0.55 * f)
  }
}

/** O peso do musgo no pé da parede de cada lado do objeto: o do norte NA TELA é o que mais junta água. */
function pesoDoMusgoPorLado(v: VistaDoTemplo): readonly number[] {
  return PARA_FORA.map(([nx, ny]) => {
    const [, sy] = naTelaDoTemplo(nx, ny, v.q)
    return sy < -0.5 ? 1 : sy > 0.5 ? 0.3 : 0.42
  })
}

/**
 * As LAJES do terraço do degrau `k`: uma fiada ao comprido de cada lado, emendada em meia-esquadria nos cantos, cada
 * laje no seu tom, a junta escura, a sombra do degrau de cima e o musgo onde a água para (nas juntas em trechos, no
 * pé da parede do norte e nos cantos de dentro).
 */
function texDoTerraco(t: Trabalho, k: number): Textura {
  const { m, v } = t
  const laje = t.c.g * LAJE
  const [bx, by] = [m.AX[k + 1], m.AY[k + 1]]
  const menor = Math.min(m.hw, m.hh)
  const naSombra = sombraDoDegrauDeCima(t, k)
  const peso = pesoDoMusgoPorLado(v)
  const z = m.Z[k]
  return (_u, _v, sx, sy, p, s, escala) => {
    paraOObjeto(v, z, sx, sy)
    const [x, y] = [NO_OBJETO[0], NO_OBJETO[1]]
    DA_PEDRA(0, 0, x, y, p, s, escala)
    s[3] -= naSombra(x, y)
    const [ax, ay] = [Math.abs(x), Math.abs(y)]
    const emX = ax / m.hw > ay / m.hh
    const lado = emX ? (x < 0 ? 3 : 1) : y < 0 ? 0 : 2
    const tt = (emX ? y : x) / laje + 0.37 * lado + 0.21 * k
    const i = Math.floor(tt)
    const f = (tt - i) * laje
    const junta = Math.min(f, laje - f, Math.abs(ax / m.hw - ay / m.hh) * menor)
    s[3] += (hash(i, lado + 4 * k, 913) - 0.5) * 0.1
    if (junta < 0.9) s[3] -= 0.24 * (1 - junta / 0.9)
    // O pé da parede de cima e o canto de dentro (a distância até a planta do degrau seguinte).
    const pe = Math.max(ax - bx, ay - by)
    let musgo = musgoDaJunta(x, y, junta, 2.5, k * 5 + 2)
    if (pe < 5.5) {
      // Em trechos (pouco mais da metade do pé) e com a beira roída: não é uma faixa contínua.
      const trecho = limitar01((ruido(x / 8 + 11 + k, y / 8 + 3) + 0.1) * 3.4)
      const roido = 0.8 + 0.6 * ruido(x / 1.4 + 5, y / 1.4 + k)
      const canto = Math.min(ax - bx, ay - by) > -5 ? 0.9 : 0
      const noPe = (1 - Math.max(0, pe) / 5.5) * Math.max(peso[lado] * trecho, canto) * roido * 1.2
      if (noPe > musgo) musgo = noPe
    }
    pintarMusgo(s, musgo)
  }
}

/**
 * A FACE do degrau `k` (o talude de cima, o espelho na 3/4), de normal (nx, ny) NA TELA e meia medida `R` nesse eixo:
 * as fiadas de blocos ao comprido com as juntas de pé desencontradas, o pé mais escuro, o fio claro no alto e o musgo
 * só no pé da face do norte.
 */
function texDaFace(t: Trabalho, k: number, nx: number, ny: number, R: number): Textura {
  const { m, v } = t
  const zl = k === 0 ? 0 : m.Z[k - 1]
  const sobe = v.sobe * (m.Z[k] - zl)
  const tl = m.talude
  const doNorte = ny < -0.5
  // O tamanho da face na tela, do pé ao alto, e as fiadas que cabem nela.
  const alto = ny > 0.5 ? tl + sobe : tl
  const fiadas = alto > 15 ? 3 : 2
  return (_u, _v, x, y, p, s, escala) => {
    let f: number
    let ao: number
    if (ny > 0.5) {
      f = (R - v.sobe * zl - y) / (tl + sobe)
      ao = x
    } else if (doNorte) {
      f = (y + R + v.sobe * zl) / tl
      ao = x
    } else {
      f = nx < 0 ? (x + R) / tl : (R - x) / tl
      ao = y + v.sobe * zl + f * sobe
    }
    DA_PEDRA(0, 0, ao, f * alto + k * 31, p, s, escala)
    const fi = f * fiadas
    const fiada = Math.floor(fi)
    // A junta deitada entre duas fiadas (o pé e o alto da face não têm junta).
    const perto = Math.round(fi)
    const deitada = Math.abs(fi - perto) * (alto / fiadas)
    if (deitada < 0.55 && perto > 0 && perto < fiadas) s[3] -= 0.17 * (1 - deitada / 0.55)
    if (escala >= ESCALA_DO_GRAO || alto > 15) {
      const tt = ao / BLOCO_DA_FACE + fiada * 0.47 + k * 0.3
      const junta = Math.abs(tt - Math.round(tt)) * BLOCO_DA_FACE
      if (junta < 0.5) s[3] -= 0.15 * (1 - junta / 0.5)
      s[3] += (hash(Math.round(tt), fiada + 3 * k + (ny === 0 ? 8 : 0), 921) - 0.5) * 0.08
    }
    // O pé encosta no terraço de baixo (mais escuro); a quina do alto pega um fio de luz.
    s[3] -= 0.1 * limitar01(1 - (f * alto) / 3)
    if ((1 - f) * alto < 1.1) s[3] += 0.07
    if (doNorte) pintarMusgo(s, musgoDaJunta(ao, k * 9, f * alto, 3.6, k * 3 + 11))
  }
}

/** A CAPA no alto da face: blocos curtos, a junta fina de través. */
function texDaCapa(k: number, aoComprido: 'x' | 'y'): Textura {
  return (_u, _v, x, y, p, s, escala) => {
    DA_PEDRA(0, 0, x, y, p, s, escala)
    const tt = (aoComprido === 'x' ? x : y) / 11 + k * 0.4
    const junta = Math.abs(tt - Math.round(tt)) * 11
    if (junta < 0.5) s[3] -= 0.18 * (1 - junta / 0.5)
    s[3] += (hash(Math.round(tt), k + (aoComprido === 'x' ? 0 : 5), 923) - 0.5) * 0.06
  }
}

/** O que o pisante precisa saber da vala para se pintar. */
interface DaPisada {
  /** O pisante inteiro NA TELA (antes de ser cortado pela beira da vala). */
  readonly inteiro: Caixa
  /** Para onde a escada desce NA TELA: 0 sul, 1 oeste, 2 norte, 3 leste. */
  readonly desce: number
  /** Pinta o espelho de imitação na borda de trás (de cima e de lado, onde ele não tem largura). */
  readonly espelho: boolean
  /** A altura (px) do que há a oeste e ao norte do pisante NA TELA: faz sombra nele. */
  readonly aOeste: number
  readonly aoNorte: number
  readonly desloca: number
  readonly bloco: number
}

/**
 * O PISANTE: a mesma pedra das plataformas em blocos de juntas desencontradas, o gasto no meio, o fio claro de 1 px
 * na borda da frente, o espelho escuro (ou claro, virado para a luz) na de trás e a sombra das paredes da vala.
 */
function texDaPisada(o: DaPisada): Textura {
  const [x0, y0, x1, y1] = o.inteiro
  const aoLongoDeX = o.desce % 2 === 0
  const centro = aoLongoDeX ? (x0 + x1) / 2 : (y0 + y1) / 2
  const meia = (aoLongoDeX ? x1 - x0 : y1 - y0) / 2
  const fundo = aoLongoDeX ? y1 - y0 : x1 - x0
  // O espelho olha para onde a escada desce: o do sul e o do leste na sombra, o do norte e o do oeste na luz.
  const luzDoEspelho = o.desce === 0 ? -0.34 : o.desce === 3 ? -0.36 : 0.13
  return (_u, _v, x, y, p, s, escala) => {
    DA_PEDRA(0, 0, x, y, p, s, escala)
    const daFrente = o.desce === 0 ? y1 - y : o.desce === 2 ? y - y0 : o.desce === 1 ? x - x0 : x1 - x
    const deTras = fundo - daFrente
    const ao = aoLongoDeX ? x : y
    const tt = (ao - centro) / o.bloco + o.desloca
    const junta = Math.abs(tt - Math.round(tt)) * o.bloco
    if (junta < 0.55) s[3] -= 0.2 * (1 - junta / 0.55)
    s[3] += (hash(Math.round(tt), Math.round(o.desloca * 100), 941) - 0.5) * 0.07
    const q = (ao - centro) / (meia * 0.6)
    s[3] += 0.045 * Math.exp(-q * q)
    if (daFrente < 1.1) s[3] += 0.18
    if (o.espelho) {
      if (deTras < ESPELHO_DE_CIMA) s[3] += luzDoEspelho
      else if (luzDoEspelho < 0 && deTras < ESPELHO_DE_CIMA + 2) s[3] -= 0.14 * (1 - (deTras - ESPELHO_DE_CIMA) / 2)
      else if (luzDoEspelho > 0 && deTras < ESPELHO_DE_CIMA + 0.7) s[3] -= 0.16
    }
    if (o.aOeste > 0) {
      const largo = 1.2 + 0.42 * o.aOeste
      const d = x - x0
      if (d < largo) s[3] -= 0.34 * (1 - d / largo)
    }
    if (o.aoNorte > 0) {
      const largo = 1 + 0.36 * o.aoNorte
      const d = y - y0
      if (d < largo) s[3] -= 0.32 * (1 - d / largo)
    }
  }
}

/** Os blocos de uma face de pé (o espelho do pisante, a parede da vala, a frente da alfarda): fiadas de `fiada` px a partir de `base`. */
export function texDaParedeDoTemplo(base: number, fiada: number, desloca: number): Textura {
  return (_u, _v, x, y, p, s, escala) => {
    DA_PEDRA(0, 0, x, y, p, s, escala)
    const fi = (base - y) / fiada
    const linha = Math.floor(fi)
    const naFiada = (fi - linha) * fiada
    if (fiada > 6.5 && Math.min(naFiada, fiada - naFiada) < 0.5) s[3] -= 0.12
    const tt = x / BLOCO_DA_FACE + linha * 0.47 + desloca
    const junta = Math.abs(tt - Math.round(tt)) * BLOCO_DA_FACE
    if (junta < 0.5) s[3] -= 0.15 * (1 - junta / 0.5)
    // O pé da face, no encontro com o piso, mais escuro.
    if (base - y < 1.2) s[3] -= 0.1
  }
}

/** O verde do limo boiando na água parada, o fundo escuro e o fio claro onde ela toca a pedra. */
const LIMO_DA_AGUA: Rgb = [0x5f, 0x7f, 0x55]
const AGUA_FUNDA: Rgb = [0x2c, 0x50, 0x4e]
const AGUA_RASA: Rgb = [0x5e, 0x8e, 0x80]
const FIO_DA_AGUA: Rgb = [0xb6, 0xcc, 0xc0]
/** A água parada do templo (verde de tanque velho): o tom do meio, que a textura puxa para o fundo ou para o raso. */
export const AGUA_PARADA_DO_TEMPLO: MaterialDaPeca = { classe: 'liso', rgb: [0x47, 0x72, 0x69] }

/**
 * A ÁGUA parada do terraço do degrau `k`, com FUNDURA: escura colada à parede de dentro, clareando para fora até o
 * raso da beira, o fio claro de 1 px onde ela toca a pedra (a capa e a parede), o reflexo curto da parede logo depois
 * dele, o limo em manchas e uns riscos de brilho deitados NA TELA. Cada degrau tem o seu tom (o de baixo mais fundo e
 * mais verde).
 */
function texDaAguaParada(t: Trabalho, k: number): Textura {
  const { m, v } = t
  const [bx, by] = [m.AX[k + 1], m.AY[k + 1]]
  const [ix, iy] = [m.AX[k] - m.talude - m.capa, m.AY[k] - m.talude - m.capa]
  const largura = Math.max(4, Math.min(ix - bx, iy - by))
  const naSombra = sombraDoDegrauDeCima(t, k)
  const z = m.Z[k]
  const semente = k * 9 + 1
  // O degrau de baixo é o mais fundo; o de cima, o mais raso e mais claro.
  const fundura = 1 - 0.3 * k
  return (_u, _v, sx, sy, _p, s) => {
    paraOObjeto(v, z, sx, sy)
    const [x, y] = [NO_OBJETO[0], NO_OBJETO[1]]
    const [ax, ay] = [Math.abs(x), Math.abs(y)]
    const daParede = Math.max(ax - bx, ay - by)
    const daBeira = Math.min(ix - ax, iy - ay)
    // Do fundo (junto da parede) para o raso (junto da capa).
    const raso = limitar01(daParede / largura)
    tingir(s, AGUA_FUNDA, (1 - raso) * (1 - raso) * 0.9 * fundura)
    tingir(s, AGUA_RASA, limitar01(raso * raso * 0.75 + 0.14 * k))
    if (k === 0) tingir(s, LIMO_DA_AGUA, 0.12)
    s[3] -= naSombra(x, y) * 0.8
    s[3] += ruido(x * 0.06 + semente, y * 0.06 + 5) * 0.12 + ruido(x * 0.21 + 9, y * 0.21 + semente) * 0.05
    const limo = ruido(x / 9 + semente * 1.7 + 70, y / 9 + semente) + 0.4 * ruido(x / 2.4 + 31, y / 2.4 + semente)
    if (limo > 0.2) tingir(s, LIMO_DA_AGUA, limitar01((limo - 0.2) * 3.2) * 0.5 * (0.4 + 0.6 * raso))
    // O reflexo curto da parede e da capa, logo depois do fio claro.
    if (daParede > 1.2 && daParede < 4.4) s[3] -= 0.1 * (1 - Math.abs(daParede - 2.8) / 1.6)
    if (daBeira > 1.2 && daBeira < 3.6) s[3] += 0.06 * (1 - Math.abs(daBeira - 2.4) / 1.2)
    // Os riscos de brilho, deitados na tela.
    const risco = ruido(sx * 0.1 + 17 + semente, sy * 0.62 + 3)
    if (risco > 0.32) s[3] += (risco - 0.32) * 0.5
    // O fio claro onde a água toca a pedra.
    const toque = daParede < daBeira ? daParede : daBeira
    if (toque < 1.15) tingir(s, FIO_DA_AGUA, 0.62 * (1 - Math.max(0, toque - 0.3) / 0.85))
  }
}

// ---------- as partes ----------

/** Os cantos (x, y, z) das faces do degrau `k`, por lado do objeto (a do sul em duas metades, em volta da escada). */
function facesDoDegrau(m: Medidas, k: number): readonly { readonly lado: number; readonly pontos: readonly Ponto3[] }[] {
  const [ax, ay, tl, sz] = [m.AX[k], m.AY[k], m.talude, m.sz]
  const [zl, zt] = [k === 0 ? 0 : m.Z[k - 1], m.Z[k]]
  return [
    { lado: 0, pontos: [[-ax, -ay, zl], [ax, -ay, zl], [ax - tl, -ay + tl, zt], [-ax + tl, -ay + tl, zt]] },
    { lado: 1, pontos: [[ax, -ay, zl], [ax, ay, zl], [ax - tl, ay - tl, zt], [ax - tl, -ay + tl, zt]] },
    { lado: 3, pontos: [[-ax, -ay, zl], [-ax + tl, -ay + tl, zt], [-ax + tl, ay - tl, zt], [-ax, ay, zl]] },
    { lado: 2, pontos: [[-ax, ay, zl], [-ax + tl, ay - tl, zt], [-sz, ay - tl, zt], [-sz, ay, zl]] },
    { lado: 2, pontos: [[sz, ay, zl], [sz, ay - tl, zt], [ax - tl, ay - tl, zt], [ax, ay, zl]] },
  ]
}

/** As FACES do degrau `k`, cada uma com a luz do lado para onde olha NA TELA. Na 3/4 a do norte fica atrás do degrau. */
function faces(t: Trabalho, k: number): void {
  const { m, v, L, pedra } = t
  const P = t.c.peca
  const tom = tomDo(t, k)
  const girada = v.q % 2 === 1
  facesDoDegrau(m, k).forEach((face, i) => {
    const [nx, ny] = naTelaDoTemplo(PARA_FORA[face.lado][0], PARA_FORA[face.lado][1], v.q)
    if (v.sobe > 0 && ny < -0.5) return
    // A meia medida do degrau no eixo da tela em que a face está.
    const R = (nx !== 0) !== girada ? m.AX[k] : m.AY[k]
    L.push(P(polNaTela(v, face.pontos), pedra, { bisel: 0, contorno: 0.13, tom, luz: luzDaFaceNaTela(nx, ny), textura: texDaFace(t, k, nx, ny, R), semente: 5100 + k * 10 + i }))
  })
}

/** O degrau `k` (0 a 2): o terraço de lajes (ou a água), as faces e a capa no alto delas. */
function degrau(t: Trabalho, k: number): void {
  const { m, v, L, pedra, alagada } = t
  const P = t.c.peca
  const [ax, ay, tl, cp, sz] = [m.AX[k], m.AY[k], m.talude, m.capa, m.sz]
  const z = m.Z[k]
  const tom = tomDo(t, k)
  const [ix, iy] = [ax - tl, ay - tl]
  // O piso inteiro do degrau (o de cima tapa o miolo): entra um nada debaixo das faces, sem fio de chão na emenda.
  L.push(P(retNaTela(v, -ix - 0.7, -iy - 0.7, ix + 0.7, iy + 0.7, z), pedra, { bisel: 0, contorno: 0, tom: tom * 0.96, textura: texDoTerraco(t, k), semente: 5010 + k * 10 }))
  if (alagada) L.push(P(retNaTela(v, -ix + cp - 0.4, -iy + cp - 0.4, ix - cp + 0.4, iy - cp + 0.4, z), AGUA_PARADA_DO_TEMPLO, { bisel: 0, contorno: 0, textura: texDaAguaParada(t, k), semente: 5020 + k * 10 }))
  faces(t, k)
  // A CAPA: uma tira por lado, com a luz do lado (a do norte e a do oeste um nada claras) e a sombra curta para dentro.
  const tiras: readonly (readonly [number, number, number, number, number])[] = [
    [0, -ix, -iy, ix, -iy + cp],
    [3, -ix, -iy, -ix + cp, iy],
    [1, ix - cp, -iy, ix, iy],
    [2, -ix, iy - cp, -sz, iy],
    [2, sz, iy - cp, ix, iy],
  ]
  tiras.forEach(([lado, x0, y0, x1, y1], i) => {
    const [nx, ny] = naTelaDoTemplo(PARA_FORA[lado][0], PARA_FORA[lado][1], v.q)
    L.push(P(retNaTela(v, x0, y0, x1, y1, z, 0.6), pedra, { bisel: 0.6, tom: tom * 1.05, contorno: 0.2, luz: luzDaFaceNaTela(nx, ny) * 0.45, textura: texDaCapa(k, nx === 0 ? 'x' : 'y'), semente: 5150 + k * 10 + i, projeta: { dist: 1.5, forca: 0.3 } }))
  })
}

/** O PATAMAR do alto: as lajes, as faces, a moldura gravada e a pedra do sol no meio. */
function patamar(t: Trabalho): void {
  const { m, v, L, pedra } = t
  const P = t.c.peca
  const k = DEGRAUS.length - 1
  const [ax, ay, tl] = [m.AX[k], m.AY[k], m.talude]
  const z = m.Z[k]
  const tom = tomDo(t, k)
  const [ix, iy] = [ax - tl, ay - tl]
  L.push(P(retNaTela(v, -ix - 0.7, -iy - 0.7, ix + 0.7, iy + 0.7, z), pedra, { bisel: 0, contorno: 0, tom: tom * 0.97, textura: texDasLajesDoTemplo(t.c.g * LAJE_DO_PATAMAR, v, z), semente: 5200 }))
  faces(t, k)
  // A soleira: o piso do alto da escada, entre o último pisante e as lajes.
  L.push(P(retNaTela(v, -m.sz, iy - 0.8, m.sz, ay, z), pedra, { bisel: 0, contorno: 0.12, tom: tom * 0.94, textura: DA_PEDRA, semente: 5205 }))
  // A moldura gravada: um sulco fino por dentro da beira.
  const [mx, my] = [ix - 3.4, iy - 3.4]
  if (mx > 8 && my > 8) {
    const fora = caixaNaTela(v, -mx, -my, mx, my, z)
    L.push(P(menos(caixa(fora[0], fora[1], fora[2], fora[3], 1.2), caixa(fora[0] + 1.3, fora[1] + 1.3, fora[2] - 1.3, fora[3] - 1.3, 0.8)), pedra, { bisel: 0, contorno: 0, tom: tom * 0.6, alfa: 0.75, semente: 5210 }))
  }
  const r = Math.min(ax, ay) * 0.36
  if (r < 6) return
  const [cx, cy] = pontoNaTela(v, 0, 0, z)
  pedraDoSol(L, P, pedra, cx, cy, r, tom, 5220)
}

/**
 * A face do lado de fora de uma alfarda (ou do marco), vista de frente quando a escada desce para o lado NA TELA: do
 * alto `zt` até o perfil do degrau `k` ao lado dela (o terraço e, no pé, o talude descendo).
 */
function faceDeLado(t: Trabalho, k: number, a: number, o0: number, o1: number, zt: number): Forma {
  const { m, v } = t
  const zl = k === 0 ? 0 : m.Z[k - 1]
  const quebra = Math.max(o0, Math.min(o1, m.AY[k] - m.talude))
  const noPe = zl + ((m.Z[k] - zl) * (m.AY[k] - o1)) / m.talude
  return polNaTela(v, [[a, o0, zt], [a, o1, zt], [a, o1, Math.min(m.Z[k], Math.max(zl, noPe))], [a, quebra, m.Z[k]], [a, o0, m.Z[k]]])
}

/**
 * O LANCE `k` da escadaria (do pé do degrau `k` ao pé do seguinte): os pisantes numa VALA entre os dois blocos da
 * alfarda, que são sempre mais altos que ela. De frente cada pisante sobe e mostra o espelho; de costas um tapa o
 * outro; de lado o contorno fica reto, a parede do fundo da vala aparece em cima e o pisante só encurta.
 */
function lance(t: Trabalho, k: number): void {
  const { m, v, L, pedra, c } = t
  const P = c.peca
  const desce = v.q
  const [o0, o1] = [m.AY[k + 1], m.AY[k]]
  const [zb, za] = [k === 0 ? 0 : m.ZA[k - 1], m.ZA[k]]
  const n = Math.max(2, Math.round((o1 - o0) / (c.g * PISADA)))
  const passo = (o1 - o0) / n
  const sobe = (za - zb) / n
  const ultimoLance = k === m.ZA.length - 1
  const tomBase = TOM_DO_DEGRAU[k] + (t.escura ? 0.12 : 0.04)
  const bloco = (2 * m.s) / 2.5
  // A beira da vala NA TELA, na altura do alto da alfarda: o pisante não passa dela.
  const beira = caixaNaTela(v, -m.s, o0, m.s, o1, za)

  for (let j = 0; j < n; j += 1) {
    const z = zb + (j + 1) * sobe
    const [oa, ob] = [o1 - (j + 1) * passo, o1 - j * passo]
    const inteiro = caixaNaTela(v, -m.s, oa, m.s, ob, z)
    const fundo = za - z
    const topo = ultimoLance && j === n - 1
    const tom = tomBase + (0.07 * (j + 1)) / n + 0.03 * acasoDoTemplo(k * 20 + j, 3)
    const desloca = acasoDoTemplo(k * 20 + j, 5)
    const daPisada: DaPisada = {
      inteiro,
      desce,
      // Na 3/4 de frente o espelho é uma face de verdade; de costas fica escondido.
      espelho: !topo && (v.sobe === 0 || desce % 2 === 1),
      aOeste: desce === 0 || desce === 2 ? fundo : desce === 3 && !topo ? sobe : 0,
      aoNorte: desce % 2 === 1 ? fundo : desce === 0 && !topo ? sobe : 0,
      desloca,
      bloco,
    }
    // De lado, na 3/4: a parede do fundo da vala em cima do pisante, e o pisante cortado na beira de baixo.
    let forma = caixa(inteiro[0], inteiro[1], inteiro[2], inteiro[3])
    if (v.sobe > 0 && desce % 2 === 1) {
      if (fundo > 0.3) L.push(P(caixa(inteiro[0], beira[1], inteiro[2], inteiro[1] + 0.4), pedra, { bisel: 0, contorno: 0, tom: TOM_DA_ALFARDA * tomBase, luz: LUZ_DA_FRENTE_DO_TEMPLO, textura: texDaParedeDoTemplo(beira[1] + za, 8, k * 0.3), semente: 5330 + k * 20 + j }))
      forma = caixa(inteiro[0], inteiro[1], inteiro[2], beira[3])
    }
    L.push(P(forma, pedra, { bisel: 0, contorno: 0.1, tom, textura: texDaPisada(daPisada), semente: 5300 + k * 20 + j }))
    // De frente, na 3/4: o espelho de verdade, da borda da frente deste pisante até o de baixo.
    if (v.sobe > 0 && desce === 0) L.push(P(caixa(inteiro[0], inteiro[3] - 0.3, inteiro[2], inteiro[3] + sobe), pedra, { bisel: 0, contorno: 0, tom, luz: LUZ_DA_FRENTE_DO_TEMPLO - 0.06, textura: texDaParedeDoTemplo(inteiro[3] + sobe, 99, desloca), semente: 5360 + k * 20 + j }))
  }

  // As ALFARDAS: um bloco de cada lado, mais escuro que o degrau, com a sombra dele no terraço.
  const tomDaAlfarda = TOM_DO_DEGRAU[k] * TOM_DA_ALFARDA + (t.escura ? 0.04 : 0)
  for (const lado of [-1, 1]) {
    const [a0, a1] = lado < 0 ? [-m.sz, -m.s] : [m.s, m.sz]
    const alto = caixaNaTela(v, a0, o0, a1, o1, za)
    const aoComprido = desce % 2 === 0 ? 'y' : 'x'
    L.push(P(caixa(alto[0], alto[1], alto[2], alto[3], 0.5), pedra, { bisel: 0.8, contorno: 0.22, tom: tomDaAlfarda, textura: texDaCapa(k + 5, aoComprido), semente: 5400 + k * 4 + lado, projeta: { dist: 1.2 + 0.24 * (za - m.Z[k]), forca: 0.34 } }))
    if (!(v.sobe > 0)) continue
    if (desce === 0) {
      // De frente: a face do bloco, do alto dele até o alto do bloco de baixo.
      L.push(P(caixa(alto[0], alto[3] - 0.3, alto[2], alto[3] + (za - zb)), pedra, { bisel: 0, contorno: 0.16, tom: tomDaAlfarda, luz: LUZ_DA_FRENTE_DO_TEMPLO, textura: texDaParedeDoTemplo(alto[3] + (za - zb), 8, k * 0.4 + lado), semente: 5420 + k * 4 + lado }))
    } else if (desce % 2 === 1) {
      // De lado: só a alfarda de baixo NA TELA mostra a face de fora, até o perfil do degrau.
      const deBaixo = desce === 1 ? lado > 0 : lado < 0
      if (deBaixo) L.push(P(faceDeLado(t, k, lado > 0 ? a1 : a0, o0, o1, za), pedra, { bisel: 0, contorno: 0.16, tom: tomDaAlfarda, luz: LUZ_DA_FRENTE_DO_TEMPLO, textura: texDaParedeDoTemplo(alto[3] + (za - m.Z[k]), 8, k * 0.4), semente: 5440 + k * 4 + lado }))
    }
  }
}

// ---------- o que o tempo e a mata deixaram ----------

/**
 * Um ponto no terraço do degrau `k`: o lado, ao comprido (-1 a 1) e de través (0 na capa, 1 no pé do degrau de
 * cima; negativo sai para a face). `folga` = o quanto ele fica longe das pontas e da escada (px).
 */
function noTerraco(m: Medidas, k: number, lado: number, ao: number, traves: number, folga = 0): Ponto {
  const naVertical = lado % 2 === 1
  const fora = (naVertical ? m.AX[k] : m.AY[k]) - m.talude - m.capa
  const dentro = naVertical ? m.AX[k + 1] : m.AY[k + 1]
  const d = fora + (dentro - fora) * traves
  const meio = Math.max(0, (naVertical ? m.AY[k] : m.AX[k]) - m.talude - folga)
  let a = Math.max(-meio, Math.min(meio, ao * meio))
  // No lado do sul a escada fica no meio: o ponto vai para fora dela.
  if (lado === 2 && Math.abs(a) < m.sz + folga + 2) a = (a < 0 ? -1 : 1) * (m.sz + folga + 2)
  return lado === 0 ? [a, -d] : lado === 2 ? [a, d] : lado === 1 ? [d, a] : [-d, a]
}

/** O mesmo ponto NA TELA, em cima do terraço. */
function naTelaDoTerraco(t: Trabalho, k: number, lado: number, ao: number, traves: number, folga = 0): Ponto {
  const [x, y] = noTerraco(t.m, k, lado, ao, traves, folga)
  return pontoNaTela(t.v, x, y, t.m.Z[k])
}

/** O lado do objeto fica escondido atrás do degrau na 3/4 (o do norte NA TELA)? */
function escondido(t: Trabalho, lado: number): boolean {
  return t.v.sobe > 0 && naTelaDoTemplo(PARA_FORA[lado][0], PARA_FORA[lado][1], t.v.q)[1] < -0.5
}

/**
 * Um CIPÓ que nasce na capa do degrau `k` e cai pela face até o terraço de baixo: o rumo dele NA TELA é o da face
 * (de cima, para fora; na 3/4, descendo o espelho).
 */
function cipoNaFace(t: Trabalho, k: number, lado: number, ao: number, quanto: number, semente: number): void {
  if (escondido(t, lado)) return
  const { m, v } = t
  const [x, y] = noTerraco(m, k, lado, ao, 0, 10)
  const [fx, fy] = PARA_FORA[lado]
  const zl = k === 0 ? 0 : m.Z[k - 1]
  const cai = m.talude + m.capa * 0.5
  const [x0, y0] = pontoNaTela(v, x, y, m.Z[k])
  const [x1, y1] = pontoNaTela(v, x + fx * cai, y + fy * cai, zl)
  const [dx, dy] = [x1 - x0, y1 - y0]
  // O do degrau de baixo acaba antes do chão: não se arrasta para fora da pegada.
  cipo(t.L, t.c.peca, x0, y0, dx, dy, Math.hypot(dx, dy) * (k === 0 ? Math.min(quanto, 0.92) : quanto), semente)
}

/** Uma SAMAMBAIA agarrada na capa do degrau `k`, debruçada para fora (as frondes caem pelo espelho). */
function samambaiaNaBorda(t: Trabalho, k: number, lado: number, ao: number, r: number, semente: number): void {
  if (escondido(t, lado)) return
  const [x, y] = naTelaDoTerraco(t, k, lado, ao, -0.04, r)
  const [nx, ny] = naTelaDoTemplo(PARA_FORA[lado][0], PARA_FORA[lado][1], t.v.q)
  // Na 3/4 a face do sul cresce: a que cai por ela fica mais comprida.
  const cresce = t.v.sobe > 0 && ny > 0.5 ? 1.5 : 1
  samambaia(t.L, t.c.peca, x, y, r * cresce, semente, 5, Math.atan2(ny, nx), 1.9)
}

const FOLHA_SECA: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x80, 0x52] }
const TRINCA: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x47, 0x3e] }

type Posto = readonly [k: number, lado: number, ao: number, traves: number, tamanho: number]

/** As trincas, os blocos caídos e as plantas da SECA: [degrau, lado, ao comprido, de través, tamanho]. */
const TRINCAS: readonly Posto[] = [[0, 0, -0.5, 0.3, 1], [0, 3, 0.3, 0.4, -1], [1, 1, -0.4, 0.5, 1], [2, 0, 0.3, 0.5, 1], [0, 1, 0.1, 0.5, -1]]
const BLOCOS_CAIDOS: readonly Posto[] = [[0, 1, 0.42, 0.45, 0.5], [0, 1, 0.52, 0.74, 1.9], [1, 3, -0.6, 0.5, 1.1]]
/** Os tufos de musgo: nos cantos de dentro e no pé da parede do norte, de tamanhos desiguais. */
const TUFOS: readonly Posto[] = [[0, 0, -0.78, 0.9, 5.4], [0, 0, 0.2, 0.94, 3.6], [0, 0, 0.8, 0.9, 4.6], [0, 3, -0.74, 0.92, 3.4], [0, 1, 0.7, 0.9, 3.2], [1, 0, -0.7, 0.9, 4.4], [1, 0, 0.5, 0.94, 3.2], [1, 3, 0.66, 0.9, 3], [2, 0, 0.62, 0.9, 3.8], [2, 0, -0.3, 0.94, 2.8], [0, 2, -0.84, 0.92, 3.2], [1, 2, 0.86, 0.92, 2.8]]
/** O tamanho dos tufos da seca (vezes o da lista): com eles o verde fica perto de um décimo da pedra. */
const TUFO_DA_SECA = 1.35
const PLANTAS_DA_SECA: readonly Posto[] = [[0, 0, -0.9, 0.5, 7], [0, 2, 0.8, 0.5, 6.4]]
const MOITAS_DA_SECA: readonly Posto[] = [[0, 3, 0.86, 0.4, 6.4], [1, 0, -0.9, 0.4, 5.2]]
const CAPINS_DA_SECA: readonly Posto[] = [[0, 3, 0.7, 0.8, 5], [1, 1, 0.8, 0.8, 4.4], [0, 2, -0.6, 0.85, 4.6]]
/** [degrau, lado, ao comprido, quanto da face desce]. */
const CIPOS_DA_SECA: readonly (readonly [number, number, number, number])[] = [[1, 0, 0.3, 1.5], [1, 3, -0.3, 1.3], [2, 1, 0.2, 1.4], [1, 2, -0.7, 1.2], [2, 2, 0.74, 1.1]]
const SAMAMBAIAS_DA_SECA: readonly (readonly [number, number, number, number])[] = [[1, 1, 0.7, 5.4], [2, 3, -0.2, 4.6], [1, 2, 0.62, 5]]

/** O que o tempo deixou no degrau `k` da pirâmide SECA: as trincas, os tufos, os blocos caídos, as folhas secas e poucas plantas. */
function tempoDaSeca(t: Trabalho, k: number): void {
  const { L, pedra } = t
  const P = t.c.peca
  TRINCAS.forEach(([kk, lado, ao, tr, rumo], i) => {
    if (kk !== k) return
    const [x, y] = naTelaDoTerraco(t, k, lado, ao, tr, 12)
    const pontos: Ponto[] = [0, 1, 2, 3, 4].map((j) => [x + (j - 2) * 3.4 + (acasoDoTemplo(i * 9 + j, 5) - 0.5) * 2.6, y + (j - 2) * 1.5 * rumo + (acasoDoTemplo(i * 9 + j, 6) - 0.5) * 3])
    L.push(P(cadeia(pontos, 0.42), TRINCA, { bisel: 0, contorno: 0, alfa: 0.5, semente: 5500 + i }))
  })
  TUFOS.forEach(([kk, lado, ao, tr, r], i) => {
    if (kk === k) tufoDeMusgo(L, P, ...naTelaDoTerraco(t, k, lado, ao, tr, 6), r * TUFO_DA_SECA, 20 + i)
  })
  BLOCOS_CAIDOS.forEach(([kk, lado, ao, tr, giro], i) => {
    if (kk !== k) return
    const [x, y] = naTelaDoTerraco(t, k, lado, ao, tr, 8)
    const [cs, sn] = [Math.cos(giro), Math.sin(giro)]
    const canto = (px: number, py: number): Ponto => [x + px * cs - py * sn, y + px * sn + py * cs]
    const [bw, bh] = [3.6 + 1.4 * acasoDoTemplo(i, 9), 2.4 + acasoDoTemplo(i, 10)]
    L.push(P(poligono([canto(-bw, -bh), canto(bw, -bh), canto(bw, bh), canto(-bw, bh)]), pedra, { bisel: 1.3, tom: 1.02, contorno: 0.28, textura: DA_PEDRA, semente: 5540 + i, projeta: { dist: 1.8, forca: 0.36 } }))
  })
  // As folhas secas, sopradas contra o pé das faces.
  for (let i = k; i < 18; i += 3) {
    const [x, y] = naTelaDoTerraco(t, k, Math.floor(acasoDoTemplo(i, 11) * 4), acasoDoTemplo(i, 12) * 1.8 - 0.9, 0.5 + 0.44 * acasoDoTemplo(i, 13), 5)
    L.push(P(elipseGirada(x, y, 1.8, 0.9, acasoDoTemplo(i, 14) * Math.PI), FOLHA_SECA, { bisel: 0.5, contorno: 0.2, alfa: 0.82, tom: 0.86 + 0.3 * acasoDoTemplo(i, 15), semente: 5560 + i }))
  }
  PLANTAS_DA_SECA.forEach(([kk, lado, ao, tr, r], i) => {
    if (kk === k) roseta(L, P, ...naTelaDoTerraco(t, k, lado, ao, tr, r), r, 100 + i)
  })
  MOITAS_DA_SECA.forEach(([kk, lado, ao, tr, r], i) => {
    if (kk === k) moita(L, P, ...naTelaDoTerraco(t, k, lado, ao, tr, r), r, 110 + i)
  })
  CAPINS_DA_SECA.forEach(([kk, lado, ao, tr, r], i) => {
    if (kk === k) capim(L, P, ...naTelaDoTerraco(t, k, lado, ao, tr, r), r, 116 + i)
  })
  CIPOS_DA_SECA.forEach(([kk, lado, ao, quanto], i) => {
    if (kk === k) cipoNaFace(t, k, lado, ao, quanto, 120 + i)
  })
  SAMAMBAIAS_DA_SECA.forEach(([kk, lado, ao, r], i) => {
    if (kk === k) samambaiaNaBorda(t, k, lado, ao, r, 130 + i)
  })
}

/**
 * A mata da ALAGADA, em TRECHOS (sobra borda vazia para respirar). [degrau, lado, ao comprido, tamanho].
 * As moitas vão em grupos de uma a três; a outra metade do verde é samambaia, capim e cipó caindo pela face.
 */
const MOITAS_DA_ALAGADA: readonly (readonly [number, number, number, number])[] = [
  [0, 0, -0.9, 3], [0, 0, 0.34, 2], [0, 3, 0.56, 2], [0, 1, -0.12, 2], [0, 2, -0.86, 2],
  [1, 0, -0.5, 2], [1, 1, 0.76, 2], [1, 3, -0.24, 1], [2, 0, 0.44, 2], [2, 3, 0.7, 1],
]
const SAMAMBAIAS_DA_ALAGADA: readonly (readonly [number, number, number, number])[] = [
  [0, 0, -0.42, 8], [0, 1, 0.52, 7.6], [0, 3, -0.6, 7.8], [0, 2, 0.72, 7.2], [1, 0, 0.72, 7], [1, 2, -0.8, 6.4], [1, 3, 0.5, 6.6], [2, 1, -0.4, 5.8], [2, 0, -0.76, 6], [2, 2, -0.7, 5.6],
]
const CAPINS_DA_ALAGADA: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0.78, 6.8], [0, 3, 0.04, 6.4], [0, 1, -0.76, 6.2], [1, 0, 0.1, 6], [1, 1, 0.1, 5.8], [2, 3, -0.3, 5.2], [2, 2, 0.86, 5], [0, 2, -0.46, 6.2],
]
const CIPOS_DA_ALAGADA: readonly (readonly [number, number, number, number])[] = [
  [0, 0, -0.14, 1.5], [0, 3, -0.9, 1.3], [0, 1, 0.86, 1.4], [0, 2, -0.62, 1.2], [1, 0, -0.86, 1.5], [1, 3, 0.16, 1.4], [1, 1, -0.6, 1.3], [1, 2, 0.72, 1.2], [2, 0, 0.06, 1.5], [2, 3, 0.36, 1.3], [2, 1, 0.56, 1.3],
]
const ROSETAS_DA_ALAGADA: readonly Posto[] = [[0, 0, -0.66, 0.6, 7.4], [0, 2, 0.88, 0.5, 6.8], [1, 3, -0.74, 0.5, 6], [1, 1, 0.42, 0.6, 5.4], [2, 0, -0.3, 0.5, 5.2]]
/** Os grupos de folhas redondas boiando: [degrau, lado, ao comprido, quantas]. */
const FOLHAS_NA_AGUA: readonly (readonly [number, number, number, number])[] = [[0, 0, 0.56, 3], [0, 3, -0.2, 2], [0, 1, 0.3, 3], [0, 2, -0.3, 2], [1, 0, -0.16, 2], [1, 1, -0.3, 3], [1, 3, 0.74, 2], [2, 0, 0.74, 2], [2, 1, 0.3, 1]]

/** A vida do degrau `k` da pirâmide ALAGADA: as folhas redondas em grupos, os cipós, as samambaias, o capim, as moitas e as rosetas. */
function vidaDaAlagada(t: Trabalho, k: number): void {
  const { m, L } = t
  const P = t.c.peca
  // As folhas redondas boiando, em grupos de tamanhos desiguais, com o corte em cunha e a sombra curta na água.
  FOLHAS_NA_AGUA.forEach(([kk, lado, ao, quantas], i) => {
    if (kk !== k) return
    const [gx, gy] = naTelaDoTerraco(t, k, lado, ao, 0.5, 10)
    for (let j = 0; j < quantas; j += 1) {
      const sal = i * 5 + j
      const r = 2.2 + 2.6 * acasoDoTemplo(sal, 24)
      const [x, y] = [gx + (acasoDoTemplo(sal, 21) - 0.5) * 13, gy + (acasoDoTemplo(sal, 22) - 0.5) * 9]
      const a = acasoDoTemplo(sal, 25) * Math.PI * 2
      const cunha = poligono([[x, y], [x + Math.cos(a - 0.3) * r * 1.4, y + Math.sin(a - 0.3) * r * 1.4], [x + Math.cos(a + 0.3) * r * 1.4, y + Math.sin(a + 0.3) * r * 1.4]])
      L.push(P(menos(elipse(x, y, r, r * 0.94), cunha), acasoDoTemplo(sal, 26) < 0.5 ? FOLHA_DA_SELVA : FOLHA_CLARA_DA_SELVA, { bisel: 0.7, contorno: 0.24, tom: 0.92 + 0.14 * acasoDoTemplo(sal, 27), semente: 5600 + sal, projeta: { dist: 1.1, forca: 0.3 } }))
    }
  })
  CIPOS_DA_ALAGADA.forEach(([kk, lado, ao, quanto], i) => {
    if (kk === k) cipoNaFace(t, k, lado, ao, quanto, 420 + i)
  })
  SAMAMBAIAS_DA_ALAGADA.forEach(([kk, lado, ao, r], i) => {
    if (kk === k) samambaiaNaBorda(t, k, lado, ao, r, 440 + i)
  })
  CAPINS_DA_ALAGADA.forEach(([kk, lado, ao, r], i) => {
    if (kk === k) capim(L, P, ...naTelaDoTerraco(t, k, lado, ao, 0.06, r), r, 460 + i)
  })
  // As moitas na capa: grupos de uma a três, de tamanhos diferentes, encostadas.
  MOITAS_DA_ALAGADA.forEach(([kk, lado, ao, quantas], i) => {
    if (kk !== k) return
    const comprido = (lado % 2 === 1 ? m.AY[k] : m.AX[k]) - m.talude
    let anda = 0
    for (let j = 0; j < quantas; j += 1) {
      const r = 4.2 + 3.2 * acasoDoTemplo(i * 7 + j, 32)
      const [x, y] = naTelaDoTerraco(t, k, lado, ao + (anda / comprido) * (ao > 0.5 ? -1 : 1), -0.06 + 0.2 * acasoDoTemplo(i * 7 + j, 31), r)
      moita(L, P, x, y, r, 200 + i * 7 + j, r > 5.2 ? 5 : 4)
      anda += r * 1.7
    }
  })
  ROSETAS_DA_ALAGADA.forEach(([kk, lado, ao, tr, r], i) => {
    if (kk === k) roseta(L, P, ...naTelaDoTerraco(t, k, lado, ao, tr, r), r, 300 + i)
  })
}

export const montarPiramideEmDegraus: MontarMovel = (c, cena) => {
  if (!(c.hw > 0) || !(c.hh > 0)) return
  const v = vistaDoTemplo(c)
  const m = medir(c)
  const pedra = pedraDoTemplo(c.m.pedra)
  const tela: Cena = { partes: [], sombras: [], corDoPiso: ESCURO_DA_PEDRA_DO_TEMPLO }
  const t: Trabalho = { c, m, v, L: tela.partes, pedra, escura: ehPedraEscura(pedra), alagada: lerVarianteDaPiramideEmDegraus(c.variante) === 'alagada' }

  // A SOMBRA NO CHÃO: a faixa de contato do sul e do leste do degrau de baixo, forte na base e sumindo. A cor é a da
  // sombra do motor a menos de metade: escurece o piso que estiver embaixo (a grama, a pedra), nunca vira preto.
  const base = caixaNaTela(v, -m.hw, -m.hh, m.hw, m.hh)
  const { leste, sul, borda, forca } = SOMBRA_NO_CHAO
  tela.sombras.push({
    forma: poligono([[base[0] + 3, base[1] + 3], [base[2], base[1] + 3], [base[2] + leste, base[1] + 3 + sul], [base[2] + leste, base[3] + sul], [base[0] + 3 + leste, base[3] + sul], [base[0] + 3, base[3]]]),
    z: 0,
    suave: borda,
    forca,
  })

  // O leito escuro debaixo de tudo: o que aparece numa emenda é pedra, e não o chão do mapa.
  t.L.push(c.peca(caixa(base[0] + 0.6, base[1] + 0.6, base[2] - 0.6, base[3] - 0.6), pedra, { bisel: 0, contorno: 0, tom: 0.56, textura: DA_PEDRA, semente: 5000 }))

  // De baixo para cima: cada degrau com o que cresce nele e o lance da escada que o corta; o de cima tapa o de baixo.
  for (let k = 0; k < DEGRAUS.length - 1; k += 1) {
    degrau(t, k)
    if (t.alagada) vidaDaAlagada(t, k)
    else tempoDaSeca(t, k)
    lance(t, k)
  }
  patamar(t)
  entregarNaTela(v, tela, cena)
}

/** As duas formas pelo nome, para a folha de prova (o catálogo registra só `montarPiramideEmDegraus`). */
export const montarPiramideEmDegrausSeca: MontarMovel = (c, cena) => montarPiramideEmDegraus({ ...c, variante: 0 }, cena)
export const montarPiramideEmDegrausAlagada: MontarMovel = (c, cena) => montarPiramideEmDegraus({ ...c, variante: 1 }, cena)
