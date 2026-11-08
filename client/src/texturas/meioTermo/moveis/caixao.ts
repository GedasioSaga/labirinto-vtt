/**
 * CAIXÃO de cima (07/11/2026), fechado e aberto, o desenho do Atual: o
 * hexágono da tampa ao longo do lado maior da pegada (1 x 2 casas), com a
 * cabeça estreita, o ombro largo a um quarto do comprimento e o pé estreito,
 * como a arte do estúdio (`godot/desenhado/exportado/movel-caixao` e
 * `movel-caixao-aberto`), que é o que sai no Desenhado.
 *
 * - FECHADO: a caixa, a tampa um pouco mais alta e clara por cima, a emenda
 *   das duas tábuas no meio e as duas alças, uma de cada lado, trocadas na
 *   meia volta (a arte só tem 2 viradas). Materiais: `madeira` e `ferragens`.
 * - ABERTO: a caixa, o forro claro afundado por dentro, a tampa da cabeça
 *   (o terço de cima) fazendo sombra no forro e as duas alças dos pés.
 *   Material: `madeira`; o forro e as alças são fixos, como na arte.
 */
import { barra, caixa, dentroDe, poligono, type Forma, type Ponto } from './formas'
import { contato, type Cena, type MaterialDaPeca } from './motor'
import { BURACO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** Altura do caixão em casas. */
const ALTURA = 0.42
/** O ombro: a fração do comprimento, a partir da cabeça, onde o caixão é mais largo. */
const OMBRO = 0.26
/** Meia largura (fração da meia pegada) na cabeça, no ombro e no pé. */
const LARGURA_NA_CABECA = 0.62
const LARGURA_NO_OMBRO = 0.94
const LARGURA_NO_PE = 0.55
/** O casco da caixa e o da tampa (o fechado) ou do forro (o aberto), em fração da pegada. */
const CASCO_DA_CAIXA = 0.97
const CASCO_DA_TAMPA = 0.86
const CASCO_DO_FORRO = 0.8
/** O fim da tampa da cabeça do aberto, em fração do comprimento. */
const FIM_DA_TAMPA = 0.36
/** O forro: o linho do Meio-Termo, mais escuro (cetim velho), como o forro da arte. */
const FORRO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: rgb(tomDoMeio('linho', 0.9)) }
/** As alças do aberto, fixas: o ferro claro das ferragens da arte. */
const ALCA_FIXA: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.15)) }

/** O caixão na pegada: o comprimento corre em y (em pé) ou em x (deitado). */
interface Eixos {
  readonly meioC: number
  readonly meiaL: number
  /** O veio corre ao comprido. */
  readonly eixo: number
  /** (através, ao longo), em px do protótipo a partir do meio → (x, y). */
  em(atraves: number, aoLongo: number): Ponto
}

function eixosDo(c: ContextoDoMovel): Eixos {
  const deitado = c.w > c.h
  return {
    meioC: Math.max(c.hw, c.hh),
    meiaL: Math.min(c.hw, c.hh),
    eixo: deitado ? 0 : QUARTO,
    em: (atraves, aoLongo) => (deitado ? [aoLongo, atraves] : [atraves, aoLongo]),
  }
}

/** Meia largura (fração da meia pegada) no ponto `t` do comprimento, de -1 (cabeça) a 1 (pé). */
function larguraEm(t: number): number {
  const ombro = -1 + 2 * OMBRO
  if (t <= ombro) return LARGURA_NA_CABECA + ((t + 1) / (ombro + 1)) * (LARGURA_NO_OMBRO - LARGURA_NA_CABECA)
  return LARGURA_NO_OMBRO + ((t - ombro) / (1 - ombro)) * (LARGURA_NO_PE - LARGURA_NO_OMBRO)
}

/** O hexágono do caixão encolhido para `k` da pegada. */
function casco(e: Eixos, k: number): Forma {
  const ombro = (-1 + 2 * OMBRO) * e.meioC * k
  const C = e.meioC * k
  const L = e.meiaL * k
  return poligono([
    e.em(-LARGURA_NA_CABECA * L, -C),
    e.em(-LARGURA_NO_OMBRO * L, ombro),
    e.em(-LARGURA_NO_PE * L, C),
    e.em(LARGURA_NO_PE * L, C),
    e.em(LARGURA_NO_OMBRO * L, ombro),
    e.em(LARGURA_NA_CABECA * L, -C),
  ])
}

