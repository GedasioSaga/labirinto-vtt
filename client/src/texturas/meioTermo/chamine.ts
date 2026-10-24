import { aguaNoPonto, dentroDoPoligono, prepararAguas, type GeometriaDasAguas, type PontoDoTelhado } from '../../lib/telhado/aguas'
import { misturar, type Rgb } from '../ruido'
import { luminanciaDoRgb } from './barranco'
import { tonsDoMeio } from './tons'

/**
 * CHAMINÉ do telhado (Meio-Termo, fatia MT10), portada de
 * `docs/design/vila-meio-termo/prototipo/meio.js:500-537`: quadrada, de
 * PEDRA, com a face do lado da sombra aparecendo embaixo e à direita (o
 * volume), juntas finas, boca de METAL escura e uma sombra suave no telhado.
 *
 * Onde fica: na ÁGUA DE TRÁS (a borda de cima da sala, a que a vista de cima
 * mostra "atrás"), a 54% do caminho do beiral até o fim da água (o cume ou o
 * espigão), como o protótipo (0,46 da meia-fundura a partir do centro). O
 * protótipo a punha na metade da casa longe da porta; o pintor do telhado não
 * conhece as portas (só o polígono chega até ele), então ela fica na metade
 * da DIREITA, e só passa para a esquerda se não couber. A porta de fora é
 * desenhada por cima do telhado (`lib/telhado/portasDeFora.ts`), e a chaminé
 * fica no meio da água, longe da parede: não cobre porta.
 *
 * Tudo em px do mapa e por DISTÂNCIA COM SINAL, pixel a pixel (sem canvas):
 * pura, determinística e linha a linha (`pintarChamineNaLinha`), para dar os
 * mesmos bytes pintando de uma vez ou em fatias.
 */

/**
 * Lado da chaminé, em px do mapa: 0,4 da casa de referência de 50 px (MT10b,
 * pedido do usuário em 24/10: a de 11 px do protótipo parecia um respiro).
 */
export const LADO_DA_CHAMINE_PX = 20
/**
 * Na água rasa a chaminé encolhe até o lado do protótipo (11 px) e, abaixo
 * dele, não sai: toda sala que tinha chaminé antes da MT10b continua tendo.
 */
export const LADO_MINIMO_DA_CHAMINE_PX = 11
/** A chaminé ocupa no máximo esta fração da fundura da água (a casa pequena leva chaminé menor). */
const FRACAO_DA_FUNDURA = 0.4
/**
 * As medidas do desenho são as do protótipo para o lado de 11 px e crescem com
 * o lado (cantos, face, sombra, boca, juntas). Os TRAÇOS (contornos, luz,
 * largura da junta) são o peso do estilo e não crescem.
 */
const LADO_DO_PROTOTIPO = 11
const CANTO = 1.6
/** A face do lado da sombra: o corpo deslocado (o volume da pedra). */
const FACE_X = 1.2
const FACE_Y = 1.6
/** Sombra no telhado: deslocada pela altura, suave, a 30%. */
const SOMBRA_X = 3.4
const SOMBRA_Y = 4.2
const SOMBRA_ALFA = 0.3
const SOMBRA_BORRAO = 1.6
/** O traço do Meio-Termo é 72% do traço do Estilo Mother (`meio.js:87`). */
const TRACO = 0.72
const CONTORNO_DO_CORPO = 1.3 * TRACO
const CONTORNO_DA_FACE = 1 * TRACO
const LUZ = 1 * TRACO
const LARGURA_DA_LUZ = LUZ * 1.7
const JUNTA = 0.7
const JUNTA_ALFA = 0.4
/** As juntas das pedras: a fiada (horizontal) e as duas verticais, uma acima e outra abaixo dela. */
const JUNTA_DA_FIADA_Y = -1.2
const JUNTA_DE_CIMA_X = -1
const JUNTA_DE_BAIXO_X = 2.2
const BOCA = 2.8
const BOCA_CANTO = 1
const BOCA_CONTORNO = 1.1 * TRACO
const FURO = 1.9
const FURO_CANTO = 0.8
/** Fração do caminho do beiral até o fim da água (o protótipo: 1 − 0,46). */
const FRACAO_DA_ALTURA = 0.54
/** Onde, ao longo da borda de trás: a metade da direita (0,74) e, se não couber, a da esquerda. */
const AO_LONGO = 0.74
/** A água precisa ter pelo menos isto de fundura para a menor chaminé caber com folga (22 px, como antes). */
const FUNDURA_MINIMA = 2 * LADO_MINIMO_DA_CHAMINE_PX
/** Nenhum pixel do telhado fica abaixo desta luminância pela sombra da chaminé (`meio.js:86`). */
const PISO_DE_LUZ = 0.045

