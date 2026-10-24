import type { GeometriaDasAguas } from '../../lib/telhado/aguas'
import { passoSuave } from '../ruido'

/**
 * CUMEEIRA AMARRADA da palha (Meio-Termo; reabre na MT10, seção "MT6
 * medido" do plano), portada de `vila-estilo-mother/prototipo/mother.js:1026-1038`:
 * uma faixa de palha em feixe sobre o cume, de 3,4 px para cada lado, com uma
 * amarra a cada 9 px. Só na CUMEEIRA (emenda entre águas opostas), não no
 * espigão nem no rincão. `texturas/telhado.ts` pinta POR CIMA, depois do laço
 * de cada linha, só nos pixels a até 3,4 px do cume (todos do bloco lento:
 * a folga do bloco rápido continua a mesma).
 */

/** Meia-largura da faixa, em px do mapa (o raio da cápsula do protótipo). */
export const LARGURA_DA_CUMEEIRA_AMARRADA_PX = 3.4
/** Uma amarra a cada isto, ao longo do cume. */
export const PASSO_DA_AMARRA_PX = 9
/** A amarra cruza a faixa até esta distância do cume (o traço de 6 px do protótipo). */
const ALCANCE_DA_AMARRA = 3
const MEIA_LARGURA_DA_AMARRA = 0.5
/** O contorno da faixa, na própria cor (1,3 px do protótipo, no traço de 72% do Meio-Termo). */
const CONTORNO = 1.3 * 0.72
/** Luz do feixe: o lado virado para a luz clareia, o outro escurece (o realce e a sombra do protótipo). */
const LUZ_DO_LADO_CLARO = 0.09
const LUZ_DO_LADO_ESCURO = -0.06
const ESCURO_DO_CONTORNO = 0.25
const ESCURO_DA_AMARRA = 0.22
/** O escuro somado nunca passa disto (piso de luz: a palha mais escura fica acima de 0,06). */
export const ESCURO_MAXIMO_DA_CUMEEIRA = 0.3

/** A emenda entre as águas `a` e `b` é cumeeira (águas opostas)? */
export function ehCumeeira(geo: GeometriaDasAguas, a: number, b: number): boolean {
  return geo.nx[a] * geo.nx[b] + geo.ny[a] * geo.ny[b] < -0.5
}

/**
 * A posição ao longo do cume (px do mapa), a mesma dos dois lados: a direção
 * da emenda é perpendicular a (n da água de menor índice − n da outra).
 */
export function posicaoAoLongoDoCume(geo: GeometriaDasAguas, a: number, b: number, x: number, y: number): number {
  const lo = a < b ? a : b
  const hi = a < b ? b : a
  const vx = geo.nx[lo] - geo.nx[hi]
  const vy = geo.ny[lo] - geo.ny[hi]
  const n = Math.hypot(vx, vy) || 1
  return (x * -vy + y * vx) / n
}

/** Quanto da faixa cobre o pixel a `ate` px do cume (antialias só para dentro: zero a partir de 3,4 px). */
export function coberturaDaCumeeira(ate: number, k: number): number {
  const c = (LARGURA_DA_CUMEEIRA_AMARRADA_PX - ate) * k
  return c <= 0 ? 0 : c >= 1 ? 1 : c
}

/** A variação de luz da faixa no pixel (sem o grão), já com o piso do escuro. */
export function luzDaCumeeira(ate: number, aoLongo: number, ladoClaro: boolean, k: number): number {
  const r = ate / LARGURA_DA_CUMEEIRA_AMARRADA_PX
  let luz = (ladoClaro ? LUZ_DO_LADO_CLARO : LUZ_DO_LADO_ESCURO) * (1 - r * r)
  luz -= ESCURO_DO_CONTORNO * passoSuave(LARGURA_DA_CUMEEIRA_AMARRADA_PX - CONTORNO, LARGURA_DA_CUMEEIRA_AMARRADA_PX, ate)
  const ateAmarra = Math.abs(aoLongo - PASSO_DA_AMARRA_PX * Math.round(aoLongo / PASSO_DA_AMARRA_PX))
  const naAmarra = Math.min(1, Math.max(0, (MEIA_LARGURA_DA_AMARRA - ateAmarra) * k + 0.5))
  const dentroDaAmarra = Math.min(1, Math.max(0, (ALCANCE_DA_AMARRA - ate) * k + 0.5))
  luz -= ESCURO_DA_AMARRA * naAmarra * dentroDaAmarra
  return luz
}