/** Um retângulo dado em (através, ao longo). */
function retangulo(e: Eixos, a0: number, l0: number, a1: number, l1: number, raio = 0): Forma {
  const [x0, y0] = e.em(a0, l0)
  const [x1, y1] = e.em(a1, l1)
  return caixa(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), raio)
}

/** A alça do lado `lado` (-1 ou 1) no ponto `t` do comprimento, encostada por fora na caixa. */
function alca(e: Eixos, lado: number, t: number): Forma {
  const borda = larguraEm(t) * e.meiaL * CASCO_DA_CAIXA
  const meioDaAlca = 0.09 * e.meioC
  const fora = 0.12 * e.meiaL
  return retangulo(e, lado * (borda - 0.02 * e.meiaL), t * e.meioC - meioDaAlca, lado * (borda + fora), t * e.meioC + meioDaAlca, 0.6)
}

/** A sombra no chão e o contato, pelo casco de fora. */
function sombraDoCaixao(c: ContextoDoMovel, e: Eixos, cena: Cena): void {
  const fora = casco(e, 1)
  cena.sombras.push({ forma: fora, z: c.g * ALTURA }, contato(fora))
}

/** A emenda das duas tábuas, ao comprido, de `l0` a `l1` (px ao longo), dentro de `dentro`. */
function emenda(e: Eixos, l0: number, l1: number, dentro: Forma): Forma {
  const [ax, ay] = e.em(0, l0)
  const [bx, by] = e.em(0, l1)
  return dentroDe(barra(ax, ay, bx, by, 0.9), dentro)
}

export const montarCaixao: MontarMovel = (c, cena) => {
  const P = c.peca
  const e = eixosDo(c)
  const mad = c.m.madeira
  sombraDoCaixao(c, e, cena)
  const L = cena.partes
  const tampa = casco(e, CASCO_DA_TAMPA)
  L.push(P(casco(e, CASCO_DA_CAIXA), mad, { eixo: e.eixo, tabua: 0, bisel: 1.6, contorno: 0.55, semente: 71 }))
  L.push(P(tampa, mad, { eixo: e.eixo, tabua: 0, bisel: 1.1, tom: 1.05, luz: 0.05, semente: 72 }))
  L.push(P(emenda(e, -e.meioC, e.meioC, tampa), BURACO, { bisel: 0, contorno: 0, alfa: 0.55 }))
  // Uma alça de cada lado, trocadas na meia volta (o desenho é o mesmo de cabeça para baixo).
  L.push(P(alca(e, 1, -0.3), c.m.ferragens, { bisel: 0.6, contorno: 0.35, semente: 73 }))
  L.push(P(alca(e, -1, 0.3), c.m.ferragens, { bisel: 0.6, contorno: 0.35, semente: 74 }))
}

export const montarCaixaoAberto: MontarMovel = (c, cena) => {
  const P = c.peca
  const e = eixosDo(c)
  const mad = c.m.madeira
  sombraDoCaixao(c, e, cena)
  const L = cena.partes
  const caixaDeFora = casco(e, CASCO_DA_CAIXA)
  L.push(P(caixaDeFora, mad, { eixo: e.eixo, tabua: 0, bisel: 1.4, contorno: 0.55, semente: 81 }))
  L.push(P(casco(e, CASCO_DO_FORRO), FORRO, { bisel: 0.8, contorno: 0.35, recesso: { k: 2.4, forca: 0.4 }, semente: 82 }))
  // A tampa da cabeça, deitada por cima do terço de cima, faz sombra no forro.
  const fimDaTampa = (-1 + 2 * FIM_DA_TAMPA) * e.meioC
  const tampa = dentroDe(caixaDeFora, retangulo(e, -e.meiaL, -e.meioC, e.meiaL, fimDaTampa))
  L.push(P(tampa, mad, { eixo: e.eixo, tabua: 0, bisel: 1.2, contorno: 0.55, tom: 1.06, luz: 0.05, projeta: { dist: 1.6, forca: 0.36 }, semente: 83 }))
  L.push(P(emenda(e, -e.meioC, fimDaTampa, tampa), BURACO, { bisel: 0, contorno: 0, alfa: 0.55 }))
  for (const lado of [-1, 1]) L.push(P(alca(e, lado, 0.41), ALCA_FIXA, { bisel: 0.6, contorno: 0.35, semente: 84 + lado }))
}