export interface ChamineNoTelhado {
  /** Centro do corpo, em px do mapa. */
  readonly x: number
  readonly y: number
  /** Lado do corpo, em px do mapa (de `LADO_MINIMO_DA_CHAMINE_PX` a `LADO_DA_CHAMINE_PX`). */
  readonly lado: number
}

/** Quanto as medidas do protótipo crescem nesta chaminé. */
function fator(c: ChamineNoTelhado): number {
  return c.lado / LADO_DO_PROTOTIPO
}

export interface CaixaNoMapa {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/** A caixa do corpo com a face (o que a prova de presença mede). */
export function caixaDaChamine(c: ChamineNoTelhado): CaixaNoMapa {
  const meio = c.lado / 2
  const s = fator(c)
  return { x0: c.x - meio, y0: c.y - meio, x1: c.x + meio + FACE_X * s, y1: c.y + meio + FACE_Y * s }
}

/** Tudo o que a chaminé pode pintar (corpo, contorno, face e sombra): fora disto nenhum byte muda. */
export function alcanceDaChamine(c: ChamineNoTelhado): CaixaNoMapa {
  const meio = c.lado / 2
  const s = fator(c)
  const folga = CONTORNO_DO_CORPO
  return {
    x0: c.x - meio - folga - 1,
    y0: c.y - meio - folga - 1,
    x1: c.x + meio + Math.max(FACE_X * s + CONTORNO_DA_FACE, (SOMBRA_X + SOMBRA_BORRAO) * s) + 1,
    y1: c.y + meio + Math.max(FACE_Y * s + CONTORNO_DA_FACE, (SOMBRA_Y + SOMBRA_BORRAO) * s) + 1,
  }
}

/**
 * O ponto (px do mapa) cai na pedra da chaminé (corpo ou face)? Na caixa, o
 * resto são os dentes entre o corpo e a face e os cantos arredondados: telhado,
 * às vezes com a sombra (que tem o piso de luz próprio, 0,045).
 */
export function dentroDaChamine(c: ChamineNoTelhado, x: number, y: number): boolean {
  const meio = c.lado / 2
  const s = fator(c)
  return (
    distanciaAoRetangulo(x, y, c.x, c.y, meio, meio, CANTO * s) <= 0 ||
    distanciaAoRetangulo(x, y, c.x + FACE_X * s, c.y + FACE_Y * s, meio, meio, CANTO * s) <= 0
  )
}

/** Os lados a tentar, do maior que a fundura deixa até o mínimo (de 1 em 1 px, o mínimo sempre por último). */
function ladosPossiveis(fundura: number): number[] {
  const maior = Math.min(LADO_DA_CHAMINE_PX, Math.max(LADO_MINIMO_DA_CHAMINE_PX, FRACAO_DA_FUNDURA * fundura))
  const lados: number[] = []
  for (let lado = maior; lado > LADO_MINIMO_DA_CHAMINE_PX; lado -= 1) lados.push(lado)
  lados.push(LADO_MINIMO_DA_CHAMINE_PX)
  return lados
}

/** A borda de trás: a de normal de dentro mais para baixo (a borda de cima); empate, a mais comprida. */
function bordaDeTras(geo: GeometriaDasAguas): number {
  let melhor = -1
  for (let i = 0; i < geo.n; i += 1) {
    if (geo.comprimento[i] < FUNDURA_MINIMA) continue
    if (melhor < 0 || geo.ny[i] > geo.ny[melhor] + 0.01 || (Math.abs(geo.ny[i] - geo.ny[melhor]) <= 0.01 && geo.comprimento[i] > geo.comprimento[melhor])) melhor = i
  }
  return melhor
}

/** Onde a chaminé fica neste telhado, ou `null` (sala pequena demais, polígono quebrado). */
export function posicaoDaChamine(geo: GeometriaDasAguas): ChamineNoTelhado | null {
  const i = bordaDeTras(geo)
  if (i < 0 || geo.ny[i] <= 0) return null
  const L = geo.comprimento[i]
  // A primeira fração é a que cai à direita.
  const fracoes = geo.dx[i] >= 0 ? [AO_LONGO, 1 - AO_LONGO] : [1 - AO_LONGO, AO_LONGO]
  for (const f of fracoes) {
    const px = geo.ax[i] + geo.dx[i] * f * L
    const py = geo.ay[i] + geo.dy[i] * f * L
    // A fundura da água ali: anda para dentro até a água mudar de dona (o cume ou o espigão).
    let fundura = 0
    for (let h = 1; h < 4096; h += 1) {
      if (aguaNoPonto(geo, px + geo.nx[i] * h, py + geo.ny[i] * h).agua !== i) break
      fundura = h
    }
    if (fundura < FUNDURA_MINIMA) continue
    const h = FRACAO_DA_ALTURA * fundura
    for (const lado of ladosPossiveis(fundura)) {
      const c = { x: px + geo.nx[i] * h, y: py + geo.ny[i] * h, lado }
      const a = alcanceDaChamine(c)
      const cabe = [
        [a.x0, a.y0],
        [a.x1, a.y0],
        [a.x0, a.y1],
        [a.x1, a.y1],
      ].every(([x, y]) => dentroDoPoligono(geo, x, y))
      if (cabe) return c
    }
  }
  return null
}

/** O mesmo, a partir do polígono (para os testes e a folha de contato). */
export function chamineDoPoligono(poligono: readonly PontoDoTelhado[]): ChamineNoTelhado | null {
  const geo = prepararAguas(poligono)
  return geo === null ? null : posicaoDaChamine(geo)
}

// ---------- desenho ----------

/** Distância com sinal até um retângulo de cantos arredondados (centro, meia-largura, meia-altura, raio). */
function distanciaAoRetangulo(x: number, y: number, cx: number, cy: number, mx: number, my: number, r: number): number {
  const qx = Math.abs(x - cx) - (mx - r)
  const qy = Math.abs(y - cy) - (my - r)
  const ox = qx > 0 ? qx : 0
  const oy = qy > 0 ? qy : 0
  const dentro = qx > qy ? qx : qy
  return Math.sqrt(ox * ox + oy * oy) + (dentro < 0 ? dentro : 0) - r
}

/** Distância até o segmento AB. */
function distanciaAoSegmento(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax
  const vy = by - ay
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)))
  return Math.hypot(x - ax - vx * t, y - ay - vy * t)
}

function cobertura(d: number, k: number): number {
  const c = 0.5 - d * k
  return c <= 0 ? 0 : c >= 1 ? 1 : c
}

/** Cobertura de um traço de `largura` centrado onde `d` = 0. */
function traco(d: number, largura: number, k: number): number {
  return cobertura(Math.abs(d) - largura / 2, k)
}

function suave(t: number): number {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

const PEDRA = tonsDoMeio('pedra')
const METAL = tonsDoMeio('metal')
const FACE = misturar(PEDRA.base, PEDRA.contorno, 0.45)
const LINHA_DA_JUNTA = PEDRA.contorno

/** `cor` sobre o pixel `o`, com a cobertura `t` (RGB; o alfa do telhado fica). */
function pintarCor(p: Uint8ClampedArray, o: number, cor: Rgb, t: number): void {
  if (t <= 0) return
  p[o] = p[o] + (cor[0] - p[o]) * t
  p[o + 1] = p[o + 1] + (cor[1] - p[o + 1]) * t
  p[o + 2] = p[o + 2] + (cor[2] - p[o + 2]) * t
}

/** Escurece o pixel pela sombra, sem deixar a luminância cair abaixo do piso. */
function sombrear(p: Uint8ClampedArray, o: number, t: number): void {
  if (t <= 0 || p[o + 3] === 0) return
  let f = 1 - SOMBRA_ALFA * t
  const antes = luminanciaDoRgb([p[o], p[o + 1], p[o + 2]])
  if (antes * f ** 2.2 < PISO_DE_LUZ) f = antes <= PISO_DE_LUZ ? 1 : Math.min(1, (PISO_DE_LUZ / antes) ** (1 / 2.2))
  p[o] *= f
  p[o + 1] *= f
  p[o + 2] *= f
}

/**
 * Pinta a parte da chaminé que cai na linha `py` da imagem do telhado, POR
 * CIMA do que já está lá (o telhado da linha já pintado). A ordem é a do
 * protótipo: sombra no telhado, face, corpo (luz e sombra por dentro, juntas,
 * contorno) e a boca de metal.
 */
export function pintarChamineNaLinha(
  pixels: Uint8ClampedArray,
  largura: number,
  origemX: number,
  origemY: number,
  k: number,
  py: number,
  c: ChamineNoTelhado,
): void {
  const passo = 1 / k
  const y = origemY + (py + 0.5) * passo
  const a = alcanceDaChamine(c)
  if (y < a.y0 || y > a.y1) return
  const meio = c.lado / 2
  const s = fator(c)
  const canto = CANTO * s
  const fiada = c.y + JUNTA_DA_FIADA_Y * s
  const px0 = Math.max(0, Math.floor((a.x0 - origemX) * k))
  const px1 = Math.min(largura - 1, Math.ceil((a.x1 - origemX) * k))
  for (let px = px0; px <= px1; px += 1) {
    const x = origemX + (px + 0.5) * passo
    const o = (py * largura + px) * 4
    if (pixels[o + 3] === 0) continue
    // 1. Sombra no telhado (suave, deslocada pela altura).
    const dSombra = distanciaAoRetangulo(x, y, c.x + SOMBRA_X * s, c.y + SOMBRA_Y * s, meio, meio, canto)
    sombrear(pixels, o, suave(0.5 - dSombra / (SOMBRA_BORRAO * s)))
    // 2. A face do lado da sombra, com o contorno dela.
    const dFace = distanciaAoRetangulo(x, y, c.x + FACE_X * s, c.y + FACE_Y * s, meio, meio, canto)
    pintarCor(pixels, o, FACE, cobertura(dFace, k))
    pintarCor(pixels, o, PEDRA.contorno, traco(dFace, CONTORNO_DA_FACE, k))
    // 3. O corpo: pedra, realce por dentro em cima e à esquerda, sombra embaixo e à direita, juntas, contorno.
    const dCorpo = distanciaAoRetangulo(x, y, c.x, c.y, meio, meio, canto)
    const corpo = cobertura(dCorpo, k)
    if (corpo > 0) {
      pintarCor(pixels, o, PEDRA.base, corpo)
      const dRealce = distanciaAoRetangulo(x - LUZ, y - LUZ, c.x, c.y, meio, meio, canto)
      pintarCor(pixels, o, PEDRA.realce, traco(dRealce, LARGURA_DA_LUZ, k) * corpo)
      const dSombraDentro = distanciaAoRetangulo(x + LUZ, y + LUZ, c.x, c.y, meio, meio, canto)
      pintarCor(pixels, o, PEDRA.sombra, traco(dSombraDentro, LARGURA_DA_LUZ, k) * corpo)
      const dJunta = Math.min(
        distanciaAoSegmento(x, y, c.x - meio, fiada, c.x + meio, fiada),
        distanciaAoSegmento(x, y, c.x + JUNTA_DE_CIMA_X * s, c.y - meio, c.x + JUNTA_DE_CIMA_X * s, fiada),
        distanciaAoSegmento(x, y, c.x + JUNTA_DE_BAIXO_X * s, fiada, c.x + JUNTA_DE_BAIXO_X * s, c.y + meio),
      )
      pintarCor(pixels, o, LINHA_DA_JUNTA, traco(dJunta, JUNTA, k) * JUNTA_ALFA * corpo)
    }
    pintarCor(pixels, o, PEDRA.contorno, traco(dCorpo, CONTORNO_DO_CORPO, k))
    // 4. A boca de metal e o furo escuro.
    const dBoca = distanciaAoRetangulo(x, y, c.x, c.y, BOCA * s, BOCA * s, BOCA_CANTO * s)
    pintarCor(pixels, o, METAL.base, cobertura(dBoca, k))
    pintarCor(pixels, o, METAL.contorno, traco(dBoca, BOCA_CONTORNO, k))
    pintarCor(pixels, o, METAL.contorno, cobertura(distanciaAoRetangulo(x, y, c.x, c.y, FURO * s, FURO * s, FURO_CANTO * s), k))
  }
}
